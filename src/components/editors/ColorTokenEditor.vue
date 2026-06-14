<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import { isValidColorValue, isHexColor, normalizeHex, isTokenReference } from '@/utils/colorUtils'

const props = defineProps<{
  tokenKey: string
  value: string
}>()
const emit = defineEmits<{
  update: [key: string, value: string]
  remove: [key: string]
}>()

const store = useDesignSystemStore()

// Local draft, committed on blur — never thrash the compiler per keystroke.
const draft = ref(props.value)
watch(
  () => props.value,
  (v) => {
    draft.value = v
  },
)

// Resolve a {token} reference to a concrete color for the swatch + native picker.
const resolved = computed(() => {
  if (!isTokenReference(props.value)) return props.value
  const path = props.value.slice(1, -1).split('.')
  let node: unknown = store.schema
  for (const seg of path) {
    if (node && typeof node === 'object') node = (node as Record<string, unknown>)[seg]
    else return '#000000'
  }
  return typeof node === 'string' ? node : '#000000'
})

const pickerValue = computed(() => (isHexColor(resolved.value) ? resolved.value.slice(0, 7) : '#000000'))

function commit() {
  const next = normalizeHex(draft.value)
  if (isValidColorValue(next)) {
    if (next !== props.value) emit('update', props.tokenKey, next)
  } else {
    draft.value = props.value // reset to last valid
  }
}

function onPicker(e: Event) {
  const v = (e.target as HTMLInputElement).value
  draft.value = v
  emit('update', props.tokenKey, v)
}
</script>

<template>
  <div class="row">
    <span class="row__key" :title="tokenKey">{{ tokenKey }}</span>
    <span class="row__swatch" :style="{ backgroundColor: resolved }" :title="resolved" />
    <input
      class="row__picker"
      type="color"
      :value="pickerValue"
      aria-label="Pick color (sets a raw hex, replacing a token reference)"
      @input="onPicker"
    />
    <input
      v-model="draft"
      class="row__hex"
      spellcheck="false"
      aria-label="Color value or token reference"
      @blur="commit"
      @keydown.enter="commit"
    />
    <button class="row__remove" :aria-label="`Remove ${tokenKey}`" @click="emit('remove', tokenKey)">
      ×
    </button>
  </div>
</template>

<style scoped>
.row {
  display: grid;
  grid-template-columns: 1fr auto auto 96px auto;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 4px 0;
}
.row__key {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row__swatch {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-surface-border);
}
.row__picker {
  width: 24px;
  height: 20px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
}
.row__picker:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.row__hex {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-on-surface);
  background-color: var(--color-surface-sunken);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 3px 6px;
  width: 100%;
  min-width: 0;
}
.row__remove {
  background: none;
  border: none;
  color: var(--color-on-surface-subtle);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
}
.row__remove:hover {
  color: var(--color-status-error);
}
</style>
