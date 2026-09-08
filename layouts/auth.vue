<template>
  <main class="auth-shell">
    <NuxtLink
      class="brand auth-brand"
      to="/how-it-works"
      aria-label="BleedingMoney — como funciona"
    >
      <span
        class="brand-mark"
        aria-hidden="true"
      >BM</span>
      <span>BleedingMoney</span>
    </NuxtLink>
    <section class="auth-panel">
      <slot />
    </section>
    <p class="auth-private">
      Espaço pessoal privado · Uma única conta proprietária
    </p>
  </main>
</template>
