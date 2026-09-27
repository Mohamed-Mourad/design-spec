<script setup lang="ts">
import type { PreviewProps } from './usePreviewKit'

defineProps<PreviewProps>()
</script>

<template>
  <div class="showcase__navbar" :data-testid="testid" :style="rootStyle">
    <strong>Logo</strong>
    <nav class="showcase__nav-links"><span>Home</span><span>Docs</span><span>Pricing</span></nav>
    <button class="showcase__btn" :style="{ background: 'var(--color-primary)', color: 'var(--color-on-primary)', borderRadius: 'var(--rounded-md)' }">Sign in</button>
  </div>
</template>

<style scoped>
.showcase__navbar {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  min-width: 320px;
}
.showcase__nav-links {
  display: flex;
  gap: var(--spacing-md);
  flex: 1;
  font-size: 13px;
  opacity: 0.85;
}
</style>
