import { describe, expect, it } from 'vitest'
import { buildContractAgendaGapQueue, buildContractAgendaPatch, buildContractRadar, getNextDeclaredContractDate } from '../../domain/contract-agenda'
import type { RecurringExpense } from '../../domain/types'

const insurance: RecurringExpense = {
  id: 'expense-1',
  userId: 'user-1',
  category: 'insurance',
  provider: 'Seguradora',
  productName: 'Casa',
  monthlyCostCents: 2400,
  billingFrequency: 'monthly',
  currency: 'EUR',
  contractStartDate: '2025-01-01',
  commitmentEndDate: '2026-01-01',
  details: { kind: 'insurance', policyType: 'home', renewalDate: '2026-11-15', coverageCodes: ['building', 'contents'] },
  createdAt: '2025-01-01T10:00:00.000Z',
  updatedAt: '2025-01-01T10:00:00.000Z'
}

describe('agenda contratual', () => {
  it('atualiza os prazos declarados sem perder os dados auditáveis do seguro', () => {
    expect(buildContractAgendaPatch(insurance, {
      commitmentEndDate: '2026-02-01',
      contractEndDate: '2027-01-01',
      renewalDate: '2026-12-15'
    })).toEqual({
      commitmentEndDate: '2026-02-01',
      contractEndDate: '2027-01-01',
      details: { kind: 'insurance', policyType: 'home', renewalDate: '2026-12-15', coverageCodes: ['building', 'contents'] }
    })
  })

  it('rejeita datas impossíveis e submissões sem alterações', () => {
    expect(() => buildContractAgendaPatch(insurance, { renewalDate: '2026-02-31' })).toThrow(/Data inválida/)
    expect(() => buildContractAgendaPatch(insurance, {
      commitmentEndDate: '2026-01-01',
      renewalDate: '2026-11-15'
    })).toThrow(/data diferente/i)
  })

  it('permite retirar prazos que os documentos não sustentam sem apagar os restantes factos', () => {
    expect(buildContractAgendaPatch(insurance, {
      clearCommitmentEndDate: true,
      clearRenewalDate: true
    })).toEqual({
      commitmentEndDate: null,
      details: { kind: 'insurance', policyType: 'home', coverageCodes: ['building', 'contents'] }
    })
  })

  it('leva todos os prazos contratuais próximos para o radar, não apenas renovações de seguros', () => {
    const telecom: RecurringExpense = {
      ...insurance,
      id: 'expense-2',
      category: 'telecom',
      provider: 'Operador',
      productName: 'Fibra',
      commitmentEndDate: '2026-10-20',
      contractEndDate: '2026-11-10',
      details: { kind: 'telecom', connectionType: 'fiber', downloadSpeedMbps: 500 }
    }

    expect(buildContractRadar([insurance, telecom], '2026-10-15', 45)).toEqual([
      {
        expenseId: 'expense-2',
        productName: 'Fibra',
        provider: 'Operador',
        kind: 'commitment',
        label: 'Fim da fidelização',
        date: '2026-10-20',
        daysUntil: 5,
        action: 'Preparar renegociação ou mudança.'
      },
      {
        expenseId: 'expense-2',
        productName: 'Fibra',
        provider: 'Operador',
        kind: 'contract',
        label: 'Fim do contrato',
        date: '2026-11-10',
        daysUntil: 26,
        action: 'Confirmar continuação ou termo.'
      },
      {
        expenseId: 'expense-1',
        productName: 'Casa',
        provider: 'Seguradora',
        kind: 'renewal',
        label: 'Próxima renovação',
        date: '2026-11-15',
        daysUntil: 31,
        action: 'Confirmar condições de renovação.'
      }
    ])
  })

  it('exclui prazos passados ou fora da janela sem inventar alertas', () => {
    expect(buildContractRadar([insurance], '2026-12-01', 45)).toEqual([])
    expect(() => buildContractRadar([insurance], '2026-02-31', 45)).toThrow(/Data civil inválida/)
  })

  it('identifica o próximo prazo declarado para o inventário, independentemente da categoria', () => {
    const telecom: RecurringExpense = {
      ...insurance,
      category: 'telecom',
      commitmentEndDate: '2026-10-20',
      contractEndDate: '2026-11-10',
      details: { kind: 'telecom', connectionType: 'fiber', downloadSpeedMbps: 500 }
    }

    expect(getNextDeclaredContractDate(telecom, '2026-10-15')).toEqual({
      kind: 'commitment',
      label: 'Fim da fidelização',
      date: '2026-10-20'
    })
    expect(getNextDeclaredContractDate(telecom, '2026-12-01')).toBeNull()
  })

  it('separa contratos sem agenda dos que só têm prazos passados, sem inventar datas', () => {
    const missing: RecurringExpense = {
      ...insurance,
      id: 'expense-missing',
      category: 'subscription',
      productName: 'Cloud',
      commitmentEndDate: undefined,
      details: { kind: 'subscription', plan: 'Pro' }
    }
    const stale: RecurringExpense = {
      ...insurance,
      id: 'expense-stale',
      category: 'telecom',
      productName: 'Fibra',
      commitmentEndDate: '2026-09-01',
      contractEndDate: '2026-10-01',
      details: { kind: 'telecom', connectionType: 'fiber', downloadSpeedMbps: 500 }
    }
    const future = { ...insurance, id: 'expense-future', commitmentEndDate: undefined }

    expect(buildContractAgendaGapQueue([future, stale, missing], '2026-10-15')).toEqual([
      {
        expenseId: 'expense-stale',
        productName: 'Fibra',
        provider: 'Seguradora',
        status: 'stale',
        label: 'Prazo passado por confirmar',
        action: 'Confirma se o contrato renovou e regista a próxima data real.',
        lastDeclaredDate: '2026-10-01'
      },
      {
        expenseId: 'expense-missing',
        productName: 'Cloud',
        provider: 'Seguradora',
        status: 'missing',
        label: 'Agenda não declarada',
        action: 'Regista uma data contratual apenas se constar do contrato ou aviso.',
        lastDeclaredDate: null
      }
    ])
  })
})
