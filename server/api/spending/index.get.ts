import { getAuthenticatedUserId } from '../../auth/context'
import { getRepository } from '../../db/repository'
import { spendingOverview } from '../../services/spending'

export default defineEventHandler(event => {
  const userId = getAuthenticatedUserId(event)
  return spendingOverview(getRepository(), userId).catch(() => {
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível consultar os gastos mensais.' })
  })
})
