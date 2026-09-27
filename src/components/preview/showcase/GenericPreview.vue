<script setup lang="ts">
// Fallback for a blueprint with no dedicated renderer (e.g. one added by hand).
import type { PreviewProps } from './usePreviewKit'

defineProps<PreviewProps>()
</script>

<template>
  <div :data-testid="testid" :style="rootStyle">{{ variant === 'default' ? name : variant }}</div>
</template>
