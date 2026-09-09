import vuetify from 'vite-plugin-vuetify'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  modules: ['@pinia/nuxt'],
  css: ['vuetify/styles', '~/assets/main.css'],
  app: {
    head: {
      title: 'BleedingMoney — Auditor de despesas recorrentes',
      htmlAttrs: { lang: 'pt-PT' },
      meta: [
        { name: 'description', content: 'Análise explicável das tuas despesas recorrentes.' },
        { name: 'theme-color', content: '#f3f6f4' }
      ]
    }
  },
  build: { transpile: ['vuetify'] },
  nitro: { output: { dir: process.env.NITRO_OUTPUT_DIR || '.output' } },
  vite: { plugins: [vuetify({ autoImport: true })] },
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || '',
    localDataFile: process.env.LOCAL_DATA_FILE || '.data/bleedingmoney.json',
    demo: process.env.BLEEDINGMONEY_DEMO === 'true',
    public: { appName: 'BleedingMoney' }
  },
  typescript: { strict: true, typeCheck: true }
})
