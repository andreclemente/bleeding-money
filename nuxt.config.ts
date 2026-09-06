import vuetify from 'vite-plugin-vuetify'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  modules: ['@pinia/nuxt'],
  css: ['vuetify/styles', '~/assets/main.css'],
  build: { transpile: ['vuetify'] },
  vite: { plugins: [vuetify({ autoImport: true })] },
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || '',
    public: { appName: 'Poupanças' }
  },
  typescript: { strict: true, typeCheck: true }
})
