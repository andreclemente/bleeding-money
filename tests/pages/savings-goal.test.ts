import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('objetivo familiar utilizável', () => {
  it('explica que só ações concluídas contam e permite criar ou ajustar o objetivo', async () => {
    const page = await readFile(new URL('../../pages/savings-goal.vue', import.meta.url), 'utf8')
    expect(page).toMatch(/Só contam reduções que confirmaste como concluídas/i)
    expect(page).toMatch(/Poupança anual confirmada/i)
    expect(page).toMatch(/Falta confirmar/i)
    expect(page).toMatch(/aria-valuenow/i)
    expect(page).toMatch(/Provas que contam para o objetivo/i)
    expect(page).toMatch(/route\.decisions/)
    expect(page).toMatch(/previousCostCents[\s\S]+newCostCents/)
    expect(page).toMatch(/Cobrança confirmada/i)
    expect(page).toMatch(/Guardar objetivo/i)
    expect(page).not.toMatch(/orçamento|rendimento|saldo bancário/i)
  })

  it('fica acessível na navegação principal e no monitor', async () => {
    const layout = await readFile(new URL('../../layouts/default.vue', import.meta.url), 'utf8')
    const dashboard = await readFile(new URL('../../pages/dashboard.vue', import.meta.url), 'utf8')
    expect(layout).toMatch(/to="\/savings-goal"[\s\S]+Objetivo/)
    expect(dashboard).toMatch(/Objetivo[\s\S]+ações confirmadas/i)
    expect(dashboard).not.toContain('goal-callout')
  })
})
