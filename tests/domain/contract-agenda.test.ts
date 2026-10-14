import { describe, expect, it } from 'vitest'
import { buildContractAgendaPatch } from '../../domain/contract-agenda'
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
})
