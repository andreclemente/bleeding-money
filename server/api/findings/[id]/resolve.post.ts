import { getRepository } from '../../../db/repository'
import { devUserContext } from '../../../services/user-context'

export default defineEventHandler(async event => {
  const body = await readBody<{ newCostCents: number, actionDate?: string }>(event)
  try {
    return await getRepository().resolveFinding(devUserContext().userId, getRouterParam(event, 'id') || '', body.newCostCents, body.actionDate || new Date().toISOString().slice(0, 10))
  } catch (error) {
    throw createError({ statusCode: 409, statusMessage: error instanceof Error ? error.message : 'Não foi possível resolver.' })
  }
})
