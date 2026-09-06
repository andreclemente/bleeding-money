import { getRepository } from '../../db/repository'
import { devUserContext } from '../../services/user-context'

export default defineEventHandler(async event => {
  const item = await getRepository().getFinding(devUserContext().userId, getRouterParam(event, 'id') || '')
  if (!item) throw createError({ statusCode: 404, statusMessage: 'Recomendação não encontrada.' })
  return item
})
