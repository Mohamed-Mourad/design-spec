<script setup lang="ts">
import { ref, computed } from 'vue'

// Generates a named dimension scale (xs…2xl) from a base + algorithm, and emits
// it as a token record for the parent to merge into a group.
const emit = defineEmits<{ generate: [tokens: Record<string, string>] }>()

const base = ref(16)
const algorithm = ref<'linear' | 'modular' | 'golden'>('modular')
const unit = ref('px')

const steps = ['xs', 'sm', 'md', 'lg', 'xl', '2xl']
// md is the base; indices relative to it.
const ratios = { linear: 1, modular: 1.25, golden: 1.618 }

const preview = computed<Record<string, string>>(() => {
  const r = ratios[algorithm.value]
  const out: Record<string, string> = {}
  steps.forEach((name, i) => {
    const exp = i - 2 // md (index 2) = base
    const raw = algorithm.value === 'linear' ? base.value * (1 + exp * 0.5) : base.value * Math.pow(r, exp)
    out[name] = `${Math.round(raw * 100) / 100}${unit.value}`
  })
  return out
})
</script>

<template>
  <div class="scale">
    <div class="scale__controls">
      <label class="scale__field">
        <span>base</span>
        <input v-model.number="base" type="number" min="1" />
      </label>
      <label class="scale__field">
        <span>unit</span>
        <select v-model="unit">
          <option>px</option>
          <option>rem</option>
        </select>
      </label>
      <label class="scale__field">
        <span>algorithm</span>
        <select v-model="algorithm">
          <option value="linear">linear</option>
          <option value="modular">modular ×1.25</option>
          <option value="golden">golden ×1.618</option>
        </select>
      </label>
    </div>
    <div class="scale__preview">
      <span v-for="(v, k) in preview" :key="k" class="scale__chip">{{ k }}: {{ v }}</span>
    </div>
    <button class="scale__apply" @click="emit('generate', preview)">Apply scale</button>
  </div>
</template>

<style scoped>
.scale {
  border: 1px dashed var(--color-surface-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}
.scale__controls {
  display: grid;
  grid-template-columns: 64px 64px 1fr;
  gap: var(--spacing-sm);
}
.scale__field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.scale__field span {
  font-family: var(--font-sans);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-on-surface-subtle);
}
.scale__field input,
.scale__field select {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-on-surface);
  background-color: var(--color-surface-sunken);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 3px 6px;
}
.scale__preview {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: var(--spacing-sm) 0;
}
.scale__chip {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-on-surface-muted);
  background-color: var(--color-surface-raised);
  border-radius: var(--radius-sm);
  padding: 2px 6px;
}
.scale__apply {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 500;
  color: var(--color-on-primary);
  background-color: var(--color-primary);
  border: none;
  border-radius: var(--radius-sm);
  padding: 4px 10px;
  cursor: pointer;
}
</style>
