import { calculateMoneyAtRisk, type MonthlySpendPeriod } from './spending'
import type { SavingsGoalProgress } from './savings-goal'
import type { RecurringExpense, SavingAction, SavingsFinding } from './types'

export type FamilyRouteAction =
  | { kind: 'insurance_renewal', expenseId: string, daysUntil: number }
  | { kind: 'estimated_finding', expenseId: string, findingId: string }
  | { kind: 'spending_limit_experiment', periodId: string, conditionalAnnualCents: number }
  | { kind: 'factual_finding', expenseId: string, findingId: string }
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
const dayMs = 86_400_000
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

const renewalCandidates = (expenses: RecurringExpense[], civilDate: string) => expenses
  .flatMap(expense => {
    const renewalDate = expense.details.kind === 'insurance' ? expense.details.renewalDate : undefined
    if (!renewalDate) return []
    const daysUntil = (utcDay(renewalDate) - utcDay(civilDate)) / dayMs
    return Number.isInteger(daysUntil) && daysUntil >= 0 && daysUntil <= 45 ? [{ expenseId: expense.id, daysUntil }] : []
  })
  .sort((left, right) => left.daysUntil - right.daysUntil || left.expenseId.localeCompare(right.expenseId))

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
  const renewals = renewalCandidates(input.expenses, input.civilDate)
  const urgentRenewal = renewals.find(item => item.daysUntil <= 15)
  const laterRenewal = renewals.find(item => item.daysUntil >= 16)
  const estimatedCase = estimatedCases[0]
  const factualCase = cases.find(item => item.evidenceKind === 'fact')

  let nextAction: FamilyRouteAction
  if (urgentRenewal) nextAction = { kind: 'insurance_renewal', ...urgentRenewal }
  else if (estimatedCase) nextAction = { kind: 'estimated_finding', expenseId: estimatedCase.expense.id, findingId: estimatedCase.finding.id }
  else if (laterRenewal) nextAction = { kind: 'insurance_renewal', ...laterRenewal }
  else if (latestPeriod && conditionalAnnualPlanCents > 0) nextAction = { kind: 'spending_limit_experiment', periodId: latestPeriod.id, conditionalAnnualCents: conditionalAnnualPlanCents }
  else if (factualCase) nextAction = { kind: 'factual_finding', expenseId: factualCase.expense.id, findingId: factualCase.finding.id }
  else if (latestPeriod && comparableMonths < 3) nextAction = { kind: 'build_own_history', recordedMonths: comparableMonths, missingMonths: 3 - comparableMonths }
  else if (!input.expenses.length && !periods.length) nextAction = { kind: 'empty' }
  else nextAction = { kind: 'clear' }

  return {
    civilDate: input.civilDate,
    nextAction,
    monthlyRecurringConfirmedCents: input.expenses.reduce((sum, expense) => addMoney(sum, expense.monthlyCostCents), 0),
    confirmedAnnualCents: input.actions.reduce((sum, action) => addMoney(sum, action.annualSavingCents), 0),
    identifiedMonthlyRangeCents,
    conditionalAnnualPlanCents,
    lastUpdatedAt: [...input.expenses.map(item => item.updatedAt), ...input.periods.map(item => item.updatedAt)].sort().at(-1) || null,
    cases,
    decisions: [...input.actions].sort((left, right) => right.actionDate.localeCompare(left.actionDate) || left.id.localeCompare(right.id)),
    goal: input.goal
  }
}

export type FamilyRoute = ReturnType<typeof buildFamilyRoute>
