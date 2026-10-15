import { calculateMoneyAtRisk, type MonthlySpendPeriod } from './spending'
import { buildContractRadar, type ContractRadarItem } from './contract-agenda'
import type { SavingsGoalProgress } from './savings-goal'
import type { RecurringExpense, SavingAction, SavingsFinding } from './types'

export type FamilyRouteAction =
  | { kind: 'contract_deadline', expenseId: string, eventKind: ContractRadarItem['kind'], label: string, action: string, date: string, daysUntil: number }
  | { kind: 'estimated_finding', expenseId: string, findingId: string }
  | { kind: 'spending_limit_experiment', periodId: string, conditionalAnnualCents: number }
  | { kind: 'factual_finding', expenseId: string, findingId: string }
  | { kind: 'define_goal', confirmedAnnualCents: number }
  | { kind: 'build_own_history', recordedMonths: number, missingMonths: number }
  | { kind: 'clear' }
  | { kind: 'empty' }

export interface FamilyAuditCase {
  expense: RecurringExpense
  finding: SavingsFinding
  evidenceKind: 'estimate' | 'fact'
  monthlySavingMinCents: number
  monthlySavingMaxCents: number
}

export interface FamilyRouteInput {
  civilDate: string
  expenses: RecurringExpense[]
  findings: SavingsFinding[]
  actions: SavingAction[]
  periods: MonthlySpendPeriod[]
  goal: SavingsGoalProgress | null
}

const civilDatePattern = /^\d{4}-\d{2}-\d{2}$/
const utcDay = (value: string) => Date.parse(`${value}T00:00:00.000Z`)
const assertMoney = (value: number) => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Valor monetário inválido')
  return value
}
const addMoney = (total: number, value: number) => {
  const next = assertMoney(total) + assertMoney(value)
  if (!Number.isSafeInteger(next)) throw new Error('Total monetário inválido')
  return next
}
const isEstimated = (finding: SavingsFinding) => finding.estimatedMonthlySavingMinCents > 0 || finding.estimatedMonthlySavingMaxCents > 0
const findingOrder = (left: SavingsFinding, right: SavingsFinding) => right.priority - left.priority || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
const routeFindingOrder = (left: SavingsFinding, right: SavingsFinding) => Number(isEstimated(right)) - Number(isEstimated(left)) || findingOrder(left, right)

const deadlineAction = (item: ContractRadarItem): FamilyRouteAction => ({
  kind: 'contract_deadline',
  expenseId: item.expenseId,
  eventKind: item.kind,
  label: item.label,
  action: item.action,
  date: item.date,
  daysUntil: item.daysUntil
})

export const buildFamilyRoute = (input: FamilyRouteInput) => {
  if (!civilDatePattern.test(input.civilDate) || Number.isNaN(utcDay(input.civilDate)) || new Date(utcDay(input.civilDate)).toISOString().slice(0, 10) !== input.civilDate) throw new Error('Data civil inválida')

  for (const expense of input.expenses) assertMoney(expense.monthlyCostCents)
  for (const action of input.actions) assertMoney(action.annualSavingCents)
  for (const finding of input.findings) {
    const minimum = assertMoney(finding.estimatedMonthlySavingMinCents)
    const maximum = assertMoney(finding.estimatedMonthlySavingMaxCents)
    if (minimum > maximum) throw new Error('Intervalo monetário inválido')
  }

  const expenseById = new Map(input.expenses.map(expense => [expense.id, expense]))
  const grouped = new Map<string, SavingsFinding[]>()
  for (const finding of input.findings) {
    if (finding.status !== 'open' || !expenseById.has(finding.expenseId)) continue
    const group = grouped.get(finding.expenseId) || []
    group.push(finding)
    grouped.set(finding.expenseId, group)
  }
  const cases: FamilyAuditCase[] = [...grouped.entries()]
    .map(([expenseId, findings]) => {
      const expense = expenseById.get(expenseId)!
      const finding = [...findings].sort(routeFindingOrder)[0]!
      return {
        expense,
        finding,
        evidenceKind: isEstimated(finding) ? 'estimate' as const : 'fact' as const,
        monthlySavingMinCents: Math.min(finding.estimatedMonthlySavingMinCents, expense.monthlyCostCents),
        monthlySavingMaxCents: Math.min(finding.estimatedMonthlySavingMaxCents, expense.monthlyCostCents)
      }
    })
    .sort((left, right) => findingOrder(left.finding, right.finding))

  const estimatedCases = cases.filter(item => item.evidenceKind === 'estimate')
  const identifiedMonthlyRangeCents = estimatedCases.reduce((range, item) => ({
    minCents: addMoney(range.minCents, item.monthlySavingMinCents),
    maxCents: addMoney(range.maxCents, item.monthlySavingMaxCents)
  }), { minCents: 0, maxCents: 0 })

  const periods = [...input.periods].sort((left, right) => right.month.localeCompare(left.month) || right.updatedAt.localeCompare(left.updatedAt))
  const latestPeriod = periods[0]
  const comparableMonths = latestPeriod
    ? periods.filter(item => item.month < latestPeriod.month && item.supermarketCoverage === latestPeriod.supermarketCoverage && item.amountBasis === latestPeriod.amountBasis).length
    : 0
  const plan = latestPeriod ? calculateMoneyAtRisk(latestPeriod.amounts) : null
  const conditionalAnnualPlanCents = plan?.annualCents || 0
  const confirmedAnnualCents = input.actions.reduce((sum, action) => addMoney(sum, action.annualSavingCents), 0)
  const deadlines = buildContractRadar(input.expenses, input.civilDate)
  const urgentDeadline = deadlines.find(item => item.daysUntil <= 15)
  const laterDeadline = deadlines.find(item => item.daysUntil >= 16)
  const estimatedCase = estimatedCases[0]
  const factualCase = cases.find(item => item.evidenceKind === 'fact')

  let nextAction: FamilyRouteAction
  if (urgentDeadline) nextAction = deadlineAction(urgentDeadline)
  else if (estimatedCase) nextAction = { kind: 'estimated_finding', expenseId: estimatedCase.expense.id, findingId: estimatedCase.finding.id }
  else if (laterDeadline) nextAction = deadlineAction(laterDeadline)
  else if (latestPeriod && conditionalAnnualPlanCents > 0) nextAction = { kind: 'spending_limit_experiment', periodId: latestPeriod.id, conditionalAnnualCents: conditionalAnnualPlanCents }
  else if (factualCase) nextAction = { kind: 'factual_finding', expenseId: factualCase.expense.id, findingId: factualCase.finding.id }
  else if (!input.goal && confirmedAnnualCents > 0) nextAction = { kind: 'define_goal', confirmedAnnualCents }
  else if (latestPeriod && comparableMonths < 3) nextAction = { kind: 'build_own_history', recordedMonths: comparableMonths, missingMonths: 3 - comparableMonths }
  else if (!input.expenses.length && !periods.length) nextAction = { kind: 'empty' }
  else nextAction = { kind: 'clear' }

  return {
    civilDate: input.civilDate,
    nextAction,
    monthlyRecurringConfirmedCents: input.expenses.reduce((sum, expense) => addMoney(sum, expense.monthlyCostCents), 0),
    confirmedAnnualCents,
    identifiedMonthlyRangeCents,
    conditionalAnnualPlanCents,
    lastUpdatedAt: [...input.expenses.map(item => item.updatedAt), ...input.periods.map(item => item.updatedAt)].sort().at(-1) || null,
    cases,
    decisions: [...input.actions].sort((left, right) => right.actionDate.localeCompare(left.actionDate) || left.id.localeCompare(right.id)),
    goal: input.goal
  }
}

export type FamilyRoute = ReturnType<typeof buildFamilyRoute>
