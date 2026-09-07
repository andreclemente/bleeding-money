import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  test: { environment: 'node' },
  resolve: { alias: { '~': new URL('.', import.meta.url).pathname } }
})
