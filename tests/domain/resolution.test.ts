import { describe, expect, it } from 'vitest'
import { DEMO_USER_ID } from '../../server/db/demo-data'
import { MemoryRepository } from '../../server/db/repository'

describe('fluxo de resolução', () => {
  it('parte de exatamente 57–81 €/mês potenciais', async () => {
    const repo = new MemoryRepository({ demo: true })
    const open = (await repo.listFindings(DEMO_USER_ID)).filter(item => item.status === 'open')
    expect(open.reduce((sum, item) => sum + item.estimatedMonthlySavingMinCents, 0)).toBe(5700)
    expect(open.reduce((sum, item) => sum + item.estimatedMonthlySavingMaxCents, 0)).toBe(8100)
  })
  it('resolve Vodafone 48,90→34,90, cria ação imutável e atualiza despesa e snapshot', async () => {
    const repo = new MemoryRepository({ demo: true })
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
    const repo = new MemoryRepository({ demo: true })
    const id = '40000000-0000-4000-8000-000000000001'
    await expect(repo.dismissFinding('00000000-0000-4000-8000-999999999999', id)).rejects.toThrow()
    await repo.dismissFinding(DEMO_USER_ID, id)
    await expect(repo.resolveFinding(DEMO_USER_ID, id, 0, '2026-09-06')).rejects.toThrow()
  })

  it('recusa confirmar poupança sem redução real ou com cobrança no futuro', async () => {
    const repo = new MemoryRepository({ demo: true })
    const findingId = '40000000-0000-4000-8000-000000000002'

    await expect(repo.resolveFinding(DEMO_USER_ID, findingId, 4890, '2026-09-06')).rejects.toThrow(/inferior/i)
    await expect(repo.resolveFinding(DEMO_USER_ID, findingId, 3490, '2999-01-01')).rejects.toThrow(/futuro/i)
    expect(await repo.listActions(DEMO_USER_ID)).toHaveLength(0)
  })

  it('recusa transformar uma revisão factual sem estimativa numa poupança', async () => {
    const repo = new MemoryRepository()
    const renewalDate = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10)
    const expense = await repo.createExpense(DEMO_USER_ID, {
      category: 'insurance', provider: 'Seguradora', productName: 'Casa', monthlyCostCents: 2400,
      details: { kind: 'insurance', policyType: 'home', renewalDate, coverageCodes: [] }
    })
    const finding = (await repo.getExpense(DEMO_USER_ID, expense.id))!.findings.find(item => item.type === 'CONTRACT_EXPIRING')!

    await expect(repo.resolveFinding(DEMO_USER_ID, finding.id, 0, renewalDate)).rejects.toThrow(/poupança estimada/i)
    expect(await repo.listActions(DEMO_USER_ID)).toHaveLength(0)
    expect((await repo.getExpense(DEMO_USER_ID, expense.id))?.expense.monthlyCostCents).toBe(2400)
  })
})
