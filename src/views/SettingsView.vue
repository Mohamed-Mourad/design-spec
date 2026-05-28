<script setup lang="ts">
import { useHead } from '@unhead/vue'

useHead({ title: 'Settings — Design Spec' })
</script>

<template>
  <main class="settings-stub">
    <h1>Settings</h1>
    <p>Export settings, font loading, naming conventions. Coming in Phase 6.</p>
  </main>
</template>

<style scoped>
.settings-stub {
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
