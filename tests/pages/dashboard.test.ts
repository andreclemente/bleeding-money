import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('dashboard factual', () => {
  it('não apresenta avisos sem estimativa como poupança zero', async () => {
    const page = await readFile(new URL('../../pages/dashboard.vue', import.meta.url), 'utf8')
    expect(page).toMatch(/hasEstimatedSaving/)
    expect(page).toMatch(/Poupança não estimada/)
    expect(page).toMatch(/Sem poupanças potenciais estimadas/)
    expect(page).toContain('v-else-if="priorityFindings.length"')
    expect(page).toMatch(/Sem poupança potencial identificada/)
  })
})