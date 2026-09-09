import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { householdProfiles, monthlySpendAmounts, monthlySpendPeriods, spendCohortAggregates } from '../../server/db/schema'
import { JsonFileRepository, MemoryRepository } from '../../server/db/repository'

const userA = '10000000-0000-4000-8000-000000000001'
const userB = '10000000-0000-4000-8000-000000000002'
const directories: string[] = []
const periodInput = (month: string, supermarketCents = 45000, adults = 2, dependents = 1) => ({
  month,
  adults,
  dependents,
  status: 'complete' as const,
  supermarketCoverage: 'includes_cleaning_hygiene' as const,
  amountBasis: 'statement_or_receipts' as const,
  amounts: [
    { category: 'supermarket_total' as const, scope: 'supermarket' as const, amountCents: supermarketCents, trackingIntent: 'track_only' as const },
    { category: 'fast_food_takeaway' as const, scope: 'outside_supermarket' as const, amountCents: 7000, trackingIntent: 'reduce' as const, userTargetCents: 4000 }
  ]
})

const temporaryFile = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'spending-'))
  directories.push(directory)
  return join(directory, 'state.json')
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

describe.each([
  ['memória', () => new MemoryRepository()],
  ['JSON local', async () => new JsonFileRepository(await temporaryFile())]
])('persistência de gastos em %s', (_label, createRepository) => {
  it('isola perfil e períodos por utilizador e atualiza o mesmo mês sem duplicar', async () => {
    const repository = await createRepository()

    const profile = await repository.upsertHouseholdProfile(userA, { adults: 2, dependents: 1, country: 'PT' })
    await repository.upsertHouseholdProfile(userB, { adults: 1, dependents: 0, country: 'PT' })
    const first = await repository.upsertMonthlySpendPeriod(userA, periodInput('2026-07-01'))
    await repository.upsertMonthlySpendPeriod(userA, periodInput('2026-06-01', 44000))
    const updated = await repository.upsertMonthlySpendPeriod(userA, periodInput('2026-07-01', 47000))
    await repository.upsertMonthlySpendPeriod(userB, periodInput('2026-07-01', 99000))

    expect(profile).toMatchObject({ userId: userA, adults: 2, dependents: 1, country: 'PT' })
    expect(updated.id).toBe(first.id)
    expect(updated.amounts[0]?.periodId).toBe(first.id)
    expect(updated).toMatchObject({ adults: 2, dependents: 1, adultBand: '2', dependentBand: '1' })
    expect((await repository.listMonthlySpendPeriods(userA)).map(item => item.month)).toEqual(['2026-07-01', '2026-06-01'])
    expect((await repository.listMonthlySpendPeriods(userA))[0]?.amounts[0]?.amountCents).toBe(47000)
    expect(await repository.getHouseholdProfile(userB)).toMatchObject({ userId: userB, adults: 1 })
    expect(JSON.stringify(await repository.listMonthlySpendPeriods(userA))).not.toContain('99000')
  })

  it('usa e edita a composição explícita do mês sem depender do perfil atual', async () => {
    const repository = await createRepository()
    await repository.upsertHouseholdProfile(userA, { adults: 2, dependents: 1, country: 'PT' })
    const backfill = await repository.upsertMonthlySpendPeriod(userA, periodInput('2026-05-01', 45000, 1, 0))
    await repository.upsertHouseholdProfile(userA, { adults: 4, dependents: 3, country: 'PT' })
    const edited = await repository.upsertMonthlySpendPeriod(userA, periodInput('2026-05-01', 47000, 3, 2))

    expect(backfill).toMatchObject({ adults: 1, dependents: 0, adultBand: '1', dependentBand: '0' })
    expect(edited).toMatchObject({ id: backfill.id, adults: 3, dependents: 2, adultBand: '3plus', dependentBand: '2plus' })
    expect(await repository.getHouseholdProfile(userA)).toMatchObject({ adults: 4, dependents: 3 })
  })
})

describe('ficheiro JSON de gastos', () => {
  it('tem paridade estrutural com PostgreSQL sem identificadores pessoais nas coortes', () => {
    expect(householdProfiles.userId.name).toBe('user_id')
    expect(monthlySpendPeriods.userId.name).toBe('user_id')
    expect(monthlySpendAmounts.amountCents.name).toBe('amount_cents')
    expect(spendCohortAggregates.householdCount.name).toBe('household_count')
    expect(spendCohortAggregates.scope.name).toBe('scope')
    expect(spendCohortAggregates.amountBasis.name).toBe('amount_basis')
    expect(spendCohortAggregates.status.name).toBe('status')
    expect(Object.keys(spendCohortAggregates)).not.toEqual(expect.arrayContaining(['userId', 'email', 'periodId']))
  })

  it('sobrevive a reinício e valida relações e estado versionado', async () => {
    const file = await temporaryFile()
    const first = new JsonFileRepository(file)
    await first.upsertHouseholdProfile(userA, { adults: 2, dependents: 1, country: 'PT' })
    const created = await first.upsertMonthlySpendPeriod(userA, periodInput('2026-08-01'))

    const restarted = new JsonFileRepository(file)
    expect(await restarted.getHouseholdProfile(userA)).toMatchObject({ adults: 2, dependents: 1 })
    expect(await restarted.listMonthlySpendPeriods(userA)).toEqual([created])
    const stored = JSON.parse(await readFile(file, 'utf8'))
    expect(stored).toMatchObject({ version: 3 })
    expect(stored.householdProfiles).toHaveLength(1)
    expect(stored.monthlySpendPeriods).toHaveLength(1)
    expect(stored.anonymousCohortAggregates).toEqual([])
  })

  it('rejeita IDs de montante duplicados entre períodos diferentes', async () => {
    const file = await temporaryFile()
    const repository = new JsonFileRepository(file)
    await repository.upsertHouseholdProfile(userA, { adults: 2, dependents: 1, country: 'PT' })
    await repository.upsertMonthlySpendPeriod(userA, periodInput('2026-07-01'))
    await repository.upsertMonthlySpendPeriod(userA, periodInput('2026-08-01'))
    const state = JSON.parse(await readFile(file, 'utf8'))
    state.monthlySpendPeriods[1].amounts[0].id = state.monthlySpendPeriods[0].amounts[0].id
    await writeFile(file, JSON.stringify(state), 'utf8')

    await expect(new JsonFileRepository(file).listMonthlySpendPeriods(userA)).rejects.toThrow(/corrupto/i)
  })
})
