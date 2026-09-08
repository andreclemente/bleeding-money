import { getRepository, getStorageMode, type PoupancasRepository, type StorageMode } from '../db/repository'
import { devUserContext } from './user-context'

export const setupStatus = async (repository: PoupancasRepository, userId: string, storageMode: StorageMode) => ({
  onboardingNeeded: (await repository.listExpenses(userId)).length === 0,
  storageMode
})

export const currentSetupStatus = () => setupStatus(getRepository(), devUserContext().userId, getStorageMode())
