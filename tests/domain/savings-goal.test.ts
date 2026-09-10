import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { confirmedGoalProgress, parseSavingsGoalInput } from '../../domain/savings-goal'
import { DEMO_USER_ID } from '../../server/db/demo-data'
import { JsonFileRepository, MemoryRepository } from '../../server/db/repository'

const directories: string[] = []
afterEach(async () => Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))))

describe('objetivo familiar ligado a poupanças confirmadas', () => {
  it('valida um objetivo anual em EUR/cêntimos sem aceitar identidade ou progresso do cliente', () => {
    expect(parseSavingsGoalInput({ name: 'Fundo de emergência', targetAnnualCents: 120000 })).toEqual({ name: 'Fundo de emergência', targetAnnualCents: 120000 })
    expect(() => parseSavingsGoalInput({ name: 'Férias', targetAnnualCents: 100000, progressCents: 90000 })).toThrow(/campo não permitido/i)
    expect(() => parseSavingsGoalInput({ name: ' ', targetAnnualCents: 100000 })).toThrow(/nome/i)
    expect(() => parseSavingsGoalInput({ name: 'Férias', targetAnnualCents: 10.5 })).toThrow(/montante/i)
  })

  it('mede progresso apenas pela redução anual confirmada em ações concluídas', () => {
    expect(confirmedGoalProgress({ id: 'g', userId: DEMO_USER_ID, name: 'Reserva', targetAnnualCents: 20000, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' }, [
      { annualSavingCents: 16800 }
    ])).toMatchObject({ confirmedAnnualCents: 16800, remainingAnnualCents: 3200, percentage: 84 })
  })

  it('rejeita ações monetárias inválidas e overflow no progresso confirmado', () => {
    const goal = { id: 'g', userId: DEMO_USER_ID, name: 'Reserva', targetAnnualCents: 20000, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' }
    expect(() => confirmedGoalProgress(goal, [{ annualSavingCents: -1 }])).toThrow(/monetário/i)
    expect(() => confirmedGoalProgress(goal, [{ annualSavingCents: Number.MAX_SAFE_INTEGER }, { annualSavingCents: 1 }])).toThrow(/monetário/i)
  })

  it('isola e persiste um único objetivo por utilizador no armazenamento local', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'goal-'))
    directories.push(directory)
    const file = join(directory, 'state.json')
    const repo = new JsonFileRepository(file)
    const otherUser = '90000000-0000-4000-8000-000000000009'

    await repo.upsertSavingsGoal(DEMO_USER_ID, { name: 'Reserva familiar', targetAnnualCents: 240000 })
    expect(await repo.getSavingsGoal(otherUser)).toBeNull()
    expect(await new JsonFileRepository(file).getSavingsGoal(DEMO_USER_ID)).toMatchObject({ name: 'Reserva familiar', targetAnnualCents: 240000 })
  })

  it('não altera o progresso quando apenas existe potencial por confirmar', async () => {
    const repo = new MemoryRepository({ demo: true })
    await repo.upsertSavingsGoal(DEMO_USER_ID, { name: 'Margem anual', targetAnnualCents: 50000 })

    expect((await repo.getSavingsGoalProgress(DEMO_USER_ID))?.confirmedAnnualCents).toBe(0)
    await repo.resolveFinding(DEMO_USER_ID, '40000000-0000-4000-8000-000000000002', 3490, '2026-09-06')
    expect(await repo.getSavingsGoalProgress(DEMO_USER_ID)).toMatchObject({ confirmedAnnualCents: 16800, remainingAnnualCents: 33200, percentage: 34 })
  })
})
