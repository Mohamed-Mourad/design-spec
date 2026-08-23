<script setup lang="ts">
import { computed } from 'vue'
import type { DesignSystemSchema } from '@/types/schema'

const props = defineProps<{ schema: DesignSystemSchema }>()

const shadows = computed(() =>
  Object.entries(props.schema.shadows).map(([key, token]) => ({
    key,
    css: Array.isArray(token.value) ? token.value.join(', ') : token.value,
  })),
)
</script>

<template>
  <ul class="shadows">
    <li v-for="shadow in shadows" :key="shadow.key" class="shadows__item">
      <span class="shadows__chip" :style="{ boxShadow: shadow.css }" />
      <span class="shadows__name">{{ shadow.key }}</span>
    </li>
  </ul>
</template>

<style scoped>
.shadows {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 14px 10px;
  margin: 0;
  padding: 6px;
  list-style: none;
}

.shadows__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
}

.shadows__chip {
  display: block;
  width: 100%;
  height: 38px;
  border-radius: 8px;
  background-color: var(--bento-surface-raised);
}

.shadows__name {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--bento-fg-subtle);
}
</style>
