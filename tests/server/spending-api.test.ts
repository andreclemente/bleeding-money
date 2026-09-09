import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const directories: string[] = []
const userA = { id: '10000000-0000-4000-8000-000000000001', name: 'Ana', email: 'ana@example.test' }
const userB = { id: '10000000-0000-4000-8000-000000000002', name: 'Bruno', email: 'bruno@example.test' }
let putProfile: (event: unknown) => Promise<unknown>
let postPeriod: (event: unknown) => Promise<unknown>
let getOverview: (event: unknown) => Promise<unknown>

beforeAll(async () => {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('readBody', (event: { body: unknown }) => Promise.resolve(event.body))
  vi.stubGlobal('createError', (input: { statusCode: number, statusMessage?: string, message?: string }) => Object.assign(new Error(input.statusMessage || input.message), input))
  putProfile = (await import('../../server/api/spending/profile.put')).default as typeof putProfile
  postPeriod = (await import('../../server/api/spending/periods/index.post')).default as typeof postPeriod
  getOverview = (await import('../../server/api/spending/index.get')).default as typeof getOverview
})

afterEach(async () => {
  delete process.env.DATABASE_URL
  delete process.env.LOCAL_DATA_FILE
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

const event = (user: typeof userA | null, body?: unknown) => ({
  context: user ? { auth: { user } } : {},
  body
})

const periodBody = {
  month: '2026-08-01',
  adults: 2,
  dependents: 1,
  status: 'estimated',
  supermarketCoverage: 'includes_cleaning_hygiene',
  amountBasis: 'memory_estimate',
  amounts: [
    { category: 'supermarket_total', scope: 'supermarket', amountCents: 56000, trackingIntent: 'track_only' },
    { category: 'sweets_snacks_soft_drinks', scope: 'supermarket', amountCents: 6000, trackingIntent: 'reduce', userTargetCents: 3000 },
    { category: 'fast_food_takeaway', scope: 'outside_supermarket', amountCents: 9000, trackingIntent: 'reduce', userTargetCents: 5000 }
  ]
}

describe('API autenticada de gastos mensais', () => {
  it('recusa pedidos sem sessão', async () => {
    expect(() => getOverview(event(null))).toThrow(/autenticação/i)
    await expect(putProfile(event(null, { adults: 2, dependents: 0, country: 'PT' }))).rejects.toMatchObject({ statusCode: 401 })
  })

  it('guarda no utilizador autenticado, ignora identidade do cliente e devolve cálculo transparente', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'spending-api-'))
    directories.push(directory)
    process.env.LOCAL_DATA_FILE = join(directory, 'state.json')

    await putProfile(event(userA, { adults: 2, dependents: 1, country: 'PT' }))
    await postPeriod(event(userA, { ...periodBody, userId: userB.id })).catch(error => expect(error).toMatchObject({ statusCode: 400 }))
    await postPeriod(event(userA, periodBody))
    const own = await getOverview(event(userA)) as Record<string, unknown>
    const other = await getOverview(event(userB)) as Record<string, unknown>

    expect(own).toMatchObject({
      moneyAtRisk: {
        monthlyCents: 7000,
        annualCents: 84000,
        currency: 'EUR',
        isEstimate: true,
        basis: 'user_declared_targets'
      },
      comparisonOrder: ['own_history', 'anonymous_exact_cohort']
    })
    expect((own.comparisons as Array<{ category: string }>).map(item => item.category)).toEqual([
      'supermarket_total',
      'fast_food_takeaway',
      'sweets_snacks_soft_drinks'
    ])
    expect(JSON.stringify(own)).toMatch(/são necessários 3 meses comparáveis/i)
    expect(JSON.stringify(own)).not.toContain('benchmarkSavingCents')
    expect(other).toMatchObject({ profile: null, periods: [], moneyAtRisk: { monthlyCents: 0 } })
  })

  it('devolve 400 sanitizado apenas para input inválido', async () => {
    await expect(postPeriod(event(userA, { ...periodBody, adults: 0 }))).rejects.toMatchObject({ statusCode: 400 })
  })

  it('transforma falhas do repositório em 500 sanitizado sem expor detalhes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'spending-api-failure-'))
    directories.push(directory)
    const file = join(directory, 'private-state.json')
    await writeFile(file, '{ segredo truncado', 'utf8')
    process.env.LOCAL_DATA_FILE = file

    const failure = await putProfile(event(userA, { adults: 2, dependents: 1, country: 'PT' })).catch(error => error) as { statusCode: number, statusMessage: string }
    expect(failure).toMatchObject({ statusCode: 500, statusMessage: 'Não foi possível guardar o agregado familiar.' })
    expect(JSON.stringify(failure)).not.toContain(file)
    expect(JSON.stringify(failure)).not.toContain('segredo')

    const periodFailure = await postPeriod(event(userA, periodBody)).catch(error => error) as { statusCode: number, statusMessage: string }
    expect(periodFailure).toMatchObject({ statusCode: 500, statusMessage: 'Não foi possível guardar o mês.' })
    expect(JSON.stringify(periodFailure)).not.toContain(file)

    const readFailure = await getOverview(event(userA)).catch(error => error) as { statusCode: number, statusMessage: string }
    expect(readFailure).toMatchObject({ statusCode: 500, statusMessage: 'Não foi possível consultar os gastos mensais.' })
    expect(JSON.stringify(readFailure)).not.toContain(file)
    expect(JSON.stringify(readFailure)).not.toContain('segredo')
  })
})
