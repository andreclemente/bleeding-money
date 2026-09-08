import type { ExpenseInput } from '../server/db/repository'

type Category = ExpenseInput['category']

export interface ExpenseWizardState {
  category: Category
  provider: string
  productName: string
  monthlyCost: number
  hasCommitment: boolean | null
  contractStartDate: string
  commitmentEndDate: string
  contractedPowerKva: number
  tariffType: string
  pricePerKwh: number
  powerPricePerDay: number
  annualConsumptionKwh: number
  maxHistoricalPowerKva: number
  connectionType: string
  downloadSpeedMbps: number
  uploadSpeedMbps: number
  mobileDataGb: number
  mobileLines: number
  tvIncluded: boolean
  accountMaintenanceFee: number
  cardAnnualFee: number
  transferFees: number
  plan: string
  lastUsedAt: string
  usageFrequency: string
}

export const createExpenseWizardState = (): ExpenseWizardState => ({
  category: 'subscription', provider: '', productName: '', monthlyCost: 0, hasCommitment: null, contractStartDate: '', commitmentEndDate: '',
  contractedPowerKva: 3.45, tariffType: 'simples', pricePerKwh: 0, powerPricePerDay: 0, annualConsumptionKwh: 0, maxHistoricalPowerKva: 0,
  connectionType: 'fiber', downloadSpeedMbps: 100, uploadSpeedMbps: 0, mobileDataGb: 0, mobileLines: 0, tvIncluded: false,
  accountMaintenanceFee: 0, cardAnnualFee: 0, transferFees: 0, plan: '', lastUsedAt: '', usageFrequency: ''
})

const cents = (value: number) => Math.round(value * 100)
const withoutUndefined = <T extends Record<string, unknown>>(value: T) => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T

export const buildExpenseRequest = (form: ExpenseWizardState): ExpenseInput => {
  let details: ExpenseInput['details']
  if (form.category === 'electricity') details = { kind: 'electricity', contractedPowerKva: form.contractedPowerKva, tariffType: form.tariffType, pricePerKwhCents: cents(form.pricePerKwh), powerPricePerDayCents: cents(form.powerPricePerDay), annualConsumptionKwh: form.annualConsumptionKwh, maxHistoricalPowerKva: form.maxHistoricalPowerKva }
  else if (form.category === 'telecom') details = { kind: 'telecom', connectionType: form.connectionType, downloadSpeedMbps: form.downloadSpeedMbps, uploadSpeedMbps: form.uploadSpeedMbps, mobileDataGb: form.mobileDataGb, mobileLines: form.mobileLines, tvIncluded: form.tvIncluded }
  else if (form.category === 'bank') details = { kind: 'bank', accountMaintenanceFeeCents: cents(form.accountMaintenanceFee), cardAnnualFeeCents: cents(form.cardAnnualFee), transferFeesCents: cents(form.transferFees) }
  else details = withoutUndefined({ kind: 'subscription' as const, plan: form.plan || form.productName, lastUsedAt: form.lastUsedAt || undefined, usageFrequency: form.usageFrequency || undefined })

  return withoutUndefined({
    category: form.category,
    provider: form.provider.trim(),
    productName: form.productName.trim(),
    monthlyCostCents: cents(form.monthlyCost),
    contractStartDate: form.hasCommitment ? form.contractStartDate || undefined : undefined,
    commitmentEndDate: form.hasCommitment ? form.commitmentEndDate || undefined : undefined,
    details
  })
}
