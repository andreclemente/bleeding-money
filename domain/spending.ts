export const spendCategories = ['supermarket_total', 'fast_food_takeaway', 'alcohol', 'tobacco_nicotine', 'sweets_snacks_soft_drinks', 'other_discretionary'] as const
export const spendScopes = ['supermarket', 'outside_supermarket'] as const
export const trackingIntents = ['track_only', 'maintain', 'reduce'] as const
export const supermarketCoverages = ['food_only', 'includes_cleaning_hygiene', 'unknown'] as const
export const amountBases = ['statement_or_receipts', 'calculated_estimate', 'memory_estimate'] as const
export const spendStatuses = ['estimated', 'complete'] as const
export type SpendCategory = typeof spendCategories[number]
export type SpendScope = typeof spendScopes[number]
export type TrackingIntent = typeof trackingIntents[number]
export type SupermarketCoverage = typeof supermarketCoverages[number]
export type AmountBasis = typeof amountBases[number]
export type SpendStatus = typeof spendStatuses[number]
export type AdultBand = '1' | '2' | '3plus'
export type DependentBand = '0' | '1' | '2plus'

export interface HouseholdProfile { userId: string, adults: number, dependents: number, country: 'PT', effectiveAt: string, updatedAt: string }
export interface HouseholdInput { adults: number, dependents: number, country: 'PT' }
export interface MonthlySpendAmount { id: string, periodId: string, category: SpendCategory, scope: SpendScope, amountCents: number, trackingIntent: TrackingIntent, userTargetCents?: number }
export interface MonthlySpendPeriod { id: string, userId: string, month: string, status: SpendStatus, supermarketCoverage: SupermarketCoverage, amountBasis: AmountBasis, country: 'PT', adults: number, dependents: number, adultBand: AdultBand, dependentBand: DependentBand, createdAt: string, updatedAt: string, amounts: MonthlySpendAmount[] }
export interface MonthlySpendInput { month: string, adults: number, dependents: number, status: SpendStatus, supermarketCoverage: SupermarketCoverage, amountBasis: AmountBasis, amounts: Array<Omit<MonthlySpendAmount, 'id' | 'periodId'>> }
export interface AnonymousCohortAggregate { id: string, category: SpendCategory, scope: SpendScope, country: 'PT', adultBand: AdultBand, dependentBand: DependentBand, supermarketCoverage: SupermarketCoverage, amountBasis: AmountBasis, status: SpendStatus, windowStart: string, windowEnd: string, householdCount: number, p25Cents: number, medianCents: number, p75Cents: number, source: string, confidence: number }
export type SpendInsightKind = 'FACT' | 'OWN_HISTORY_CHANGE' | 'COHORT_COMPARISON' | 'USER_TARGET_GAP' | 'CHECK_UNAVAILABLE'
export interface SpendInsight { kind: SpendInsightKind, category?: SpendCategory, confidence: number, reason: string, evidence: Record<string, unknown>, methodVersion: string, savingMinCents: number | null, savingMaxCents: number | null }

const MAX_CENTS = Math.floor(2_147_483_647 / 12)
const object = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Pedido inválido')
  return value as Record<string, unknown>
}
const rejectUnknown = (row: Record<string, unknown>, allowed: readonly string[]) => {
  const key = Object.keys(row).find(item => !allowed.includes(item))
  if (key) throw new Error(`Campo não permitido: ${key}`)
}
const enumValue = <T extends string>(value: unknown, allowed: readonly T[], label: string) => {
  if (!allowed.includes(value as T)) throw new Error(`${label} inválido`)
  return value as T
}
const integer = (value: unknown, minimum: number, maximum: number, label: string) => {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) throw new Error(`${label} inválido`)
  return value as number
}
export const isCalendarMonth = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])-01$/.test(value)
const normalizeCalendarMonth = (value: unknown) => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? `${value}-01` : value
const currentCalendarMonth = (now: Date) => {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit' }).formatToParts(now)
  const year = parts.find(part => part.type === 'year')?.value
  const month = parts.find(part => part.type === 'month')?.value
  if (!year || !month) throw new Error('Não foi possível determinar o mês atual')
  return `${year}-${month}-01`
}
export const adultBand = (value: number): AdultBand => value === 1 ? '1' : value === 2 ? '2' : '3plus'
export const dependentBand = (value: number): DependentBand => value === 0 ? '0' : value === 1 ? '1' : '2plus'

export const parseHouseholdInput = (value: unknown): HouseholdInput => {
  const row = object(value)
  rejectUnknown(row, ['adults', 'dependents', 'country'])
  if (row.country !== 'PT') throw new Error('País inválido')
  return { adults: integer(row.adults, 1, 20, 'Número de adultos'), dependents: integer(row.dependents, 0, 20, 'Número de dependentes'), country: 'PT' }
}

export const parseMonthlySpendInput = (value: unknown, now = new Date()): MonthlySpendInput => {
  const row = object(value)
  rejectUnknown(row, ['month', 'adults', 'dependents', 'status', 'supermarketCoverage', 'amountBasis', 'amounts'])
  const month = normalizeCalendarMonth(row.month)
  if (!isCalendarMonth(month)) throw new Error('Mês inválido; escolhe um mês civil no formato YYYY-MM')
  if (month > currentCalendarMonth(now)) throw new Error('Não é possível registar um mês futuro')
  if (!Array.isArray(row.amounts) || !row.amounts.length) throw new Error('Montantes inválidos')
  const amounts = row.amounts.map(raw => {
    const amount = object(raw)
    rejectUnknown(amount, ['category', 'scope', 'amountCents', 'trackingIntent', 'userTargetCents'])
    const category = enumValue(amount.category, spendCategories, 'Categoria')
    const scope = enumValue(amount.scope, spendScopes, 'Âmbito')
    const amountCents = integer(amount.amountCents, 0, MAX_CENTS, 'Montante')
    const trackingIntent = enumValue(amount.trackingIntent, trackingIntents, 'Intenção')
    if (category === 'supermarket_total' && scope !== 'supermarket') throw new Error('O total de supermercado tem de usar o âmbito supermercado')
    if (category !== 'supermarket_total' && amountCents === 0) throw new Error('Omite categorias sem montante')
    const userTargetCents = amount.userTargetCents === undefined ? undefined : integer(amount.userTargetCents, 0, amountCents, 'Limite escolhido')
    if (trackingIntent !== 'reduce' && userTargetCents !== undefined) throw new Error('O limite escolhido só é válido para reduzir')
    if (trackingIntent === 'reduce' && userTargetCents === undefined) throw new Error('Indica o limite escolhido para reduzir')
    return { category, scope, amountCents, trackingIntent, ...(userTargetCents === undefined ? {} : { userTargetCents }) }
  })
  const keys = amounts.map(item => `${item.category}:${item.scope}`)
  if (new Set(keys).size !== keys.length) throw new Error('Categoria e âmbito duplicados')
  const supermarket = amounts.find(item => item.category === 'supermarket_total' && item.scope === 'supermarket')
  if (!supermarket) throw new Error('Indica o total de supermercado')
  const inside = amounts.filter(item => item.category !== 'supermarket_total' && item.scope === 'supermarket').reduce((sum, item) => sum + item.amountCents, 0)
  if (inside > supermarket.amountCents) throw new Error('As parcelas incluídas no supermercado excedem o total declarado')
  return {
    month,
    adults: integer(row.adults, 1, 20, 'Número de adultos'),
    dependents: integer(row.dependents, 0, 20, 'Número de dependentes'),
    status: enumValue(row.status, spendStatuses, 'Estado'),
    supermarketCoverage: enumValue(row.supermarketCoverage, supermarketCoverages, 'Cobertura do supermercado'),
    amountBasis: enumValue(row.amountBasis, amountBases, 'Base do montante'),
    amounts
  }
}

export const calculateSpendTotals = (amounts: MonthlySpendInput['amounts']) => {
  const supermarketCents = amounts.find(item => item.category === 'supermarket_total' && item.scope === 'supermarket')?.amountCents || 0
  const outsideCents = amounts.filter(item => item.scope === 'outside_supermarket').reduce((sum, item) => sum + item.amountCents, 0)
  const discretionaryDeclaredCents = amounts.filter(item => item.category !== 'supermarket_total').reduce((sum, item) => sum + item.amountCents, 0)
  const grandTotalCents = supermarketCents + outsideCents
  return { supermarketCents, outsideCents, grandTotalCents, annualizedCents: grandTotalCents * 12, discretionaryDeclaredCents }
}

export interface MoneyAtRisk {
  monthlyCents: number
  annualCents: number
  components: Array<{ scope: SpendScope, amountCents: number, method: 'highest_non_overlapping_target_gap' | 'sum_of_target_gaps' }>
  isEstimate: true
  basis: 'user_declared_targets'
}

export const calculateMoneyAtRisk = (amounts: MonthlySpendInput['amounts']): MoneyAtRisk => {
  const gaps = amounts
    .filter(item => item.trackingIntent === 'reduce' && item.userTargetCents !== undefined)
    .map(item => ({ ...item, gapCents: item.amountCents - item.userTargetCents! }))
  const supermarketTotalGap = gaps.find(item => item.category === 'supermarket_total' && item.scope === 'supermarket')?.gapCents || 0
  const supermarketCategoryGaps = gaps.filter(item => item.category !== 'supermarket_total' && item.scope === 'supermarket').reduce((sum, item) => sum + item.gapCents, 0)
  const supermarketCents = Math.max(supermarketTotalGap, supermarketCategoryGaps)
  const outsideCents = gaps.filter(item => item.scope === 'outside_supermarket').reduce((sum, item) => sum + item.gapCents, 0)
  const components: MoneyAtRisk['components'] = []
  if (supermarketCents) components.push({ scope: 'supermarket', amountCents: supermarketCents, method: 'highest_non_overlapping_target_gap' })
  if (outsideCents) components.push({ scope: 'outside_supermarket', amountCents: outsideCents, method: 'sum_of_target_gaps' })
  const monthlyCents = supermarketCents + outsideCents
  return { monthlyCents, annualCents: monthlyCents * 12, components, isEstimate: true, basis: 'user_declared_targets' }
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle]! : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2)
}

export const buildSpendChartData = (periods: MonthlySpendPeriod[]) => {
  const chronological = [...periods].sort((a, b) => a.month.localeCompare(b.month))
  const latest = chronological.at(-1)
  const points = chronological.map(period => {
    const totals = calculateSpendTotals(period.amounts)
    return { month: period.month, supermarketCents: totals.supermarketCents, otherCents: totals.outsideCents, highlighted: period.id === latest?.id }
  })
  if (!latest) return {
    timeline: { state: 'empty' as const, missingComparableMonths: 3, comparableMedianCents: null, points },
    breakdown: { month: null, totalCents: 0, bars: [] as Array<{ key: string, amountCents: number }> }
  }
  const comparable = chronological.filter(item => item.month < latest.month && item.supermarketCoverage === latest.supermarketCoverage && item.amountBasis === latest.amountBasis)
  const insideCents = latest.amounts.filter(item => item.category !== 'supermarket_total' && item.scope === 'supermarket').reduce((sum, item) => sum + item.amountCents, 0)
  const bars = new Map<string, number>()
  const supermarketCents = categoryAmount(latest, 'supermarket_total')
  bars.set('supermarket_remainder', supermarketCents - insideCents)
  for (const amount of latest.amounts.filter(item => item.category !== 'supermarket_total')) bars.set(amount.category, (bars.get(amount.category) || 0) + amount.amountCents)
  const sortedBars = [...bars.entries()].filter(([, amountCents]) => amountCents > 0).map(([key, amountCents]) => ({ key, amountCents })).sort((a, b) => b.amountCents - a.amountCents)
  const totalCents = calculateSpendTotals(latest.amounts).grandTotalCents
  return {
    timeline: {
      state: comparable.length >= 3 ? 'comparable_baseline' as const : 'insufficient_for_trend' as const,
      missingComparableMonths: Math.max(0, 3 - comparable.length),
      comparableMedianCents: comparable.length >= 3 ? median(comparable.map(item => categoryAmount(item, 'supermarket_total'))) : null,
      points
    },
    breakdown: { month: latest.month, totalCents, bars: sortedBars }
  }
}
const categoryAmount = (period: MonthlySpendPeriod, category: SpendCategory) => period.amounts.filter(item => item.category === category).reduce((sum, item) => sum + item.amountCents, 0)
const insight = (kind: SpendInsightKind, category: SpendCategory, confidence: number, reason: string, evidence: Record<string, unknown>, savingMinCents: number | null = null, savingMaxCents: number | null = null): SpendInsight => ({ kind, category, confidence, reason, evidence, methodVersion: 'spend-v1', savingMinCents, savingMaxCents })

export class OwnHistorySpendAnalyzer {
  analyze(latest: MonthlySpendPeriod, periods: MonthlySpendPeriod[], category: SpendCategory): SpendInsight | null {
    if (category !== 'supermarket_total' && !latest.amounts.some(amount => amount.category === category)) return null
    const comparable = periods.filter(item => item.month < latest.month && item.supermarketCoverage === latest.supermarketCoverage && item.amountBasis === latest.amountBasis && (category === 'supermarket_total' || item.amounts.some(amount => amount.category === category)))
    if (comparable.length < 3) return insight('CHECK_UNAVAILABLE', category, 1, 'Histórico próprio: ainda sem dados suficientes; são necessários 3 meses comparáveis.', { sampleSize: comparable.length, requiredSampleSize: 3, missingMonths: 3 - comparable.length })
    const values = comparable.map(item => categoryAmount(item, category)).sort((a, b) => a - b)
    const middle = Math.floor(values.length / 2)
    const medianCents = values.length % 2 ? values[middle]! : Math.round((values[middle - 1]! + values[middle]!) / 2)
    const latestCents = categoryAmount(latest, category)
    const deltaCents = latestCents - medianCents
    const percentageIncrease = medianCents ? deltaCents / medianCents * 100 : 0
    if (deltaCents < 4000 || percentageIncrease < 20) return null
    return insight('OWN_HISTORY_CHANGE', category, latest.amountBasis === 'statement_or_receipts' ? 0.9 : 0.6, 'O valor declarado ficou acima da mediana dos teus meses comparáveis.', { sampleSize: values.length, medianCents, latestCents, deltaCents, percentageIncrease: Number(percentageIncrease.toFixed(2)), minimumPercentage: 20, minimumDeltaCents: 4000 })
  }
}

export class UserTargetGapAnalyzer {
  analyze(amount: Omit<MonthlySpendAmount, 'id' | 'periodId'> | MonthlySpendAmount): SpendInsight | null {
    if (amount.trackingIntent !== 'reduce' || amount.userTargetCents === undefined || amount.userTargetCents >= amount.amountCents || amount.userTargetCents < 0) return null
    const gap = amount.amountCents - amount.userTargetCents
    return insight('USER_TARGET_GAP', amount.category, 1, 'Se cumprires o limite que escolheste, podes libertar até este valor. É um cenário definido por ti, não uma previsão de resultado.', { amountCents: amount.amountCents, userTargetCents: amount.userTargetCents, annualEquivalentCents: gap * 12, arithmeticOnly: true }, gap, gap)
  }
}

export class CohortSpendAnalyzer {
  analyze(latest: MonthlySpendPeriod, category: SpendCategory, aggregates: AnonymousCohortAggregate[], now = new Date()): SpendInsight | null {
    if (category !== 'supermarket_total' && !latest.amounts.some(amount => amount.category === category)) return null
    const scopes = [...new Set(latest.amounts.filter(amount => amount.category === category).map(amount => amount.scope))]
    const cutoff = new Date(now)
    cutoff.setUTCMonth(cutoff.getUTCMonth() - 12)
    const matching = scopes.length === 1 ? aggregates.filter(item => item.category === category && item.scope === scopes[0] && item.country === latest.country && item.adultBand === latest.adultBand && item.dependentBand === latest.dependentBand && item.supermarketCoverage === latest.supermarketCoverage && item.amountBasis === latest.amountBasis && item.status === latest.status && new Date(`${item.windowEnd}T23:59:59Z`) >= cutoff) : []
    const aggregate = matching.sort((a, b) => b.windowEnd.localeCompare(a.windowEnd))[0]
    if (!aggregate || aggregate.householdCount < 10) return insight('CHECK_UNAVAILABLE', category, 1, 'Benchmark de agregados familiares semelhantes: ainda sem dados suficientes.', { householdCount: aggregate?.householdCount || 0, minimumHouseholdCount: 10, exactMatchRequired: true })
    const latestCents = categoryAmount(latest, category)
    if (latestCents < aggregate.p75Cents * 1.1) return null
    return insight('COHORT_COMPARISON', category, aggregate.confidence, 'O valor declarado está pelo menos 10% acima do percentil 75 deste agregado anónimo comparável. Isto não prova desperdício nem uma poupança possível.', { latestCents, p75Cents: aggregate.p75Cents, householdCount: aggregate.householdCount, source: aggregate.source, windowStart: aggregate.windowStart, windowEnd: aggregate.windowEnd, minimumDifferencePercent: 10 })
  }
}
