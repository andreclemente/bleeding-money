import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('Hoje', () => {
  it('apresenta uma única missão familiar e um mapa sem totais sobrepostos', async () => {
    const page = await readFile(new URL('../../pages/dashboard.vue', import.meta.url), 'utf8')

    expect(page).toContain('<h1>Uma coisa útil hoje.</h1>')
    expect(page).toContain('Missão familiar')
    expect(page).toContain('Mapa BleedingMoney')
    expect(page).toContain('Redução anual confirmada')
    expect(page).toContain('Objetivo')
    expect(page).not.toContain('potentialMonthlyMinCents')
    expect(page).not.toContain('potentialMonthlyMaxCents')
    expect(page).not.toContain('Poupança mensal potencial')
    expect(page).not.toContain('monthly-spending-callout')
    expect(page).not.toContain('goal-callout')
  })

  it('oferece definir um objetivo sem confundir redução confirmada com dinheiro depositado', async () => {
    const page = await readFile(new URL('../../pages/dashboard.vue', import.meta.url), 'utf8')

    expect(page).toContain("action.kind === 'define_goal'")
    expect(page).toContain('Dar um destino às reduções confirmadas')
    expect(page).toContain('Não representa dinheiro já depositado')
    expect(page).toContain("href: '/savings-goal'")
  })

  it('distingue estimativa, recuperado e evidência e descreve atualização manual', async () => {
    const page = await readFile(new URL('../../pages/dashboard.vue', import.meta.url), 'utf8')

    expect(page).toContain('Estimativa')
    expect(page).toContain('Recuperado')
    expect(page).toContain('Evidência')
    expect(page).toMatch(/atualiz/i)
    expect(page).not.toMatch(/vigilância|automaticamente|segundo plano/i)
  })

  it('transforma qualquer prazo contratual próximo numa missão concreta', async () => {
    const page = await readFile(new URL('../../pages/dashboard.vue', import.meta.url), 'utf8')

    expect(page).toContain("action.kind === 'contract_deadline'")
    expect(page).toContain('action.label')
    expect(page).toContain('action.action')
    expect(page).toContain('data declarada')
    expect(page).not.toContain("action.kind === 'insurance_renewal'")
  })

  it('transforma uma agenda contratual incompleta numa missão factual sem inventar datas', async () => {
    const page = await readFile(new URL('../../pages/dashboard.vue', import.meta.url), 'utf8')

    expect(page).toContain("action.kind === 'complete_contract_agenda'")
    expect(page).toContain('Confirmar agenda de')
    expect(page).toContain('contrato, fatura ou aviso do fornecedor')
    expect(page).toContain('?edit=agenda')
  })
})
