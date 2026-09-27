<script setup lang="ts">
import type { PreviewProps } from './usePreviewKit'

defineProps<PreviewProps>()
</script>

<template>
  <label class="showcase__checkbox-row" :data-testid="testid">
    <span class="showcase__checkbox" :style="rootStyle" />
    Label
  </label>
</template>

<style scoped>
.showcase__checkbox-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.showcase__checkbox {
  display: inline-block;
}
</style>
