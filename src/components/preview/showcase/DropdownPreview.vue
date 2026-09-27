<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import type { PreviewProps } from './usePreviewKit'

defineProps<PreviewProps>()
</script>

<template>
  <div class="showcase__dropdown" :data-testid="testid" :style="rootStyle">
    <span>Select option</span>
    <ChevronDown :size="14" aria-hidden="true" />
  </div>
</template>

<style scoped>
.showcase__dropdown {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  min-width: 180px;
}
</style>
