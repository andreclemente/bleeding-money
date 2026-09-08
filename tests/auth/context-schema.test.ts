import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { getAuthenticatedUserId, requireAuthenticatedUser } from '../../server/auth/context'
import { users, sessions } from '../../server/db/schema'

describe('contexto autenticado', () => {
  it('responde 401 sem sessão e nunca aceita um userId fornecido pelo cliente', () => {
    expect(() => requireAuthenticatedUser({ context: {} } as never)).toThrow(/autenticação/i)
    expect(getAuthenticatedUserId({ context: { auth: { user: { id: 'owner' } } }, body: { userId: 'intruso' } } as never)).toBe('owner')
  })
})

describe('forma PostgreSQL e migração', () => {
  it('define credencial do dono e sessões com hash único, revogação e expiração', () => {
    expect(users.passwordHash.name).toBe('password_hash')
    expect(users.ownerKey.name).toBe('owner_key')
    expect(sessions.tokenHash.name).toBe('token_hash')
    expect(sessions.expiresAt.name).toBe('expires_at')
    expect(sessions.revokedAt.name).toBe('revoked_at')
  })

  it('migra dados atuais e reivindica apenas recurring_expenses numa transação registável', async () => {
    const migration = await readFile(new URL('../../drizzle/0002_hard_giant_man.sql', import.meta.url), 'utf8')
    expect(migration).toMatch(/password_hash/)
    expect(migration).toMatch(/owner_key/)
    expect(migration).toMatch(/auth_sessions/)
    expect(migration).not.toMatch(/market_observations[\s\S]*user_id/i)
  })

  it('recusa a seed de demonstração dentro da transação quando já existe proprietário', async () => {
    const seed = await readFile(new URL('../../server/db/seed.ts', import.meta.url), 'utf8')
    expect(seed).toMatch(/transaction[\s\S]*lock table users[\s\S]*select[\s\S]*ownerKey[\s\S]*throw new Error\([^)]*seed[^)]*proprietário/i)
    expect(seed.indexOf('lock table users')).toBeLessThan(seed.indexOf('ownerKey'))
    expect(seed.indexOf('ownerKey')).toBeLessThan(seed.indexOf('tx.insert(users)'))
  })

  it('valida o hash PostgreSQL com o mesmo parser antes de o devolver', async () => {
    const repository = await readFile(new URL('../../server/db/postgres-repository.ts', import.meta.url), 'utf8')
    expect(repository).toMatch(/parsePasswordHash/)
    expect(repository).toMatch(/getOwner[\s\S]*parsePasswordHash/)
  })
})
