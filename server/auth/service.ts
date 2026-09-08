import { DEMO_USER_ID } from '../db/demo-data'
import type { AuthRepository, LoginInput, PublicOwner, RegisterInput, StoredOwner, StoredSession } from './types'
import { createSessionToken, hashPassword, hashSessionToken, verifyPassword } from './crypto'

const EMAIL_MAX = 254
const NAME_MAX = 100
const PASSWORD_MAX = 256
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const cleanName = (value: unknown) => {
  if (typeof value !== 'string') throw new Error('Indica o teu nome.')
  const name = value.trim().replace(/\s+/g, ' ')
  if (name.length < 2) throw new Error('O nome deve ter pelo menos 2 caracteres.')
  if (name.length > NAME_MAX) throw new Error(`O nome não pode exceder ${NAME_MAX} caracteres.`)
  return name
}

const cleanEmail = (value: unknown) => {
  if (typeof value !== 'string') throw new Error('Indica um endereço de email válido.')
  const email = value.trim().toLowerCase()
  if (!emailPattern.test(email) || email.length > EMAIL_MAX) throw new Error('Indica um endereço de email válido.')
  return email
}

const cleanPassword = (value: unknown) => {
  if (typeof value !== 'string' || value.length < 12) throw new Error('A palavra-passe deve ter pelo menos 12 caracteres.')
  if (value.length > PASSWORD_MAX) throw new Error(`A palavra-passe não pode exceder ${PASSWORD_MAX} caracteres.`)
  return value
}

const publicOwner = ({ id, name, email }: StoredOwner): PublicOwner => ({ id, name, email })

export class AuthService {
  readonly repository: AuthRepository
  private readonly now: () => Date
  private readonly sessionTtlMs: number

  constructor(repository: AuthRepository, options: { now?: () => Date, sessionTtlMs?: number } = {}) {
    this.repository = repository
    this.now = options.now || (() => new Date())
    this.sessionTtlMs = options.sessionTtlMs || 30 * 24 * 60 * 60 * 1000
  }

  registrationAvailable = async () => !(await this.repository.getOwner())

  private session(userId: string) {
    const token = createSessionToken()
    const createdAt = this.now()
    const session: StoredSession = {
      id: crypto.randomUUID(),
      userId,
      tokenHash: hashSessionToken(token),
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + this.sessionTtlMs).toISOString()
    }
    return { token, session }
  }

  async register(input: RegisterInput) {
    if (!await this.registrationAvailable()) throw new Error('Esta área pessoal já tem proprietário.')
    if (!input || typeof input !== 'object') throw new Error('Pedido de registo inválido.')
    const name = cleanName(input.name)
    const email = cleanEmail(input.email)
    const password = cleanPassword(input.password)
    const createdAt = this.now().toISOString()
    const owner: StoredOwner = { id: crypto.randomUUID(), name, email, passwordHash: await hashPassword(password), createdAt }
    const { token, session } = this.session(owner.id)
    await this.repository.registerOwner(owner, session, DEMO_USER_ID)
    return { user: publicOwner(owner), token, expiresAt: session.expiresAt }
  }

  async login(input: LoginInput) {
    const failure = new Error('Email ou palavra-passe incorretos.')
    if (!input || typeof input !== 'object') throw failure
    let email: string
    try { email = cleanEmail(input.email) } catch { throw failure }
    const password = typeof input.password === 'string' && input.password.length <= PASSWORD_MAX ? input.password : ''
    const owner = await this.repository.getOwner()
    if (!owner || owner.email !== email || !await verifyPassword(password, owner.passwordHash)) throw failure
    await this.ensureLegacyClaim(owner.id)
    const { token, session } = this.session(owner.id)
    await this.repository.replaceSessions(session)
    return { user: publicOwner(owner), token, expiresAt: session.expiresAt }
  }

  async authenticate(token?: string | null) {
    if (!token) return null
    const found = await this.repository.getSession(hashSessionToken(token))
    if (!found || found.session.revokedAt || Date.parse(found.session.expiresAt) <= this.now().getTime()) return null
    await this.ensureLegacyClaim(found.owner.id)
    return publicOwner(found.owner)
  }

  async logout(token?: string | null) {
    if (token) await this.repository.revokeSession(hashSessionToken(token), this.now().toISOString())
  }

  async ensureLegacyClaim(ownerId: string) {
    const owner = await this.repository.getOwner()
    if (owner?.id === ownerId && !owner.legacyClaimedAt) await this.repository.claimLegacyExpenses(ownerId, DEMO_USER_ID, this.now().toISOString())
  }
}
