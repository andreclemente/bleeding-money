import { createError, defineEventHandler, readBody, setCookie } from 'h3'
import { authThrottle } from '../../auth/http'
import { authService, requestSecurity, secureCookie, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '../../auth/runtime'
import type { LoginInput } from '../../auth/types'

export default defineEventHandler(async event => {
  const key = requestSecurity(event).clientIp
  if (!authThrottle.allow(key)) throw createError({ statusCode: 429, statusMessage: 'Demasiadas tentativas. Tenta novamente dentro de alguns minutos.' })
  try {
    const result = await authService().login(await readBody<LoginInput>(event))
    authThrottle.reset(key)
    setCookie(event, SESSION_COOKIE, result.token, { httpOnly: true, sameSite: 'lax', path: '/', secure: secureCookie(event), maxAge: SESSION_MAX_AGE_SECONDS })
    return { user: result.user, expiresAt: result.expiresAt }
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Email ou palavra-passe incorretos.' })
  }
})
