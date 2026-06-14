<script setup lang="ts">
import { ref } from 'vue'

withDefaults(defineProps<{ placeholder?: string }>(), { placeholder: 'new token name' })
const emit = defineEmits<{ add: [name: string] }>()

const name = ref('')
function add() {
  const n = name.value.trim()
  if (!n) return
  emit('add', n)
  name.value = ''
}
</script>

<template>
  <div class="add">
    <input v-model="name" :placeholder="placeholder" aria-label="New token name" @keydown.enter="add" />
    <button @click="add">+ Add</button>
  </div>
</template>

<style scoped>
.add {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
}
.add input {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-on-surface);
  background-color: var(--color-surface-sunken);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 3px 6px;
}
.add button {
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-on-surface-muted);
  background-color: var(--color-surface-raised);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 3px 10px;
  cursor: pointer;
  white-space: nowrap;
}
.add button:hover {
  color: var(--color-on-surface);
}
</style>
