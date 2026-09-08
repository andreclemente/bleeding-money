<script setup lang="ts">
const requestFetch = useRequestFetch()
const setup = await requestFetch<{ onboardingNeeded: boolean }>('/api/setup')
await navigateTo(setup.onboardingNeeded ? '/welcome' : '/dashboard')
</script>

<template><div /></template>
