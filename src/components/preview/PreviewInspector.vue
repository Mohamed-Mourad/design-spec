<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { X } from '@lucide/vue'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import TokenGroupEditor from '@/components/editors/TokenGroupEditor.vue'
import ColorTokenEditor from '@/components/editors/ColorTokenEditor.vue'

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

// ── Suggestions ──
// Each is backed by a token group on the blueprint (tokens.<key>), so once
// enabled its properties are editable here via the same TokenGroupEditor.
const CONTAINERS = ['Card', 'Alert', 'Modal']

interface Suggestion {
  key: string
  label: string
  hint: string
  available: boolean
  default: Record<string, unknown>
  /** Extra side effect beyond creating/removing the token group. */
  onToggle?: (on: boolean) => void
}

const suggestionDefs = computed<Suggestion[]>(() => {
  const isContainer = CONTAINERS.includes(name.value)
  return [
    { key: 'hover', label: 'Hover effect', hint: 'styles on hover', available: true, default: { backgroundColor: '{colors.surface-overlay}' } },
    { key: 'separator', label: 'Separator', hint: 'divider line', available: isContainer, default: { borderColor: '{colors.surface-border}', borderWidth: '1px' } },
    {
      key: 'close',
      label: 'Close (✕) button',
      hint: 'dismissible',
      available: isContainer,
      default: { textColor: '{colors.on-surface-muted}', size: '16px' },
      onToggle: (on: boolean) => store.setPath(p('props', 'dismissible'), { type: 'boolean', default: on }),
    },
    {
      key: 'actions',
      label: 'Action buttons',
      hint: 'Cancel / Confirm',
      available: isContainer,
      default: {
        cancelLabel: 'Cancel',
        confirmLabel: 'Confirm',
        rounded: '{rounded.md}',
        confirmBg: '{colors.primary}',
        confirmText: '{colors.on-primary}',
        cancelBg: '{colors.surface-raised}',
        cancelText: '{colors.on-surface}',
      },
    },
  ].filter((s) => s.available)
})

function isOn(key: string) {
  return !!bp.value?.tokens[key]
}
function toggle(s: Suggestion, on: boolean) {
  if (on) store.setPath(p('tokens', s.key), { ...s.default })
  else store.removePath(p('tokens', s.key))
  s.onToggle?.(on)
}
function groupTokens(key: string): Record<string, unknown> {
  return (bp.value?.tokens[key] ?? {}) as Record<string, unknown>
}
function setGroupProp(key: string, prop: string, value: unknown) {
  store.setPath(p('tokens', key, prop), value)
}
function removeGroupProp(key: string, prop: string) {
  store.removePath(p('tokens', key, prop))
}
function actionLabel(which: 'cancelLabel' | 'confirmLabel'): string {
  return (groupTokens('actions')[which] as string) ?? ''
}
function actionColor(which: string, fallback: string): string {
  return (groupTokens('actions')[which] as string) ?? fallback
}
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
      <div v-for="s in suggestionDefs" :key="s.key" class="insp__sgroup">
        <label class="insp__sugg">
          <input type="checkbox" :checked="isOn(s.key)" @change="toggle(s, ($event.target as HTMLInputElement).checked)" />
          <span class="insp__sugg-label">{{ s.label }}</span>
          <span class="insp__sugg-hint">{{ s.hint }}</span>
        </label>

        <div v-if="isOn(s.key)" class="insp__sub">
          <template v-if="s.key === 'actions'">
            <label class="insp__field">
              <span>Cancel label</span>
              <input :value="actionLabel('cancelLabel')" @change="setGroupProp('actions', 'cancelLabel', ($event.target as HTMLInputElement).value)" />
            </label>
            <ColorTokenEditor token-key="cancel bg" :value="actionColor('cancelBg', '{colors.surface-raised}')" @update="(_, v) => setGroupProp('actions', 'cancelBg', v)" @remove="() => removeGroupProp('actions', 'cancelBg')" />
            <ColorTokenEditor token-key="cancel text" :value="actionColor('cancelText', '{colors.on-surface}')" @update="(_, v) => setGroupProp('actions', 'cancelText', v)" @remove="() => removeGroupProp('actions', 'cancelText')" />
            <label class="insp__field">
              <span>Confirm label</span>
              <input :value="actionLabel('confirmLabel')" @change="setGroupProp('actions', 'confirmLabel', ($event.target as HTMLInputElement).value)" />
            </label>
            <ColorTokenEditor token-key="confirm bg" :value="actionColor('confirmBg', '{colors.primary}')" @update="(_, v) => setGroupProp('actions', 'confirmBg', v)" @remove="() => removeGroupProp('actions', 'confirmBg')" />
            <ColorTokenEditor token-key="confirm text" :value="actionColor('confirmText', '{colors.on-primary}')" @update="(_, v) => setGroupProp('actions', 'confirmText', v)" @remove="() => removeGroupProp('actions', 'confirmText')" />
          </template>
          <TokenGroupEditor
            :tokens="groupTokens(s.key)"
            @update="(prop, v) => setGroupProp(s.key, prop, v)"
            @remove="(prop) => removeGroupProp(s.key, prop)"
          />
        </div>
      </div>
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
.insp__sgroup {
  border-bottom: 1px solid var(--color-surface-border-subtle);
  padding-bottom: var(--spacing-xs);
  margin-bottom: var(--spacing-xs);
}
.insp__sub {
  margin: var(--spacing-xs) 0 var(--spacing-sm) var(--spacing-md);
  padding-left: var(--spacing-sm);
  border-left: 2px solid var(--color-surface-border);
}
.insp__field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: var(--spacing-xs);
}
.insp__field span {
  font-family: var(--font-sans);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-on-surface-subtle);
}
.insp__field input {
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--color-on-surface);
  background-color: var(--color-surface-sunken);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 4px 6px;
}
</style>
