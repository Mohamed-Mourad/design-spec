<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { X } from '@lucide/vue'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import TokenGroupEditor from '@/components/editors/TokenGroupEditor.vue'

const store = useDesignSystemStore()
const { schema, selectedComponent } = storeToRefs(store)

const name = computed(() => selectedComponent.value ?? '')
const bp = computed(() => (name.value ? schema.value.componentBlueprints[name.value] : undefined))
const baseTokens = computed<Record<string, unknown>>(() => (bp.value?.tokens.base ?? {}) as Record<string, unknown>)

function p(...rest: (string | number)[]) {
  return ['componentBlueprints', name.value, ...rest]
}

function setBase(prop: string, value: unknown) {
  store.setPath(p('tokens', 'base', prop), value)
}
function removeBase(prop: string) {
  store.removePath(p('tokens', 'base', prop))
}

// ── Suggestions (component-aware), each backed by the blueprint ──
const hasHover = computed(() => !!bp.value?.tokens.hover)
function toggleHover(on: boolean) {
  if (on) store.setPath(p('tokens', 'hover'), { backgroundColor: '{colors.surface-overlay}' })
  else store.removePath(p('tokens', 'hover'))
}

function hasAnatomy(key: string) {
  return bp.value?.anatomy.includes(key) ?? false
}
function toggleAnatomy(key: string, on: boolean) {
  if (!bp.value) return
  const next = bp.value.anatomy.filter((a) => a !== key)
  if (on) next.push(key)
  store.setPath(p('anatomy'), next)
}

const hasClose = computed(() => bp.value?.props.dismissible?.default === true || hasAnatomy('close'))
function toggleClose(on: boolean) {
  store.setPath(p('props', 'dismissible'), { type: 'boolean', default: on })
  toggleAnatomy('close', on)
}

interface Suggestion {
  key: string
  label: string
  hint: string
  available: boolean
  get: () => boolean
  set: (on: boolean) => void
}
const CONTAINERS = ['Card', 'Alert', 'Modal']
const suggestions = computed<Suggestion[]>(() => {
  const n = name.value
  const isContainer = CONTAINERS.includes(n)
  return [
    { key: 'hover', label: 'Hover effect', hint: 'adds a hover token group', available: true, get: () => hasHover.value, set: toggleHover },
    { key: 'separator', label: 'Separator', hint: 'divider between header & body', available: isContainer, get: () => hasAnatomy('separator'), set: (v: boolean) => toggleAnatomy('separator', v) },
    { key: 'close', label: 'Close (✕) button', hint: 'dismissible', available: isContainer, get: () => hasClose.value, set: toggleClose },
    { key: 'actions', label: 'Action buttons', hint: 'Cancel / Confirm footer', available: isContainer, get: () => hasAnatomy('actions'), set: (v: boolean) => toggleAnatomy('actions', v) },
  ].filter((s) => s.available)
})
</script>

<template>
  <aside v-if="bp" class="insp">
    <header class="insp__head">
      <span class="insp__name">{{ name }}</span>
      <button class="insp__close" aria-label="Close inspector" @click="store.selectComponent(null)">
        <X :size="14" aria-hidden="true" />
      </button>
    </header>
    <p class="insp__note">Edits apply everywhere — preview, code, and the Components tab.</p>

    <section>
      <h4 class="insp__h">Tokens</h4>
      <TokenGroupEditor :tokens="baseTokens" @update="setBase" @remove="removeBase" />
    </section>

    <section>
      <h4 class="insp__h">Suggestions</h4>
      <label v-for="s in suggestions" :key="s.key" class="insp__sugg">
        <input type="checkbox" :checked="s.get()" @change="s.set(($event.target as HTMLInputElement).checked)" />
        <span class="insp__sugg-label">{{ s.label }}</span>
        <span class="insp__sugg-hint">{{ s.hint }}</span>
      </label>
    </section>
  </aside>
</template>

<style scoped>
.insp {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  width: 280px;
  max-height: 100%;
  overflow-y: auto;
  padding: var(--spacing-md);
  background-color: var(--color-surface-default);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
}
.insp__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.insp__name {
  font-family: var(--font-display);
  font-size: 16px;
  color: var(--color-on-surface);
}
.insp__close {
  display: inline-flex;
  background: none;
  border: none;
  color: var(--color-on-surface-muted);
  cursor: pointer;
}
.insp__close:hover {
  color: var(--color-on-surface);
}
.insp__note {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-on-surface-subtle);
}
.insp__h {
  margin: 0 0 var(--spacing-xs);
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-on-surface-subtle);
}
.insp__sugg {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 4px 0;
  cursor: pointer;
}
.insp__sugg-label {
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--color-on-surface);
}
.insp__sugg-hint {
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-on-surface-subtle);
  margin-left: auto;
}
</style>
