export type ExpenseCategory = 'electricity' | 'telecom' | 'bank' | 'subscription' | 'gym' | 'insurance'
export type BillingFrequency = 'monthly' | 'quarterly' | 'annual'
export type Severity = 'info' | 'low' | 'medium' | 'high'
export type Effort = 'very_low' | 'low' | 'medium' | 'high'
export type Urgency = 'low' | 'medium' | 'high'
export type FindingStatus = 'open' | 'resolved' | 'dismissed'
export type FindingType = 'UNDERUTILIZATION' | 'PRICE_INCREASE' | 'MARKET_OVERPRICED' | 'CONTRACT_EXPIRING' | 'CONTRACT_EXPIRED' | 'DUPLICATE_SERVICE' | 'UNUSED_SERVICE' | 'WRONG_PLAN' | 'AVOIDABLE_FEE' | 'NEGOTIATION_OPPORTUNITY'

export type ExpenseDetails =
  | { kind: 'electricity', contractedPowerKva: number, tariffType: string, pricePerKwhCents: number, powerPricePerDayCents: number, annualConsumptionKwh: number, maxHistoricalPowerKva: number }
  | { kind: 'telecom', connectionType: string, downloadSpeedMbps: number, uploadSpeedMbps?: number, mobileDataGb?: number, mobileLines?: number, tvIncluded?: boolean }
  | { kind: 'bank', accountMaintenanceFeeCents: number, cardAnnualFeeCents: number, transferFeesCents: number }
  | { kind: 'subscription', plan: string, lastUsedAt?: string, usageFrequency?: string }
  | { kind: 'generic', notes?: string }

export interface RecurringExpense {
  id: string
  userId: string
  category: ExpenseCategory
  provider: string
  productName: string
  monthlyCostCents: number
  billingFrequency: BillingFrequency
  currency: string
  contractStartDate?: string
  contractEndDate?: string
  commitmentEndDate?: string
  details: ExpenseDetails
  createdAt: string
  updatedAt: string
}

export interface ExpenseSnapshot { id: string, expenseId: string, observedAt: string, priceCents: number, plan?: string, properties: Record<string, unknown>, source: string }
export interface MarketObservation { id: string, category: ExpenseCategory, provider: string, productType: string, attributes: Record<string, string | number | boolean>, monthlyPriceCents: number, negotiated: boolean, country: string, observedAt: string, source: string, confidence: number }
export interface MarketOffer { id: string, provider: string, category: ExpenseCategory, productName: string, validFrom: string, validUntil?: string, attributes: Record<string, unknown>, pricing: Record<string, number>, source: string }
export interface SavingsFinding {
  id: string
  expenseId: string
  type: FindingType
  title: string
  description: string
  estimatedMonthlySavingMinCents: number
  estimatedMonthlySavingMaxCents: number
  estimatedAnnualSavingMinCents: number
  estimatedAnnualSavingMaxCents: number
  confidence: number
  severity: Severity
  priority: number
  effort: Effort
  urgency: Urgency
  action: string
  evidence: string[]
  status: FindingStatus
  createdAt: string
  resolvedAt?: string
  dismissedAt?: string
}
export interface SavingAction { id: string, findingId: string, previousCostCents: number, newCostCents: number, actionDate: string, annualSavingCents: number, createdAt: string }
export interface SavingsContext { now: Date, snapshots: ExpenseSnapshot[], marketObservations: MarketObservation[], expenses: RecurringExpense[] }
export interface SavingsAnalyzer { supports(expense: RecurringExpense): boolean, analyze(expense: RecurringExpense, context: SavingsContext): Promise<SavingsFinding[]> }
