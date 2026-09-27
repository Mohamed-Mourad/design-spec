<script setup lang="ts">
import { computed } from 'vue'
import { usePreviewKit, type PreviewProps } from './usePreviewKit'

const props = defineProps<PreviewProps>()
const { groupStyle, propDefault } = usePreviewKit()

const indeterminate = computed(() => props.variant === 'indeterminate')
const max = computed(() => Math.max(1, Number(propDefault(props.name, 'max', 100)) || 100))
const value = computed(() => Math.min(max.value, Math.max(0, Number(propDefault(props.name, 'value', 40)) || 0)))
const pct = computed(() => Math.round((value.value / max.value) * 100))
const label = computed(() => propDefault(props.name, 'label', indeterminate.value ? 'Loading' : 'Uploading'))
const fillStyle = computed(() => ({ ...groupStyle(props.name, 'fill'), width: indeterminate.value ? '40%' : `${pct.value}%` }))
</script>

<template>
  <div class="pr">
    <div
      role="progressbar"
      class="pr__track"
      :class="{ 'pr__track--indeterminate': indeterminate }"
      :aria-label="label"
      aria-valuemin="0"
      :aria-valuemax="max"
      :aria-valuenow="indeterminate ? undefined : value"
      :data-testid="testid"
      :style="rootStyle"
    >
      <div class="pr__fill" :style="fillStyle" />
    </div>
    <span class="pr__label" :style="groupStyle(name, 'label')">{{ label }}{{ indeterminate ? '…' : ` · ${pct}%` }}</span>
  </div>
</template>

<style scoped>
.pr {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  width: 16rem;
  max-width: 100%;
}
.pr__track {
  position: relative;
  overflow: hidden;
  width: 100%;
}
.pr__fill {
  height: 100%;
}
@media (prefers-reduced-motion: no-preference) {
  .pr__fill {
    transition: width 200ms ease-out;
  }
  .pr__track--indeterminate .pr__fill {
    position: absolute;
    top: 0;
    left: 0;
    animation: pr-slide 1.4s ease-in-out infinite;
  }
}
@keyframes pr-slide {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(250%);
  }
}
</style>
