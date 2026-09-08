import { defineEventHandler } from 'h3'
import { authService, sessionToken } from '../../auth/runtime'

export default defineEventHandler(async event => {
  const service = authService()
  return { user: await service.authenticate(sessionToken(event)), registrationAvailable: await service.registrationAvailable() }
})
