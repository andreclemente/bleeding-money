import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('reestruturação do produto', () => {
  it('documenta proposta, ciclo, IA, evidência e não-objetivos', async () => {
    const document = await readFile(new URL('../../docs/product-restructure.md', import.meta.url), 'utf8')

    expect(document).toContain('auditoria de despesas familiares')
    expect(document).toContain('Registar → Comparar → Decidir → Confirmar → Repetir')
    expect(document).toMatch(/\bIA\b/)
    expect(document).toMatch(/histórico próprio/i)
    expect(document).toMatch(/coorte[s]? anónim[ao]s?.*10/is)
    expect(document).toMatch(/habitação.*factual/is)
    expect(document).toMatch(/seguros.*comparável/is)
    expect(document).toMatch(/OCR|Open Banking|scraping/)
    expect(document).toMatch(/não (?:invent|fabric)/i)
  })

  it('expõe quatro tarefas primárias sem passos fictícios e Método/privacidade como secundário', async () => {
    const [layout, dashboard] = await Promise.all([
      readFile(new URL('../../layouts/default.vue', import.meta.url), 'utf8'),
      readFile(new URL('../../pages/dashboard.vue', import.meta.url), 'utf8')
    ])

    for (const label of ['Hoje', 'Registar', 'Contratos', 'Objetivo']) expect(layout).toContain(`>${label}<`)
    expect(layout.match(/class="nav-link"/g)).toHaveLength(4)
    expect(layout).not.toContain('nav-index')
    expect(layout).toMatch(/Método.*privacidade/is)
    expect(dashboard).not.toMatch(/IA com limites/i)
  })
})
