<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'

// Grouped dropdown that outputs a {path.to.token} reference. Pass the token
// groups to offer (default: the common style groups).
const props = withDefaults(
  defineProps<{
    modelValue: string
    groups?: string[]
    allowRaw?: boolean
  }>(),
  { groups: () => ['colors', 'spacing', 'rounded', 'shadows', 'typography'], allowRaw: true },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const store = useDesignSystemStore()
const { schema } = storeToRefs(store)

interface Group {
  label: string
  options: { value: string; label: string }[]
}

const grouped = computed<Group[]>(() =>
  props.groups
    .map((g) => {
      const node = (schema.value as Record<string, unknown>)[g]
      if (!node || typeof node !== 'object') return null
      return {
        label: g,
        options: Object.keys(node as Record<string, unknown>).map((k) => ({
          value: `{${g}.${k}}`,
          label: k,
        })),
      }
    })
    .filter((x): x is Group => x !== null),
)
</script>

<template>
  <select
    class="ref-picker"
    :value="modelValue"
    aria-label="Token reference"
    @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
  >
    <option v-if="allowRaw" value="">— raw value —</option>
    <optgroup v-for="group in grouped" :key="group.label" :label="group.label">
      <option v-for="opt in group.options" :key="opt.value" :value="opt.value">
        {{ group.label }}.{{ opt.label }}
      </option>
    </optgroup>
  </select>
</template>

<style scoped>
.ref-picker {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-on-surface);
  background-color: var(--color-surface-sunken);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 3px 6px;
  width: 100%;
}
</style>
