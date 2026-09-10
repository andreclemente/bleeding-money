import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('experiência de gastos mensais', () => {
  it('faz perguntas concretas, permite histórico e rotula cenários sem prometer poupança', async () => {
    const page = await readFile(new URL('../../pages/spending.vue', import.meta.url), 'utf8')

    expect(page).toMatch(/Só precisas de um número/i)
    expect(page).toMatch(/Guardar este mês/i)
    expect(page).toMatch(/Quero perceber melhor este mês/i)
    expect(page).toMatch(/v-if="detailsOpen"/)
    expect(page).toMatch(/v-if="householdOpen"/)
    expect(page).toMatch(/loadMonth\(month\.value, false\)/)
    expect(page.match(/v-if="analysisOpen"/g)).toHaveLength(3)
    expect(page).not.toMatch(/Passo 1 de|Passo 2 de/i)
    expect(page).toMatch(/Quanto gastaste no supermercado/i)
    expect(page).toMatch(/Adicionar o mês anterior/i)
    expect(page).toMatch(/type="month"/)
    expect(page).toMatch(/\^\\d\{4\}-\(0\[1-9\]\|1\[0-2\]\)\$/)
    expect(page).toMatch(/mês por escolher/i)
    expect(page).toMatch(/Baseado apenas nos limites que escolheste/i)
    expect(page).toMatch(/não é uma previsão|não é uma garantia/i)
    expect(page).toMatch(/Cenário guardado/i)
    expect(page).toMatch(/Histórico próprio/i)
    expect(page).toMatch(/Agregados semelhantes/i)
    expect(page).toMatch(/aria-invalid/)
    expect(page).toMatch(/aria-describedby/)
    expect(page).toMatch(/useHead\(\{ title:/)
    expect(page).not.toMatch(/Math\.max\(5,/)
    expect(page).toMatch(/Onde se concentrou o gasto/i)
    expect(page).toMatch(/Como evoluíram os teus gastos/i)
    expect(page).toMatch(/Custos de habitação/i)
    expect(page).toMatch(/Renda|Prestação da casa/i)
    expect(page).toMatch(/Condomínio/i)
    expect(page).toMatch(/contexto[\s\S]*não.*desperdício/i)
    expect(page).not.toMatch(/reduzir (?:a )?(?:renda|prestação|condomínio)/i)
    expect(page).not.toMatch(/gráfico circular|pie|chart\.js/i)
  })

  it('integra a área na navegação e no monitor sem links mortos', async () => {
    const [layout, dashboard, welcome] = await Promise.all([
      readFile(new URL('../../layouts/default.vue', import.meta.url), 'utf8'),
      readFile(new URL('../../pages/dashboard.vue', import.meta.url), 'utf8'),
      readFile(new URL('../../pages/welcome.vue', import.meta.url), 'utf8')
    ])

    expect(layout).toMatch(/to="\/spending"[\s\S]*Registar/)
    expect(dashboard).toMatch(/to="\/spending"[\s\S]*Registar/)
    expect(dashboard).not.toContain('monthly-spending-callout')
    expect(welcome).toMatch(/to="\/spending"[\s\S]*supermercado/i)
  })
})
