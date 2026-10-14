import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('detalhe do contrato', () => {
  it('apresenta uma linha de vida auditável e mantém custo, variações e datas semanticamente separados', async () => {
    const page = await readFile(new URL('../../pages/expenses/[id].vue', import.meta.url), 'utf8')

    expect(page).toContain('buildExpenseLifecycle')
    expect(page).toMatch(/Equivalente anual/i)
    expect(page).toMatch(/não é uma cobrança adicional/i)
    expect(page).toMatch(/Linha de vida da despesa/i)
    expect(page).toMatch(/Variação confirmada/i)
    expect(page).toMatch(/Datas para decidir/i)
    expect(page).toMatch(/Renovação, fidelização e fim de contrato são eventos diferentes/i)
    expect(page).not.toMatch(/poupança confirmada/i)
  })

  it('permite registar um novo valor observado sem o apresentar como poupança confirmada', async () => {
    const page = await readFile(new URL('../../pages/expenses/[id].vue', import.meta.url), 'utf8')

    expect(page).toMatch(/Registar novo valor observado/i)
    expect(page).toMatch(/method:\s*'PATCH'/)
    expect(page).toMatch(/monthlyCostCents/)
    expect(page).toMatch(/fica na linha de vida/i)
    expect(page).toMatch(/não confirma uma poupança/i)
    expect(page).toMatch(/Novo valor em EUR/i)
  })
})
