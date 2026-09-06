import { getRepository } from '../db/repository'
import { devUserContext } from './user-context'

export const dashboard = async () => {
  const { userId } = devUserContext()
  const repo = getRepository()
  const [expenses, findings, actions] = await Promise.all([repo.listExpenses(userId), repo.listFindings(userId), repo.listActions(userId)])
  const open = findings.filter(item => item.status === 'open')
  return {
    monthlyExpensesCents: expenses.reduce((sum, item) => sum + item.monthlyCostCents, 0),
    potentialMonthlyMinCents: open.reduce((sum, item) => sum + item.estimatedMonthlySavingMinCents, 0),
    potentialMonthlyMaxCents: open.reduce((sum, item) => sum + item.estimatedMonthlySavingMaxCents, 0),
    realizedAnnualCents: actions.reduce((sum, item) => sum + item.annualSavingCents, 0),
    priorityFindings: open.slice(0, 5), expenses
  }
}
