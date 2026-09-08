<script setup lang="ts">
const setup = await $fetch<{ onboardingNeeded: boolean }>('/api/setup')
await navigateTo(setup.onboardingNeeded ? '/welcome' : '/dashboard')
</script>

<template><div /></template>
