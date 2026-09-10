import { parseSavingsGoalInput } from '../../../domain/savings-goal'
import { getAuthenticatedUserId } from '../../auth/context'
import { getRepository } from '../../db/repository'

export default defineEventHandler(async event => {
  const userId = getAuthenticatedUserId(event)
  let input
  try {
    input = parseSavingsGoalInput(await readBody<unknown>(event))
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Dados do objetivo familiar inválidos.' })
  }
  try {
    await getRepository().upsertSavingsGoal(userId, input)
    return { goal: await getRepository().getSavingsGoalProgress(userId) }
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível guardar o objetivo familiar.' })
  }
})
