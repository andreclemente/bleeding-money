import { createVuetify } from 'vuetify'

export default defineNuxtPlugin(nuxtApp => {
  const vuetify = createVuetify({ theme: { defaultTheme: 'poupancas', themes: { poupancas: { dark: false, colors: { primary: '#0d6b57', secondary: '#e5a02b', background: '#f5f7f3', surface: '#ffffff', error: '#b43b3b' } } } } })
  nuxtApp.vueApp.use(vuetify)
})
