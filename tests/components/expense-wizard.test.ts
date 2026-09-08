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
})

describe('validação das datas de fidelização', () => {
  it('rejeita fim anterior ao início na criação', () => {
    expect(() => parseExpenseCreateInput(buildExpenseRequest(base({ contractStartDate: '2026-08-01', commitmentEndDate: '2026-07-31' })))).toThrow(/fidelização/i)
  })

  it('rejeita fim anterior ao início quando ambas as datas são alteradas', () => {
    expect(() => parseExpensePatchInput({ contractStartDate: '2026-08-01', commitmentEndDate: '2026-07-31' })).toThrow(/fidelização/i)
  })
})
