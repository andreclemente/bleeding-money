import { getAuthenticatedUserId } from '../../../auth/context'
import { getRepository } from '../../../db/repository'

export default defineEventHandler(async event => {
  const userId = getAuthenticatedUserId(event)
  const body = await readBody<{ newCostCents: number, actionDate?: string }>(event)
  try {
    return await getRepository().resolveFinding(userId, getRouterParam(event, 'id') || '', body.newCostCents, body.actionDate || new Date().toISOString().slice(0, 10))
  } catch (error) {
    throw createError({ statusCode: 409, statusMessage: error instanceof Error ? error.message : 'Não foi possível resolver.' })
  }
})
