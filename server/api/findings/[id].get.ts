import { getAuthenticatedUserId } from '../../auth/context'
import { getRepository } from '../../db/repository'

export default defineEventHandler(async event => {
  const item = await getRepository().getFinding(getAuthenticatedUserId(event), getRouterParam(event, 'id') || '')
  if (!item) throw createError({ statusCode: 404, statusMessage: 'Recomendação não encontrada.' })
  return item
})
