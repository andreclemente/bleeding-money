import { getCookie, getHeader } from 'h3'
import { getRepository } from '../db/repository'
import { AuthService } from './service'
import { resolveRequestSecurity } from './http'

export const SESSION_COOKIE = 'bm_session'
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
export const authService = () => new AuthService(getRepository(), { sessionTtlMs: SESSION_MAX_AGE_SECONDS * 1000 })
export const sessionToken = (event: Parameters<typeof getCookie>[0]) => getCookie(event, SESSION_COOKIE)
export const requestSecurity = (event: Parameters<typeof getHeader>[0]) => resolveRequestSecurity({
  directHost: getHeader(event, 'host'),
  directProtocol: (event.node.req.socket as { encrypted?: boolean }).encrypted ? 'https' : 'http',
  remoteAddress: event.node.req.socket.remoteAddress,
  publicOrigin: process.env.PUBLIC_ORIGIN,
  forwardedHost: getHeader(event, 'x-forwarded-host'),
  forwardedProto: getHeader(event, 'x-forwarded-proto'),
  forwardedFor: getHeader(event, 'x-forwarded-for'),
  cfConnectingIp: getHeader(event, 'cf-connecting-ip'),
  trustProxy: process.env.TRUST_PROXY === 'true'
})
export const secureCookie = (event: Parameters<typeof getHeader>[0]) => {
  const configured = process.env.AUTH_COOKIE_SECURE
  if (configured === 'true') return true
  if (configured === 'false') return false
  return requestSecurity(event).secure
}
