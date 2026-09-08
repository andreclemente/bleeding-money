import { getAuthenticatedUserId } from '../../../auth/context'
import { getRepository } from '../../../db/repository'

export default defineEventHandler(async event => {
  try { return await getRepository().dismissFinding(getAuthenticatedUserId(event), getRouterParam(event, 'id') || '') }
  catch (error) {
    if ((error as { statusCode?: number }).statusCode === 401) throw error
    throw createError({ statusCode: 409, statusMessage: error instanceof Error ? error.message : 'Não foi possível dispensar.' })
  }
})
