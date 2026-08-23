<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  /** Raw token values keyed by name — `spacing` or `rounded`. */
  tokens: Record<string, unknown>
  /** `bar` draws a proportional rule; `radius` draws a rounded corner sample. */
  render: 'bar' | 'radius'
}>()

interface Entry {
  key: string
  label: string
  px: number
}

/** A dimension token as pixels, for sizing the sample. `rem`/`em` × 16. */
function toPx(value: unknown): number {
  const raw = String(value)
  const n = parseFloat(raw)
  if (Number.isNaN(n)) return 0
  if (raw.includes('rem') || raw.includes('em')) return n * 16
  return n
}

const entries = computed<Entry[]>(() =>
  Object.entries(props.tokens).map(([key, value]) => ({
    key,
    label: typeof value === 'number' ? `${value}px` : String(value),
    px: toPx(value),
  })),
)

// Full-bleed for the largest token; everything else reads relative to it.
const maxPx = computed(() => Math.max(1, ...entries.value.map((e) => e.px)))
</script>

<template>
  <ul class="scale">
    <li v-for="entry in entries" :key="entry.key" class="scale__row">
      <span class="scale__name">{{ entry.key }}</span>
      <span class="scale__sample">
        <span
          v-if="render === 'bar'"
          class="scale__bar"
          :style="{ width: `${Math.max(2, (entry.px / maxPx) * 100)}%` }"
        />
        <span
          v-else
          class="scale__radius"
          :style="{ borderTopLeftRadius: entry.label, borderBottomRightRadius: entry.label }"
        />
      </span>
      <span class="scale__value">{{ entry.label }}</span>
    </li>
  </ul>
</template>

<style scoped>
.scale {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.scale__row {
  display: grid;
  grid-template-columns: 44px 1fr auto;
  align-items: center;
  gap: 10px;
}

.scale__name {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--bento-fg-muted);
  overflow: hidden;
  text-overflow: ellipsis;
}

.scale__sample {
  display: flex;
  align-items: center;
  min-width: 0;
}

.scale__bar {
  display: block;
  height: 8px;
  border-radius: 2px;
  background-color: var(--bento-accent);
}

.scale__radius {
  display: block;
  width: 30px;
  height: 30px;
  border: 1.5px solid var(--bento-accent);
}

.scale__value {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--bento-fg-subtle);
}
</style>
