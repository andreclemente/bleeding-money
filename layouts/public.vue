<template>
  <div class="public-shell">
    <header class="public-header">
      <NuxtLink
        class="brand"
        to="/how-it-works"
      >
        <span class="brand-wordmark">bleeding<span>/money</span></span>
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
