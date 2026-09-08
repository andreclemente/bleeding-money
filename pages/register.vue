<script setup lang="ts">
definePageMeta({ layout: 'auth' })
const name = ref('')
const email = ref('')
const password = ref('')
const visible = ref(false)
const pending = ref(false)
const error = ref('')
const submit = async () => {
  pending.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/register', { method: 'POST', body: { name: name.value, email: email.value, password: password.value } })
    await navigateTo('/welcome')
  } catch (reason: unknown) {
    const value = reason as { data?: { statusMessage?: string }, message?: string }
    error.value = value.data?.statusMessage || value.message || 'Não foi possível criar a conta.'
  } finally { pending.value = false }
}
</script>

<template>
  <form
    class="auth-form"
    aria-labelledby="register-title"
    @submit.prevent="submit"
  >
    <div class="section-kicker">
      Primeira configuração
    </div>
    <h1 id="register-title">
      Cria a conta proprietária
    </h1>
    <p>O primeiro registo torna-se o único proprietário deste espaço. As despesas existentes passam para esta conta.</p>
    <v-text-field
      v-model="name"
      label="Nome"
      autocomplete="name"
      maxlength="100"
      required
      variant="outlined"
    />
    <v-text-field
      v-model="email"
      label="Email"
      type="email"
      autocomplete="email"
      maxlength="254"
      required
      variant="outlined"
    />
    <v-text-field
      v-model="password"
      label="Palavra-passe"
      :type="visible ? 'text' : 'password'"
      autocomplete="new-password"
      minlength="12"
      maxlength="256"
      required
      hint="Pelo menos 12 caracteres."
      persistent-hint
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
      Criar espaço privado
    </v-btn>
    <NuxtLink
      class="auth-help"
      to="/how-it-works"
    >
      Como funciona a análise?
    </NuxtLink>
  </form>
</template>
