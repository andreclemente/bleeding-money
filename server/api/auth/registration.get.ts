import { defineEventHandler } from 'h3'
import { authService } from '../../auth/runtime'

export default defineEventHandler(async () => ({ available: await authService().registrationAvailable() }))
