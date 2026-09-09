import { parseHouseholdInput } from '../../../domain/spending'
import { getAuthenticatedUserId } from '../../auth/context'
import { getRepository } from '../../db/repository'

export default defineEventHandler(async event => {
  const userId = getAuthenticatedUserId(event)
  let input
  try {
    input = parseHouseholdInput(await readBody<unknown>(event))
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Dados do agregado familiar inválidos.' })
  }
  try {
    return await getRepository().upsertHouseholdProfile(userId, input)
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível guardar o agregado familiar.' })
  }
})
