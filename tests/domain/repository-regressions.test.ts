import { describe, expect, it } from 'vitest'
import { createSavingsEngine } from '../../server/services/savings-engine'
import { DEMO_USER_ID, demoMarketOffers } from '../../server/db/demo-data'
import { MemoryRepository, parseExpenseCreateInput, parseExpensePatchInput } from '../../server/db/repository'
import type { RecurringExpense, SavingsContext } from '../../domain/types'

const now = new Date('2026-09-06T12:00:00Z')
const expense = (category: RecurringExpense['category'], details: RecurringExpense['details']): RecurringExpense => ({
  id: crypto.randomUUID(),
  userId: DEMO_USER_ID,
  category,
  provider: category === 'telecom' ? 'Vodafone' : 'Teste',
  productName: 'Plano',
  monthlyCostCents: 4890,
  billingFrequency: 'monthly',
  currency: 'EUR',
  commitmentEndDate: category === 'telecom' ? '2026-04-01' : undefined,
  details,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString()
})
const context: SavingsContext = { now, snapshots: [], marketObservations: [], expenses: [] }

describe('DTO explícito de despesas', () => {
  it('rejeita mass assignment e campos desconhecidos no PATCH', () => {
    expect(() => parseExpensePatchInput({ id: 'roubado' })).toThrow('Campo não permitido')
    expect(() => parseExpensePatchInput({ userId: 'roubado' })).toThrow('Campo não permitido')
    expect(() => parseExpensePatchInput({ category: 'bank' })).toThrow('Campo não permitido')
    expect(() => parseExpensePatchInput({ createdAt: now.toISOString() })).toThrow('Campo não permitido')
  })

  it.each([
    ['electricity', { kind: 'electricity', contractedPowerKva: 6.9, tariffType: 'simples', pricePerKwhCents: 16, powerPricePerDayCents: 50, annualConsumptionKwh: 3200, maxHistoricalPowerKva: 3.8 }],
    ['telecom', { kind: 'telecom', connectionType: 'fiber', downloadSpeedMbps: 500, uploadSpeedMbps: 100, mobileDataGb: 20, mobileLines: 2, tvIncluded: true }],
    ['bank', { kind: 'bank', accountMaintenanceFeeCents: 790, cardAnnualFeeCents: 2000, transferFeesCents: 50 }],
    ['subscription', { kind: 'subscription', plan: 'Premium', lastUsedAt: '2026-01-10', usageFrequency: 'rarely' }]
  ] as const)('valida e preserva detalhes de %s', async (category, details) => {
    const input = parseExpenseCreateInput({ category, provider: 'Fornecedor', productName: 'Produto', monthlyCostCents: 1000, details })
    const repo = new MemoryRepository()
    const created = await repo.createExpense(DEMO_USER_ID, input)
    expect(created.details).toEqual(details)
  })

  it('rejeita detalhes incompatíveis e datas ou dinheiro inseguros', () => {
    expect(() => parseExpenseCreateInput({ category: 'bank', provider: 'B', productName: 'P', monthlyCostCents: 100, details: { kind: 'subscription', plan: 'X' } })).toThrow('Detalhes incompatíveis')
    expect(() => parseExpenseCreateInput({ category: 'subscription', provider: 'B', productName: 'P', monthlyCostCents: Number.MAX_SAFE_INTEGER + 1, details: { kind: 'subscription', plan: 'X' } })).toThrow('Custo inválido')
    expect(() => parseExpenseCreateInput({ category: 'insurance', provider: 'B', productName: 'P', monthlyCostCents: 100, currency: 'USD', details: { kind: 'insurance', policyType: 'home', coverageCodes: [] } })).toThrow(/EUR/i)
    expect(() => parseExpenseCreateInput({ category: 'subscription', provider: 'B', productName: 'P', monthlyCostCents: 2_147_483_648, details: { kind: 'subscription', plan: 'X' } })).toThrow('Custo inválido')
    expect(() => parseExpensePatchInput({ contractEndDate: '2026-02-30' })).toThrow('Data inválida')
    expect(parseExpensePatchInput({ contractEndDate: null })).toEqual({ contractEndDate: null })
    expect(parseExpensePatchInput({ details: { kind: 'insurance', policyType: 'home', renewalDate: null, coverageCodes: [] } })).toEqual({
      details: { kind: 'insurance', policyType: 'home', renewalDate: undefined, coverageCodes: [] }
    })
  })

  it('remove datas contratuais quando o PATCH recebe uma correção explícita', async () => {
    const repo = new MemoryRepository()
    const created = await repo.createExpense(DEMO_USER_ID, parseExpenseCreateInput({
      category: 'insurance',
      provider: 'Seguradora',
      productName: 'Casa',
      monthlyCostCents: 2400,
      contractEndDate: '2027-01-01',
      commitmentEndDate: '2026-12-01',
      details: { kind: 'insurance', policyType: 'home', renewalDate: '2026-11-15', coverageCodes: ['building'] }
    }))

    await repo.updateExpense(DEMO_USER_ID, created.id, parseExpensePatchInput({
      contractEndDate: null,
      commitmentEndDate: null,
      details: { kind: 'insurance', policyType: 'home', renewalDate: null, coverageCodes: ['building'] }
    }))

    expect((await repo.getExpense(DEMO_USER_ID, created.id))?.expense).toMatchObject({
      contractEndDate: undefined,
      commitmentEndDate: undefined,
      details: { kind: 'insurance', policyType: 'home', renewalDate: undefined, coverageCodes: ['building'] }
    })
  })
})

describe('snapshots e orquestração do SavingsEngine', () => {
  it('regista os seis analyzers de produção', async () => {
    const engine = createSavingsEngine()
    const cases = [
      [expense('electricity', { kind: 'electricity', contractedPowerKva: 6.9, tariffType: 'simples', pricePerKwhCents: 16, powerPricePerDayCents: 50, annualConsumptionKwh: 3000, maxHistoricalPowerKva: 3.8 }), 'WRONG_PLAN'],
      [expense('bank', { kind: 'bank', accountMaintenanceFeeCents: 790, cardAnnualFeeCents: 0, transferFeesCents: 0 }), 'AVOIDABLE_FEE'],
      [expense('subscription', { kind: 'subscription', plan: 'Pro', lastUsedAt: '2026-01-01' }), 'UNUSED_SERVICE'],
      [expense('telecom', { kind: 'telecom', connectionType: 'fiber', downloadSpeedMbps: 500 }), 'CONTRACT_EXPIRED']
    ] as const
    for (const [item, findingType] of cases) expect((await engine.analyze(item, context)).map(result => result.type)).toContain(findingType)
    const telecom = expense('telecom', { kind: 'telecom', connectionType: 'fiber', downloadSpeedMbps: 500 })
    const marketObservations = Array.from({ length: 10 }, (_, index) => ({ id: `m-${index}`, category: 'telecom' as const, provider: 'Vodafone', productType: 'fiber', attributes: { speedMbps: 500 }, monthlyPriceCents: 3200 + index * 100, negotiated: false, country: 'PT', observedAt: '2026-06-01', source: 'fixture', confidence: 0.9 }))
    const findings = await engine.analyze(telecom, { ...context, snapshots: [{ id: 'snapshot', expenseId: telecom.id, observedAt: '2025-01-01', priceCents: 3000, properties: {}, source: 'manual' }], marketObservations })
    expect(new Set(findings.map(item => item.type))).toEqual(new Set(['MARKET_OVERPRICED', 'PRICE_INCREASE', 'CONTRACT_EXPIRED']))
  })

  it('cria findings reais e deduplica o finding aberto ao reanalisar', async () => {
    const repo = new MemoryRepository()
    const created = await repo.createExpense(DEMO_USER_ID, parseExpenseCreateInput({ category: 'subscription', provider: 'Teste', productName: 'Pro', monthlyCostCents: 1500, details: { kind: 'subscription', plan: 'Pro', lastUsedAt: '2026-01-01', usageFrequency: 'never' } }))
    const first = (await repo.getExpense(DEMO_USER_ID, created.id))!
    expect(first.findings.filter(item => item.status === 'open' && item.type === 'UNUSED_SERVICE')).toHaveLength(1)
    await repo.updateExpense(DEMO_USER_ID, created.id, parseExpensePatchInput({ monthlyCostCents: 1600 }))
    const second = (await repo.getExpense(DEMO_USER_ID, created.id))!
    expect(second.snapshots).toHaveLength(2)
    expect(second.findings.filter(item => item.status === 'open' && item.type === 'UNUSED_SERVICE')).toHaveLength(1)
    expect(second.findings.find(item => item.status === 'open' && item.type === 'UNUSED_SERVICE')?.estimatedMonthlySavingMinCents).toBe(1600)
  })

  it('só cria snapshot quando termos relevantes mudam', async () => {
    const repo = new MemoryRepository()
    const created = await repo.createExpense(DEMO_USER_ID, parseExpenseCreateInput({ category: 'telecom', provider: 'MEO', productName: 'Fibra', monthlyCostCents: 3000, details: { kind: 'telecom', connectionType: 'fiber', downloadSpeedMbps: 500 } }))
    await repo.updateExpense(DEMO_USER_ID, created.id, parseExpensePatchInput({ provider: 'MEO' }))
    expect((await repo.getExpense(DEMO_USER_ID, created.id))?.snapshots).toHaveLength(1)
    await repo.updateExpense(DEMO_USER_ID, created.id, parseExpensePatchInput({ details: { kind: 'telecom', connectionType: 'fiber', downloadSpeedMbps: 1000 } }))
    expect((await repo.getExpense(DEMO_USER_ID, created.id))?.snapshots.at(-1)).toMatchObject({ source: 'manual_update', properties: { details: { downloadSpeedMbps: 1000 } } })
  })

  it('mantém uma revisão de seguro dispensada fechada durante a atualização temporal', async () => {
    const repo = new MemoryRepository()
    const first = await repo.createExpense(DEMO_USER_ID, parseExpenseCreateInput({ category: 'insurance', provider: 'A', productName: 'Casa A', monthlyCostCents: 2000, details: { kind: 'insurance', policyType: 'home', coverageCodes: ['contents'] } }))
    await repo.createExpense(DEMO_USER_ID, parseExpenseCreateInput({ category: 'insurance', provider: 'B', productName: 'Casa B', monthlyCostCents: 1500, details: { kind: 'insurance', policyType: 'home', coverageCodes: ['contents'] } }))
    const overlap = (await repo.listFindings(DEMO_USER_ID)).find(item => item.expenseId === first.id && item.type === 'DUPLICATE_SERVICE')!
    await repo.dismissFinding(DEMO_USER_ID, overlap.id)
    expect((await repo.listFindings(DEMO_USER_ID)).filter(item => item.expenseId === first.id && item.type === 'DUPLICATE_SERVICE' && item.status === 'open')).toEqual([])
  })

  it('abre uma nova revisão para um novo ciclo de renovação já depois de dispensar o anterior', async () => {
    const repo = new MemoryRepository()
    const firstRenewal = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10)
    const nextRenewal = new Date(Date.now() + 35 * 86_400_000).toISOString().slice(0, 10)
    const policy = await repo.createExpense(DEMO_USER_ID, parseExpenseCreateInput({ category: 'insurance', provider: 'A', productName: 'Casa', monthlyCostCents: 2000, details: { kind: 'insurance', policyType: 'home', renewalDate: firstRenewal, coverageCodes: [] } }))
    const first = (await repo.listFindings(DEMO_USER_ID)).find(item => item.expenseId === policy.id && item.type === 'CONTRACT_EXPIRING')!
    await repo.dismissFinding(DEMO_USER_ID, first.id)

    await repo.updateExpense(DEMO_USER_ID, policy.id, parseExpensePatchInput({ details: { kind: 'insurance', policyType: 'home', renewalDate: nextRenewal, coverageCodes: [] } }))
    const reopened = (await repo.listFindings(DEMO_USER_ID)).filter(item => item.expenseId === policy.id && item.type === 'CONTRACT_EXPIRING' && item.status === 'open')

    expect(reopened).toHaveLength(1)
    expect(reopened[0]?.evidence.join(' ')).toContain(nextRenewal)
  })
})

describe('resolução segura e reconciliação', () => {
  it('não reabre imediatamente o mesmo tipo que acabou de ser resolvido', async () => {
    const repo = new MemoryRepository({ demo: true })
    await repo.resolveFinding(DEMO_USER_ID, '40000000-0000-4000-8000-000000000001', 0, '2026-09-06')
    const detail = await repo.getExpense(DEMO_USER_ID, '10000000-0000-4000-8000-000000000006')
    expect(detail?.findings.filter(item => item.status === 'open' && item.type === 'UNUSED_SERVICE')).toHaveLength(0)
  })

  it('rejeita custo superior, datas inválidas e fecha recomendações irmãs obsoletas', async () => {
    const repo = new MemoryRepository({ demo: true })
    const findingId = '40000000-0000-4000-8000-000000000002'
    await expect(repo.resolveFinding(DEMO_USER_ID, findingId, 5000, '2026-09-06')).rejects.toThrow('inferior')
    await expect(repo.resolveFinding(DEMO_USER_ID, findingId, 3490, '2026-02-30')).rejects.toThrow('Data inválida')
    await repo.resolveFinding(DEMO_USER_ID, findingId, 3490, '2026-09-06')
    const detail = await repo.getExpense(DEMO_USER_ID, '10000000-0000-4000-8000-000000000002')
    expect(detail?.findings.filter(item => item.status === 'open' && ['MARKET_OVERPRICED', 'PRICE_INCREASE'].includes(item.type))).toHaveLength(0)
    expect(detail?.findings.find(item => item.status === 'open' && item.type === 'CONTRACT_EXPIRED')?.estimatedMonthlySavingMaxCents).toBe(698)
    expect(detail?.findings.find(item => item.id === findingId)?.status).toBe('resolved')
  })
})

describe('catálogo de mercado', () => {
  it('inclui pelo menos uma oferta pública sem dados pessoais', () => {
    expect(demoMarketOffers.length).toBeGreaterThan(0)
    expect(Object.keys(demoMarketOffers[0] || {})).not.toContain('userId')
  })
})
