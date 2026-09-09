import type { ExpenseInput } from '../server/db/repository'

type Category = ExpenseInput['category']
export type ExpenseTemplate = 'electricity_bill' | 'internet_tv' | 'mobile_plan' | 'bank_account_card' | 'streaming' | 'software_cloud_saas' | 'insurance_policy'

export const expenseTemplates: Array<{ value: ExpenseTemplate, title: string, example: string, category: Category }> = [
  { value: 'electricity_bill', title: 'Fatura de eletricidade', example: 'Ex.: EDP, Goldenergy ou Endesa', category: 'electricity' },
  { value: 'internet_tv', title: 'Pacote internet / TV', example: 'Ex.: fibra 500 Mbps com televisão', category: 'telecom' },
  { value: 'mobile_plan', title: 'Tarifário móvel', example: 'Ex.: 20 GB e uma linha móvel', category: 'telecom' },
  { value: 'bank_account_card', title: 'Conta bancária ou cartão', example: 'Ex.: manutenção de conta e anuidade', category: 'bank' },
  { value: 'streaming', title: 'Streaming', example: 'Ex.: Netflix, Spotify ou Disney+', category: 'subscription' },
  { value: 'software_cloud_saas', title: 'Software, cloud ou SaaS', example: 'Ex.: ChatGPT, Adobe ou armazenamento cloud', category: 'subscription' },
  { value: 'insurance_policy', title: 'Seguro', example: 'Ex.: automóvel, casa, saúde ou vida', category: 'insurance' }
]

export interface ExpenseWizardState {
  template?: ExpenseTemplate
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
  insurancePolicyType: 'car' | 'home' | 'health' | 'life' | 'other'
  insuranceRenewalDate: string
  insuranceCoverages: Array<'civil_liability' | 'own_damage' | 'building' | 'contents' | 'hospitalization' | 'outpatient' | 'death' | 'disability' | 'travel_assistance'>
}

export const createExpenseWizardState = (): ExpenseWizardState => ({
  category: 'subscription', provider: '', productName: '', monthlyCost: 0, hasCommitment: null, contractStartDate: '', commitmentEndDate: '',
  contractedPowerKva: 3.45, tariffType: 'simples', pricePerKwh: 0, powerPricePerDay: 0, annualConsumptionKwh: 0, maxHistoricalPowerKva: 0,
  connectionType: 'fiber', downloadSpeedMbps: 100, uploadSpeedMbps: 0, mobileDataGb: 0, mobileLines: 0, tvIncluded: false,
  accountMaintenanceFee: 0, cardAnnualFee: 0, transferFees: 0, plan: '', lastUsedAt: '', usageFrequency: '',
  insurancePolicyType: 'other', insuranceRenewalDate: '', insuranceCoverages: []
})

export const applyExpenseTemplate = (form: ExpenseWizardState, template: ExpenseTemplate) => {
  const selected = expenseTemplates.find(item => item.value === template)
  if (!selected) throw new Error('Tipo de despesa inválido')
  form.template = template
  form.category = selected.category
  form.connectionType = template === 'mobile_plan' ? 'mobile' : 'fiber'
  form.downloadSpeedMbps = template === 'mobile_plan' ? 0 : 100
  form.mobileLines = template === 'mobile_plan' ? 1 : 0
  form.tvIncluded = template === 'internet_tv'
  form.hasCommitment = null
  form.contractStartDate = ''
  form.commitmentEndDate = ''
}

export const analyzerCapabilities = (form: ExpenseWizardState) => {
  const available: string[] = []
  const unavailable = ['Aumento de preço — a monitorização começa agora; é necessária uma observação posterior']
  if (form.category === 'subscription') {
    if (form.lastUsedAt) available.push('Subscrição sem utilização')
    else unavailable.push('Subscrição sem utilização — falta a data da última utilização')
  }
  if (form.category === 'telecom') {
    available.push('Comparação com a comunidade (se existirem 10 casos comparáveis)')
    if (form.hasCommitment && form.commitmentEndDate) available.push('Fim da fidelização')
    else unavailable.push('Fim da fidelização — falta a data de fim')
  }
  if (form.category === 'bank') available.push('Comissão de manutenção bancária')
  if (form.category === 'electricity') {
    if (form.contractedPowerKva > 0 && form.maxHistoricalPowerKva > 0) available.push('Potência elétrica contratada')
    else unavailable.push('Potência elétrica contratada — faltam potência atual e máximo histórico')
  }
  if (form.category === 'insurance') {
    if (form.insuranceRenewalDate) available.push('Revisão antes da renovação')
    else unavailable.push('Renovação do seguro — falta a data de renovação')
    if (form.insuranceCoverages.length) available.push('Possíveis coberturas duplicadas entre os teus contratos')
    else unavailable.push('Possível cobertura duplicada — faltam coberturas declaradas')
  }
  return { available, unavailable }
}

const cents = (value: number) => Math.round(value * 100)
const withoutUndefined = <T extends Record<string, unknown>>(value: T) => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T

export const buildExpenseRequest = (form: ExpenseWizardState): ExpenseInput => {
  let details: ExpenseInput['details']
  if (form.category === 'electricity') details = { kind: 'electricity', contractedPowerKva: form.contractedPowerKva, tariffType: form.tariffType, pricePerKwhCents: cents(form.pricePerKwh), powerPricePerDayCents: cents(form.powerPricePerDay), annualConsumptionKwh: form.annualConsumptionKwh, maxHistoricalPowerKva: form.maxHistoricalPowerKva }
  else if (form.category === 'telecom') details = { kind: 'telecom', connectionType: form.connectionType, downloadSpeedMbps: form.downloadSpeedMbps, uploadSpeedMbps: form.uploadSpeedMbps, mobileDataGb: form.mobileDataGb, mobileLines: form.mobileLines, tvIncluded: form.tvIncluded }
  else if (form.category === 'bank') details = { kind: 'bank', accountMaintenanceFeeCents: cents(form.accountMaintenanceFee), cardAnnualFeeCents: cents(form.cardAnnualFee), transferFeesCents: cents(form.transferFees) }
  else if (form.category === 'insurance') details = { kind: 'insurance', policyType: form.insurancePolicyType, renewalDate: form.insuranceRenewalDate || undefined, coverageCodes: [...form.insuranceCoverages] }
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
