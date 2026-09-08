import type { PoupancasRepository, StorageMode } from '../db/repository'

export const setupStatus = async (repository: PoupancasRepository, userId: string, storageMode: StorageMode) => ({
  onboardingNeeded: (await repository.listExpenses(userId)).length === 0,
  storageMode
})
