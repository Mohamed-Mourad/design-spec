<script setup lang="ts">
import { ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    tokenKey: string
    value: number
    step?: number
    removable?: boolean
  }>(),
  { step: 1, removable: true },
)
const emit = defineEmits<{
  update: [key: string, value: number]
  remove: [key: string]
}>()

const draft = ref(String(props.value))
watch(
  () => props.value,
  (v) => (draft.value = String(v)),
)

function commit() {
  const n = Number(draft.value)
  if (Number.isNaN(n)) {
    draft.value = String(props.value)
    return
  }
  if (n !== props.value) emit('update', props.tokenKey, n)
}
</script>

<template>
  <div class="row">
    <span class="row__key" :title="tokenKey">{{ tokenKey }}</span>
    <input
      v-model="draft"
      class="row__num"
      type="number"
      :step="step"
      :aria-label="`${tokenKey} value`"
      @blur="commit"
      @keydown.enter="commit"
    />
    <button
      v-if="removable"
      class="row__remove"
      :aria-label="`Remove ${tokenKey}`"
      @click="emit('remove', tokenKey)"
    >
      ×
    </button>
  </div>
</template>

<style scoped>
.row {
  display: grid;
  grid-template-columns: 1fr 88px auto;
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
.row__num {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-on-surface);
  background-color: var(--color-surface-sunken);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 3px 6px;
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
