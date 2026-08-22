<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import type { Framework } from '@/types/compiler'

// Native <details> doesn't close on outside click — wire it up manually.
const root = ref<HTMLDetailsElement | null>(null)
function onDocClick(e: MouseEvent) {
  if (root.value?.open && !root.value.contains(e.target as Node)) root.value.open = false
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && root.value?.open) root.value.open = false
}
onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
})

// Independent stack toggles: framework (React/Vue) × styling (Tailwind/CSS).
// Each cell is its own combo, so a designer can ship any mix — e.g. just
// react-tailwind + vue-css for two teams, without the other two combos.
const store = useDesignSystemStore()
const { schema } = storeToRefs(store)

const frameworks = [
  { id: 'react', label: 'React' },
  { id: 'vue', label: 'Vue' },
] as const
const stylings = [
  { id: 'tailwind', label: 'Tailwind' },
  { id: 'css', label: 'CSS' },
] as const

const selected = computed(() => schema.value.export.frameworks)
const combo = (fw: string, st: string) => `${fw}-${st}` as Framework

function isOn(fw: string, st: string) {
  return selected.value.includes(combo(fw, st))
}

function toggle(fw: string, st: string) {
  const id = combo(fw, st)
  const current = new Set<Framework>(selected.value)
  if (current.has(id)) {
    if (current.size === 1) return // keep at least one stack
    current.delete(id)
  } else {
    current.add(id)
  }
  // Preserve a stable order matching the enum.
  const order: Framework[] = ['react-tailwind', 'react-css', 'vue-tailwind', 'vue-css', 'flutter']
  store.updateFrameworks(order.filter((f) => current.has(f)))
}

const summary = computed(() => `${selected.value.length} stack${selected.value.length === 1 ? '' : 's'}`)
</script>

<template>
  <details ref="root" class="fw">
    <summary class="fw__summary">Stacks · {{ summary }}</summary>
    <div class="fw__panel">
      <table class="fw__matrix">
        <thead>
          <tr>
            <th></th>
            <th v-for="st in stylings" :key="st.id">{{ st.label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="fw in frameworks" :key="fw.id">
            <th scope="row">{{ fw.label }}</th>
            <td v-for="st in stylings" :key="st.id">
              <button
                class="fw__cell"
                :class="{ 'fw__cell--on': isOn(fw.id, st.id) }"
                :aria-pressed="isOn(fw.id, st.id)"
                :aria-label="`${fw.label} + ${st.label}`"
                @click="toggle(fw.id, st.id)"
              >
                {{ isOn(fw.id, st.id) ? '✓' : '' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="fw__flutter" title="Flutter — compiler not built yet (Phase 10)">
        <span>Flutter</span><span class="fw__soon">Soon</span>
      </div>
    </div>
  </details>
</template>

<style scoped>
.fw {
  position: relative;
  flex-shrink: 0;
}
.fw__summary {
  list-style: none;
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 500;
  color: var(--color-on-surface-muted);
  background-color: var(--color-surface-raised);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 4px 10px;
}
.fw__summary::-webkit-details-marker {
  display: none;
}
.fw__summary:hover {
  color: var(--color-on-surface);
}
.fw__panel {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: var(--z-dropdown);
  background-color: var(--color-surface-overlay);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: var(--spacing-sm);
}
.fw__matrix {
  border-collapse: collapse;
}
.fw__matrix th {
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-on-surface-subtle);
  padding: 4px 8px;
  text-align: center;
}
.fw__matrix th[scope='row'] {
  text-align: right;
}
.fw__cell {
  width: 28px;
  height: 24px;
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface-sunken);
  color: var(--color-on-primary);
  cursor: pointer;
  font-size: 12px;
}
.fw__cell--on {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
}
.fw__flutter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
  padding: 4px 8px;
  border-top: 1px solid var(--color-surface-border);
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-on-surface-subtle);
}
.fw__soon {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-on-surface-subtle);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 1px 5px;
}
</style>
