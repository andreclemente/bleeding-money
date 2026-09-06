import { getRepository } from '../../db/repository'
import { devUserContext } from '../../services/user-context'

export default defineEventHandler(async event => {
  const item = await getRepository().getExpense(devUserContext().userId, getRouterParam(event, 'id') || '')
  if (!item) throw createError({ statusCode: 404, statusMessage: 'Despesa não encontrada.' })
  return item
})
