import { CohortSpendAnalyzer, OwnHistorySpendAnalyzer, buildSpendChartData, calculateMoneyAtRisk, spendCategories, type SpendInsight } from '../../domain/spending'
import type { PoupancasRepository } from '../db/repository'

export interface SpendingComparison {
  category: typeof spendCategories[number]
  ownHistory: SpendInsight | null
  anonymousCohort: SpendInsight | null
}

export const spendingOverview = async (repository: PoupancasRepository, userId: string) => {
  const [profile, periods, cohorts] = await Promise.all([
    repository.getHouseholdProfile(userId),
    repository.listMonthlySpendPeriods(userId),
    repository.listAnonymousSpendCohorts()
  ])
  const latest = periods[0]
  const risk = calculateMoneyAtRisk(latest?.amounts || [])
  const declaredCategories = latest ? spendCategories.filter(category => category === 'supermarket_total' || latest.amounts.some(amount => amount.category === category)) : []
  const comparisons: SpendingComparison[] = latest ? declaredCategories.map(category => {
    const ownHistory = new OwnHistorySpendAnalyzer().analyze(latest, periods.slice(1), category)
    const anonymousCohort = ownHistory?.kind === 'CHECK_UNAVAILABLE'
      ? new CohortSpendAnalyzer().analyze(latest, category, cohorts)
      : null
    return { category, ownHistory, anonymousCohort }
  }) : []
  return {
    profile,
    periods,
    moneyAtRisk: { ...risk, currency: 'EUR' as const },
    comparisons,
    comparisonOrder: ['own_history', 'anonymous_exact_cohort'] as const,
    charts: buildSpendChartData(periods)
  }
}
