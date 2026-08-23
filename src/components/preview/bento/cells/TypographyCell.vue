<script setup lang="ts">
import { computed } from 'vue'
import type { CSSProperties } from 'vue'
import type { DesignSystemSchema, TypographyToken } from '@/types/schema'

const props = defineProps<{ schema: DesignSystemSchema }>()

interface Specimen {
  key: string
  token: TypographyToken
  style: CSSProperties
}

// Largest first: the specimen list reads as a type scale, not a dictionary.
const specimens = computed<Specimen[]>(() =>
  Object.entries(props.schema.typography)
    .map(([key, token]) => ({
      key,
      token,
      style: {
        fontFamily: token.fontFamily,
        fontSize: String(token.fontSize),
        fontWeight: token.fontWeight,
        lineHeight: String(token.lineHeight),
        letterSpacing: token.letterSpacing,
        textTransform: token.textTransform,
      } as CSSProperties,
    }))
    .sort((a, b) => parseFloat(String(b.token.fontSize)) - parseFloat(String(a.token.fontSize))),
)
</script>

<template>
  <ul class="type">
    <li v-for="specimen in specimens" :key="specimen.key" class="type__row">
      <p class="type__sample" :style="specimen.style">{{ specimen.key }}</p>
      <p class="type__meta">
        {{ specimen.token.fontFamily }} · {{ specimen.token.fontSize }} · {{ specimen.token.fontWeight }}
      </p>
    </li>
  </ul>
</template>

<style scoped>
.type {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.type__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--bento-border-subtle);
  min-width: 0;
}

.type__row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.type__sample {
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--bento-fg);
}

.type__meta {
  flex-shrink: 0;
  margin: 0;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--bento-fg-subtle);
  white-space: nowrap;
}
</style>
