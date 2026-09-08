import { createError, type H3Event } from 'h3'
import type { PublicOwner } from './types'

type AuthEvent = H3Event & { context: { auth?: { user: PublicOwner } } }

export const requireAuthenticatedUser = (event: AuthEvent) => {
  const user = event.context.auth?.user
  if (!user) throw createError({ statusCode: 401, message: 'Autenticação necessária.' })
  return user
}

export const getAuthenticatedUserId = (event: AuthEvent) => requireAuthenticatedUser(event).id
