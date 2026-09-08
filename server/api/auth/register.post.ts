import { createError, defineEventHandler, readBody, setCookie } from 'h3'
import { authService, secureCookie, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '../../auth/runtime'
import type { RegisterInput } from '../../auth/types'

export default defineEventHandler(async event => {
  try {
    const result = await authService().register(await readBody<RegisterInput>(event))
    setCookie(event, SESSION_COOKIE, result.token, { httpOnly: true, sameSite: 'lax', path: '/', secure: secureCookie(event), maxAge: SESSION_MAX_AGE_SECONDS })
    return { user: result.user, expiresAt: result.expiresAt }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível criar a conta.'
    throw createError({ statusCode: /proprietário/.test(message) ? 409 : 400, statusMessage: message })
  }
})
