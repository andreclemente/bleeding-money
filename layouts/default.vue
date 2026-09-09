<script setup lang="ts">
const requestFetch = useRequestFetch()
const { user } = await requestFetch<{ user: { name: string, email: string } | null }>('/api/auth/session')
const leaving = ref(false)
const logout = async () => {
  leaving.value = true
  try {
    await requestFetch('/api/auth/logout', { method: 'POST' })
    await navigateTo('/login')
  } finally { leaving.value = false }
}
</script>

<template>
  <div class="app-shell">
    <aside
      class="app-sidebar"
      aria-label="Navegação principal"
    >
      <NuxtLink
        class="brand"
        to="/dashboard"
        aria-label="BleedingMoney — monitor"
      >
        <span
          class="brand-mark"
          aria-hidden="true"
        >BM</span><span>BleedingMoney</span>
      </NuxtLink>
      <p class="workspace-label">
        Espaço pessoal privado
      </p>
      <div class="nav-label">
        Monitorização
      </div>
      <nav class="app-nav">
        <NuxtLink
          class="nav-link"
          to="/dashboard"
        >
          <span
            class="nav-index"
            aria-hidden="true"
          >01</span><span>Monitor</span>
        </NuxtLink>
        <NuxtLink
          class="nav-link"
          to="/spending"
        >
          <span
            class="nav-index"
            aria-hidden="true"
          >02</span><span>Gastos mensais</span>
        </NuxtLink>
        <NuxtLink
          class="nav-link"
          to="/expenses"
        >
          <span
            class="nav-index"
            aria-hidden="true"
          >03</span><span>Despesas</span>
        </NuxtLink>
        <NuxtLink
          class="nav-link"
          to="/findings"
        >
          <span
            class="nav-index"
            aria-hidden="true"
          >04</span><span>Recomendações</span>
        </NuxtLink>
        <NuxtLink
          class="nav-link"
          to="/how-it-works"
        >
          <span
            class="nav-index"
            aria-hidden="true"
          >05</span><span>Como funciona</span>
        </NuxtLink>
      </nav>
      <div
        v-if="user"
        class="account-control"
      >
        <strong>{{ user.name }}</strong><span>{{ user.email }}</span>
        <button
          type="button"
          :disabled="leaving"
          @click="logout"
        >
          {{ leaving ? 'A sair…' : 'Terminar sessão' }}
        </button>
      </div>
    </aside>
    <main class="app-main">
      <header class="mobile-topbar">
        <NuxtLink
          class="brand"
          to="/dashboard"
        >
          <span
            class="brand-mark"
            aria-hidden="true"
          >BM</span><span>BleedingMoney</span>
        </NuxtLink>
        <button
          class="mobile-logout"
          type="button"
          :disabled="leaving"
          @click="logout"
        >
          Sair
        </button>
      </header>
      <div class="page-container">
        <slot />
      </div>
    </main>
  </div>
</template>
