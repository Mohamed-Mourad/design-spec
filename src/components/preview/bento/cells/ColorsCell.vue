<script setup lang="ts">
import { computed } from 'vue'
import { readableInk } from '@/utils/colorUtils'
import type { DesignSystemSchema } from '@/types/schema'

const props = defineProps<{ schema: DesignSystemSchema; dark?: boolean }>()

interface Swatch {
  key: string
  value: string
  /** Label color picked for legibility against the swatch itself. */
  ink: string
}

const swatches = computed<Swatch[]>(() => {
  const overrides = props.dark ? props.schema.darkMode.colors : {}
  return Object.entries(props.schema.colors).map(([key, base]) => {
    const value = (overrides[key] as string | undefined) ?? base
    return { key, value, ink: readableInk(value) }
  })
})
</script>

<template>
  <ul class="colors">
    <li v-for="swatch in swatches" :key="swatch.key" class="colors__swatch" :style="{ backgroundColor: swatch.value, color: swatch.ink }">
      <span class="colors__name">{{ swatch.key }}</span>
      <span class="colors__value">{{ swatch.value.toUpperCase() }}</span>
    </li>
  </ul>
</template>

<style scoped>
.colors {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.colors__swatch {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 1px;
  min-height: 64px;
  padding: 8px;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px rgb(128 128 128 / 0.22);
}

.colors__name {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.colors__value {
  font-family: var(--font-mono);
  font-size: 10px;
  opacity: 0.75;
}
</style>
