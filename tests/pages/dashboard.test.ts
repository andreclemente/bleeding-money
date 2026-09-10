import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('Hoje', () => {
  it('apresenta uma única Rota Familiar e um extrato sem total de findings sobrepostos', async () => {
    const page = await readFile(new URL('../../pages/dashboard.vue', import.meta.url), 'utf8')

    expect(page).toMatch(/<h1>Hoje<\/h1>/)
    expect(page).toContain('Rota Familiar')
    expect(page).toContain('Extrato familiar')
    expect(page).toContain('Redução anual confirmada')
    expect(page).toContain('Objetivo')
    expect(page).not.toContain('potentialMonthlyMinCents')
    expect(page).not.toContain('potentialMonthlyMaxCents')
    expect(page).not.toContain('Poupança mensal potencial')
    expect(page).not.toContain('monthly-spending-callout')
    expect(page).not.toContain('goal-callout')
  })

  it('distingue estimativa, confirmado e evidência e descreve atualização manual', async () => {
    const page = await readFile(new URL('../../pages/dashboard.vue', import.meta.url), 'utf8')

    expect(page).toContain('Estimativa')
    expect(page).toContain('Confirmado')
    expect(page).toContain('Evidência')
    expect(page).toMatch(/atualiz/i)
    expect(page).not.toMatch(/vigilância|automaticamente|segundo plano/i)
  })
})
