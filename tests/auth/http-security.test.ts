import { describe, expect, it } from 'vitest'
import { assertAllowedOrigin, buildSessionCookie, loginThrottle, resolveRequestSecurity } from '../../server/auth/http'
import { routeGuardDestination } from '../../middleware/auth.global'

describe('fronteira HTTP autenticada', () => {
  it('gera cookie de sessão protegido sem expor o token ao JavaScript', () => {
    const cookie = buildSessionCookie('segredo', { secure: true, maxAgeSeconds: 3600 })
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('Max-Age=3600')
  })

  it('aceita mutações same-origin e rejeita origins exteriores ou ausentes', () => {
    expect(() => assertAllowedOrigin({ method: 'POST', origin: 'https://app.example', host: 'app.example', forwardedProto: 'https' })).not.toThrow()
    expect(() => assertAllowedOrigin({ method: 'GET', origin: undefined, host: 'app.example', forwardedProto: 'https' })).not.toThrow()
    expect(() => assertAllowedOrigin({ method: 'POST', origin: 'https://evil.example', host: 'app.example', forwardedProto: 'https' })).toThrow(/origem/i)
    expect(() => assertAllowedOrigin({ method: 'DELETE', origin: undefined, host: 'app.example', forwardedProto: 'https' })).toThrow(/origem/i)
  })

  it('limita tentativas de login em memória sem bloquear para sempre', () => {
    const throttle = loginThrottle({ limit: 2, windowMs: 1000 })
    expect(throttle.allow('cliente', 0)).toBe(true)
    expect(throttle.allow('cliente', 1)).toBe(true)
    expect(throttle.allow('cliente', 2)).toBe(false)
    expect(throttle.allow('cliente', 1001)).toBe(true)
  })

  it('ignora cabeçalhos de proxy quando a confiança está desligada', () => {
    expect(resolveRequestSecurity({ directHost: 'localhost:3001', directProtocol: 'http', remoteAddress: '127.0.0.1', forwardedHost: 'evil.example', forwardedProto: 'https', forwardedFor: '203.0.113.9', cfConnectingIp: '198.51.100.7', trustProxy: false }))
      .toEqual({ expectedOrigin: 'http://localhost:3001', secure: false, clientIp: '127.0.0.1' })
  })

  it('usa origem canónica e cabeçalhos encaminhados apenas atrás de proxy confiável', () => {
    expect(resolveRequestSecurity({ directHost: '127.0.0.1:3001', directProtocol: 'http', remoteAddress: '127.0.0.1', publicOrigin: 'https://app.example', forwardedHost: 'app.example', forwardedProto: 'https,http', forwardedFor: '203.0.113.9, 127.0.0.1', cfConnectingIp: '198.51.100.7', trustProxy: true }))
      .toEqual({ expectedOrigin: 'https://app.example', secure: true, clientIp: '198.51.100.7' })
  })
})

describe('guardas de rota', () => {
  it.each([
    [{ path: '/dashboard', authenticated: false, registrationAvailable: true, onboardingNeeded: false }, '/register'],
    [{ path: '/dashboard', authenticated: false, registrationAvailable: false, onboardingNeeded: false }, '/login'],
    [{ path: '/login', authenticated: true, registrationAvailable: false, onboardingNeeded: true }, '/welcome'],
    [{ path: '/register', authenticated: true, registrationAvailable: false, onboardingNeeded: false }, '/dashboard'],
    [{ path: '/dashboard', authenticated: true, registrationAvailable: false, onboardingNeeded: true }, '/welcome'],
    [{ path: '/how-it-works', authenticated: false, registrationAvailable: false, onboardingNeeded: false }, null]
  ])('resolve %o para %s', (state, expected) => {
    expect(routeGuardDestination(state)).toBe(expected)
  })
})
