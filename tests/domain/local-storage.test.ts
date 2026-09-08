import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DEMO_USER_ID } from '../../server/db/demo-data'
import { JsonFileRepository, MemoryRepository } from '../../server/db/repository'

const dirs: string[] = []
const tempFile = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bleeding-money-'))
  dirs.push(directory)
  return { directory, file: join(directory, 'state.json') }
}
const subscription = (index = 1) => ({
  category: 'subscription' as const,
  provider: `Fornecedor ${index}`,
  productName: `Plano ${index}`,
  monthlyCostCents: 1000 + index,
  details: { kind: 'subscription' as const, plan: `Plano ${index}` }
})

afterEach(async () => {
  await Promise.all(dirs.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

describe('modo local pessoal', () => {
  it('começa vazio por omissão, sem despesas ou findings de demonstração', async () => {
    const repo = new MemoryRepository()

    expect(await repo.listExpenses(DEMO_USER_ID)).toEqual([])
    expect(await repo.listFindings(DEMO_USER_ID)).toEqual([])
  })

  it('carrega fixtures pessoais apenas com opt-in explícito', async () => {
    const repo = new MemoryRepository({ demo: true })

    expect((await repo.listExpenses(DEMO_USER_ID)).length).toBeGreaterThan(0)
    expect((await repo.listFindings(DEMO_USER_ID)).length).toBeGreaterThan(0)
  })

  it('persiste estado entre instâncias do repositório', async () => {
    const { file } = await tempFile()
    const first = new JsonFileRepository(file)
    const created = await first.createExpense(DEMO_USER_ID, subscription())

    const restarted = new JsonFileRepository(file)
    expect(await restarted.listExpenses(DEMO_USER_ID)).toEqual([created])
    expect((await restarted.getExpense(DEMO_USER_ID, created.id))?.snapshots).toHaveLength(1)
  })

  it('serializa mutações concorrentes e deixa apenas JSON completo', async () => {
    const { directory, file } = await tempFile()
    const repo = new JsonFileRepository(file)

    await Promise.all(Array.from({ length: 24 }, (_, index) => repo.createExpense(DEMO_USER_ID, subscription(index))))

    expect(await repo.listExpenses(DEMO_USER_ID)).toHaveLength(24)
    expect(JSON.parse(await readFile(file, 'utf8')).expenses).toHaveLength(24)
    expect((await readdir(directory)).filter(name => name !== 'state.json')).toEqual([])
  })

  it('serializa mutações concorrentes entre instâncias que partilham o ficheiro', async () => {
    const { file } = await tempFile()
    const first = new JsonFileRepository(file)
    const second = new JsonFileRepository(file)

    await Promise.all(Array.from({ length: 12 }, (_, index) => (index % 2 ? first : second).createExpense(DEMO_USER_ID, subscription(index))))

    expect(await new JsonFileRepository(file).listExpenses(DEMO_USER_ID)).toHaveLength(12)
  })

  it('falha claramente perante armazenamento corrupto e não o substitui', async () => {
    const { file } = await tempFile()
    await writeFile(file, '{ dados pessoais truncados', 'utf8')
    const repo = new JsonFileRepository(file)

    await expect(repo.listExpenses(DEMO_USER_ID)).rejects.toThrow(/corrupto/i)
    await expect(repo.createExpense(DEMO_USER_ID, subscription())).rejects.toThrow(/corrupto/i)
    expect(await readFile(file, 'utf8')).toBe('{ dados pessoais truncados')
  })

  it.each([
    ['despesa', (state: ReturnType<MemoryRepository['exportState']>) => { state.expenses[0]!.monthlyCostCents = 'veneno' as never }],
    ['snapshot', (state: ReturnType<MemoryRepository['exportState']>) => { state.snapshots[0]!.properties = [] as unknown as Record<string, unknown> }],
    ['finding', (state: ReturnType<MemoryRepository['exportState']>) => { state.findings[0]!.evidence = ['válida', 42 as never] }],
    ['ação', (state: ReturnType<MemoryRepository['exportState']>) => { state.actions.push('inválida' as never) }],
    ['relação', (state: ReturnType<MemoryRepository['exportState']>) => { state.snapshots[0]!.expenseId = '90000000-0000-4000-8000-000000000009' }],
    ['timestamp impossível na despesa', (state: ReturnType<MemoryRepository['exportState']>) => { state.expenses[0]!.createdAt = '2026-02-30T12:00:00.000Z' }],
    ['timestamp impossível no finding', (state: ReturnType<MemoryRepository['exportState']>) => { state.findings[0]!.createdAt = '2026-02-30T12:00:00.000Z' }],
    ['timestamp impossível na ação', (state: ReturnType<MemoryRepository['exportState']>) => {
      const finding = state.findings[0]!
      finding.status = 'resolved'
      finding.resolvedAt = '2026-09-07T12:00:00.000Z'
      state.actions.push({
        id: '90000000-0000-4000-8000-000000000001',
        findingId: finding.id,
        previousCostCents: 8200,
        newCostCents: 8100,
        actionDate: '2026-09-07',
        annualSavingCents: 1200,
        createdAt: '2026-02-30T12:00:00.000Z'
      })
    }]
  ])('rejeita %s malformada em JSON válido sem alterar um único byte', async (_label, corrupt) => {
    const { file } = await tempFile()
    const state = new MemoryRepository({ demo: true }).exportState()
    corrupt(state)
    const originalBytes = Buffer.from(`${JSON.stringify(state, null, 2)}\n`, 'utf8')
    await writeFile(file, originalBytes)
    const repo = new JsonFileRepository(file)
    const corruptFileError = `Ficheiro de dados local corrupto: ${file}`

    await expect(repo.listExpenses(DEMO_USER_ID)).rejects.toThrow(corruptFileError)
    await expect(repo.createExpense(DEMO_USER_ID, subscription())).rejects.toThrow(corruptFileError)
    expect(await readFile(file)).toEqual(originalBytes)
  })
})
