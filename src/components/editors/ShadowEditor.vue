<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { ShadowToken } from '@/types/schema'

const props = defineProps<{
  tokenKey: string
  value: ShadowToken
}>()
const emit = defineEmits<{
  update: [key: string, value: ShadowToken]
  remove: [key: string]
}>()

// Edit layers as newline-separated CSS box-shadow strings.
function toText(v: ShadowToken): string {
  return Array.isArray(v.value) ? v.value.join('\n') : v.value
}
const text = ref(toText(props.value))
const inset = ref(!!props.value.inset)
watch(
  () => props.value,
  (v) => {
    text.value = toText(v)
    inset.value = !!v.inset
  },
  { deep: true },
)

const layers = computed(() =>
  text.value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean),
)
const previewShadow = computed(() => layers.value.join(', ') || 'none')

function commit() {
  const ls = layers.value
  const value: ShadowToken['value'] = ls.length <= 1 ? (ls[0] ?? 'none') : ls
  emit('update', props.tokenKey, { value, ...(inset.value ? { inset: true } : {}) })
}
</script>

<template>
  <div class="sh">
    <div class="sh__head">
      <span class="sh__key">{{ tokenKey }}</span>
      <div class="sh__preview-wrap">
        <span class="sh__preview" :style="{ boxShadow: previewShadow }" />
      </div>
      <button class="sh__remove" :aria-label="`Remove ${tokenKey}`" @click="emit('remove', tokenKey)">×</button>
    </div>
    <textarea
      v-model="text"
      class="sh__text"
      rows="2"
      spellcheck="false"
      :aria-label="`${tokenKey} layers`"
      @blur="commit"
    />
    <label class="sh__inset">
      <input v-model="inset" type="checkbox" @change="commit" />
      inset
    </label>
  </div>
</template>

<style scoped>
.sh {
  border: 1px solid var(--color-surface-border-subtle);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
  background-color: var(--color-surface-default);
}
.sh__head {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: var(--spacing-sm);
}
.sh__key {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-on-surface);
}
.sh__preview-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
}
.sh__preview {
  width: 28px;
  height: 20px;
  border-radius: var(--radius-sm);
  background-color: var(--color-surface-raised);
}
.sh__remove {
  background: none;
  border: none;
  color: var(--color-on-surface-subtle);
  font-size: 16px;
  cursor: pointer;
}
.sh__remove:hover {
  color: var(--color-status-error);
}
.sh__text {
  width: 100%;
  margin-top: var(--spacing-xs);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-on-surface);
  background-color: var(--color-surface-sunken);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 4px 6px;
  resize: vertical;
}
.sh__inset {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-on-surface-muted);
}
</style>
