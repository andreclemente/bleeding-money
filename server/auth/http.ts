export interface OriginInput { method: string, origin?: string, host?: string, forwardedProto?: string, protocol?: string, expectedOrigin?: string }

export interface RequestSecurityInput {
  directHost?: string
  directProtocol: 'http' | 'https'
  remoteAddress?: string
  publicOrigin?: string
  forwardedHost?: string
  forwardedProto?: string
  forwardedFor?: string
  cfConnectingIp?: string
  trustProxy: boolean
}

const first = (value?: string) => value?.split(',')[0]?.trim() || undefined
const canonicalOrigin = (value?: string) => {
  if (!value) return undefined
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('PUBLIC_ORIGIN deve conter apenas uma origem HTTP(S) válida')
  return url.origin
}

export const resolveRequestSecurity = (input: RequestSecurityInput) => {
  const protocol = input.trustProxy ? first(input.forwardedProto) || input.directProtocol : input.directProtocol
  const host = input.trustProxy ? first(input.forwardedHost) || input.directHost : input.directHost
  const expectedOrigin = canonicalOrigin(input.publicOrigin) || (host ? `${protocol}://${host}` : '')
  const clientIp = input.trustProxy ? first(input.cfConnectingIp) || first(input.forwardedFor) || input.remoteAddress || 'desconhecido' : input.remoteAddress || 'desconhecido'
  return { expectedOrigin, secure: canonicalOrigin(input.publicOrigin)?.startsWith('https://') ?? protocol === 'https', clientIp }
}

export const assertAllowedOrigin = (input: OriginInput) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(input.method.toUpperCase())) return
  const protocol = input.forwardedProto?.split(',')[0]?.trim() || input.protocol || 'http'
  const expected = input.expectedOrigin || (input.host ? `${protocol}://${input.host}` : '')
  if (!input.origin || !expected || input.origin !== expected) throw new Error('Origem do pedido não permitida.')
}

export const buildSessionCookie = (token: string, options: { secure: boolean, maxAgeSeconds: number }) => [
  `bm_session=${encodeURIComponent(token)}`,
  'HttpOnly',
  'SameSite=Lax',
  'Path=/',
  `Max-Age=${options.maxAgeSeconds}`,
  ...(options.secure ? ['Secure'] : [])
].join('; ')

export const clearSessionCookie = (secure: boolean) => buildSessionCookie('', { secure, maxAgeSeconds: 0 })

export const loginThrottle = ({ limit, windowMs }: { limit: number, windowMs: number }) => {
  const attempts = new Map<string, number[]>()
  return {
    allow(key: string, now = Date.now()) {
      const recent = (attempts.get(key) || []).filter(time => now - time < windowMs)
      if (recent.length >= limit) return false
      recent.push(now)
      attempts.set(key, recent)
      return true
    },
    reset(key: string) { attempts.delete(key) }
  }
}

export const authThrottle = loginThrottle({ limit: 6, windowMs: 15 * 60 * 1000 })
