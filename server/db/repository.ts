import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { annualSaving } from '../../domain/savings'
import { adultBand, amountBases, dependentBand, parseHouseholdInput, parseMonthlySpendInput, spendCategories, spendScopes, spendStatuses, supermarketCoverages, trackingIntents, type AnonymousCohortAggregate, type HouseholdInput, type HouseholdProfile, type MonthlySpendInput, type MonthlySpendPeriod } from '../../domain/spending'
import type { ExpenseDetails, ExpenseSnapshot, MarketObservation, RecurringExpense, SavingAction, SavingsFinding } from '../../domain/types'
import { parsePasswordHash } from '../auth/crypto'
import type { AuthRepository, StoredOwner, StoredSession } from '../auth/types'
import { createSavingsEngine } from '../services/savings-engine'
import { findingCycleKey } from '../../domain/finding'
import { confirmedGoalProgress, parseSavingsGoalInput, type SavingsGoal, type SavingsGoalInput, type SavingsGoalProgress } from '../../domain/savings-goal'
import { PostgresRepository } from './postgres-repository'
import { demoActions, demoExpenses, demoFindings, demoMarketObservations, demoSnapshots } from './demo-data'

type MvpCategory = Extract<RecurringExpense['category'], 'electricity' | 'telecom' | 'bank' | 'subscription' | 'insurance'>
type CategoryDetails = Exclude<ExpenseDetails, { kind: 'generic' }>
export interface ExpenseInput {
  category: MvpCategory
  provider: string
  productName: string
  monthlyCostCents: number
  currency?: string
  contractStartDate?: string
  contractEndDate?: string
  commitmentEndDate?: string
  details: CategoryDetails
}
export type ExpensePatchInput = Partial<Omit<ExpenseInput, 'category'>>

const categories = ['electricity', 'telecom', 'bank', 'subscription', 'insurance'] as const
const insurancePolicyTypes = ['car', 'home', 'health', 'life', 'other'] as const
const insuranceCoverageCodes = ['civil_liability', 'own_damage', 'building', 'contents', 'hospitalization', 'outpatient', 'death', 'disability', 'travel_assistance'] as const
const baseCreateKeys = ['category', 'provider', 'productName', 'monthlyCostCents', 'currency', 'contractStartDate', 'contractEndDate', 'commitmentEndDate', 'details']
const patchKeys = baseCreateKeys.filter(key => key !== 'category')
const dateKeys = ['contractStartDate', 'contractEndDate', 'commitmentEndDate'] as const

const object = (value: unknown, message = 'Pedido inválido'): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message)
  return value as Record<string, unknown>
}
const rejectUnknown = (value: Record<string, unknown>, allowed: readonly string[]) => {
  const key = Object.keys(value).find(item => !allowed.includes(item))
  if (key) throw new Error(`Campo não permitido: ${key}`)
}
const requiredText = (value: unknown, label: string) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} inválido`)
  return value.trim()
}
const optionalText = (value: unknown, label: string) => value === undefined ? undefined : requiredText(value, label)
const POSTGRES_INTEGER_MAX = 2_147_483_647
const money = (value: unknown, label = 'Custo') => {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > POSTGRES_INTEGER_MAX) throw new Error(`${label} inválido`)
  return value as number
}
const monthlyMoney = (value: unknown, label = 'Custo') => {
  const cents = money(value, label)
  if (cents > Math.floor(POSTGRES_INTEGER_MAX / 12)) throw new Error(`${label} inválido`)
  return cents
}
const nonNegativeNumber = (value: unknown, label: string) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`${label} inválido`)
  return value
}
const nonNegativeInteger = (value: unknown, label: string) => {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > POSTGRES_INTEGER_MAX) throw new Error(`${label} inválido`)
  return value as number
}
export const isIsoDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}
const optionalDate = (value: unknown) => {
  if (value === undefined) return undefined
  if (!isIsoDate(value)) throw new Error('Data inválida')
  return value
}

export const validateCommitmentDates = (contractStartDate?: string, commitmentEndDate?: string) => {
  if (contractStartDate && commitmentEndDate && commitmentEndDate < contractStartDate) throw new Error('O fim da fidelização não pode ser anterior ao início do contrato')
}

const parseDetails = (value: unknown): CategoryDetails => {
  const row = object(value, 'Detalhes inválidos')
  if (typeof row.kind !== 'string') throw new Error('Detalhes inválidos')
  if (row.kind === 'electricity') {
    rejectUnknown(row, ['kind', 'contractedPowerKva', 'tariffType', 'pricePerKwhCents', 'powerPricePerDayCents', 'annualConsumptionKwh', 'maxHistoricalPowerKva'])
    return { kind: 'electricity', contractedPowerKva: nonNegativeNumber(row.contractedPowerKva, 'Potência contratada'), tariffType: requiredText(row.tariffType, 'Tarifa'), pricePerKwhCents: money(row.pricePerKwhCents, 'Preço por kWh'), powerPricePerDayCents: money(row.powerPricePerDayCents, 'Preço diário da potência'), annualConsumptionKwh: nonNegativeInteger(row.annualConsumptionKwh, 'Consumo anual'), maxHistoricalPowerKva: nonNegativeNumber(row.maxHistoricalPowerKva, 'Potência histórica') }
  }
  if (row.kind === 'telecom') {
    rejectUnknown(row, ['kind', 'connectionType', 'downloadSpeedMbps', 'uploadSpeedMbps', 'mobileDataGb', 'mobileLines', 'tvIncluded'])
    if (row.tvIncluded !== undefined && typeof row.tvIncluded !== 'boolean') throw new Error('TV incluída inválida')
    return { kind: 'telecom', connectionType: requiredText(row.connectionType, 'Tipo de ligação'), downloadSpeedMbps: nonNegativeInteger(row.downloadSpeedMbps, 'Velocidade'), uploadSpeedMbps: row.uploadSpeedMbps === undefined ? undefined : nonNegativeInteger(row.uploadSpeedMbps, 'Upload'), mobileDataGb: row.mobileDataGb === undefined ? undefined : nonNegativeInteger(row.mobileDataGb, 'Dados móveis'), mobileLines: row.mobileLines === undefined ? undefined : nonNegativeInteger(row.mobileLines, 'Linhas móveis'), tvIncluded: row.tvIncluded as boolean | undefined }
  }
  if (row.kind === 'bank') {
    rejectUnknown(row, ['kind', 'accountMaintenanceFeeCents', 'cardAnnualFeeCents', 'transferFeesCents'])
    return { kind: 'bank', accountMaintenanceFeeCents: money(row.accountMaintenanceFeeCents, 'Comissão de manutenção'), cardAnnualFeeCents: money(row.cardAnnualFeeCents, 'Anuidade do cartão'), transferFeesCents: money(row.transferFeesCents, 'Comissões de transferência') }
  }
  if (row.kind === 'subscription') {
    rejectUnknown(row, ['kind', 'plan', 'lastUsedAt', 'usageFrequency'])
    return { kind: 'subscription', plan: requiredText(row.plan, 'Plano'), lastUsedAt: optionalDate(row.lastUsedAt), usageFrequency: optionalText(row.usageFrequency, 'Frequência de utilização') }
  }
  if (row.kind === 'insurance') {
    rejectUnknown(row, ['kind', 'policyType', 'renewalDate', 'coverageCodes'])
    if (!insurancePolicyTypes.includes(row.policyType as typeof insurancePolicyTypes[number])) throw new Error('Tipo de seguro inválido')
    if (!Array.isArray(row.coverageCodes) || !row.coverageCodes.every(item => insuranceCoverageCodes.includes(item as typeof insuranceCoverageCodes[number])) || new Set(row.coverageCodes).size !== row.coverageCodes.length) throw new Error('Coberturas inválidas')
    return { kind: 'insurance', policyType: row.policyType as typeof insurancePolicyTypes[number], renewalDate: optionalDate(row.renewalDate), coverageCodes: row.coverageCodes as typeof insuranceCoverageCodes[number][] }
  }
  throw new Error('Detalhes inválidos')
}

export const parseExpenseCreateInput = (value: unknown): ExpenseInput => {
  const row = object(value)
  rejectUnknown(row, baseCreateKeys)
  if (!categories.includes(row.category as MvpCategory)) throw new Error('Categoria inválida')
  const details = parseDetails(row.details)
  if (details.kind !== row.category) throw new Error('Detalhes incompatíveis com a categoria')
  const result: ExpenseInput = { category: row.category as MvpCategory, provider: requiredText(row.provider, 'Fornecedor'), productName: requiredText(row.productName, 'Produto'), monthlyCostCents: monthlyMoney(row.monthlyCostCents), details }
  if (row.currency !== undefined) {
    result.currency = requiredText(row.currency, 'Moeda')
    if (result.currency !== 'EUR') throw new Error('A moeda suportada é EUR')
  }
  for (const key of dateKeys) if (row[key] !== undefined) result[key] = optionalDate(row[key])
  validateCommitmentDates(result.contractStartDate, result.commitmentEndDate)
  return result
}

export const parseExpensePatchInput = (value: unknown): ExpensePatchInput => {
  const row = object(value)
  rejectUnknown(row, patchKeys)
  if (!Object.keys(row).length) throw new Error('Nenhuma alteração válida')
  const result: ExpensePatchInput = {}
  if (row.provider !== undefined) result.provider = requiredText(row.provider, 'Fornecedor')
  if (row.productName !== undefined) result.productName = requiredText(row.productName, 'Produto')
  if (row.monthlyCostCents !== undefined) result.monthlyCostCents = monthlyMoney(row.monthlyCostCents)
  if (row.currency !== undefined) {
    result.currency = requiredText(row.currency, 'Moeda')
    if (result.currency !== 'EUR') throw new Error('A moeda suportada é EUR')
  }
  if (row.details !== undefined) result.details = parseDetails(row.details)
  for (const key of dateKeys) if (row[key] !== undefined) result[key] = optionalDate(row[key])
  validateCommitmentDates(result.contractStartDate, result.commitmentEndDate)
  return result
}

export interface PoupancasRepository extends AuthRepository {
  listExpenses(userId: string): Promise<RecurringExpense[]>
  getExpense(userId: string, id: string): Promise<{ expense: RecurringExpense, snapshots: ExpenseSnapshot[], findings: SavingsFinding[] } | null>
  createExpense(userId: string, input: ExpenseInput): Promise<RecurringExpense>
  updateExpense(userId: string, id: string, input: ExpensePatchInput): Promise<RecurringExpense | null>
  listFindings(userId: string): Promise<SavingsFinding[]>
  getFinding(userId: string, id: string): Promise<SavingsFinding | null>
  resolveFinding(userId: string, id: string, newCostCents: number, actionDate: string): Promise<SavingAction>
  dismissFinding(userId: string, id: string): Promise<SavingsFinding>
  listActions(userId: string): Promise<SavingAction[]>
  getHouseholdProfile(userId: string): Promise<HouseholdProfile | null>
  upsertHouseholdProfile(userId: string, input: HouseholdInput): Promise<HouseholdProfile>
  listMonthlySpendPeriods(userId: string): Promise<MonthlySpendPeriod[]>
  upsertMonthlySpendPeriod(userId: string, input: MonthlySpendInput): Promise<MonthlySpendPeriod>
  listAnonymousSpendCohorts(): Promise<AnonymousCohortAggregate[]>
  getSavingsGoal(userId: string): Promise<SavingsGoal | null>
  upsertSavingsGoal(userId: string, input: SavingsGoalInput): Promise<SavingsGoal>
  getSavingsGoalProgress(userId: string): Promise<SavingsGoalProgress | null>
}

const snapshotProperties = (expense: RecurringExpense) => ({ provider: expense.provider, details: structuredClone(expense.details), contractStartDate: expense.contractStartDate, contractEndDate: expense.contractEndDate, commitmentEndDate: expense.commitmentEndDate })
const relevantState = (expense: RecurringExpense) => JSON.stringify({ provider: expense.provider, productName: expense.productName, monthlyCostCents: expense.monthlyCostCents, currency: expense.currency, contractStartDate: expense.contractStartDate, contractEndDate: expense.contractEndDate, commitmentEndDate: expense.commitmentEndDate, details: expense.details })

export interface RepositoryState {
  version: 4
  expenses: RecurringExpense[]
  snapshots: ExpenseSnapshot[]
  findings: SavingsFinding[]
  actions: SavingAction[]
  marketObservations: MarketObservation[]
  owner: StoredOwner | null
  sessions: StoredSession[]
  householdProfiles: HouseholdProfile[]
  monthlySpendPeriods: MonthlySpendPeriod[]
  anonymousCohortAggregates: AnonymousCohortAggregate[]
  savingsGoals: SavingsGoal[]
}

interface MemoryRepositoryOptions { demo?: boolean, state?: RepositoryState }

const initialState = (demo = false): RepositoryState => ({
  version: 4,
  expenses: structuredClone(demo ? demoExpenses : []),
  snapshots: structuredClone(demo ? demoSnapshots : []),
  findings: structuredClone(demo ? demoFindings : []),
  actions: structuredClone(demo ? demoActions : []),
  marketObservations: structuredClone(demoMarketObservations),
  owner: null,
  sessions: [],
  householdProfiles: [],
  monthlySpendPeriods: [],
  anonymousCohortAggregates: [],
  savingsGoals: []
})

const expenseCategories = ['electricity', 'telecom', 'bank', 'subscription', 'gym', 'insurance'] as const
const billingFrequencies = ['monthly', 'quarterly', 'annual'] as const
const findingTypes = ['UNDERUTILIZATION', 'PRICE_INCREASE', 'MARKET_OVERPRICED', 'CONTRACT_EXPIRING', 'CONTRACT_EXPIRED', 'DUPLICATE_SERVICE', 'UNUSED_SERVICE', 'WRONG_PLAN', 'AVOIDABLE_FEE', 'NEGOTIATION_OPPORTUNITY'] as const
const severities = ['info', 'low', 'medium', 'high'] as const
const efforts = ['very_low', 'low', 'medium', 'high'] as const
const urgencies = ['low', 'medium', 'high'] as const
const findingStatuses = ['open', 'resolved', 'dismissed'] as const
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const timestampPattern = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|([+-])(\d{2}):(\d{2}))$/

function assertStored(condition: unknown): asserts condition {
  if (!condition) throw new Error('Ficheiro de dados local corrupto')
}

const storedUuid = (value: unknown) => {
  assertStored(typeof value === 'string' && uuidPattern.test(value))
  return value
}
const storedText = (value: unknown) => {
  assertStored(typeof value === 'string' && Boolean(value.trim()))
  return value
}
const storedDate = (value: unknown) => {
  assertStored(isIsoDate(value))
  return value
}
const storedTimestamp = (value: unknown): string => {
  assertStored(typeof value === 'string')
  const match = timestampPattern.exec(value)
  assertStored(match && isIsoDate(match[1]) && Number(match[2]) <= 23 && Number(match[3]) <= 59 && Number(match[4]) <= 59)
  if (match[5]) assertStored(Number(match[6]) <= 23 && Number(match[7]) <= 59)
  assertStored(!Number.isNaN(Date.parse(value)))
  return value
}
const storedOptionalDate = (value: unknown) => value === undefined ? undefined : storedDate(value)
const storedOptionalTimestamp = (value: unknown) => value === undefined ? undefined : storedTimestamp(value)
const storedOptionalText = (value: unknown) => value === undefined ? undefined : storedText(value)
const storedEnum = <T extends string>(value: unknown, allowed: readonly T[]): T => {
  assertStored(typeof value === 'string' && allowed.includes(value as T))
  return value as T
}
const storedFinite = (value: unknown, minimum: number, maximum: number) => {
  assertStored(typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum)
  return value
}
const storedMoney = (value: unknown) => {
  assertStored(Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= POSTGRES_INTEGER_MAX)
  return value as number
}
const storedObject = (value: unknown) => object(value, 'Ficheiro de dados local corrupto')

const validateStoredDetails = (value: unknown, category: RecurringExpense['category']) => {
  const row = storedObject(value)
  if (category === 'gym' || (category === 'insurance' && row.kind === 'generic')) {
    rejectUnknown(row, ['kind', 'notes'])
    assertStored(row.kind === 'generic')
    storedOptionalText(row.notes)
    return
  }
  const details = parseDetails(value)
  assertStored(details.kind === category)
}

const parseStoredExpense = (value: unknown): RecurringExpense => {
  const row = storedObject(value)
  rejectUnknown(row, ['id', 'userId', 'category', 'provider', 'productName', 'monthlyCostCents', 'billingFrequency', 'currency', 'contractStartDate', 'contractEndDate', 'commitmentEndDate', 'details', 'createdAt', 'updatedAt'])
  const category = storedEnum(row.category, expenseCategories)
  storedUuid(row.id)
  storedUuid(row.userId)
  storedText(row.provider)
  storedText(row.productName)
  storedMoney(row.monthlyCostCents)
  storedEnum(row.billingFrequency, billingFrequencies)
  storedText(row.currency)
  const contractStartDate = storedOptionalDate(row.contractStartDate)
  storedOptionalDate(row.contractEndDate)
  const commitmentEndDate = storedOptionalDate(row.commitmentEndDate)
  validateCommitmentDates(contractStartDate, commitmentEndDate)
  validateStoredDetails(row.details, category)
  const createdAt = storedTimestamp(row.createdAt)
  const updatedAt = storedTimestamp(row.updatedAt)
  assertStored(Date.parse(updatedAt) >= Date.parse(createdAt))
  return row as unknown as RecurringExpense
}

const parseStoredSnapshot = (value: unknown): ExpenseSnapshot => {
  const row = storedObject(value)
  rejectUnknown(row, ['id', 'expenseId', 'observedAt', 'priceCents', 'plan', 'properties', 'source'])
  storedUuid(row.id)
  storedUuid(row.expenseId)
  storedDate(row.observedAt)
  storedMoney(row.priceCents)
  storedOptionalText(row.plan)
  storedObject(row.properties)
  storedText(row.source)
  return row as unknown as ExpenseSnapshot
}

const parseStoredFinding = (value: unknown): SavingsFinding => {
  const row = storedObject(value)
  rejectUnknown(row, ['id', 'expenseId', 'type', 'title', 'description', 'estimatedMonthlySavingMinCents', 'estimatedMonthlySavingMaxCents', 'estimatedAnnualSavingMinCents', 'estimatedAnnualSavingMaxCents', 'confidence', 'severity', 'priority', 'effort', 'urgency', 'action', 'evidence', 'status', 'createdAt', 'resolvedAt', 'dismissedAt'])
  storedUuid(row.id)
  storedUuid(row.expenseId)
  storedEnum(row.type, findingTypes)
  storedText(row.title)
  storedText(row.description)
  const monthlyMin = storedMoney(row.estimatedMonthlySavingMinCents)
  const monthlyMax = storedMoney(row.estimatedMonthlySavingMaxCents)
  const annualMin = storedMoney(row.estimatedAnnualSavingMinCents)
  const annualMax = storedMoney(row.estimatedAnnualSavingMaxCents)
  assertStored(monthlyMin <= monthlyMax && annualMin <= annualMax)
  storedFinite(row.confidence, 0, 1)
  storedEnum(row.severity, severities)
  storedFinite(row.priority, 0, 100)
  storedEnum(row.effort, efforts)
  storedEnum(row.urgency, urgencies)
  storedText(row.action)
  assertStored(Array.isArray(row.evidence))
  row.evidence.forEach(storedText)
  const status = storedEnum(row.status, findingStatuses)
  const createdAt = storedTimestamp(row.createdAt)
  const resolvedAt = storedOptionalTimestamp(row.resolvedAt)
  const dismissedAt = storedOptionalTimestamp(row.dismissedAt)
  assertStored(status === 'open' ? !resolvedAt && !dismissedAt : status === 'resolved' ? Boolean(resolvedAt) && !dismissedAt : Boolean(dismissedAt) && !resolvedAt)
  assertStored(!resolvedAt || Date.parse(resolvedAt) >= Date.parse(createdAt))
  assertStored(!dismissedAt || Date.parse(dismissedAt) >= Date.parse(createdAt))
  return row as unknown as SavingsFinding
}

const parseStoredAction = (value: unknown): SavingAction => {
  const row = storedObject(value)
  rejectUnknown(row, ['id', 'findingId', 'previousCostCents', 'newCostCents', 'actionDate', 'annualSavingCents', 'createdAt'])
  storedUuid(row.id)
  storedUuid(row.findingId)
  const previousCostCents = storedMoney(row.previousCostCents)
  const newCostCents = storedMoney(row.newCostCents)
  const annualSavingCents = storedMoney(row.annualSavingCents)
  assertStored(newCostCents <= previousCostCents && annualSavingCents === annualSaving(previousCostCents, newCostCents))
  storedDate(row.actionDate)
  storedTimestamp(row.createdAt)
  return row as unknown as SavingAction
}

const parseStoredObservation = (value: unknown): MarketObservation => {
  const row = storedObject(value)
  rejectUnknown(row, ['id', 'category', 'provider', 'productType', 'attributes', 'monthlyPriceCents', 'negotiated', 'country', 'observedAt', 'source', 'confidence'])
  storedUuid(row.id)
  storedEnum(row.category, expenseCategories)
  storedText(row.provider)
  storedText(row.productType)
  const attributes = storedObject(row.attributes)
  assertStored(Object.values(attributes).every(item => ['string', 'number', 'boolean'].includes(typeof item) && (typeof item !== 'number' || Number.isFinite(item))))
  storedMoney(row.monthlyPriceCents)
  assertStored(typeof row.negotiated === 'boolean')
  storedText(row.country)
  storedDate(row.observedAt)
  storedText(row.source)
  storedFinite(row.confidence, 0, 1)
  return row as unknown as MarketObservation
}

const parseStoredOwner = (value: unknown): StoredOwner | null => {
  if (value === null || value === undefined) return null
  const row = storedObject(value)
  rejectUnknown(row, ['id', 'name', 'email', 'passwordHash', 'createdAt', 'legacyClaimedAt'])
  storedUuid(row.id)
  storedText(row.name)
  assertStored((row.name as string).length <= 100)
  assertStored(typeof row.email === 'string' && row.email === row.email.toLowerCase() && row.email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))
  assertStored(typeof row.passwordHash === 'string')
  assertStored(Boolean(parsePasswordHash(row.passwordHash as string)))
  storedTimestamp(row.createdAt)
  storedOptionalTimestamp(row.legacyClaimedAt)
  return row as unknown as StoredOwner
}

const parseStoredSession = (value: unknown): StoredSession => {
  const row = storedObject(value)
  rejectUnknown(row, ['id', 'userId', 'tokenHash', 'createdAt', 'expiresAt', 'revokedAt'])
  storedUuid(row.id)
  storedUuid(row.userId)
  assertStored(typeof row.tokenHash === 'string' && /^[a-f0-9]{64}$/.test(row.tokenHash))
  storedTimestamp(row.createdAt)
  storedTimestamp(row.expiresAt)
  const revokedAt = storedOptionalTimestamp(row.revokedAt)
  assertStored(Date.parse(row.expiresAt as string) > Date.parse(row.createdAt as string))
  assertStored(!revokedAt || Date.parse(revokedAt) >= Date.parse(row.createdAt as string))
  return row as unknown as StoredSession
}

const parseStoredHouseholdProfile = (value: unknown): HouseholdProfile => {
  const row = storedObject(value)
  rejectUnknown(row, ['userId', 'adults', 'dependents', 'country', 'effectiveAt', 'updatedAt'])
  storedUuid(row.userId)
  parseHouseholdInput({ adults: row.adults, dependents: row.dependents, country: row.country })
  storedDate(row.effectiveAt)
  storedTimestamp(row.updatedAt)
  return row as unknown as HouseholdProfile
}

const parseStoredSpendPeriod = (value: unknown): MonthlySpendPeriod => {
  const row = storedObject(value)
  rejectUnknown(row, ['id', 'userId', 'month', 'status', 'supermarketCoverage', 'amountBasis', 'country', 'adults', 'dependents', 'adultBand', 'dependentBand', 'createdAt', 'updatedAt', 'amounts'])
  const id = storedUuid(row.id)
  storedUuid(row.userId)
  assertStored(Array.isArray(row.amounts))
  const amounts = row.amounts.map(value => {
    const amount = storedObject(value)
    rejectUnknown(amount, ['id', 'periodId', 'category', 'scope', 'amountCents', 'trackingIntent', 'userTargetCents'])
    storedUuid(amount.id)
    assertStored(amount.periodId === id)
    storedEnum(amount.category, spendCategories)
    storedEnum(amount.scope, spendScopes)
    storedMoney(amount.amountCents)
    storedEnum(amount.trackingIntent, trackingIntents)
    if (amount.userTargetCents !== undefined) storedMoney(amount.userTargetCents)
    return amount
  })
  const parsed = parseMonthlySpendInput({ month: row.month, adults: row.adults, dependents: row.dependents, status: row.status, supermarketCoverage: row.supermarketCoverage, amountBasis: row.amountBasis, amounts: amounts.map(({ category, scope, amountCents, trackingIntent, userTargetCents }) => ({ category, scope, amountCents, trackingIntent, ...(userTargetCents === undefined ? {} : { userTargetCents }) })) })
  assertStored(row.country === 'PT')
  assertStored(row.adultBand === adultBand(parsed.adults))
  assertStored(row.dependentBand === dependentBand(parsed.dependents))
  storedTimestamp(row.createdAt)
  storedTimestamp(row.updatedAt)
  assertStored(parsed.month === row.month && uniqueIds(amounts as Array<{ id: string }>))
  return row as unknown as MonthlySpendPeriod
}

const parseStoredCohort = (value: unknown): AnonymousCohortAggregate => {
  const row = storedObject(value)
  rejectUnknown(row, ['id', 'category', 'scope', 'country', 'adultBand', 'dependentBand', 'supermarketCoverage', 'amountBasis', 'status', 'windowStart', 'windowEnd', 'householdCount', 'p25Cents', 'medianCents', 'p75Cents', 'source', 'confidence'])
  storedUuid(row.id)
  storedEnum(row.category, spendCategories)
  storedEnum(row.scope, spendScopes)
  assertStored(row.country === 'PT')
  assertStored(['1', '2', '3plus'].includes(String(row.adultBand)) && ['0', '1', '2plus'].includes(String(row.dependentBand)))
  storedEnum(row.supermarketCoverage, supermarketCoverages)
  storedEnum(row.amountBasis, amountBases)
  storedEnum(row.status, spendStatuses)
  storedDate(row.windowStart)
  storedDate(row.windowEnd)
  const count = storedMoney(row.householdCount)
  const p25 = storedMoney(row.p25Cents)
  const median = storedMoney(row.medianCents)
  const p75 = storedMoney(row.p75Cents)
  storedText(row.source)
  storedFinite(row.confidence, 0, 1)
  assertStored(count >= 0 && p25 <= median && median <= p75)
  return row as unknown as AnonymousCohortAggregate
}

const parseStoredSavingsGoal = (value: unknown): SavingsGoal => {
  const row = storedObject(value)
  rejectUnknown(row, ['id', 'userId', 'name', 'targetAnnualCents', 'createdAt', 'updatedAt'])
  storedUuid(row.id)
  storedUuid(row.userId)
  parseSavingsGoalInput({ name: row.name, targetAnnualCents: row.targetAnnualCents })
  const createdAt = storedTimestamp(row.createdAt)
  const updatedAt = storedTimestamp(row.updatedAt)
  assertStored(Date.parse(updatedAt) >= Date.parse(createdAt))
  return row as unknown as SavingsGoal
}

const uniqueIds = (items: Array<{ id: string }>) => new Set(items.map(item => item.id)).size === items.length

const parseRepositoryState = (value: unknown): RepositoryState => {
  try {
    const row = storedObject(value)
    const version = row.version
    const baseKeys = ['version', 'expenses', 'snapshots', 'findings', 'actions', 'marketObservations', 'owner', 'sessions']
    const spendingKeys = ['householdProfiles', 'monthlySpendPeriods', 'anonymousCohortAggregates']
    const goalKeys = ['savingsGoals']
    rejectUnknown(row, version === 1 ? ['version', 'expenses', 'snapshots', 'findings', 'actions'] : version === 3 ? [...baseKeys, ...spendingKeys] : version === 4 ? [...baseKeys, ...spendingKeys, ...goalKeys] : baseKeys)
    assertStored((version === 1 || version === 2 || version === 3 || version === 4) && Array.isArray(row.expenses) && Array.isArray(row.snapshots) && Array.isArray(row.findings) && Array.isArray(row.actions))
    if (version === 2 || version === 3 || version === 4) assertStored(Array.isArray(row.marketObservations) && Array.isArray(row.sessions))
    if (version === 3 || version === 4) assertStored(Array.isArray(row.householdProfiles) && Array.isArray(row.monthlySpendPeriods) && Array.isArray(row.anonymousCohortAggregates))
    if (version === 4) assertStored(Array.isArray(row.savingsGoals))
    const expenses = row.expenses.map(parseStoredExpense)
    const snapshots = row.snapshots.map(parseStoredSnapshot)
    const findings = row.findings.map(parseStoredFinding)
    const actions = row.actions.map(parseStoredAction)
    const marketObservations = version === 1 ? structuredClone(demoMarketObservations) : (row.marketObservations as unknown[]).map(parseStoredObservation)
    const owner = version === 1 ? null : parseStoredOwner(row.owner)
    const sessions = version === 1 ? [] : (row.sessions as unknown[]).map(parseStoredSession)
    const householdProfiles = version === 3 || version === 4 ? (row.householdProfiles as unknown[]).map(parseStoredHouseholdProfile) : []
    const monthlySpendPeriods = version === 3 || version === 4 ? (row.monthlySpendPeriods as unknown[]).map(parseStoredSpendPeriod) : []
    const anonymousCohortAggregates = version === 3 || version === 4 ? (row.anonymousCohortAggregates as unknown[]).map(parseStoredCohort) : []
    const savingsGoals = version === 4 ? (row.savingsGoals as unknown[]).map(parseStoredSavingsGoal) : []
    assertStored(uniqueIds(expenses) && uniqueIds(snapshots) && uniqueIds(findings) && uniqueIds(actions) && uniqueIds(marketObservations) && uniqueIds(sessions) && uniqueIds(monthlySpendPeriods) && uniqueIds(anonymousCohortAggregates))
    assertStored(new Set(householdProfiles.map(item => item.userId)).size === householdProfiles.length)
    assertStored(new Set(savingsGoals.map(item => item.userId)).size === savingsGoals.length)
    assertStored(new Set(monthlySpendPeriods.map(item => `${item.userId}:${item.month}`)).size === monthlySpendPeriods.length)
    assertStored(uniqueIds(monthlySpendPeriods.flatMap(item => item.amounts)))
    const expenseIds = new Set(expenses.map(item => item.id))
    const findingsById = new Map(findings.map(item => [item.id, item]))
    const actionIds = new Set(actions.map(item => item.id))
    assertStored(snapshots.every(item => expenseIds.has(item.expenseId)))
    assertStored(findings.every(item => expenseIds.has(item.expenseId)))
    assertStored(actions.every(item => findingsById.get(item.findingId)?.status === 'resolved'))
    assertStored(new Set(actions.map(item => item.findingId)).size === actions.length)
    assertStored(new Set(findings.filter(item => item.status === 'open').map(item => `${item.expenseId}:${item.type}`)).size === findings.filter(item => item.status === 'open').length)
    assertStored(sessions.every(item => owner && item.userId === owner.id))
    for (const snapshot of snapshots) {
      const savingActionId = snapshot.properties.savingActionId
      if (savingActionId !== undefined) assertStored(typeof savingActionId === 'string' && actionIds.has(savingActionId))
    }
    return structuredClone({ version: 4, expenses, snapshots, findings, actions, marketObservations, owner, sessions, householdProfiles, monthlySpendPeriods, anonymousCohortAggregates, savingsGoals })
  } catch {
    throw new Error('Ficheiro de dados local corrupto')
  }
}

export class MemoryRepository implements PoupancasRepository {
  private expenses: RecurringExpense[]
  private snapshots: ExpenseSnapshot[]
  private findings: SavingsFinding[]
  private actions: SavingAction[]
  private observations: MarketObservation[]
  private owner: StoredOwner | null
  private sessions: StoredSession[]
  private householdProfiles: HouseholdProfile[]
  private monthlySpendPeriods: MonthlySpendPeriod[]
  private anonymousCohortAggregates: AnonymousCohortAggregate[]
  private savingsGoals: SavingsGoal[]
  private engine = createSavingsEngine()

  constructor(options: MemoryRepositoryOptions = {}) {
    const state = options.state || initialState(options.demo)
    this.expenses = structuredClone(state.expenses)
    this.snapshots = structuredClone(state.snapshots)
    this.findings = structuredClone(state.findings)
    this.actions = structuredClone(state.actions)
    this.observations = structuredClone(state.marketObservations)
    this.owner = structuredClone(state.owner)
    this.sessions = structuredClone(state.sessions)
    this.householdProfiles = structuredClone(state.householdProfiles)
    this.monthlySpendPeriods = structuredClone(state.monthlySpendPeriods)
    this.anonymousCohortAggregates = structuredClone(state.anonymousCohortAggregates)
    this.savingsGoals = structuredClone(state.savingsGoals)
  }

  exportState(): RepositoryState {
    return structuredClone({ version: 4, expenses: this.expenses, snapshots: this.snapshots, findings: this.findings, actions: this.actions, marketObservations: this.observations, owner: this.owner, sessions: this.sessions, householdProfiles: this.householdProfiles, monthlySpendPeriods: this.monthlySpendPeriods, anonymousCohortAggregates: this.anonymousCohortAggregates, savingsGoals: this.savingsGoals })
  }

  async getOwner() { return structuredClone(this.owner) }
  async registerOwner(owner: StoredOwner, session: StoredSession, legacyUserId: string) {
    if (this.owner) throw new Error('Esta área pessoal já tem proprietário.')
    this.owner = structuredClone({ ...owner, legacyClaimedAt: owner.createdAt })
    this.sessions = [structuredClone(session)]
    for (const expense of this.expenses) if (expense.userId === legacyUserId) expense.userId = owner.id
  }
  async replaceSessions(session: StoredSession) {
    if (!this.owner || session.userId !== this.owner.id) throw new Error('Conta não encontrada.')
    const now = session.createdAt
    this.sessions.forEach(item => { if (!item.revokedAt) item.revokedAt = now })
    this.sessions.push(structuredClone(session))
  }
  async getSession(tokenHash: string) {
    const session = this.sessions.find(item => item.tokenHash === tokenHash)
    return session && this.owner && session.userId === this.owner.id ? structuredClone({ owner: this.owner, session }) : null
  }
  async revokeSession(tokenHash: string, revokedAt: string) {
    const session = this.sessions.find(item => item.tokenHash === tokenHash)
    if (session && !session.revokedAt) session.revokedAt = revokedAt
  }
  async claimLegacyExpenses(ownerId: string, legacyUserId: string, claimedAt: string) {
    if (!this.owner || this.owner.id !== ownerId) throw new Error('Conta não encontrada.')
    for (const expense of this.expenses) if (expense.userId === legacyUserId) expense.userId = ownerId
    this.owner.legacyClaimedAt = claimedAt
  }

  async listExpenses(userId: string) { return structuredClone(this.expenses.filter(item => item.userId === userId)) }
  async getExpense(userId: string, id: string) {
    await this.refreshInsuranceFindings(userId)
    const expense = this.expenses.find(item => item.id === id && item.userId === userId)
    return expense ? structuredClone({ expense, snapshots: this.snapshots.filter(item => item.expenseId === id), findings: this.findings.filter(item => item.expenseId === id) }) : null
  }
  private async generate(userId: string, expense: RecurringExpense, snapshots = this.snapshots, expenses = this.expenses, excludedTypes: SavingsFinding['type'][] = []) {
    const closedCycles = expense.category === 'insurance'
      ? new Set(this.findings.filter(item => item.expenseId === expense.id && item.status !== 'open').map(findingCycleKey))
      : new Set<string>()
    return (await this.engine.analyze(expense, { now: new Date(), snapshots, marketObservations: this.observations, expenses: expenses.filter(item => item.userId === userId) }))
      .filter(item => !excludedTypes.includes(item.type) && !closedCycles.has(findingCycleKey(item)))
  }
  private reconcile(expense: RecurringExpense, generated: SavingsFinding[]) {
    const generatedTypes = new Set(generated.map(item => item.type))
    const timestamp = new Date().toISOString()
    for (const existing of this.findings.filter(item => item.expenseId === expense.id && item.status === 'open' && !generatedTypes.has(item.type))) {
      existing.status = 'dismissed'
      existing.dismissedAt = timestamp
    }
    for (const finding of generated) {
      const existing = this.findings.find(item => item.expenseId === expense.id && item.type === finding.type && item.status === 'open')
      if (existing) Object.assign(existing, { ...finding, id: existing.id, createdAt: existing.createdAt })
      else this.findings.push(finding)
    }
  }
  private async refreshInsuranceFindings(userId: string) {
    for (const expense of this.expenses.filter(item => item.userId === userId && item.category === 'insurance' && item.details.kind === 'insurance')) {
      this.reconcile(expense, await this.generate(userId, expense))
    }
  }
  async createExpense(userId: string, raw: ExpenseInput) {
    const input = parseExpenseCreateInput(raw)
    const now = new Date().toISOString()
    const expense: RecurringExpense = { id: crypto.randomUUID(), userId, category: input.category, provider: input.provider, productName: input.productName, monthlyCostCents: input.monthlyCostCents, billingFrequency: 'monthly', currency: input.currency || 'EUR', contractStartDate: input.contractStartDate, contractEndDate: input.contractEndDate, commitmentEndDate: input.commitmentEndDate, details: structuredClone(input.details), createdAt: now, updatedAt: now }
    const snapshot: ExpenseSnapshot = { id: crypto.randomUUID(), expenseId: expense.id, observedAt: now.slice(0, 10), priceCents: expense.monthlyCostCents, plan: expense.productName, properties: snapshotProperties(expense), source: 'manual' }
    const generated = await this.generate(userId, expense, [...this.snapshots, snapshot], [...this.expenses, expense])
    this.expenses.push(expense)
    this.snapshots.push(snapshot)
    this.reconcile(expense, generated)
    return structuredClone(expense)
  }
  async updateExpense(userId: string, id: string, raw: ExpensePatchInput) {
    const input = parseExpensePatchInput(raw)
    const item = this.expenses.find(expense => expense.id === id && expense.userId === userId)
    if (!item) return null
    if (input.details && input.details.kind !== item.category) throw new Error('Detalhes incompatíveis com a categoria')
    const before = relevantState(item)
    const candidate: RecurringExpense = { ...structuredClone(item), ...structuredClone(input), updatedAt: new Date().toISOString() }
    validateCommitmentDates(candidate.contractStartDate, candidate.commitmentEndDate)
    const changed = relevantState(candidate) !== before
    if (!changed) return structuredClone(item)
    const snapshot: ExpenseSnapshot = { id: crypto.randomUUID(), expenseId: candidate.id, observedAt: candidate.updatedAt.slice(0, 10), priceCents: candidate.monthlyCostCents, plan: candidate.details.kind === 'subscription' ? candidate.details.plan : candidate.productName, properties: snapshotProperties(candidate), source: 'manual_update' }
    const expenses = this.expenses.map(expense => expense.id === id ? candidate : expense)
    const generated = await this.generate(userId, candidate, [...this.snapshots, snapshot], expenses)
    Object.assign(item, candidate)
    this.snapshots.push(snapshot)
    this.reconcile(item, generated)
    return structuredClone(item)
  }
  async listFindings(userId: string) {
    await this.refreshInsuranceFindings(userId)
    const ids = new Set(this.expenses.filter(item => item.userId === userId).map(item => item.id))
    return structuredClone(this.findings.filter(item => ids.has(item.expenseId)).sort((a, b) => b.priority - a.priority))
  }
  async getFinding(userId: string, id: string) { return (await this.listFindings(userId)).find(item => item.id === id) || null }
  async resolveFinding(userId: string, id: string, newCostCents: number, actionDate: string) {
    monthlyMoney(newCostCents, 'Novo custo')
    if (!isIsoDate(actionDate)) throw new Error('Data inválida')
    const finding = this.findings.find(item => item.id === id && item.status === 'open')
    const expense = finding && this.expenses.find(item => item.id === finding.expenseId && item.userId === userId)
    if (!finding || !expense) throw new Error('Finding não encontrado ou já fechado')
    if (finding.estimatedMonthlySavingMaxCents <= 0) throw new Error('Esta revisão não tem uma poupança estimada e só pode ser concluída sem registar uma ação de poupança')
    if (newCostCents > expense.monthlyCostCents) throw new Error('O novo custo não pode ser superior ao custo anterior')
    const timestamp = new Date().toISOString()
    const action: SavingAction = { id: crypto.randomUUID(), findingId: finding.id, previousCostCents: expense.monthlyCostCents, newCostCents, actionDate, annualSavingCents: annualSaving(expense.monthlyCostCents, newCostCents), createdAt: timestamp }
    const candidate: RecurringExpense = { ...structuredClone(expense), monthlyCostCents: newCostCents, updatedAt: timestamp }
    const snapshot: ExpenseSnapshot = { id: crypto.randomUUID(), expenseId: candidate.id, observedAt: actionDate, priceCents: newCostCents, plan: candidate.productName, properties: { ...snapshotProperties(candidate), savingActionId: action.id }, source: 'saving_action' }
    const expenses = this.expenses.map(item => item.id === candidate.id ? candidate : item)
    const generated = await this.generate(userId, candidate, [...this.snapshots, snapshot], expenses, [finding.type])
    finding.status = 'resolved'
    finding.resolvedAt = timestamp
    Object.assign(expense, candidate)
    this.snapshots.push(snapshot)
    this.actions.push(action)
    this.reconcile(expense, generated)
    return structuredClone(action)
  }
  async dismissFinding(userId: string, id: string) {
    const finding = this.findings.find(item => item.id === id && item.status === 'open' && this.expenses.some(expense => expense.id === item.expenseId && expense.userId === userId))
    if (!finding) throw new Error('Finding não encontrado ou já fechado')
    finding.status = 'dismissed'
    finding.dismissedAt = new Date().toISOString()
    return structuredClone(finding)
  }
  async listActions(userId: string) {
    const findingIds = new Set(this.findings.filter(finding => this.expenses.some(expense => expense.id === finding.expenseId && expense.userId === userId)).map(item => item.id))
    return structuredClone(this.actions.filter(item => findingIds.has(item.findingId)))
  }
  async getHouseholdProfile(userId: string) { return structuredClone(this.householdProfiles.find(item => item.userId === userId) || null) }
  async upsertHouseholdProfile(userId: string, raw: HouseholdInput) {
    const input = parseHouseholdInput(raw)
    const now = new Date().toISOString()
    const existing = this.householdProfiles.find(item => item.userId === userId)
    if (existing) {
      Object.assign(existing, input, { updatedAt: now })
      return structuredClone(existing)
    }
    const profile: HouseholdProfile = { userId, ...input, effectiveAt: now.slice(0, 10), updatedAt: now }
    this.householdProfiles.push(profile)
    return structuredClone(profile)
  }
  async listMonthlySpendPeriods(userId: string) {
    return structuredClone(this.monthlySpendPeriods.filter(item => item.userId === userId).sort((a, b) => b.month.localeCompare(a.month)))
  }
  async upsertMonthlySpendPeriod(userId: string, raw: MonthlySpendInput) {
    const input = parseMonthlySpendInput(raw)
    const now = new Date().toISOString()
    const existing = this.monthlySpendPeriods.find(item => item.userId === userId && item.month === input.month)
    const id = existing?.id || crypto.randomUUID()
    const amounts = input.amounts.map(amount => ({ id: crypto.randomUUID(), periodId: id, ...structuredClone(amount) }))
    const period: MonthlySpendPeriod = {
      id,
      userId,
      month: input.month,
      status: input.status,
      supermarketCoverage: input.supermarketCoverage,
      amountBasis: input.amountBasis,
      country: 'PT',
      adults: input.adults,
      dependents: input.dependents,
      adultBand: adultBand(input.adults),
      dependentBand: dependentBand(input.dependents),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      amounts
    }
    if (existing) Object.assign(existing, period)
    else this.monthlySpendPeriods.push(period)
    return structuredClone(period)
  }
  async listAnonymousSpendCohorts() { return structuredClone(this.anonymousCohortAggregates) }
  async getSavingsGoal(userId: string) { return structuredClone(this.savingsGoals.find(item => item.userId === userId) || null) }
  async upsertSavingsGoal(userId: string, raw: SavingsGoalInput) {
    const input = parseSavingsGoalInput(raw)
    const now = new Date().toISOString()
    const existing = this.savingsGoals.find(item => item.userId === userId)
    if (existing) {
      Object.assign(existing, input, { updatedAt: now })
      return structuredClone(existing)
    }
    const goal: SavingsGoal = { id: crypto.randomUUID(), userId, ...input, createdAt: now, updatedAt: now }
    this.savingsGoals.push(goal)
    return structuredClone(goal)
  }
  async getSavingsGoalProgress(userId: string) {
    const goal = await this.getSavingsGoal(userId)
    return goal ? confirmedGoalProgress(goal, await this.listActions(userId)) : null
  }
}

const fileMutationQueues = new Map<string, Promise<void>>()

export class JsonFileRepository implements PoupancasRepository {
  private repository!: MemoryRepository
  private readonly ready: Promise<void>
  private mutations: Promise<void> = Promise.resolve()

  constructor(private readonly file: string, private readonly demo = false) {
    this.ready = this.load(demo)
  }

  private async load(demo: boolean) {
    try {
      const state = parseRepositoryState(JSON.parse(await readFile(this.file, 'utf8')))
      this.repository = new MemoryRepository({ state })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.repository = new MemoryRepository({ demo })
        return
      }
      if (error instanceof SyntaxError || (error instanceof Error && error.message === 'Ficheiro de dados local corrupto')) throw new Error(`Ficheiro de dados local corrupto: ${this.file}`, { cause: error })
      throw error
    }
  }

  private async persist() {
    await mkdir(dirname(this.file), { recursive: true })
    const temporary = `${this.file}.${process.pid}.${crypto.randomUUID()}.tmp`
    try {
      await writeFile(temporary, `${JSON.stringify(this.repository.exportState(), null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
      await rename(temporary, this.file)
    } finally {
      await rm(temporary, { force: true })
    }
  }

  private mutate<T>(operation: () => Promise<T>): Promise<T> {
    const previous = fileMutationQueues.get(this.file) || Promise.resolve()
    const result = previous.then(async () => {
      await this.ready
      await this.load(this.demo)
      const value = await operation()
      await this.persist()
      return value
    })
    const settled = result.then(() => undefined, () => undefined)
    fileMutationQueues.set(this.file, settled)
    this.mutations = settled
    return result
  }

  private async read<T>(operation: () => Promise<T>) {
    await this.ready
    await (fileMutationQueues.get(this.file) || Promise.resolve())
    await this.load(this.demo)
    return operation()
  }

  listExpenses(userId: string) { return this.read(() => this.repository.listExpenses(userId)) }
  getOwner() { return this.read(() => this.repository.getOwner()) }
  registerOwner(owner: StoredOwner, session: StoredSession, legacyUserId: string) { return this.mutate(() => this.repository.registerOwner(owner, session, legacyUserId)) }
  replaceSessions(session: StoredSession) { return this.mutate(() => this.repository.replaceSessions(session)) }
  getSession(tokenHash: string) { return this.read(() => this.repository.getSession(tokenHash)) }
  revokeSession(tokenHash: string, revokedAt: string) { return this.mutate(() => this.repository.revokeSession(tokenHash, revokedAt)) }
  claimLegacyExpenses(ownerId: string, legacyUserId: string, claimedAt: string) { return this.mutate(() => this.repository.claimLegacyExpenses(ownerId, legacyUserId, claimedAt)) }
  getExpense(userId: string, id: string) { return this.mutate(() => this.repository.getExpense(userId, id)) }
  createExpense(userId: string, input: ExpenseInput) { return this.mutate(() => this.repository.createExpense(userId, input)) }
  updateExpense(userId: string, id: string, input: ExpensePatchInput) { return this.mutate(() => this.repository.updateExpense(userId, id, input)) }
  listFindings(userId: string) { return this.mutate(() => this.repository.listFindings(userId)) }
  getFinding(userId: string, id: string) { return this.mutate(() => this.repository.getFinding(userId, id)) }
  resolveFinding(userId: string, id: string, newCostCents: number, actionDate: string) { return this.mutate(() => this.repository.resolveFinding(userId, id, newCostCents, actionDate)) }
  dismissFinding(userId: string, id: string) { return this.mutate(() => this.repository.dismissFinding(userId, id)) }
  listActions(userId: string) { return this.read(() => this.repository.listActions(userId)) }
  getHouseholdProfile(userId: string) { return this.read(() => this.repository.getHouseholdProfile(userId)) }
  upsertHouseholdProfile(userId: string, input: HouseholdInput) { return this.mutate(() => this.repository.upsertHouseholdProfile(userId, input)) }
  listMonthlySpendPeriods(userId: string) { return this.read(() => this.repository.listMonthlySpendPeriods(userId)) }
  upsertMonthlySpendPeriod(userId: string, input: MonthlySpendInput) { return this.mutate(() => this.repository.upsertMonthlySpendPeriod(userId, input)) }
  listAnonymousSpendCohorts() { return this.read(() => this.repository.listAnonymousSpendCohorts()) }
  getSavingsGoal(userId: string) { return this.read(() => this.repository.getSavingsGoal(userId)) }
  upsertSavingsGoal(userId: string, input: SavingsGoalInput) { return this.mutate(() => this.repository.upsertSavingsGoal(userId, input)) }
  getSavingsGoalProgress(userId: string) { return this.read(() => this.repository.getSavingsGoalProgress(userId)) }
}

let postgres: PostgresRepository | undefined
let local: JsonFileRepository | undefined
let localKey = ''
export type StorageMode = 'local-json' | 'postgresql'
export const getStorageMode = (): StorageMode => process.env.DATABASE_URL ? 'postgresql' : 'local-json'
export const getRepository = (): PoupancasRepository => {
  const url = process.env.DATABASE_URL
  if (!url) {
    const file = resolve(process.env.LOCAL_DATA_FILE || '.data/bleedingmoney.json')
    const key = `${file}:${process.env.BLEEDINGMONEY_DEMO === 'true'}`
    if (!local || localKey !== key) {
      local = new JsonFileRepository(file, process.env.BLEEDINGMONEY_DEMO === 'true')
      localKey = key
    }
    return local
  }
  postgres ||= new PostgresRepository(url)
  return postgres
}
