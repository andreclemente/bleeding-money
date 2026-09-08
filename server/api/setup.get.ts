import { getAuthenticatedUserId } from '../auth/context'
import { getRepository, getStorageMode } from '../db/repository'
import { setupStatus } from '../services/setup'

export default defineEventHandler(event => setupStatus(getRepository(), getAuthenticatedUserId(event), getStorageMode()))
