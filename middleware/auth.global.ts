export interface RouteGuardState { path: string, authenticated: boolean, registrationAvailable: boolean, onboardingNeeded: boolean }
const publicPaths = ['/login', '/register', '/how-it-works']

export const routeGuardDestination = (state: RouteGuardState) => {
  if (!state.authenticated) {
    if (state.path === '/how-it-works') return null
    const target = state.registrationAvailable ? '/register' : '/login'
    return state.path === target ? null : target
  }
  if (state.path === '/login' || state.path === '/register') return state.onboardingNeeded ? '/welcome' : '/dashboard'
  if (state.onboardingNeeded && state.path !== '/welcome' && !publicPaths.includes(state.path)) return '/welcome'
  if (!state.onboardingNeeded && state.path === '/welcome') return '/dashboard'
  return null
}

const middleware = typeof defineNuxtRouteMiddleware === 'undefined' ? (() => undefined) : defineNuxtRouteMiddleware(async to => {
  const requestFetch = useRequestFetch()
  const session = await requestFetch<{ user: { id: string } | null, registrationAvailable: boolean }>('/api/auth/session')
  let onboardingNeeded = false
  if (session.user) onboardingNeeded = (await requestFetch<{ onboardingNeeded: boolean }>('/api/setup')).onboardingNeeded
  const destination = routeGuardDestination({ path: to.path, authenticated: Boolean(session.user), registrationAvailable: session.registrationAvailable, onboardingNeeded })
  if (destination) return navigateTo(destination)
})

export default middleware
