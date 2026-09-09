import type { PoupancasRepository, StorageMode } from '../db/repository'

export const setupStatus = async (repository: PoupancasRepository, userId: string, storageMode: StorageMode) => {
  const [expenses, periods] = await Promise.all([
    repository.listExpenses(userId),
    repository.listMonthlySpendPeriods(userId)
  ])
  return { onboardingNeeded: expenses.length === 0 && periods.length === 0, storageMode }
}
