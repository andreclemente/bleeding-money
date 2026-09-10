import { buildFamilyRoute } from '../../domain/family-route'
import { getRepository } from '../db/repository'

const lisbonCivilDate = (now: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value
  return `${value('year')}-${value('month')}-${value('day')}`
}

export const dashboard = async (userId: string, now = new Date()) => {
  const repo = getRepository()
  const [expenses, findings, actions, periods, goal] = await Promise.all([
    repo.listExpenses(userId),
    repo.listFindings(userId),
    repo.listActions(userId),
    repo.listMonthlySpendPeriods(userId),
    repo.getSavingsGoalProgress(userId)
  ])
  return buildFamilyRoute({ civilDate: lisbonCivilDate(now), expenses, findings, actions, periods, goal })
}
