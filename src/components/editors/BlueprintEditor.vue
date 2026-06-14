<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import type { ComponentBlueprint, PropDefinition } from '@/types/schema'
import TokenGroupEditor from '@/components/editors/TokenGroupEditor.vue'

const props = defineProps<{ name: string }>()

const store = useDesignSystemStore()
const { schema } = storeToRefs(store)

const bp = computed<ComponentBlueprint | undefined>(() => schema.value.componentBlueprints[props.name])

const subTabs = ['Props', 'Variants', 'Tokens', 'Examples', 'Responsive'] as const
type SubTab = (typeof subTabs)[number]
const active = ref<SubTab>('Tokens')

const base = (key: string) => ['componentBlueprints', props.name, key]

// ── Variants / Sizes / States — string lists ──
const listFields = ['variants', 'sizes', 'states'] as const
function addToList(field: (typeof listFields)[number], value: string) {
  const v = value.trim()
  if (!v || !bp.value) return
  const arr = bp.value[field]
  if (arr.includes(v)) return
  store.setPath(base(field), [...arr, v])
}
function removeFromList(field: (typeof listFields)[number], value: string) {
  if (!bp.value) return
  store.setPath(
    base(field),
    bp.value[field].filter((x) => x !== value),
  )
}
const listDraft = ref<Record<string, string>>({ variants: '', sizes: '', states: '' })

// ── Props ──
const propTypes: PropDefinition['type'][] = ['string', 'boolean', 'number', 'enum', 'slot']
const newPropName = ref('')
function addProp() {
  const n = newPropName.value.trim()
  if (!n || !bp.value || n in bp.value.props) return
  store.setPath(['componentBlueprints', props.name, 'props', n], { type: 'string' } satisfies PropDefinition)
  newPropName.value = ''
}
function setProp(name: string, patch: Partial<PropDefinition>) {
  if (!bp.value) return
  store.setPath(['componentBlueprints', props.name, 'props', name], { ...bp.value.props[name], ...patch })
}
function removeProp(name: string) {
  store.removePath(['componentBlueprints', props.name, 'props', name])
}

// ── Tokens (base + variants) ──
function setBaseToken(prop: string, value: unknown) {
  store.setPath(['componentBlueprints', props.name, 'tokens', 'base', prop], value)
}
function removeBaseToken(prop: string) {
  store.removePath(['componentBlueprints', props.name, 'tokens', 'base', prop])
}
// Every declared variant is editable, even before it has a token group — an
// empty group renders as fully inherited from base, with override affordances.
const variantTokenGroups = computed(() => bp.value?.variants ?? [])
function setVariantToken(variant: string, prop: string, value: unknown) {
  store.setPath(['componentBlueprints', props.name, 'tokens', variant, prop], value)
}
function removeVariantToken(variant: string, prop: string) {
  store.removePath(['componentBlueprints', props.name, 'tokens', variant, prop])
}

// ── Responsive ──
const selectedBp = ref('')
const breakpointNames = computed(() => Object.keys(schema.value.breakpoints))
const baseTokens = computed<Record<string, unknown>>(() => (bp.value?.tokens.base ?? {}) as Record<string, unknown>)
function overrideTokens(name: string): Record<string, unknown> {
  return (bp.value?.responsive?.[name]?.tokens ?? {}) as Record<string, unknown>
}
function setResponsiveToken(name: string, prop: string, value: unknown) {
  store.setPath(['componentBlueprints', props.name, 'responsive', name, 'tokens', prop], value)
}
function removeResponsiveToken(name: string, prop: string) {
  store.removePath(['componentBlueprints', props.name, 'responsive', name, 'tokens', prop])
}
function removeBreakpointOverride(name: string) {
  store.removePath(['componentBlueprints', props.name, 'responsive', name])
}
const activeOverrides = computed(() => Object.keys(bp.value?.responsive ?? {}))
</script>

<template>
  <div v-if="bp" class="be">
    <p class="be__desc">{{ bp.description }}</p>

    <nav class="be__subnav">
      <button
        v-for="t in subTabs"
        :key="t"
        class="be__subtab"
        :class="{ 'be__subtab--active': active === t }"
        @click="active = t"
      >
        {{ t }}
      </button>
    </nav>

    <!-- Props -->
    <div v-if="active === 'Props'" class="be__section">
      <div v-for="(def, name) in bp.props" :key="name" class="be__prop">
        <span class="be__prop-name">{{ name }}</span>
        <select :value="def.type" aria-label="type" @change="setProp(name, { type: ($event.target as HTMLSelectElement).value as PropDefinition['type'] })">
          <option v-for="t in propTypes" :key="t" :value="t">{{ t }}</option>
        </select>
        <label class="be__req">
          <input type="checkbox" :checked="def.required" @change="setProp(name, { required: ($event.target as HTMLInputElement).checked })" />
          req
        </label>
        <button class="be__x" :aria-label="`Remove ${name}`" @click="removeProp(name)">×</button>
      </div>
      <div class="be__add">
        <input v-model="newPropName" placeholder="new prop" @keydown.enter="addProp" />
        <button @click="addProp">+ Add</button>
      </div>
    </div>

    <!-- Variants / Sizes / States -->
    <div v-else-if="active === 'Variants'" class="be__section">
      <div v-for="field in listFields" :key="field" class="be__list">
        <h4 class="be__list-head">{{ field }}</h4>
        <div class="be__chips">
          <span v-for="item in bp[field]" :key="item" class="be__chip">
            {{ item }}
            <button :aria-label="`Remove ${item}`" @click="removeFromList(field, item)">×</button>
          </span>
        </div>
        <div class="be__add">
          <input v-model="listDraft[field]" :placeholder="`add ${field}`" @keydown.enter="addToList(field, listDraft[field]); listDraft[field] = ''" />
          <button @click="addToList(field, listDraft[field]); listDraft[field] = ''">+ Add</button>
        </div>
      </div>
    </div>

    <!-- Tokens -->
    <div v-else-if="active === 'Tokens'" class="be__section">
      <h4 class="be__list-head">base</h4>
      <TokenGroupEditor :tokens="baseTokens" @update="setBaseToken" @remove="removeBaseToken" />
      <template v-for="variant in variantTokenGroups" :key="variant">
        <h4 class="be__list-head">{{ variant }} <span class="be__muted">(inherits base)</span></h4>
        <TokenGroupEditor
          :tokens="((bp.tokens[variant] ?? {}) as Record<string, unknown>)"
          :inherited="baseTokens"
          @update="(p, v) => setVariantToken(variant, p, v)"
          @remove="(p) => removeVariantToken(variant, p)"
        />
      </template>
    </div>

    <!-- Examples -->
    <div v-else-if="active === 'Examples'" class="be__section">
      <div v-for="(ex, i) in bp.examples" :key="i" class="be__example">
        <span class="be__example-label">{{ ex.label }}</span>
        <code class="be__example-props">{{ JSON.stringify(ex.props) }}</code>
      </div>
      <p v-if="bp.examples.length === 0" class="be__empty">No examples.</p>
    </div>

    <!-- Responsive -->
    <div v-else class="be__section">
      <p class="be__hint">
        Base applies until the breakpoint. Add an override to grow padding, hide, or restyle at a viewport.
      </p>
      <div class="be__add">
        <select v-model="selectedBp" aria-label="Breakpoint" data-testid="responsive-bp-select">
          <option value="">choose breakpoint…</option>
          <option v-for="name in breakpointNames" :key="name" :value="name">
            {{ name }} ({{ schema.breakpoints[name] }})
          </option>
        </select>
      </div>

      <div v-if="selectedBp" class="be__override">
        <h4 class="be__list-head">
          {{ selectedBp }} override
          <button class="be__x" :aria-label="`Clear ${selectedBp} override`" @click="removeBreakpointOverride(selectedBp)">clear</button>
        </h4>
        <TokenGroupEditor
          :tokens="overrideTokens(selectedBp)"
          :inherited="baseTokens"
          @update="(p, v) => setResponsiveToken(selectedBp, p, v)"
          @remove="(p) => removeResponsiveToken(selectedBp, p)"
        />
      </div>

      <div v-if="activeOverrides.length" class="be__active">
        <span class="be__muted">Active overrides:</span>
        <span v-for="o in activeOverrides" :key="o" class="be__chip be__chip--static">{{ o }}</span>
      </div>
    </div>
  </div>
  <p v-else class="be__empty">Component not found.</p>
</template>

<style scoped>
.be__desc {
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-on-surface-muted);
  margin: 0 0 var(--spacing-sm);
}
.be__subnav {
  display: flex;
  gap: 2px;
  border-bottom: 1px solid var(--color-surface-border);
  margin-bottom: var(--spacing-md);
  overflow-x: auto;
}
.be__subtab {
  flex-shrink: 0;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  padding: 6px 8px;
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-on-surface-muted);
  cursor: pointer;
}
.be__subtab--active {
  color: var(--color-on-surface);
  border-bottom-color: var(--color-primary);
}
.be__list-head {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-on-surface-subtle);
  margin: var(--spacing-md) 0 var(--spacing-xs);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.be__muted {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: var(--color-on-surface-subtle);
}
.be__prop {
  display: grid;
  grid-template-columns: 1fr 90px auto auto;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 3px 0;
}
.be__prop-name {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-on-surface);
}
.be__prop select,
.be__add input,
.be__add select {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-on-surface);
  background-color: var(--color-surface-sunken);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 3px 6px;
}
.be__req {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-on-surface-muted);
}
.be__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.be__chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-on-surface);
  background-color: var(--color-surface-raised);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 2px 6px;
}
.be__chip button {
  background: none;
  border: none;
  color: var(--color-on-surface-subtle);
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
}
.be__chip--static {
  border-style: dashed;
}
.be__add {
  display: flex;
  gap: var(--spacing-sm);
  margin: var(--spacing-xs) 0 var(--spacing-md);
}
.be__add input,
.be__add select {
  flex: 1;
}
.be__add button,
.be__x {
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-on-surface-muted);
  background-color: var(--color-surface-raised);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 3px 10px;
  cursor: pointer;
}
.be__x {
  padding: 1px 8px;
}
.be__x:hover {
  color: var(--color-status-error);
}
.be__example {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--spacing-xs) 0;
  border-bottom: 1px solid var(--color-surface-border-subtle);
}
.be__example-label {
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-on-surface);
}
.be__example-props {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-on-surface-subtle);
}
.be__hint,
.be__empty {
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-on-surface-subtle);
}
.be__active {
  margin-top: var(--spacing-md);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}
</style>
