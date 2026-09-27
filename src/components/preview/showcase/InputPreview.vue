<script setup lang="ts">
import type { PreviewProps } from './usePreviewKit'

defineProps<PreviewProps>()
</script>

<template>
  <input :data-testid="testid" :style="rootStyle" placeholder="Placeholder" />
</template>
