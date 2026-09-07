import { createVuetify } from 'vuetify'

export default defineNuxtPlugin(nuxtApp => {
  const vuetify = createVuetify({
    defaults: {
      VBtn: { rounded: 'lg' },
      VCard: { rounded: 'lg' }
    },
    theme: {
      defaultTheme: 'bleedingMoney',
      themes: {
        bleedingMoney: {
          dark: false,
          colors: {
            primary: '#136b52',
            secondary: '#35658a',
            background: '#f3f6f4',
            surface: '#ffffff',
            error: '#b34a4a',
            warning: '#a86e16',
            success: '#217a55',
            info: '#35658a'
          }
        }
      }
    }
  })
  nuxtApp.vueApp.use(vuetify)
})
