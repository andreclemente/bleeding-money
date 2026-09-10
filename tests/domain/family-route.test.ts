import { describe, expect, it } from 'vitest'
import { buildFamilyRoute } from '../../domain/family-route'
import type { MonthlySpendPeriod } from '../../domain/spending'
import type { RecurringExpense, SavingAction, SavingsFinding } from '../../domain/types'

const expense = (id: string, overrides: Partial<RecurringExpense> = {}): RecurringExpense => ({
  id,
  userId: 'owner-1',
  category: 'telecom',
  provider: 'Fornecedor',
  productName: `Contrato ${id}`,
  monthlyCostCents: 4599,
  billingFrequency: 'monthly',
  currency: 'EUR',
  details: { kind: 'telecom', connectionType: 'fibra', downloadSpeedMbps: 500 },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...overrides
})

const finding = (id: string, expenseId: string, overrides: Partial<SavingsFinding> = {}): SavingsFinding => ({
  id,
  expenseId,
  type: 'NEGOTIATION_OPPORTUNITY',
  title: `Caso ${id}`,
  description: 'Descrição factual',
  estimatedMonthlySavingMinCents: 500,
  estimatedMonthlySavingMaxCents: 1000,
  estimatedAnnualSavingMinCents: 6000,
  estimatedAnnualSavingMaxCents: 12000,
  confidence: 0.8,
  severity: 'medium',
  priority: 50,
  effort: 'low',
  urgency: 'medium',
  action: 'Rever manualmente',
  evidence: ['Dado introduzido pelo utilizador'],
  status: 'open',
  createdAt: '2026-09-01T00:00:00.000Z',
  ...overrides
})

const period = (month: string, amounts: MonthlySpendPeriod['amounts']): MonthlySpendPeriod => ({
  id: `period-${month}`,
  userId: 'owner-1',
  month,
  status: 'complete',
  supermarketCoverage: 'food_only',
  amountBasis: 'statement_or_receipts',
  country: 'PT',
  adults: 2,
  dependents: 1,
  adultBand: '2',
  dependentBand: '1',
  createdAt: `${month}T00:00:00.000Z`,
  updatedAt: `${month}T00:00:00.000Z`,
  amounts
})

const amount = (id: string, periodId: string, overrides: Partial<MonthlySpendPeriod['amounts'][number]> = {}): MonthlySpendPeriod['amounts'][number] => ({
  id,
  periodId,
  category: 'supermarket_total',
  scope: 'supermarket',
  amountCents: 50000,
  trackingIntent: 'track_only',
  ...overrides
})

describe('Rota Familiar', () => {
  it('seleciona exatamente uma ação pela ordem congelada e por dias civis', () => {
    const insuranceSoon = expense('insurance-soon', {
      category: 'insurance',
      details: { kind: 'insurance', policyType: 'home', renewalDate: '2026-09-24', coverageCodes: ['building'] }
    })
    const insuranceLater = expense('insurance-later', {
      category: 'insurance',
      details: { kind: 'insurance', policyType: 'car', renewalDate: '2026-10-14', coverageCodes: ['civil_liability'] }
    })
    const estimated = finding('estimated', 'contract')
    const factual = finding('factual', 'contract-2', {
      estimatedMonthlySavingMinCents: 0,
      estimatedMonthlySavingMaxCents: 0,
      estimatedAnnualSavingMinCents: 0,
      estimatedAnnualSavingMaxCents: 0
    })
    const latest = period('2026-09-01', [amount('target', 'period-2026-09-01', { trackingIntent: 'reduce', userTargetCents: 42000 })])

    const route = buildFamilyRoute({
      civilDate: '2026-09-09',
      expenses: [insuranceSoon, insuranceLater, expense('contract'), expense('contract-2')],
      findings: [estimated, factual],
      actions: [],
      periods: [latest],
      goal: null
    })

    expect(route.nextAction).toMatchObject({ kind: 'insurance_renewal', expenseId: 'insurance-soon', daysUntil: 15 })
  })

  it('agrupa findings abertos num único caso por despesa sem somar intervalos sobrepostos', () => {
    const lowerPriority = finding('lower', 'contract', { priority: 40, estimatedMonthlySavingMinCents: 300, estimatedMonthlySavingMaxCents: 900 })
    const higherPriority = finding('higher', 'contract', { priority: 90, estimatedMonthlySavingMinCents: 500, estimatedMonthlySavingMaxCents: 1200 })
    const other = finding('other', 'contract-2', { estimatedMonthlySavingMinCents: 200, estimatedMonthlySavingMaxCents: 400 })

    const route = buildFamilyRoute({
      civilDate: '2026-09-09',
      expenses: [expense('contract'), expense('contract-2')],
      findings: [lowerPriority, higherPriority, other],
      actions: [],
      periods: [],
      goal: null
    })

    expect(route.cases.map(item => item.finding.id)).toEqual(['higher', 'other'])
    expect(route.identifiedMonthlyRangeCents).toEqual({ minCents: 700, maxCents: 1600 })
    expect(route.nextAction).toMatchObject({ kind: 'estimated_finding', findingId: 'higher', expenseId: 'contract' })
  })

  it('prefere o caso estimado ao factual da mesma despesa na fase de estimativas', () => {
    const factual = finding('factual-high', 'contract', {
      priority: 99,
      estimatedMonthlySavingMinCents: 0,
      estimatedMonthlySavingMaxCents: 0,
      estimatedAnnualSavingMinCents: 0,
      estimatedAnnualSavingMaxCents: 0
    })
    const estimated = finding('estimated-low', 'contract', { priority: 20 })

    const route = buildFamilyRoute({ civilDate: '2026-09-09', expenses: [expense('contract')], findings: [factual, estimated], actions: [], periods: [], goal: null })

    expect(route.cases.map(item => item.finding.id)).toEqual(['estimated-low'])
    expect(route.nextAction.kind).toBe('estimated_finding')
  })

  it('mantém confirmado, intervalo identificado e plano condicional separados e exclui habitação do plano', () => {
    const resolved = finding('resolved', 'contract', { status: 'resolved', resolvedAt: '2026-09-02T00:00:00.000Z' })
    const actions: SavingAction[] = [{ id: 'action-1', findingId: resolved.id, previousCostCents: 4599, newCostCents: 3599, actionDate: '2026-09-02', annualSavingCents: 12000, createdAt: '2026-09-02T00:00:00.000Z' }]
    const latest = period('2026-09-01', [
      amount('market', 'period-2026-09-01', { trackingIntent: 'reduce', userTargetCents: 42000 }),
      amount('housing', 'period-2026-09-01', { category: 'rent', scope: 'housing', amountCents: 90000, trackingIntent: 'track_only' })
    ])

    const route = buildFamilyRoute({
      civilDate: '2026-09-09',
      expenses: [expense('contract')],
      findings: [resolved],
      actions,
      periods: [latest],
      goal: { id: 'goal-1', userId: 'owner-1', name: 'Fundo familiar', targetAnnualCents: 60000, confirmedAnnualCents: 12000, remainingAnnualCents: 48000, percentage: 20, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' }
    })

    expect(route.confirmedAnnualCents).toBe(12000)
    expect(route.identifiedMonthlyRangeCents).toEqual({ minCents: 0, maxCents: 0 })
    expect(route.conditionalAnnualPlanCents).toBe(96000)
    expect(route.goal?.confirmedAnnualCents).toBe(12000)
    expect(route.nextAction.kind).toBe('spending_limit_experiment')
  })

  it('prioriza renovação a 16-45 dias depois de casos estimados e antes de limites', () => {
    const renewal = expense('insurance', {
      category: 'insurance',
      details: { kind: 'insurance', policyType: 'car', renewalDate: '2026-10-24', coverageCodes: ['civil_liability'] }
    })
    const latest = period('2026-09-01', [amount('target', 'period-2026-09-01', { trackingIntent: 'reduce', userTargetCents: 45000 })])
    const base = { civilDate: '2026-09-09', expenses: [renewal, expense('contract')], actions: [], periods: [latest], goal: null }

    expect(buildFamilyRoute({ ...base, findings: [finding('estimated', 'contract')] }).nextAction.kind).toBe('estimated_finding')
    expect(buildFamilyRoute({ ...base, findings: [] }).nextAction).toMatchObject({ kind: 'insurance_renewal', daysUntil: 45 })
  })

  it('propõe factos, construção de histórico e estado vazio sem fabricar perda', () => {
    const factual = finding('factual', 'contract', {
      estimatedMonthlySavingMinCents: 0,
      estimatedMonthlySavingMaxCents: 0,
      estimatedAnnualSavingMinCents: 0,
      estimatedAnnualSavingMaxCents: 0
    })
    const latest = period('2026-09-01', [amount('market-latest', 'period-2026-09-01')])
    const comparableOne = period('2026-08-01', [amount('market-1', 'period-2026-08-01')])
    const comparableTwo = period('2026-07-01', [amount('market-2', 'period-2026-07-01')])
    const mismatched = { ...period('2026-06-01', [amount('market-other', 'period-2026-06-01')]), amountBasis: 'memory_estimate' as const }
    const comparableThree = period('2026-05-01', [amount('market-3', 'period-2026-05-01')])
    const base = { civilDate: '2026-09-09', expenses: [expense('contract')], actions: [], goal: null }

    expect(buildFamilyRoute({ ...base, findings: [factual], periods: [latest] }).nextAction.kind).toBe('factual_finding')
    expect(buildFamilyRoute({ ...base, findings: [], periods: [latest, comparableOne, comparableTwo, mismatched] }).nextAction).toMatchObject({ kind: 'build_own_history', recordedMonths: 2, missingMonths: 1 })
    expect(buildFamilyRoute({ ...base, findings: [], periods: [latest, comparableOne, comparableTwo, comparableThree] }).nextAction.kind).toBe('clear')
    expect(buildFamilyRoute({ ...base, findings: [], periods: [] }).nextAction.kind).toBe('clear')
    expect(buildFamilyRoute({ ...base, expenses: [], findings: [], periods: [] }).nextAction.kind).toBe('empty')
  })

  it('limita cada estimativa ao custo atual e rejeita intervalos monetários inválidos', () => {
    const capped = buildFamilyRoute({
      civilDate: '2026-09-09',
      expenses: [expense('contract', { monthlyCostCents: 700 })],
      findings: [finding('estimate', 'contract', { estimatedMonthlySavingMinCents: 500, estimatedMonthlySavingMaxCents: 1000 })],
      actions: [],
      periods: [],
      goal: null
    })

    expect(capped.identifiedMonthlyRangeCents).toEqual({ minCents: 500, maxCents: 700 })
    expect(capped.cases[0]).toMatchObject({ monthlySavingMinCents: 500, monthlySavingMaxCents: 700 })
    expect(() => buildFamilyRoute({
      civilDate: '2026-09-09',
      expenses: [expense('contract')],
      findings: [finding('invalid', 'contract', { estimatedMonthlySavingMinCents: 1000, estimatedMonthlySavingMaxCents: 500 })],
      actions: [],
      periods: [],
      goal: null
    })).toThrow(/monetário/i)
  })

  it('rejeita datas civis impossíveis e totais que excedem inteiros seguros', () => {
    const input = { expenses: [expense('contract')], findings: [], actions: [], periods: [], goal: null }
    expect(() => buildFamilyRoute({ civilDate: '2026-02-31', ...input })).toThrow(/Data civil inválida/)
    expect(() => buildFamilyRoute({
      civilDate: '2026-09-09',
      expenses: [expense('a', { monthlyCostCents: Number.MAX_SAFE_INTEGER }), expense('b', { monthlyCostCents: 1 })],
      findings: [],
      actions: [],
      periods: [],
      goal: null
    })).toThrow(/monetário/i)
  })
})
