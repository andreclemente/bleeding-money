<template>
  <div class="app-shell">
    <aside
      class="app-sidebar"
      aria-label="Navegação principal"
    >
      <NuxtLink
        class="brand"
        to="/dashboard"
        aria-label="BleedingMoney — resumo"
      >
        <span
          class="brand-mark"
          aria-hidden="true"
        >BM</span>
        <span>BleedingMoney</span>
      </NuxtLink>

      <div class="nav-label">
        Auditoria
      </div>
      <nav class="app-nav">
        <NuxtLink
          class="nav-link"
          to="/dashboard"
        >
          <span
            class="nav-icon"
            aria-hidden="true"
          >⌁</span>
          <span>Resumo</span>
        </NuxtLink>
        <NuxtLink
          class="nav-link"
          to="/expenses"
        >
          <span
            class="nav-icon"
            aria-hidden="true"
          >▤</span>
          <span>Despesas</span>
        </NuxtLink>
        <NuxtLink
          class="nav-link"
          to="/findings"
        >
          <span
            class="nav-icon"
            aria-hidden="true"
          >◇</span>
          <span>Recomendações</span>
        </NuxtLink>
      </nav>

      <div class="sidebar-status">
        <div class="status-live">
          <span
            class="status-dot"
            aria-hidden="true"
          />
          Auditoria ativa
        </div>
        <p>As despesas recorrentes são analisadas continuamente.</p>
      </div>
    </aside>

    <main class="app-main">
      <header class="mobile-topbar">
        <NuxtLink
          class="brand"
          to="/dashboard"
          aria-label="BleedingMoney — resumo"
        >
          <span
            class="brand-mark"
            aria-hidden="true"
          >BM</span>
          <span>BleedingMoney</span>
        </NuxtLink>
        <span class="mobile-topbar-status">Auditoria ativa</span>
      </header>
      <div class="page-container">
        <slot />
      </div>
    </main>
  </div>
</template>
