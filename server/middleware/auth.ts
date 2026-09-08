import { createError, defineEventHandler, getHeader, getMethod } from 'h3'
import { assertAllowedOrigin } from '../auth/http'
import { authService, requestSecurity, sessionToken } from '../auth/runtime'

export default defineEventHandler(async event => {
  const method = getMethod(event)
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    try {
      assertAllowedOrigin({ method, origin: getHeader(event, 'origin'), expectedOrigin: requestSecurity(event).expectedOrigin })
    } catch {
      throw createError({ statusCode: 403, statusMessage: 'Origem do pedido não permitida.' })
    }
  }
  const user = await authService().authenticate(sessionToken(event))
  if (user) event.context.auth = { user }
})
