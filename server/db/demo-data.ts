import type { ExpenseSnapshot, MarketObservation, MarketOffer, RecurringExpense, SavingAction, SavingsFinding } from '../../domain/types'

export const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001'
const now = '2026-09-06T12:00:00.000Z'
const expense = (id: string, category: RecurringExpense['category'], provider: string, productName: string, monthlyCostCents: number, details: RecurringExpense['details'], extra: Partial<RecurringExpense> = {}): RecurringExpense => ({ id, userId: DEMO_USER_ID, category, provider, productName, monthlyCostCents, billingFrequency: 'monthly', currency: 'EUR', details, createdAt: now, updatedAt: now, ...extra })

export const demoExpenses: RecurringExpense[] = [
  expense('10000000-0000-4000-8000-000000000001', 'electricity', 'EDP', 'Eletricidade Casa', 8200, { kind: 'electricity', contractedPowerKva: 6.9, tariffType: 'simples', pricePerKwhCents: 16, powerPricePerDayCents: 50, annualConsumptionKwh: 3200, maxHistoricalPowerKva: 3.8 }),
  expense('10000000-0000-4000-8000-000000000002', 'telecom', 'Vodafone', 'Internet Fibra 500', 4890, { kind: 'telecom', connectionType: 'fiber', downloadSpeedMbps: 500, uploadSpeedMbps: 100, mobileLines: 0, tvIncluded: true }, { contractStartDate: '2024-01-01', commitmentEndDate: '2026-04-01' }),
  expense('10000000-0000-4000-8000-000000000003', 'telecom', 'Vodafone', 'Mobile 20 GB', 1990, { kind: 'telecom', connectionType: 'mobile', downloadSpeedMbps: 100, mobileDataGb: 20, mobileLines: 1, tvIncluded: false }),
  expense('10000000-0000-4000-8000-000000000004', 'subscription', 'Spotify', 'Premium', 1199, { kind: 'subscription', plan: 'Premium', lastUsedAt: '2026-09-05', usageFrequency: 'daily' }),
  expense('10000000-0000-4000-8000-000000000005', 'subscription', 'Netflix', 'Standard', 969, { kind: 'subscription', plan: 'Standard', lastUsedAt: '2026-04-01', usageFrequency: 'rarely' }),
  expense('10000000-0000-4000-8000-000000000006', 'subscription', 'Adobe', 'Creative Cloud', 2399, { kind: 'subscription', plan: 'Fotografia', lastUsedAt: '2026-01-10', usageFrequency: 'never' }),
  expense('10000000-0000-4000-8000-000000000007', 'bank', 'Banco Exemplo', 'Conta à ordem', 790, { kind: 'bank', accountMaintenanceFeeCents: 790, cardAnnualFeeCents: 0, transferFeesCents: 0 }),
  expense('10000000-0000-4000-8000-000000000008', 'subscription', 'Google', 'Google One 100 GB', 199, { kind: 'subscription', plan: '100 GB', lastUsedAt: '2026-09-01', usageFrequency: 'weekly' }),
  expense('10000000-0000-4000-8000-000000000009', 'gym', 'Ginásio Bairro', 'Livre trânsito', 2990, { kind: 'generic', notes: 'Sem analyzer no MVP' }),
  expense('10000000-0000-4000-8000-000000000010', 'insurance', 'Seguradora Exemplo', 'Seguro auto', 3125, { kind: 'generic', notes: 'Categoria visível mas não suportada pelos analyzers do MVP' })
]

export const demoSnapshots: ExpenseSnapshot[] = [
  { id: '20000000-0000-4000-8000-000000000001', expenseId: demoExpenses[1]!.id, observedAt: '2024-01-01', priceCents: 3690, plan: 'Fibra 500', properties: {}, source: 'manual' },
  { id: '20000000-0000-4000-8000-000000000002', expenseId: demoExpenses[1]!.id, observedAt: '2025-07-01', priceCents: 4190, plan: 'Fibra 500', properties: {}, source: 'manual' },
  { id: '20000000-0000-4000-8000-000000000003', expenseId: demoExpenses[1]!.id, observedAt: '2026-08-01', priceCents: 4890, plan: 'Fibra 500', properties: {}, source: 'manual' },
  { id: '20000000-0000-4000-8000-000000000004', expenseId: demoExpenses[0]!.id, observedAt: '2025-09-01', priceCents: 7100, plan: 'Casa', properties: { maxPowerKva: 3.8 }, source: 'manual' },
  { id: '20000000-0000-4000-8000-000000000005', expenseId: demoExpenses[5]!.id, observedAt: '2025-01-01', priceCents: 1999, plan: 'Fotografia', properties: {}, source: 'manual' }
]

export const demoMarketObservations: MarketObservation[] = [3290, 3390, 3490, 3590, 3690, 3690, 3790, 3890, 3990, 4190, 3490, 4090].map((monthlyPriceCents, index) => ({
  id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, category: 'telecom', provider: 'Vodafone', productType: 'fiber', attributes: { speedMbps: 500 }, monthlyPriceCents, negotiated: index % 3 === 0, country: 'PT', observedAt: `2026-${String((index % 8) + 1).padStart(2, '0')}-15`, source: 'fixture', confidence: 0.9
}))

export const demoMarketOffers: MarketOffer[] = [
  { id: '50000000-0000-4000-8000-000000000001', provider: 'Goldenergy', category: 'electricity', productName: 'Tarifa Digital', validFrom: '2026-01-01', attributes: { tariffType: 'simples' }, pricing: { pricePerKwhCents: 15, powerPricePerDayCents: 42 }, source: 'fixture_public_catalog' }
]

const finding = (id: string, expenseId: string, type: SavingsFinding['type'], title: string, min: number, max: number, action: string, priority: number): SavingsFinding => ({ id, expenseId, type, title, description: 'Encontrámos evidência verificável de que este custo pode ser reduzido.', estimatedMonthlySavingMinCents: min, estimatedMonthlySavingMaxCents: max, estimatedAnnualSavingMinCents: min * 12, estimatedAnnualSavingMaxCents: max * 12, confidence: 0.9, severity: 'high', priority, effort: 'low', urgency: 'high', action, evidence: ['Análise baseada nos dados do contrato e no histórico disponível.', 'A estimativa é um intervalo, não uma garantia.'], status: 'open', createdAt: now })
export const demoFindings: SavingsFinding[] = [
  finding('40000000-0000-4000-8000-000000000001', demoExpenses[5]!.id, 'UNUSED_SERVICE', 'Cancelar Adobe não utilizado', 2399, 2399, 'Confirmar e cancelar a subscrição.', 96),
  finding('40000000-0000-4000-8000-000000000002', demoExpenses[1]!.id, 'MARKET_OVERPRICED', 'Renegociar Vodafone Internet', 700, 1600, 'Renegociar primeiro com a Vodafone.', 92),
  finding('40000000-0000-4000-8000-000000000003', demoExpenses[1]!.id, 'PRICE_INCREASE', 'Contestar aumento da Vodafone', 600, 1200, 'Pedir reposição do preço inicial.', 88),
  finding('40000000-0000-4000-8000-000000000004', demoExpenses[1]!.id, 'CONTRACT_EXPIRED', 'Aproveitar o fim da fidelização', 0, 542, 'Negociar sem penalização contratual.', 78),
  finding('40000000-0000-4000-8000-000000000005', demoExpenses[0]!.id, 'WRONG_PLAN', 'Reduzir potência elétrica', 400, 600, 'Confirmar e pedir redução para 4,6 kVA.', 84),
  finding('40000000-0000-4000-8000-000000000006', demoExpenses[6]!.id, 'AVOIDABLE_FEE', 'Eliminar comissão bancária', 632, 790, 'Pedir isenção ou mudar para conta sem comissão.', 82),
  finding('40000000-0000-4000-8000-000000000007', demoExpenses[4]!.id, 'UNUSED_SERVICE', 'Rever Netflix pouco utilizado', 969, 969, 'Cancelar se já não for utilizado.', 90)
]
export const demoActions: SavingAction[] = []
