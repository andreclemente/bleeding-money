import { describe, expect, it } from 'vitest'
import { benchmark, filterComparableObservations } from '../../domain/benchmark'
import { calculateHealthScore, healthLabel } from '../../domain/health'
import { calculatePriority } from '../../domain/priority'
import { annualSaving, monthlyCost } from '../../domain/savings'
import { BankMaintenanceFeeAnalyzer } from '../../domain/analyzers/bank-maintenance-fee'
import { ElectricityContractedPowerAnalyzer } from '../../domain/analyzers/electricity-contracted-power'
import { ExpensePriceIncreaseAnalyzer } from '../../domain/analyzers/expense-price-increase'
import { SubscriptionUnusedAnalyzer } from '../../domain/analyzers/subscription-unused'
import { TelecomContractExpiredAnalyzer } from '../../domain/analyzers/telecom-contract-expired'
import { TelecomMarketBenchmarkAnalyzer } from '../../domain/analyzers/telecom-market-benchmark'
import type { MarketObservation, RecurringExpense, SavingsContext, SavingsFinding } from '../../domain/types'

const now = new Date('2026-09-06T12:00:00Z')
const base = (overrides: Partial<RecurringExpense> = {}): RecurringExpense => ({
  id: 'expense-1', userId: 'user-1', category: 'subscription', provider: 'Teste', productName: 'Plano',
  monthlyCostCents: 2000, billingFrequency: 'monthly', currency: 'EUR', details: { kind: 'generic' },
  createdAt: now.toISOString(), updatedAt: now.toISOString(), ...overrides
})
const context = (overrides: Partial<SavingsContext> = {}): SavingsContext => ({ now, snapshots: [], marketObservations: [], expenses: [], ...overrides })

describe('dinheiro em minor units', () => {
  it('normaliza frequências', () => {
    expect(monthlyCost(12000, 'annual')).toBe(1000)
    expect(monthlyCost(9000, 'quarterly')).toBe(3000)
  })
  it('rejeita frações e negativos e calcula poupança real', () => {
    expect(() => monthlyCost(10.5, 'monthly')).toThrow()
    expect(() => monthlyCost(-1, 'monthly')).toThrow()
    expect(annualSaving(4890, 3490)).toBe(16800)
    expect(annualSaving(2000, 2500)).toBe(0)
  })
})

describe('benchmark', () => {
  const rows = Array.from({ length: 10 }, (_, i): MarketObservation => ({ id: `m${i}`, category: 'telecom', provider: 'Vodafone', productType: 'fiber', attributes: { speedMbps: 500 }, monthlyPriceCents: 3000 + i * 200, negotiated: false, country: 'PT', observedAt: '2026-06-01', source: 'fixture', confidence: 0.9 }))
  it('calcula estatísticas e percentis', () => expect(benchmark(rows.map(x => x.monthlyPriceCents))).toEqual({ count: 10, min: 3000, max: 4800, average: 3900, median: 3900, p25: 3450, p75: 4350 }))
  it('exige exatamente uma amostra elegível de dez', () => {
    expect(benchmark(rows.slice(0, 9).map(item => item.monthlyPriceCents))).toBeNull()
    expect(benchmark(rows.map(item => item.monthlyPriceCents))).not.toBeNull()
  })
  it('filtra todos os atributos e janela', () => expect(filterComparableObservations([...rows, { ...rows[0]!, id: 'old', observedAt: '2024-01-01' }], { category: 'telecom', provider: 'Vodafone', productType: 'fiber', attributes: { speedMbps: 500 }, country: 'PT', now })).toHaveLength(10))
})

describe('seis analyzers', () => {
  it('deteta subscrição sem uso e não inventa quando falta data', async () => {
    const analyzer = new SubscriptionUnusedAnalyzer()
    expect((await analyzer.analyze(base({ details: { kind: 'subscription', plan: 'Pro', lastUsedAt: '2026-05-01' } }), context()))[0]).toMatchObject({ type: 'UNUSED_SERVICE', estimatedMonthlySavingMinCents: 2000 })
    expect(await analyzer.analyze(base({ details: { kind: 'subscription', plan: 'Pro' } }), context())).toHaveLength(0)
  })
  it('deteta aumento relevante e ignora os pequenos', async () => {
    const analyzer = new ExpensePriceIncreaseAnalyzer()
    expect((await analyzer.analyze(base({ monthlyCostCents: 4890 }), context({ snapshots: [{ id: 's', expenseId: 'expense-1', observedAt: '2025-01-01', priceCents: 3690, properties: {}, source: 'manual' }] })))[0]?.type).toBe('PRICE_INCREASE')
    expect(await analyzer.analyze(base({ monthlyCostCents: 2050 }), context({ snapshots: [{ id: 's', expenseId: 'expense-1', observedAt: '2025-01-01', priceCents: 2000, properties: {}, source: 'manual' }] }))).toHaveLength(0)
  })
  it('deteta contrato telecom expirado e ignora ativo', async () => {
    const analyzer = new TelecomContractExpiredAnalyzer()
    expect((await analyzer.analyze(base({ category: 'telecom', commitmentEndDate: '2026-04-01' }), context()))[0]?.type).toBe('CONTRACT_EXPIRED')
    expect(await analyzer.analyze(base({ category: 'telecom', commitmentEndDate: '2027-04-01' }), context())).toHaveLength(0)
  })
  it('deteta telecom acima do benchmark só com dez comparáveis', async () => {
    const expense = base({ category: 'telecom', provider: 'Vodafone', monthlyCostCents: 4890, details: { kind: 'telecom', connectionType: 'fiber', downloadSpeedMbps: 500 } })
    const rows = Array.from({ length: 10 }, (_, i): MarketObservation => ({ id: `${i}`, category: 'telecom', provider: 'Vodafone', productType: 'fiber', attributes: { speedMbps: 500 }, monthlyPriceCents: 3290 + i * 100, negotiated: false, country: 'PT', observedAt: '2026-06-01', source: 'fixture', confidence: 0.9 }))
    const analyzer = new TelecomMarketBenchmarkAnalyzer()
    expect((await analyzer.analyze(expense, context({ marketObservations: rows })))[0]).toMatchObject({ type: 'MARKET_OVERPRICED', estimatedMonthlySavingMinCents: 925, estimatedMonthlySavingMaxCents: 1375 })
    expect(await analyzer.analyze(expense, context({ marketObservations: rows.slice(0, 9) }))).toHaveLength(0)
  })
  it('deteta comissão bancária e ignora conta gratuita', async () => {
    const analyzer = new BankMaintenanceFeeAnalyzer()
    expect((await analyzer.analyze(base({ category: 'bank', details: { kind: 'bank', accountMaintenanceFeeCents: 790, cardAnnualFeeCents: 0, transferFeesCents: 0 } }), context()))[0]).toMatchObject({ type: 'AVOIDABLE_FEE', estimatedMonthlySavingMinCents: 632 })
    expect(await analyzer.analyze(base({ category: 'bank', details: { kind: 'bank', accountMaintenanceFeeCents: 0, cardAnnualFeeCents: 0, transferFeesCents: 0 } }), context())).toHaveLength(0)
  })
  it('deteta potência excessiva e ignora adequada', async () => {
    const analyzer = new ElectricityContractedPowerAnalyzer()
    expect((await analyzer.analyze(base({ category: 'electricity', details: { kind: 'electricity', contractedPowerKva: 6.9, tariffType: 'simple', pricePerKwhCents: 16, powerPricePerDayCents: 50, annualConsumptionKwh: 3200, maxHistoricalPowerKva: 3.8 } }), context()))[0]).toMatchObject({ type: 'WRONG_PLAN', estimatedMonthlySavingMinCents: 400, estimatedMonthlySavingMaxCents: 600 })
    expect(await analyzer.analyze(base({ category: 'electricity', details: { kind: 'electricity', contractedPowerKva: 4.6, tariffType: 'simple', pricePerKwhCents: 16, powerPricePerDayCents: 40, annualConsumptionKwh: 2500, maxHistoricalPowerKva: 4.1 } }), context())).toHaveLength(0)
  })
})

describe('saúde e prioridade', () => {
  const finding = (severity: SavingsFinding['severity'], confidence = 1): SavingsFinding => ({ id: crypto.randomUUID(), expenseId: 'e', type: 'UNUSED_SERVICE', title: 'x', description: 'x', estimatedMonthlySavingMinCents: 1000, estimatedMonthlySavingMaxCents: 1000, estimatedAnnualSavingMinCents: 12000, estimatedAnnualSavingMaxCents: 12000, confidence, severity, priority: 0, effort: 'low', urgency: 'medium', action: 'x', evidence: [], status: 'open', createdAt: now.toISOString() })
  it('limita e classifica score', () => {
    expect(calculateHealthScore([])).toBe(100)
    expect(healthLabel(75)).toBe('saudável')
    expect(healthLabel(55)).toBe('atenção')
    expect(calculateHealthScore(Array.from({ length: 10 }, () => finding('high')))).toBe(0)
  })
  it('pondera confiança', () => expect(calculateHealthScore([finding('high', 0.5)])).toBe(82))
  it('favorece ação fácil e urgente', () => expect(calculatePriority({ annualSavingMaxCents: 12000, confidence: 1, effort: 'very_low', urgency: 'high' })).toBeGreaterThan(calculatePriority({ annualSavingMaxCents: 14000, confidence: 0.7, effort: 'medium', urgency: 'low' })))
})
