import { getAuthenticatedUserId } from '../../auth/context'
import { getRepository, parseExpenseCreateInput } from '../../db/repository'

export default defineEventHandler(async event => {
  try {
    const body = parseExpenseCreateInput(await readBody<unknown>(event))
    return await getRepository().createExpense(getAuthenticatedUserId(event), body)
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 401) throw error
    throw createError({ statusCode: 400, statusMessage: error instanceof Error ? error.message : 'Pedido inválido' })
  }
})
