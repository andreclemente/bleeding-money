import { describe, expect, it } from 'vitest'
import { buildContractDecisionDossier, buildContractDecisionSignal, buildExpenseLifecycle } from '../../domain/expense-lifecycle'
import type { ExpenseSnapshot, RecurringExpense } from '../../domain/types'

const expense = (overrides: Partial<RecurringExpense> = {}): RecurringExpense => ({
  id: 'expense-1',
  userId: 'user-1',
  category: 'telecom',
  provider: 'Fornecedor',
  productName: 'Fibra',
  monthlyCostCents: 4890,
  billingFrequency: 'monthly',
  currency: 'EUR',
  contractStartDate: '2024-01-01',
  commitmentEndDate: '2026-04-01',
  details: { kind: 'telecom', connectionType: 'fiber', downloadSpeedMbps: 500 },
  createdAt: '2024-01-01T12:00:00.000Z',
  updatedAt: '2026-08-01T12:00:00.000Z',
  ...overrides
})

const snapshot = (id: string, observedAt: string, priceCents: number): ExpenseSnapshot => ({
  id,
  expenseId: 'expense-1',
  observedAt,
  priceCents,
  plan: 'Fibra 500',
  properties: {},
  source: 'manual'
})

describe('linha de vida da despesa', () => {
  it('ordena observações e calcula apenas variações confirmadas entre valores registados', () => {
    const lifecycle = buildExpenseLifecycle(expense(), [
      snapshot('latest', '2026-08-01', 4890),
      snapshot('first', '2024-01-01', 3690),
      snapshot('middle', '2025-07-01', 4190)
    ])

    expect(lifecycle.annualEquivalentCents).toBe(58_680)
    expect(lifecycle.observations.map(item => item.snapshot.id)).toEqual(['first', 'middle', 'latest'])
    expect(lifecycle.observations.map(item => item.change)).toEqual([
      null,
      { cents: 500, basisPoints: 1355 },
      { cents: 700, basisPoints: 1671 }
    ])
  })

  it('separa renovação, fim de fidelização e fim de contrato sem inventar datas', () => {
    const insurance = expense({
      category: 'insurance',
      commitmentEndDate: '2026-03-01',
      contractEndDate: '2026-12-31',
      details: { kind: 'insurance', policyType: 'home', renewalDate: '2026-11-15', coverageCodes: ['building'] }
    })

    expect(buildExpenseLifecycle(insurance, []).decisionDates).toEqual([
      { kind: 'commitment', label: 'Fim da fidelização', date: '2026-03-01' },
      { kind: 'renewal', label: 'Próxima renovação', date: '2026-11-15' },
      { kind: 'contract', label: 'Fim do contrato', date: '2026-12-31' }
    ])
  })

  it('mantém a linha de vida honesta quando ainda não existe histórico', () => {
    const lifecycle = buildExpenseLifecycle(expense({ monthlyCostCents: 1199, contractStartDate: undefined, commitmentEndDate: undefined }), [])

    expect(lifecycle.observations).toEqual([])
    expect(lifecycle.decisionDates).toEqual([])
    expect(lifecycle.annualEquivalentCents).toBe(14_388)
  })

  it('destaca o próximo prazo declarado com uma ação verificável', () => {
    const signal = buildContractDecisionSignal([
      { kind: 'commitment', label: 'Fim da fidelização', date: '2026-10-01' },
      { kind: 'renewal', label: 'Próxima renovação', date: '2026-10-20' },
      { kind: 'contract', label: 'Fim do contrato', date: '2027-01-31' }
    ], '2026-10-14')

    expect(signal).toEqual({
      event: { kind: 'renewal', label: 'Próxima renovação', date: '2026-10-20' },
      timing: 'soon',
      days: 6,
      timingLabel: 'Daqui a 6 dias',
      action: 'Confirma as condições de renovação junto do fornecedor.'
    })
  })

  it('assinala o último prazo passado sem inventar uma nova data', () => {
    const signal = buildContractDecisionSignal([
      { kind: 'commitment', label: 'Fim da fidelização', date: '2026-09-01' },
      { kind: 'contract', label: 'Fim do contrato', date: '2026-10-10' }
    ], '2026-10-14')

    expect(signal).toEqual({
      event: { kind: 'contract', label: 'Fim do contrato', date: '2026-10-10' },
      timing: 'passed',
      days: 4,
      timingLabel: 'Passou há 4 dias',
      action: 'Confirma o estado atual do contrato e corrige a data se renovou.'
    })
    expect(buildContractDecisionSignal([], '2026-10-14')).toBeNull()
  })

  it('prepara a decisão de telecomunicações apenas com evidência do contrato atual', () => {
    expect(buildContractDecisionDossier(expense())).toEqual({
      title: 'Leva estes factos para a conversa',
      evidence: [
        'Última fatura ou extrato com o valor atual',
        'Resumo do contrato com fidelização e serviços incluídos',
        'Linhas, equipamentos e extras que aparecem na fatura'
      ],
      rule: 'Serve para confirmar condições. Não estima nem confirma poupanças.'
    })
  })

  it('torna a preparação de seguros auditável por coberturas e condições', () => {
    const insurance = expense({
      category: 'insurance',
      details: { kind: 'insurance', policyType: 'home', renewalDate: '2026-11-15', coverageCodes: ['building'] }
    })

    expect(buildContractDecisionDossier(insurance).evidence).toEqual([
      'Último recibo ou aviso com o prémio atual',
      'Condições particulares com capitais, coberturas, exclusões e franquias',
      'Aviso de renovação, se já foi recebido'
    ])
  })
})
