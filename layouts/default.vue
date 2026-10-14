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
        aria-label="BleedingMoney — Hoje"
      >
        <span class="brand-wordmark">bleeding<span>/money</span></span>
      </NuxtLink>
      <p class="workspace-label">
        Caderno familiar privado
      </p>
      <div class="nav-label">
        Tarefas
      </div>
      <nav class="app-nav">
        <NuxtLink
          class="nav-link"
          to="/dashboard"
        >
          <span>Hoje</span>
        </NuxtLink>
        <NuxtLink
          class="nav-link"
          to="/spending"
        >
          <span>Registar</span>
        </NuxtLink>
        <NuxtLink
          class="nav-link"
          to="/expenses"
        >
          <span>Contratos</span>
        </NuxtLink>
        <NuxtLink
          class="nav-link"
          to="/savings-goal"
        >
          <span>Objetivo</span>
        </NuxtLink>
      </nav>
      <nav
        class="secondary-nav"
        aria-label="Método e privacidade"
      >
        <NuxtLink to="/how-it-works">
          Método e privacidade
        </NuxtLink>
        <NuxtLink to="/findings">
          Arquivo de casos
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
          <span class="brand-wordmark">bleeding<span>/money</span></span>
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
