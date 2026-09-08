import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DEMO_USER_ID } from '../../server/db/demo-data'
import { JsonFileRepository, MemoryRepository } from '../../server/db/repository'
import { hashPassword, hashSessionToken, parsePasswordHash, verifyPassword } from '../../server/auth/crypto'
import { AuthService } from '../../server/auth/service'

const directories: string[] = []
const tempFile = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bleeding-money-auth-'))
  directories.push(directory)
  return join(directory, 'state.json')
}

const credentials = { name: '  Ana   Silva ', email: ' ANA.SILVA@Example.COM ', password: 'uma-frase-segura-2026' }

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

describe('passwords e tokens', () => {
  it('faz hash scrypt versionado com salt aleatório e verifica em tempo seguro', async () => {
    const first = await hashPassword(credentials.password)
    const second = await hashPassword(credentials.password)

    expect(first).toMatch(/^scrypt\$v1\$/)
    expect(first).not.toBe(second)
    expect(first).not.toContain(credentials.password)
    await expect(verifyPassword(credentials.password, first)).resolves.toBe(true)
    await expect(verifyPassword('frase-totalmente-errada', first)).resolves.toBe(false)
    await expect(verifyPassword(credentials.password, 'inválido')).resolves.toBe(false)
  })

  it('persiste apenas o SHA-256 do token de sessão', () => {
    expect(hashSessionToken('token-opaco')).toMatch(/^[a-f0-9]{64}$/)
    expect(hashSessionToken('token-opaco')).not.toContain('token-opaco')
  })

  it('aceita apenas o perfil scrypt produzido pela aplicação', async () => {
    const valid = await hashPassword(credentials.password)
    const parts = valid.split('$')
    expect(parsePasswordHash(valid)).not.toBeNull()
    for (const [index, value] of [[1, 'v2'], [2, '32768'], [3, '16'], [4, '2']] as const) {
      const malformed = [...parts]
      malformed[index] = value
      expect(parsePasswordHash(malformed.join('$'))).toBeNull()
      await expect(verifyPassword(credentials.password, malformed.join('$'))).resolves.toBe(false)
    }
  })

  it('rejeita forma, alfabeto e comprimentos inválidos antes da derivação', async () => {
    const valid = await hashPassword(credentials.password)
    const parts = valid.split('$')
    const malformed = [valid + '$extra', parts.with(5, 'salt+com/barra=').join('$'), parts.with(5, 'curto').join('$'), parts.with(6, 'hash+com/barra=').join('$'), parts.with(6, 'curto').join('$')]
    for (const encoded of malformed) {
      expect(parsePasswordHash(encoded)).toBeNull()
      await expect(verifyPassword(credentials.password, encoded)).resolves.toBe(false)
    }
  })
})

describe('dono único e propriedade local', () => {
  it('permite exatamente um registo mesmo sob pedidos concorrentes', async () => {
    const repository = new JsonFileRepository(await tempFile())
    const auth = new AuthService(repository)
    const attempts = await Promise.allSettled([
      auth.register(credentials),
      auth.register({ ...credentials, email: 'outra@example.com' })
    ])

    expect(attempts.filter(item => item.status === 'fulfilled')).toHaveLength(1)
    expect(attempts.filter(item => item.status === 'rejected')).toHaveLength(1)
    await expect(auth.registrationAvailable()).resolves.toBe(false)
  })

  it('normaliza identidade, valida limites e nunca devolve o hash', async () => {
    const auth = new AuthService(new MemoryRepository())
    const result = await auth.register(credentials)

    expect(result.user).toEqual(expect.objectContaining({ name: 'Ana Silva', email: 'ana.silva@example.com' }))
    expect(result.user).not.toHaveProperty('passwordHash')
    const emptyAuth = new AuthService(new MemoryRepository())
    await expect(emptyAuth.register({ ...credentials, password: 'curta' })).rejects.toThrow(/12 caracteres/i)
    await expect(auth.register({ ...credentials, password: 'curta' })).rejects.toThrow(/proprietário/i)
  })

  it('reivindica dados legados uma vez e preserva todos os restantes bytes lógicos', async () => {
    const repository = new MemoryRepository({ demo: true })
    const before = repository.exportState()
    const auth = new AuthService(repository)
    const { user } = await auth.register(credentials)
    await auth.ensureLegacyClaim(user.id)
    const after = repository.exportState()

    expect(after.expenses.every(item => item.userId === user.id)).toBe(true)
    expect(after.snapshots).toEqual(before.snapshots)
    expect(after.findings).toEqual(before.findings)
    expect(after.actions).toEqual(before.actions)
    expect(after.marketObservations).toEqual(before.marketObservations)
    expect(after.expenses.map(item => ({ ...item, userId: DEMO_USER_ID }))).toEqual(before.expenses)
    expect(before.expenses.every(item => item.userId === DEMO_USER_ID)).toBe(true)
  })

  it('revoga, rejeita expiração e roda a sessão no login', async () => {
    const auth = new AuthService(new MemoryRepository(), { now: () => new Date('2026-09-08T10:00:00Z'), sessionTtlMs: 1000 })
    const registered = await auth.register(credentials)
    expect(await auth.authenticate(registered.token)).toMatchObject({ email: 'ana.silva@example.com' })
    const loggedIn = await auth.login({ email: credentials.email, password: credentials.password })
    expect(loggedIn.token).not.toBe(registered.token)
    await expect(auth.authenticate(registered.token)).resolves.toBeNull()
    await auth.logout(loggedIn.token)
    await expect(auth.authenticate(loggedIn.token)).resolves.toBeNull()

    const later = new AuthService(auth.repository, { now: () => new Date('2026-09-08T10:00:02Z'), sessionTtlMs: 1000 })
    const fresh = await later.login({ email: credentials.email, password: credentials.password })
    const expired = new AuthService(later.repository, { now: () => new Date('2026-09-08T10:00:04Z'), sessionTtlMs: 1000 })
    await expect(expired.authenticate(fresh.token)).resolves.toBeNull()
  })

  it('rejeita auth local profundamente corrupta sem substituir o ficheiro', async () => {
    const file = await tempFile()
    const repository = new JsonFileRepository(file)
    await new AuthService(repository).register(credentials)
    const state = JSON.parse(await readFile(file, 'utf8'))
    state.owner.passwordHash = credentials.password
    const original = `${JSON.stringify(state, null, 2)}\n`
    await writeFile(file, original)

    await expect(new JsonFileRepository(file).getOwner()).rejects.toThrow(/corrupto/i)
    expect(await readFile(file, 'utf8')).toBe(original)
  })

  it('usa o parser estrito comum também no estado local', async () => {
    const file = await tempFile()
    const repository = new JsonFileRepository(file)
    await new AuthService(repository).register(credentials)
    const state = JSON.parse(await readFile(file, 'utf8'))
    const parts = state.owner.passwordHash.split('$')
    parts[5] = `+${parts[5].slice(1)}`
    state.owner.passwordHash = parts.join('$')
    await writeFile(file, `${JSON.stringify(state, null, 2)}\n`)

    await expect(new JsonFileRepository(file).getOwner()).rejects.toThrow(/corrupto/i)
  })
})
