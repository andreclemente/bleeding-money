<script setup lang="ts">
useHead({ title: 'Começar — BleedingMoney' })
</script>

<template>
  <div>
    <NuxtLink
      class="welcome-spending-choice panel"
      to="/spending"
    >
      <span><small>Começar pelo dia a dia</small><strong>Registar supermercado e gastos deste mês</strong><span>Responde já a perguntas concretas e escolhe os teus próprios limites.</span></span><b>Começar →</b>
    </NuxtLink>
    <p class="welcome-divider">
      ou começa por um contrato mensal
    </p>
    <ExpenseWizard welcome />
  </div>
</template>
