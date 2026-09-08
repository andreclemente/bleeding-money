import { getAuthenticatedUserId } from '../../auth/context'
import { getRepository, parseExpensePatchInput } from '../../db/repository'

export default defineEventHandler(async event => {
  const userId = getAuthenticatedUserId(event)
  try {
    const body = parseExpensePatchInput(await readBody<unknown>(event))
    const item = await getRepository().updateExpense(userId, getRouterParam(event, 'id') || '', body)
    if (!item) throw createError({ statusCode: 404, statusMessage: 'Despesa não encontrada.' })
    return item
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error
    throw createError({ statusCode: 400, statusMessage: error instanceof Error ? error.message : 'Pedido inválido' })
  }
})
