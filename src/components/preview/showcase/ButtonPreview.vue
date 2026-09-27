<script setup lang="ts">
import type { PreviewProps } from './usePreviewKit'

defineProps<PreviewProps>()
</script>

<template>
  <button :data-testid="testid" :style="rootStyle">{{ variant === 'default' ? name : variant }}</button>
</template>
