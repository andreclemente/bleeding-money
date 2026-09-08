<template>
  <div class="public-shell">
    <header class="public-header">
      <NuxtLink
        class="brand"
        to="/how-it-works"
      >
        <span
          class="brand-mark"
          aria-hidden="true"
        >BM</span><span>BleedingMoney</span>
      </NuxtLink>
      <NuxtLink
        class="text-link"
        to="/login"
      >
        Entrar no espaço privado
      </NuxtLink>
    </header>
    <main class="method-container">
      <slot />
    </main>
  </div>
</template>
