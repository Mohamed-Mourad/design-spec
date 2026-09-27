<script setup lang="ts">
// Inline label components (Badge, Tooltip): the root carries all the tokens.
import type { PreviewProps } from './usePreviewKit'

defineProps<PreviewProps>()
</script>

<template>
  <span :data-testid="testid" :style="rootStyle">{{ variant === 'default' ? name : variant }}</span>
</template>
