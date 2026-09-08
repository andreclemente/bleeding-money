<script setup lang="ts">
definePageMeta({ layout: 'auth' })
const email = ref('')
const password = ref('')
const visible = ref(false)
const pending = ref(false)
const error = ref('')
const submit = async () => {
  pending.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/login', { method: 'POST', body: { email: email.value, password: password.value } })
    const setup = await $fetch<{ onboardingNeeded: boolean }>('/api/setup')
    await navigateTo(setup.onboardingNeeded ? '/welcome' : '/dashboard')
  } catch (reason: unknown) {
    const value = reason as { data?: { statusMessage?: string }, message?: string }
    error.value = value.data?.statusMessage || value.message || 'Email ou palavra-passe incorretos.'
  } finally { pending.value = false }
}
</script>

<template>
  <form
    class="auth-form"
    aria-labelledby="login-title"
    @submit.prevent="submit"
  >
    <div class="section-kicker">
      Espaço pessoal privado
    </div>
    <h1 id="login-title">
      Entrar
    </h1>
    <p>Usa a conta proprietária deste BleedingMoney.</p>
    <v-text-field
      v-model="email"
      label="Email"
      type="email"
      autocomplete="email"
      maxlength="254"
      required
      autofocus
      variant="outlined"
    />
    <v-text-field
      v-model="password"
      label="Palavra-passe"
      :type="visible ? 'text' : 'password'"
      autocomplete="current-password"
      maxlength="256"
      required
      variant="outlined"
    />
    <button
      class="password-toggle"
      type="button"
      :aria-pressed="visible"
      @click="visible = !visible"
    >
      {{ visible ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe' }}
    </button>
    <p
      v-if="error"
      class="form-error"
      role="alert"
    >
      {{ error }}
    </p>
    <v-btn
      type="submit"
      color="primary"
      size="large"
      block
      :loading="pending"
    >
      Entrar
    </v-btn>
    <NuxtLink
      class="auth-help"
      to="/how-it-works"
    >
      Como funciona a análise?
    </NuxtLink>
  </form>
</template>
