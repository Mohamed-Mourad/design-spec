<script setup lang="ts">
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import BlueprintEditor from '@/components/editors/BlueprintEditor.vue'

const store = useDesignSystemStore()
const { schema, selectedComponent } = storeToRefs(store)

const names = computed(() => Object.keys(schema.value.componentBlueprints))
// Selection is shared with the live-preview inspector via the store.
const selected = computed({
  get: () => (selectedComponent.value && names.value.includes(selectedComponent.value) ? selectedComponent.value : names.value[0] ?? ''),
  set: (v: string) => store.selectComponent(v),
})

watch(names, (n) => {
  if (selectedComponent.value && !n.includes(selectedComponent.value)) store.selectComponent(n[0] ?? null)
})
</script>

<template>
  <section>
    <label class="picker">
      <span>Component</span>
      <select v-model="selected" aria-label="Select component">
        <option v-for="name in names" :key="name" :value="name">{{ name }}</option>
      </select>
    </label>
    <BlueprintEditor v-if="selected" :key="selected" :name="selected" />
    <p v-else class="empty">No component blueprints.</p>
  </section>
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: var(--spacing-md);
}
.picker span {
  font-family: var(--font-sans);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-on-surface-subtle);
}
.picker select {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--color-on-surface);
  background-color: var(--color-surface-sunken);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
}
.empty {
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-on-surface-subtle);
}
</style>
