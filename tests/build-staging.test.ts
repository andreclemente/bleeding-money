import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'

describe('build de staging isolada', () => {
  it('não mistura a build de staging com lint, git ou a build servida', async () => {
    const [nuxtConfig, eslintConfig, gitignore] = await Promise.all([
      readFile(new URL('../nuxt.config.ts', import.meta.url), 'utf8'),
      readFile(new URL('../eslint.config.js', import.meta.url), 'utf8'),
      readFile(new URL('../.gitignore', import.meta.url), 'utf8')
    ])

    expect(nuxtConfig).toMatch(/NITRO_OUTPUT_DIR[^\n]*\.output/)
    expect(eslintConfig).toMatch(/\.output-\*\/\*\*/)
    expect(gitignore).toMatch(/^\.output-\*$/m)
  })
})
