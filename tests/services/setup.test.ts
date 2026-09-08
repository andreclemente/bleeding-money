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
