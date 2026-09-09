import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { buildExpenseRequest, type ExpenseWizardState } from '../../utils/expense-wizard'
import { parseExpenseCreateInput, parseExpensePatchInput } from '../../server/db/repository'

const base = (overrides: Partial<ExpenseWizardState> = {}): ExpenseWizardState => ({
  category: 'subscription',
  provider: 'Netflix',
  productName: 'Standard',
  monthlyCost: 11.99,
  hasCommitment: true,
  contractStartDate: '2026-01-01',
  commitmentEndDate: '2026-12-31',
  plan: 'Standard',
  lastUsedAt: '',
  usageFrequency: '',
  contractedPowerKva: 3.45,
  tariffType: 'simples',
  pricePerKwh: 0,
  powerPricePerDay: 0,
  annualConsumptionKwh: 0,
  maxHistoricalPowerKva: 0,
  connectionType: 'fiber',
  downloadSpeedMbps: 100,
  uploadSpeedMbps: 0,
  mobileDataGb: 0,
  mobileLines: 0,
  tvIncluded: false,
  accountMaintenanceFee: 0,
  cardAnnualFee: 0,
  transferFees: 0,
  insurancePolicyType: 'home',
  insuranceRenewalDate: '',
  insuranceCoverages: [],
  ...overrides
})

describe('pedido do assistente de despesas', () => {
  it('envia apenas o DTO real, valores em cêntimos e ambas as datas de fidelização', () => {
    expect(buildExpenseRequest(base())).toEqual({
      category: 'subscription',
      provider: 'Netflix',
      productName: 'Standard',
      monthlyCostCents: 1199,
      contractStartDate: '2026-01-01',
      commitmentEndDate: '2026-12-31',
      details: { kind: 'subscription', plan: 'Standard' }
    })
  })

  it('não envia datas quando a resposta à fidelização é não', () => {
    const request = buildExpenseRequest(base({ hasCommitment: false }))

    expect(request).not.toHaveProperty('contractStartDate')
    expect(request).not.toHaveProperty('commitmentEndDate')
  })

  it('constrói um contrato de seguro com preço, renovação e coberturas declaradas', () => {
    const request = buildExpenseRequest(base({ category: 'insurance', template: 'insurance_policy', provider: 'Seguradora', productName: 'Casa', monthlyCost: 24.5, insurancePolicyType: 'home', insuranceRenewalDate: '2026-11-15', insuranceCoverages: ['building', 'contents'] }))
    expect(request).toMatchObject({ category: 'insurance', monthlyCostCents: 2450, details: { kind: 'insurance', policyType: 'home', renewalDate: '2026-11-15', coverageCodes: ['building', 'contents'] } })
    expect(request).not.toHaveProperty('contractEndDate')
    expect(() => parseExpenseCreateInput(request)).not.toThrow()
  })
})

describe('validação das datas de fidelização', () => {
  it('aceita o fim da fidelização sem data de início', () => {
    const request = buildExpenseRequest(base({ category: 'telecom', contractStartDate: '', commitmentEndDate: '2026-12-31' }))
    expect(() => parseExpenseCreateInput(request)).not.toThrow()
    expect(request).not.toHaveProperty('contractStartDate')
  })

  it('apresenta o início como opcional e só o compara quando ambas as datas existem', async () => {
    const component = await readFile(new URL('../../components/ExpenseWizard.vue', import.meta.url), 'utf8')
    expect(component).toContain('label="Início do contrato · opcional"')
    expect(component).toMatch(/form\.contractStartDate\s*&&\s*form\.commitmentEndDate\s*&&\s*form\.commitmentEndDate\s*<\s*form\.contractStartDate/)
    expect(component).not.toContain('Indica o início do contrato e o fim da fidelização.')
  })

  it('pergunta tipo, renovação e coberturas do seguro sem prometer poupança', async () => {
    const component = await readFile(new URL('../../components/ExpenseWizard.vue', import.meta.url), 'utf8')
    const detail = await readFile(new URL('../../pages/expenses/[id].vue', import.meta.url), 'utf8')
    expect(component).toMatch(/Tipo de seguro/i)
    expect(component).toMatch(/Próxima renovação/i)
    expect(component).toMatch(/Coberturas declaradas/i)
    expect(component).toMatch(/não prova duplicação nem poupança/i)
    expect(component).toMatch(/Nos seguros, este valor regista apenas o custo declarado/i)
    expect(detail).toMatch(/Ficha do contrato/i)
    expect(detail).toMatch(/Exclusões e franquias/i)
  })

  it('rejeita fim anterior ao início na criação', () => {
    expect(() => parseExpenseCreateInput(buildExpenseRequest(base({ contractStartDate: '2026-08-01', commitmentEndDate: '2026-07-31' })))).toThrow(/fidelização/i)
  })

  it('rejeita fim anterior ao início quando ambas as datas são alteradas', () => {
    expect(() => parseExpensePatchInput({ contractStartDate: '2026-08-01', commitmentEndDate: '2026-07-31' })).toThrow(/fidelização/i)
  })
})
