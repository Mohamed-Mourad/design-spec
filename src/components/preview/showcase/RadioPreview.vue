<script setup lang="ts">
import { usePreviewKit, type PreviewProps } from './usePreviewKit'

defineProps<PreviewProps>()
const { stateStyle } = usePreviewKit()
</script>

<template>
  <!-- Radio group (selected + unselected) -->
  <div class="showcase__radio-group" :data-testid="testid">
    <label class="showcase__radio-row">
      <span class="showcase__radio" :style="stateStyle(name, 'checked')"><span class="showcase__radio-dot" /></span>Option A
    </label>
    <label class="showcase__radio-row">
      <span class="showcase__radio" :style="rootStyle" />Option B
    </label>
  </div>
</template>

<style scoped>
.showcase__radio-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}
.showcase__radio-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: 13px;
}
.showcase__radio {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
.showcase__radio-dot {
  width: 7px;
  height: 7px;
  border-radius: 9999px;
  background: var(--color-on-primary);
}
</style>
