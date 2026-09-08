import { defineEventHandler, deleteCookie } from 'h3'
import { authService, secureCookie, sessionToken, SESSION_COOKIE } from '../../auth/runtime'

export default defineEventHandler(async event => {
  await authService().logout(sessionToken(event))
  deleteCookie(event, SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', path: '/', secure: secureCookie(event) })
  return { ok: true }
})
