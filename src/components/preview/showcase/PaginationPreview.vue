<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CSSProperties } from 'vue'
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { usePreviewKit, type PreviewProps } from './usePreviewKit'

const props = defineProps<PreviewProps>()
const { groupStyle, layoutReached, propDefault } = usePreviewKit()

const count = computed(() => Math.max(1, Number(propDefault(props.name, 'pageCount', 10)) || 1))
const clamp = (p: number) => Math.min(count.value, Math.max(1, p))
const page = ref(clamp(Number(propDefault(props.name, 'page', 3)) || 1))
watch(count, () => (page.value = clamp(page.value)))

// Numbered once the layout breakpoint is reached; the mobile-first base is
// prev/next around "Page x of y".
const numbered = computed(() => layoutReached(props.name))
const showPrevNext = computed(() => propDefault(props.name, 'showPrevNext', true) || !numbered.value)

/** At most 7 slots: 1 … p-1 p p+1 … N. */
const slots = computed<Array<number | 'gap'>>(() => {
  const n = count.value
  const p = page.value
  if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1)
  const mid = [p - 1, p, p + 1].filter((x) => x > 1 && x < n)
  const out: Array<number | 'gap'> = [1]
  if (mid[0] > 2) out.push('gap')
  out.push(...mid)
  if (mid[mid.length - 1] < n - 1) out.push('gap')
  out.push(n)
  return out
})
function itemStyle(p: number): CSSProperties {
  return p === page.value ? { ...groupStyle(props.name, 'item'), ...groupStyle(props.name, 'itemActive') } : groupStyle(props.name, 'item')
}
</script>

<template>
  <nav aria-label="Pagination" class="pg" :data-testid="testid" :style="rootStyle">
    <button v-if="showPrevNext" type="button" class="pg__btn" aria-label="Previous page" :disabled="page === 1" :style="groupStyle(name, 'item')" @click="page = clamp(page - 1)">
      <ChevronLeft :size="14" aria-hidden="true" />
    </button>
    <ol v-if="numbered" class="pg__list">
      <li v-for="(s, i) in slots" :key="`${s}-${i}`">
        <span v-if="s === 'gap'" class="pg__gap" aria-hidden="true">…</span>
        <button
          v-else
          type="button"
          class="pg__btn"
          :aria-current="s === page ? 'page' : undefined"
          :aria-label="`Page ${s}`"
          :style="itemStyle(s)"
          @click="page = s"
        >
          {{ s }}
        </button>
      </li>
    </ol>
    <span v-else class="pg__status" aria-live="polite">Page {{ page }} of {{ count }}</span>
    <button v-if="showPrevNext" type="button" class="pg__btn" aria-label="Next page" :disabled="page === count" :style="groupStyle(name, 'item')" @click="page = clamp(page + 1)">
      <ChevronRight :size="14" aria-hidden="true" />
    </button>
  </nav>
</template>

<style scoped>
.pg {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  max-width: 100%;
}
.pg__list {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin: 0;
  padding: 0;
  list-style: none;
}
.pg__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  min-height: 32px;
  box-sizing: border-box;
  font: inherit;
  color: inherit;
  background: none;
  cursor: pointer;
}
.pg__btn:disabled {
  opacity: 0.38;
  cursor: default;
}
.pg__btn:focus-visible {
  outline: 2px solid var(--color-interactive-focus-ring);
  outline-offset: 2px;
}
.pg__gap {
  padding: 0 var(--spacing-xs);
  opacity: 0.6;
}
.pg__status {
  padding: 0 var(--spacing-sm);
}
</style>
