import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('inventário de contratos', () => {
  it('mostra no radar todos os tipos de prazo declarado com uma ação concreta', async () => {
    const page = await readFile(new URL('../../pages/expenses/index.vue', import.meta.url), 'utf8')

    expect(page).toMatch(/buildContractRadar/)
    expect(page).toMatch(/Radar de decisões/i)
    expect(page).toMatch(/Fim da fidelização|entry\.label/)
    expect(page).toMatch(/entry\.action/)
    expect(page).toMatch(/prazos declarados/i)
    expect(page).toMatch(/getNextDeclaredContractDate/)
    expect(page).toMatch(/Próximo prazo/i)
    expect(page).not.toMatch(/const renewalDate/)
  })
})