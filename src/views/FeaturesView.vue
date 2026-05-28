<script setup lang="ts">
import { useHead } from '@unhead/vue'

useHead({ title: 'Feature Requests — Design Spec' })
</script>

<template>
  <main class="features-stub">
    <h1>Feature Requests</h1>
    <p>Vote on what gets built next. Coming in Phase 3.5.</p>
  </main>
</template>

<style scoped>
.features-stub {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  gap: var(--spacing-md);
  color: var(--color-on-surface);
  font-family: var(--font-sans);
}
</style>
