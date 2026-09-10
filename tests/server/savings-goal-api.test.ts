import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const user = { id: '10000000-0000-4000-8000-000000000001', name: 'Ana', email: 'ana@example.test' }
const directories: string[] = []
let getGoal: (event: unknown) => Promise<unknown>
let putGoal: (event: unknown) => Promise<unknown>

beforeAll(async () => {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('readBody', (event: { body: unknown }) => Promise.resolve(event.body))
  vi.stubGlobal('createError', (input: { statusCode: number, statusMessage?: string }) => Object.assign(new Error(input.statusMessage), input))
  getGoal = (await import('../../server/api/savings-goal/index.get')).default as typeof getGoal
  putGoal = (await import('../../server/api/savings-goal/index.put')).default as typeof putGoal
})

afterEach(async () => {
  delete process.env.DATABASE_URL
  delete process.env.LOCAL_DATA_FILE
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

const event = (authenticated: boolean, body?: unknown) => ({ context: authenticated ? { auth: { user } } : {}, body })

describe('API do objetivo familiar', () => {
  it('exige sessão e não aceita progresso fornecido pelo cliente', async () => {
    await expect(getGoal(event(false))).rejects.toThrow(/autenticação/i)
    await expect(putGoal(event(true, { name: 'Reserva', targetAnnualCents: 120000, confirmedAnnualCents: 120000 }))).rejects.toMatchObject({ statusCode: 400 })
  })

  it('persiste o objetivo e devolve progresso zero até existir poupança confirmada', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'goal-api-'))
    directories.push(directory)
    process.env.LOCAL_DATA_FILE = join(directory, 'state.json')

    await expect(getGoal(event(true))).resolves.toEqual({ goal: null })
    await putGoal(event(true, { name: 'Entrada da casa', targetAnnualCents: 300000 }))
    await expect(getGoal(event(true))).resolves.toMatchObject({ goal: { name: 'Entrada da casa', targetAnnualCents: 300000, confirmedAnnualCents: 0, remainingAnnualCents: 300000, percentage: 0 } })
  })
})
