<script setup lang="ts">
useHead({ title: 'Adicionar despesa — BleedingMoney' })
</script>

<template>
  <div>
    <NuxtLink
      class="back-link"
      to="/expenses"
    >
      ← Voltar às despesas
    </NuxtLink>
    <ExpenseWizard />
  </div>
</template>
