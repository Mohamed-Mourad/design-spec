<script setup lang="ts">
import { X } from '@lucide/vue'
import { usePreviewKit, type PreviewProps } from './usePreviewKit'

defineProps<PreviewProps>()
const { hasGroup, sepStyle, closeStyle, closeSize, actionLabel, actionBtnStyle } = usePreviewKit()
</script>

<template>
  <!-- Card: title, optional separator, body, optional actions/close -->
  <div class="showcase__card" :data-testid="testid" :style="rootStyle">
    <div class="showcase__card-head">
      <strong>Card title</strong>
      <button v-if="hasGroup(name, 'close')" class="showcase__x" :style="closeStyle(name)" aria-label="Close"><X :size="closeSize(name)" /></button>
    </div>
    <hr v-if="hasGroup(name, 'separator')" class="showcase__sep" :style="sepStyle(name)" />
    <p class="showcase__card-body">Grouped content lives here.</p>
    <div v-if="hasGroup(name, 'actions')" class="showcase__actions">
      <button class="showcase__btn" :style="actionBtnStyle(name, 'cancel')">{{ actionLabel(name, 'cancelLabel', 'Cancel') }}</button>
      <button class="showcase__btn" :style="actionBtnStyle(name, 'confirm')">{{ actionLabel(name, 'confirmLabel', 'Confirm') }}</button>
    </div>
  </div>
</template>

<style scoped>
.showcase__card {
  display: flex;
  flex-direction: column;
  min-width: 200px;
}
.showcase__card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.showcase__card-body {
  margin: var(--spacing-xs) 0 0;
  font-size: 13px;
  opacity: 0.8;
}
</style>
