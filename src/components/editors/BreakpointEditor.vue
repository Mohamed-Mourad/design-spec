<script setup lang="ts">
import { ref, computed } from 'vue'
import DimensionEditor from '@/components/editors/DimensionEditor.vue'

const props = defineProps<{
  breakpoints: Record<string, string | number>
}>()
const emit = defineEmits<{
  update: [key: string, value: string]
  remove: [key: string]
  add: [key: string, value: string]
}>()

const newName = ref('')
const ordered = computed(() =>
  Object.entries(props.breakpoints).sort((a, b) => parseFloat(String(a[1])) - parseFloat(String(b[1]))),
)

function add() {
  const name = newName.value.trim()
  if (!name || name in props.breakpoints) return
  emit('add', name, '768px')
  newName.value = ''
}
</script>

<template>
  <div class="bp">
    <DimensionEditor
      v-for="[name, value] in ordered"
      :key="name"
      :token-key="name"
      :value="value"
      :units="['px']"
      @update="(k, v) => emit('update', k, v)"
      @remove="(k) => emit('remove', k)"
    />
    <div class="bp__add">
      <input v-model="newName" placeholder="new breakpoint" aria-label="New breakpoint name" @keydown.enter="add" />
      <button @click="add">+ Add</button>
    </div>
  </div>
</template>

<style scoped>
.bp__add {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
}
.bp__add input {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-on-surface);
  background-color: var(--color-surface-sunken);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 3px 6px;
}
.bp__add button {
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-on-surface-muted);
  background-color: var(--color-surface-raised);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 3px 10px;
  cursor: pointer;
}
.bp__add button:hover {
  color: var(--color-on-surface);
}
</style>
