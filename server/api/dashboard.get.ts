import { getAuthenticatedUserId } from '../auth/context'
import { dashboard } from '../services/dashboard'

export default defineEventHandler(event => dashboard(getAuthenticatedUserId(event)))
