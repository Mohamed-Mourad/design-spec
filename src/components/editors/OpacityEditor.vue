<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  tokenKey: string
  value: number
}>()
const emit = defineEmits<{
  update: [key: string, value: number]
  remove: [key: string]
}>()

const draft = ref(props.value)
watch(
  () => props.value,
  (v) => (draft.value = v),
)

function commit() {
  if (draft.value !== props.value) emit('update', props.tokenKey, draft.value)
}
</script>

<template>
  <div class="row">
    <span class="row__key" :title="tokenKey">{{ tokenKey }}</span>
    <input
      v-model.number="draft"
      class="row__slider"
      type="range"
      min="0"
      max="1"
      step="0.01"
      :aria-label="`${tokenKey} opacity`"
      @change="commit"
    />
    <span class="row__val">{{ draft.toFixed(2) }}</span>
    <button class="row__remove" :aria-label="`Remove ${tokenKey}`" @click="emit('remove', tokenKey)">×</button>
  </div>
</template>

<style scoped>
.row {
  display: grid;
  grid-template-columns: 1fr 1fr 40px auto;
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
.row__slider {
  width: 100%;
  accent-color: var(--color-primary);
}
.row__val {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-on-surface-muted);
  text-align: right;
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
