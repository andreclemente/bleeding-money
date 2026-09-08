import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8')

describe('pedidos internos durante SSR', () => {
  it.each(['middleware/auth.global.ts', 'layouts/default.vue', 'pages/dashboard.vue', 'pages/index.vue'])('%s usa fetch associado ao pedido', async path => {
    expect(await source(path)).toMatch(/useRequestFetch\(\)/)
  })

  it('o refresh da store aceita o fetch interno sem encaminhar cabeçalhos para URLs externas', async () => {
    const text = await source('stores/savings.ts')
    expect(text).toMatch(/refresh\s*=\s*async\s*\(fetcher/)
    expect(text).not.toMatch(/headers\s*:/)
  })
})