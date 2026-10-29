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

  it('leva uma estimativa prioritária diretamente para a sala de decisão do contrato', async () => {
    const page = await readFile(new URL('../../pages/dashboard.vue', import.meta.url), 'utf8')
    const detail = await readFile(new URL('../../pages/expenses/[id].vue', import.meta.url), 'utf8')

    expect(page).toContain("action.kind === 'estimated_finding'")
    expect(page).toContain('`/expenses/${action.expenseId}#decision-room`')
    expect(page).toContain("cta: 'Preparar contrato'")
    expect(detail).toContain('id="decision-room"')
    expect(detail).toMatch(/Sala de decisão do contrato/i)
  })

  it('mostra o contrato e o custo anterior para tornar cada confirmação auditável', async () => {
    const page = await readFile(new URL('../../pages/dashboard.vue', import.meta.url), 'utf8')

    expect(page).toContain('decision.provider')
    expect(page).toContain('decision.productName')
    expect(page).toContain('decision.previousCostCents')
    expect(page).toContain('decision.newCostCents')
    expect(page).toContain('Custo observado')
    expect(page).toContain(':to="`/expenses/${decision.expenseId}`"')
  })
})
