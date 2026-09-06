import { getRepository } from '../../../db/repository'
import { devUserContext } from '../../../services/user-context'

export default defineEventHandler(async event => {
  try { return await getRepository().dismissFinding(devUserContext().userId, getRouterParam(event, 'id') || '') }
  catch (error) { throw createError({ statusCode: 409, statusMessage: error instanceof Error ? error.message : 'Não foi possível dispensar.' }) }
})
