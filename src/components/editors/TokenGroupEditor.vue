<script setup lang="ts">
import { computed, ref } from 'vue'
import ColorTokenEditor from '@/components/editors/ColorTokenEditor.vue'
import TokenRefPicker from '@/components/editors/TokenRefPicker.vue'

// Edits the flat style properties of a ComponentTokenGroup (never `responsive`).
// When `inherited` is supplied, properties absent from `tokens` render dim as
// inherited, with an "override" affordance — the inherited-vs-overridden view.
const props = defineProps<{
  tokens: Record<string, unknown>
  inherited?: Record<string, unknown>
}>()
const emit = defineEmits<{
  update: [prop: string, value: unknown]
  remove: [prop: string]
}>()

const STYLE_PROPS = [
  'backgroundColor',
  'textColor',
  'typography',
  'rounded',
  'padding',
  'paddingX',
  'paddingY',
  'borderColor',
  'borderWidth',
  'shadow',
  'size',
  'height',
  'width',
] as const

const COLOR_PROPS = new Set(['backgroundColor', 'textColor', 'borderColor'])
const REF_GROUPS: Record<string, string[]> = {
  typography: ['typography'],
  rounded: ['rounded'],
  padding: ['spacing'],
  paddingX: ['spacing'],
  paddingY: ['spacing'],
  shadow: ['shadows'],
}

const overridden = computed(() =>
  STYLE_PROPS.filter((p) => p !== 'responsive' && props.tokens[p] !== undefined),
)
const inheritedOnly = computed(() =>
  props.inherited
    ? STYLE_PROPS.filter((p) => props.tokens[p] === undefined && props.inherited![p] !== undefined)
    : [],
)

const addable = computed(() =>
  STYLE_PROPS.filter((p) => props.tokens[p] === undefined && !inheritedOnly.value.includes(p)),
)
const newProp = ref('')

function addProp() {
  if (!newProp.value) return
  emit('update', newProp.value, COLOR_PROPS.has(newProp.value) ? '#888888' : '')
  newProp.value = ''
}
</script>

<template>
  <div class="tg">
    <div v-for="prop in overridden" :key="prop" class="tg__prop">
      <span class="tg__badge tg__badge--over" title="Overridden here">●</span>
      <ColorTokenEditor
        v-if="COLOR_PROPS.has(prop)"
        :token-key="prop"
        :value="String(tokens[prop])"
        @update="(_, v) => emit('update', prop, v)"
        @remove="() => emit('remove', prop)"
      />
      <template v-else>
        <span class="tg__name">{{ prop }}</span>
        <TokenRefPicker
          v-if="REF_GROUPS[prop]"
          :model-value="String(tokens[prop])"
          :groups="REF_GROUPS[prop]"
          @update:model-value="(v) => emit('update', prop, v)"
        />
        <input
          v-else
          class="tg__input"
          :value="String(tokens[prop] ?? '')"
          :aria-label="prop"
          @change="emit('update', prop, ($event.target as HTMLInputElement).value)"
        />
        <button class="tg__remove" :aria-label="`Remove ${prop}`" @click="emit('remove', prop)">×</button>
      </template>
    </div>

    <div v-for="prop in inheritedOnly" :key="`i-${prop}`" class="tg__prop tg__prop--inherited">
      <span class="tg__badge" title="Inherited from base">○</span>
      <span class="tg__name">{{ prop }}</span>
      <span class="tg__inherited-val">{{ String(inherited?.[prop]) }}</span>
      <button class="tg__override" @click="emit('update', prop, inherited?.[prop])">override</button>
    </div>

    <div class="tg__add">
      <select v-model="newProp" aria-label="Add property">
        <option value="">+ add property…</option>
        <option v-for="p in addable" :key="p" :value="p">{{ p }}</option>
      </select>
      <button :disabled="!newProp" @click="addProp">Add</button>
    </div>
  </div>
</template>

<style scoped>
.tg__prop {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 3px 0;
}
.tg__prop > :deep(.row),
.tg__prop > .tg__input,
.tg__prop > :deep(.ref-picker) {
  flex: 1;
}
.tg__prop--inherited {
  opacity: 0.7;
}
.tg__badge {
  font-size: 9px;
  color: var(--color-on-surface-subtle);
}
.tg__badge--over {
  color: var(--color-primary);
}
.tg__name {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-on-surface);
  min-width: 96px;
}
.tg__inherited-val {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-on-surface-subtle);
}
.tg__input {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-on-surface);
  background-color: var(--color-surface-sunken);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 3px 6px;
}
.tg__remove {
  background: none;
  border: none;
  color: var(--color-on-surface-subtle);
  font-size: 16px;
  cursor: pointer;
}
.tg__remove:hover {
  color: var(--color-status-error);
}
.tg__override {
  font-family: var(--font-sans);
  font-size: 10px;
  color: var(--color-on-surface-muted);
  background-color: var(--color-surface-raised);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 2px 6px;
  cursor: pointer;
}
.tg__override:hover {
  color: var(--color-on-surface);
}
.tg__add {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
}
.tg__add select {
  flex: 1;
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-on-surface);
  background-color: var(--color-surface-sunken);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 3px 6px;
}
.tg__add button {
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-on-surface-muted);
  background-color: var(--color-surface-raised);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 3px 10px;
  cursor: pointer;
}
.tg__add button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
