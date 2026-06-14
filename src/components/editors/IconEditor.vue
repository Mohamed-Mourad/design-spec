<script setup lang="ts">
import DimensionEditor from '@/components/editors/DimensionEditor.vue'

defineProps<{
  library: string
  sizes: Record<string, string>
}>()
const emit = defineEmits<{
  updateLibrary: [value: string]
  updateSize: [key: string, value: string]
  removeSize: [key: string]
}>()

const libraries = ['lucide', 'heroicons', 'material', 'tabler', 'custom']
</script>

<template>
  <div class="icons">
    <label class="icons__lib">
      <span>library</span>
      <select :value="library" @change="emit('updateLibrary', ($event.target as HTMLSelectElement).value)">
        <option v-for="lib in libraries" :key="lib" :value="lib">{{ lib }}</option>
      </select>
    </label>
    <p class="icons__sub">Sizes</p>
    <DimensionEditor
      v-for="(value, key) in sizes"
      :key="key"
      :token-key="key"
      :value="value"
      @update="(k, v) => emit('updateSize', k, v)"
      @remove="(k) => emit('removeSize', k)"
    />
  </div>
</template>

<style scoped>
.icons__lib {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: var(--spacing-md);
}
.icons__lib span {
  font-family: var(--font-sans);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-on-surface-subtle);
}
.icons__lib select {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-on-surface);
  background-color: var(--color-surface-sunken);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 3px 6px;
}
.icons__sub {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  color: var(--color-on-surface-muted);
  margin: 0 0 var(--spacing-xs);
}
</style>
