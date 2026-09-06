import { getRepository } from '../../db/repository'
import { devUserContext } from '../../services/user-context'

export default defineEventHandler(() => getRepository().listFindings(devUserContext().userId))
