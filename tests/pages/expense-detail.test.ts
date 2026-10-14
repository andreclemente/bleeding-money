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
})
