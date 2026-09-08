import { getAuthenticatedUserId } from '../../auth/context'
import { getRepository } from '../../db/repository'

export default defineEventHandler(event => getRepository().listFindings(getAuthenticatedUserId(event)))
