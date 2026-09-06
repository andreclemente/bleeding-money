import { annualSaving } from '../../domain/savings'
import type { ExpenseDetails, ExpenseSnapshot, MarketObservation, RecurringExpense, SavingAction, SavingsFinding } from '../../domain/types'
import { createSavingsEngine } from '../services/savings-engine'
import { PostgresRepository } from './postgres-repository'
import { demoActions, demoExpenses, demoFindings, demoMarketObservations, demoSnapshots } from './demo-data'

type MvpCategory = Extract<RecurringExpense['category'], 'electricity' | 'telecom' | 'bank' | 'subscription'>
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

const categories = ['electricity', 'telecom', 'bank', 'subscription'] as const
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
  throw new Error('Detalhes inválidos')
}

export const parseExpenseCreateInput = (value: unknown): ExpenseInput => {
  const row = object(value)
  rejectUnknown(row, baseCreateKeys)
  if (!categories.includes(row.category as MvpCategory)) throw new Error('Categoria inválida')
  const details = parseDetails(row.details)
  if (details.kind !== row.category) throw new Error('Detalhes incompatíveis com a categoria')
  const result: ExpenseInput = { category: row.category as MvpCategory, provider: requiredText(row.provider, 'Fornecedor'), productName: requiredText(row.productName, 'Produto'), monthlyCostCents: monthlyMoney(row.monthlyCostCents), details }
  if (row.currency !== undefined) result.currency = requiredText(row.currency, 'Moeda')
  for (const key of dateKeys) if (row[key] !== undefined) result[key] = optionalDate(row[key])
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
  if (row.currency !== undefined) result.currency = requiredText(row.currency, 'Moeda')
  if (row.details !== undefined) result.details = parseDetails(row.details)
  for (const key of dateKeys) if (row[key] !== undefined) result[key] = optionalDate(row[key])
  return result
}

export interface PoupancasRepository {
  listExpenses(userId: string): Promise<RecurringExpense[]>
  getExpense(userId: string, id: string): Promise<{ expense: RecurringExpense, snapshots: ExpenseSnapshot[], findings: SavingsFinding[] } | null>
  createExpense(userId: string, input: ExpenseInput): Promise<RecurringExpense>
  updateExpense(userId: string, id: string, input: ExpensePatchInput): Promise<RecurringExpense | null>
  listFindings(userId: string): Promise<SavingsFinding[]>
  getFinding(userId: string, id: string): Promise<SavingsFinding | null>
  resolveFinding(userId: string, id: string, newCostCents: number, actionDate: string): Promise<SavingAction>
  dismissFinding(userId: string, id: string): Promise<SavingsFinding>
  listActions(userId: string): Promise<SavingAction[]>
}

const snapshotProperties = (expense: RecurringExpense) => ({ provider: expense.provider, details: structuredClone(expense.details), contractStartDate: expense.contractStartDate, contractEndDate: expense.contractEndDate, commitmentEndDate: expense.commitmentEndDate })
const relevantState = (expense: RecurringExpense) => JSON.stringify({ provider: expense.provider, productName: expense.productName, monthlyCostCents: expense.monthlyCostCents, currency: expense.currency, contractStartDate: expense.contractStartDate, contractEndDate: expense.contractEndDate, commitmentEndDate: expense.commitmentEndDate, details: expense.details })

export class MemoryRepository implements PoupancasRepository {
  private expenses = structuredClone(demoExpenses)
  private snapshots = structuredClone(demoSnapshots)
  private findings = structuredClone(demoFindings)
  private actions = structuredClone(demoActions)
  private observations: MarketObservation[] = structuredClone(demoMarketObservations)
  private engine = createSavingsEngine()

  async listExpenses(userId: string) { return structuredClone(this.expenses.filter(item => item.userId === userId)) }
  async getExpense(userId: string, id: string) {
    const expense = this.expenses.find(item => item.id === id && item.userId === userId)
    return expense ? structuredClone({ expense, snapshots: this.snapshots.filter(item => item.expenseId === id), findings: this.findings.filter(item => item.expenseId === id) }) : null
  }
  private async generate(userId: string, expense: RecurringExpense, snapshots = this.snapshots, expenses = this.expenses, excludedTypes: SavingsFinding['type'][] = []) {
    return (await this.engine.analyze(expense, { now: new Date(), snapshots, marketObservations: this.observations, expenses: expenses.filter(item => item.userId === userId) })).filter(item => !excludedTypes.includes(item.type))
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
}

const memory = new MemoryRepository()
let postgres: PostgresRepository | undefined
export const getRepository = (): PoupancasRepository => {
  const url = process.env.DATABASE_URL
  if (!url) return memory
  postgres ||= new PostgresRepository(url)
  return postgres
}
