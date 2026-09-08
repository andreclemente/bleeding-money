import { currentSetupStatus } from '../services/setup'

export default defineEventHandler(() => currentSetupStatus())
