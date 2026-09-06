import { describe, expect, it } from 'vitest'
import { DEMO_USER_ID } from '../../server/db/demo-data'
import { MemoryRepository } from '../../server/db/repository'

describe('fluxo de resolução', () => {
  it('parte de exatamente 57–81 €/mês potenciais', async () => {
    const repo = new MemoryRepository()
    const open = (await repo.listFindings(DEMO_USER_ID)).filter(item => item.status === 'open')
    expect(open.reduce((sum, item) => sum + item.estimatedMonthlySavingMinCents, 0)).toBe(5700)
    expect(open.reduce((sum, item) => sum + item.estimatedMonthlySavingMaxCents, 0)).toBe(8100)
  })
  it('resolve Vodafone 48,90→34,90, cria ação imutável e atualiza despesa e snapshot', async () => {
    const repo = new MemoryRepository()
    const findingId = '40000000-0000-4000-8000-000000000002'
    const action = await repo.resolveFinding(DEMO_USER_ID, findingId, 3490, '2026-09-06')
    expect(action.annualSavingCents).toBe(16800)
    expect((await repo.getFinding(DEMO_USER_ID, findingId))?.status).toBe('resolved')
    const detail = await repo.getExpense(DEMO_USER_ID, '10000000-0000-4000-8000-000000000002')
    expect(detail?.expense.monthlyCostCents).toBe(3490)
    expect(detail?.snapshots.at(-1)).toMatchObject({ priceCents: 3490, source: 'saving_action' })
    expect(await repo.listActions(DEMO_USER_ID)).toHaveLength(1)
    await expect(repo.resolveFinding(DEMO_USER_ID, findingId, 3000, '2026-09-07')).rejects.toThrow()
  })
  it('impede acesso entre utilizadores e transições inválidas', async () => {
    const repo = new MemoryRepository()
    const id = '40000000-0000-4000-8000-000000000001'
    await expect(repo.dismissFinding('00000000-0000-4000-8000-999999999999', id)).rejects.toThrow()
    await repo.dismissFinding(DEMO_USER_ID, id)
    await expect(repo.resolveFinding(DEMO_USER_ID, id, 0, '2026-09-06')).rejects.toThrow()
  })
})
