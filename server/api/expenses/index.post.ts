import { getRepository, parseExpenseCreateInput } from '../../db/repository'
import { devUserContext } from '../../services/user-context'

export default defineEventHandler(async event => {
  try {
    const body = parseExpenseCreateInput(await readBody<unknown>(event))
    return await getRepository().createExpense(devUserContext().userId, body)
  } catch (error) {
    throw createError({ statusCode: 400, statusMessage: error instanceof Error ? error.message : 'Pedido inválido' })
  }
})
