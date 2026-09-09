import { describe, expect, it } from 'vitest'
import { DEMO_USER_ID } from '../../server/db/demo-data'
import { MemoryRepository } from '../../server/db/repository'
import { setupStatus } from '../../server/services/setup'

describe('setupStatus', () => {
  it('pede onboarding quando não existem despesas e não expõe dados pessoais', async () => {
    const result = await setupStatus(new MemoryRepository(), DEMO_USER_ID, 'local-json')

    expect(result).toEqual({ onboardingNeeded: true, storageMode: 'local-json' })
    expect(JSON.stringify(result)).not.toContain(DEMO_USER_ID)
  })

  it('considera o onboarding concluído após o primeiro mês de gastos', async () => {
    const repo = new MemoryRepository()
    await repo.upsertHouseholdProfile(DEMO_USER_ID, { adults: 2, dependents: 1, country: 'PT' })
    await repo.upsertMonthlySpendPeriod(DEMO_USER_ID, {
      month: '2026-08',
      adults: 2,
      dependents: 1,
      status: 'estimated',
      supermarketCoverage: 'unknown',
      amountBasis: 'memory_estimate',
      amounts: [{ category: 'supermarket_total', scope: 'supermarket', amountCents: 40000, trackingIntent: 'track_only' }]
    })

    expect(await setupStatus(repo, DEMO_USER_ID, 'local-json')).toEqual({ onboardingNeeded: false, storageMode: 'local-json' })
  })

  it('considera o onboarding concluído após a primeira despesa', async () => {
    const repo = new MemoryRepository()
    await repo.createExpense(DEMO_USER_ID, {
      category: 'bank',
      provider: 'Banco',
      productName: 'Conta',
      monthlyCostCents: 500,
      details: { kind: 'bank', accountMaintenanceFeeCents: 500, cardAnnualFeeCents: 0, transferFeesCents: 0 }
    })

    expect(await setupStatus(repo, DEMO_USER_ID, 'postgresql')).toEqual({ onboardingNeeded: false, storageMode: 'postgresql' })
  })
})
