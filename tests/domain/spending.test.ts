import { describe, expect, it } from 'vitest'
import {
  CohortSpendAnalyzer,
  OwnHistorySpendAnalyzer,
  UserTargetGapAnalyzer,
  buildSpendChartData,
  calculateMoneyAtRisk,
  calculateSpendTotals,
  parseHouseholdInput,
  parseMonthlySpendInput,
  type AnonymousCohortAggregate,
  type MonthlySpendPeriod
} from '../../domain/spending'

const household = { adults: 2, dependents: 1, country: 'PT' as const }
const input = (amount = 50000) => ({
  month: '2026-08-01',
  adults: 2,
  dependents: 1,
  status: 'complete' as const,
  supermarketCoverage: 'food_only' as const,
  amountBasis: 'statement_or_receipts' as const,
  amounts: [
    { category: 'supermarket_total' as const, scope: 'supermarket' as const, amountCents: amount, trackingIntent: 'track_only' as const },
    { category: 'alcohol' as const, scope: 'supermarket' as const, amountCents: 3000, trackingIntent: 'track_only' as const },
    { category: 'alcohol' as const, scope: 'outside_supermarket' as const, amountCents: 2000, trackingIntent: 'reduce' as const, userTargetCents: 1000 }
  ]
})

const period = (month: string, amountCents: number, basis: MonthlySpendPeriod['amountBasis'] = 'statement_or_receipts'): MonthlySpendPeriod => ({
  id: month,
  userId: '10000000-0000-4000-8000-000000000001',
  month,
  status: 'complete',
  supermarketCoverage: 'food_only',
  amountBasis: basis,
  country: 'PT',
  adults: 2,
  dependents: 1,
  adultBand: '2',
  dependentBand: '1',
  createdAt: `${month}T00:00:00.000Z`,
  updatedAt: `${month}T00:00:00.000Z`,
  amounts: [{ id: `${month}-a`, periodId: month, category: 'supermarket_total', scope: 'supermarket', amountCents, trackingIntent: 'track_only' }]
})

describe('validação e aritmética de gastos mensais', () => {
  it('aceita apenas agregado familiar PT dentro dos limites', () => {
    expect(parseHouseholdInput(household)).toEqual(household)
    expect(() => parseHouseholdInput({ ...household, adults: 0 })).toThrow(/adultos/i)
    expect(() => parseHouseholdInput({ ...household, secret: true })).toThrow(/não permitido/i)
  })

  it('evita dupla contagem entre supermercado e parcelas internas', () => {
    const parsed = parseMonthlySpendInput(input())
    expect(calculateSpendTotals(parsed.amounts)).toEqual({ supermarketCents: 50000, outsideCents: 2000, housingCents: 0, grandTotalCents: 52000, annualizedCents: 624000, discretionaryDeclaredCents: 5000 })
  })

  it('trata habitação como contexto factual sem a classificar como fuga', () => {
    const parsed = parseMonthlySpendInput({
      ...input(),
      amounts: [
        ...input().amounts,
        { category: 'mortgage_payment', scope: 'housing', amountCents: 72500, trackingIntent: 'track_only' },
        { category: 'condominium_fee', scope: 'housing', amountCents: 4500, trackingIntent: 'track_only' }
      ]
    })

    expect(calculateSpendTotals(parsed.amounts)).toEqual({ supermarketCents: 50000, outsideCents: 2000, housingCents: 77000, grandTotalCents: 129000, annualizedCents: 1548000, discretionaryDeclaredCents: 5000 })
    expect(calculateMoneyAtRisk(parsed.amounts).monthlyCents).toBe(1000)
    expect(() => parseMonthlySpendInput({ ...input(), amounts: [...input().amounts, { category: 'rent', scope: 'housing', amountCents: 80000, trackingIntent: 'reduce', userTargetCents: 70000 }] })).toThrow(/habitação/i)
    expect(() => parseMonthlySpendInput({ ...input(), amounts: [...input().amounts, { category: 'rent', scope: 'outside_supermarket', amountCents: 80000, trackingIntent: 'track_only' }] })).toThrow(/habitação/i)
  })

  it('rejeita mês, dinheiro, alvos e sobreposição inválidos', () => {
    expect(() => parseMonthlySpendInput({ ...input(), month: '2026-08-02' })).toThrow(/mês/i)
    expect(parseMonthlySpendInput({ ...input(), month: '2026-08' }, new Date('2026-09-09T12:00:00Z')).month).toBe('2026-08-01')
    expect(() => parseMonthlySpendInput({ ...input(), month: '2026-10' }, new Date('2026-09-09T12:00:00Z'))).toThrow(/futuro/i)
    expect(parseMonthlySpendInput({ ...input(), month: '2026-10' }, new Date('2026-09-30T23:30:00Z')).month).toBe('2026-10-01')
    expect(() => parseMonthlySpendInput({ ...input(), amounts: [{ category: 'supermarket_total', scope: 'outside_supermarket', amountCents: 1, trackingIntent: 'track_only' }] })).toThrow(/supermercado/i)
    expect(() => parseMonthlySpendInput({ ...input(), amounts: [{ category: 'alcohol', scope: 'outside_supermarket', amountCents: 100, trackingIntent: 'reduce', userTargetCents: 101 }] })).toThrow(/limite/i)
    expect(() => parseMonthlySpendInput({ ...input(), amounts: [...input().amounts, input().amounts[0]] })).toThrow(/duplicad/i)
    expect(() => parseMonthlySpendInput({ ...input(), amounts: [input().amounts[0], { category: 'alcohol', scope: 'supermarket', amountCents: 60000, trackingIntent: 'track_only' }] })).toThrow(/incluíd/i)
  })

  it('calcula dinheiro em risco apenas com alvos declarados e sem sobrepor supermercado', () => {
    const parsed = parseMonthlySpendInput({
      ...input(),
      amounts: [
        { category: 'supermarket_total', scope: 'supermarket', amountCents: 50000, trackingIntent: 'reduce', userTargetCents: 45000 },
        { category: 'alcohol', scope: 'supermarket', amountCents: 5000, trackingIntent: 'reduce', userTargetCents: 1000 },
        { category: 'fast_food_takeaway', scope: 'outside_supermarket', amountCents: 8000, trackingIntent: 'reduce', userTargetCents: 5000 },
        { category: 'other_discretionary', scope: 'outside_supermarket', amountCents: 2500, trackingIntent: 'track_only' }
      ]
    })

    expect(calculateMoneyAtRisk(parsed.amounts)).toEqual({
      monthlyCents: 8000,
      annualCents: 96000,
      components: [
        { scope: 'supermarket', amountCents: 5000, method: 'highest_non_overlapping_target_gap' },
        { scope: 'outside_supermarket', amountCents: 3000, method: 'sum_of_target_gaps' }
      ],
      isEstimate: true,
      basis: 'user_declared_targets'
    })
    expect(calculateMoneyAtRisk(parseMonthlySpendInput(input()).amounts).monthlyCents).toBe(1000)
  })
  it('prepara apenas gráficos acionáveis sem dupla contagem nem tendência fingida', () => {
    const one = period('2026-08-01', 50000)
    one.amounts.push(
      { id: 'inside', periodId: one.id, category: 'sweets_snacks_soft_drinks', scope: 'supermarket', amountCents: 5000, trackingIntent: 'track_only' },
      { id: 'outside', periodId: one.id, category: 'fast_food_takeaway', scope: 'outside_supermarket', amountCents: 8000, trackingIntent: 'track_only' }
    )
    const single = buildSpendChartData([one])

    expect(single.timeline).toMatchObject({ state: 'insufficient_for_trend', missingComparableMonths: 3, comparableMedianCents: null })
    expect(single.timeline.points).toEqual([{ month: '2026-08-01', supermarketCents: 50000, otherCents: 8000, housingCents: 0, highlighted: true }])
    expect(single.breakdown.bars.map(item => [item.key, item.amountCents])).toEqual([
      ['supermarket_remainder', 45000],
      ['fast_food_takeaway', 8000],
      ['sweets_snacks_soft_drinks', 5000]
    ])
    expect(single.breakdown.totalCents).toBe(58000)

    one.amounts.push({ id: 'housing', periodId: one.id, category: 'rent', scope: 'housing', amountCents: 80000, trackingIntent: 'track_only' })
    const withHousing = buildSpendChartData([one])
    expect(withHousing.timeline.points[0]).toMatchObject({ housingCents: 80000 })
    expect(withHousing.breakdown.bars).toContainEqual({ key: 'rent', amountCents: 80000 })

    const history = ['2026-05-01', '2026-06-01', '2026-07-01'].map(month => period(month, 40000))
    const complete = buildSpendChartData([...history.reverse(), one])
    expect(complete.timeline.state).toBe('comparable_baseline')
    expect(complete.timeline.comparableMedianCents).toBe(40000)
    expect(complete.timeline.points.map(item => item.month)).toEqual(['2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01'])
  })
})

describe('analisadores', () => {
  it('histórico próprio exige 3 comparáveis e os dois limiares inclusivos', () => {
    const latest = period('2026-08-01', 24000)
    const prior = ['2026-05-01', '2026-06-01', '2026-07-01'].map(month => period(month, 20000))
    const insight = new OwnHistorySpendAnalyzer().analyze(latest, prior, 'supermarket_total')
    expect(insight?.kind).toBe('OWN_HISTORY_CHANGE')
    expect(insight?.savingMinCents).toBeNull()
    expect(insight?.evidence).toMatchObject({ sampleSize: 3, medianCents: 20000, latestCents: 24000, percentageIncrease: 20, minimumPercentage: 20, minimumDeltaCents: 4000 })
    expect(new OwnHistorySpendAnalyzer().analyze(period('2026-08-01', 23999), prior, 'supermarket_total')).toBeNull()
    expect(new OwnHistorySpendAnalyzer().analyze(latest, prior.slice(0, 2), 'supermarket_total')).toMatchObject({ kind: 'CHECK_UNAVAILABLE', evidence: { sampleSize: 2, requiredSampleSize: 3, missingMonths: 1 } })
    expect(new OwnHistorySpendAnalyzer().analyze(latest, [...prior, period('2026-09-01', 99999)], 'supermarket_total')?.evidence).toMatchObject({ sampleSize: 3, medianCents: 20000 })
  })

  it('só compara uma categoria opcional quando foi declarada no mês atual e nos meses de referência', () => {
    const latest = period('2026-08-01', 50000)
    const prior = ['2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01'].map(month => period(month, 40000))
    prior[1]!.amounts.push({ id: 'alcohol-1', periodId: prior[1]!.id, category: 'alcohol', scope: 'outside_supermarket', amountCents: 3000, trackingIntent: 'track_only' })
    prior[2]!.amounts.push({ id: 'alcohol-2', periodId: prior[2]!.id, category: 'alcohol', scope: 'outside_supermarket', amountCents: 3000, trackingIntent: 'track_only' })

    expect(new OwnHistorySpendAnalyzer().analyze(latest, prior, 'alcohol')).toBeNull()
    latest.amounts.push({ id: 'latest-alcohol', periodId: latest.id, category: 'alcohol', scope: 'outside_supermarket', amountCents: 9000, trackingIntent: 'track_only' })
    expect(new OwnHistorySpendAnalyzer().analyze(latest, prior, 'alcohol')).toMatchObject({
      kind: 'CHECK_UNAVAILABLE',
      evidence: { sampleSize: 2, requiredSampleSize: 3, missingMonths: 1 }
    })
  })

  it('alvo explícito é cenário aritmético e não promessa', () => {
    const amount = parseMonthlySpendInput(input()).amounts.at(-1)!
    const insight = new UserTargetGapAnalyzer().analyze(amount)!
    expect(insight).toMatchObject({ kind: 'USER_TARGET_GAP', savingMinCents: 1000, savingMaxCents: 1000, confidence: 1 })
    expect(insight.reason).toMatch(/^Se cumprires o limite que escolheste/)
    expect(new UserTargetGapAnalyzer().analyze({ ...amount, trackingIntent: 'maintain', userTargetCents: undefined })).toBeNull()
  })

  it('coorte exige correspondência exata, 10 agregados e excedente de 10%', () => {
    const latest = period('2026-08-01', 33000)
    const aggregate: AnonymousCohortAggregate = { id: 'a', category: 'supermarket_total', scope: 'supermarket', country: 'PT', adultBand: '2', dependentBand: '1', supermarketCoverage: 'food_only', amountBasis: 'statement_or_receipts', status: 'complete', windowStart: '2026-01-01', windowEnd: '2026-08-31', householdCount: 10, p25Cents: 20000, medianCents: 25000, p75Cents: 30000, source: 'aggregate_partner', confidence: 0.8 }
    const insight = new CohortSpendAnalyzer().analyze(latest, 'supermarket_total', [aggregate], new Date('2026-09-01'))
    expect(insight).toMatchObject({ kind: 'COHORT_COMPARISON', savingMinCents: null, savingMaxCents: null })
    expect(new CohortSpendAnalyzer().analyze(period('2026-08-01', 32999), 'supermarket_total', [aggregate], new Date('2026-09-01'))).toBeNull()
    expect(new CohortSpendAnalyzer().analyze(latest, 'supermarket_total', [{ ...aggregate, householdCount: 9 }], new Date('2026-09-01'))?.kind).toBe('CHECK_UNAVAILABLE')
    expect(new CohortSpendAnalyzer().analyze(latest, 'supermarket_total', [{ ...aggregate, amountBasis: 'memory_estimate' }], new Date('2026-09-01'))?.kind).toBe('CHECK_UNAVAILABLE')
    expect(new CohortSpendAnalyzer().analyze(latest, 'supermarket_total', [{ ...aggregate, status: 'estimated' }], new Date('2026-09-01'))?.kind).toBe('CHECK_UNAVAILABLE')
    expect(new CohortSpendAnalyzer().analyze(latest, 'supermarket_total', [{ ...aggregate, scope: 'outside_supermarket' }], new Date('2026-09-01'))?.kind).toBe('CHECK_UNAVAILABLE')
    expect(new CohortSpendAnalyzer().analyze(latest, 'alcohol', [], new Date('2026-09-01'))).toBeNull()
    expect(new CohortSpendAnalyzer().analyze(latest, 'alcohol', [{ ...aggregate, category: 'alcohol' }], new Date('2026-09-01'))).toBeNull()
    expect(Object.keys(aggregate)).not.toEqual(expect.arrayContaining(['userId', 'periodId', 'email']))
  })
})
