import { getAuthenticatedUserId } from '../../auth/context'
import { getRepository } from '../../db/repository'

export default defineEventHandler(async event => {
  const userId = getAuthenticatedUserId(event)
  try {
    return { goal: await getRepository().getSavingsGoalProgress(userId) }
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível consultar o objetivo familiar.' })
  }
})
