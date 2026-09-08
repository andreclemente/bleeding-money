import { getAuthenticatedUserId } from '../../auth/context'
import { getRepository } from '../../db/repository'

export default defineEventHandler(async event => {
  const item = await getRepository().getExpense(getAuthenticatedUserId(event), getRouterParam(event, 'id') || '')
  if (!item) throw createError({ statusCode: 404, statusMessage: 'Despesa não encontrada.' })
  return item
})
