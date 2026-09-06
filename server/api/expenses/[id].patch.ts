import { getRepository, parseExpensePatchInput } from '../../db/repository'
import { devUserContext } from '../../services/user-context'

export default defineEventHandler(async event => {
  try {
    const body = parseExpensePatchInput(await readBody<unknown>(event))
    const item = await getRepository().updateExpense(devUserContext().userId, getRouterParam(event, 'id') || '', body)
    if (!item) throw createError({ statusCode: 404, statusMessage: 'Despesa não encontrada.' })
    return item
  } catch (error) {
    if (typeof error === 'object' && error && 'statusCode' in error) throw error
    throw createError({ statusCode: 400, statusMessage: error instanceof Error ? error.message : 'Pedido inválido' })
  }
})
