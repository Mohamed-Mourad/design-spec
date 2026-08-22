<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'

const store = useDesignSystemStore()
const { schema } = storeToRefs(store)

// Free-text prose sections that feed the DESIGN.md markdown body.
const sections = [
  { key: 'overview', label: 'Overview' },
  { key: 'colors', label: 'Colors' },
  { key: 'typography', label: 'Typography' },
  { key: 'layout', label: 'Layout' },
  { key: 'elevation', label: 'Elevation & depth' },
  { key: 'shapes', label: 'Shapes' },
] as const

function setSection(key: string, value: string) {
  store.setPath(['prose', key], value)
}

function setDoDont(index: number, value: string) {
  const list = [...(schema.value.prose.dosDonts ?? [])]
  list[index] = value
  store.setPath(['prose', 'dosDonts'], list)
}
function addDoDont() {
  store.setPath(['prose', 'dosDonts'], [...(schema.value.prose.dosDonts ?? []), ''])
}
function removeDoDont(index: number) {
  store.setPath(
    ['prose', 'dosDonts'],
    (schema.value.prose.dosDonts ?? []).filter((_, i) => i !== index),
  )
}
</script>

<template>
  <section class="prose">
    <label v-for="s in sections" :key="s.key" class="prose__field">
      <span class="prose__label">{{ s.label }}</span>
      <textarea
        class="prose__textarea"
        rows="3"
        :value="schema.prose[s.key] ?? ''"
        :placeholder="`${s.label} rationale…`"
        @blur="setSection(s.key, ($event.target as HTMLTextAreaElement).value)"
      />
    </label>

    <div class="prose__field">
      <span class="prose__label">Do's &amp; Don'ts</span>
      <div v-for="(item, i) in schema.prose.dosDonts ?? []" :key="i" class="prose__dd">
        <input
          class="prose__dd-input"
          :value="item"
          placeholder="e.g. Do use semantic color tokens"
          @blur="setDoDont(i, ($event.target as HTMLInputElement).value)"
          @keydown.enter="setDoDont(i, ($event.target as HTMLInputElement).value)"
        />
        <button class="prose__dd-remove" :aria-label="`Remove item ${i + 1}`" @click="removeDoDont(i)">×</button>
      </div>
      <button class="prose__add" @click="addDoDont">+ Add guideline</button>
    </div>
  </section>
</template>

<style scoped>
.prose {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
.prose__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.prose__label {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-on-surface-subtle);
}
.prose__textarea,
.prose__dd-input {
  width: 100%;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--color-on-surface);
  background-color: var(--color-surface-sunken);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 6px 8px;
  resize: vertical;
}
.prose__dd {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: 4px;
}
.prose__dd-input {
  flex: 1;
}
.prose__dd-remove {
  background: none;
  border: none;
  color: var(--color-on-surface-subtle);
  font-size: 16px;
  cursor: pointer;
}
.prose__dd-remove:hover {
  color: var(--color-status-error);
}
.prose__add {
  align-self: flex-start;
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-on-surface-muted);
  background-color: var(--color-surface-raised);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 3px 10px;
  cursor: pointer;
  margin-top: 4px;
}
.prose__add:hover {
  color: var(--color-on-surface);
}
</style>
