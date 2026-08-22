<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import DimensionEditor from '@/components/editors/DimensionEditor.vue'
import EasingEditor from '@/components/editors/EasingEditor.vue'
import AddTokenRow from '@/components/editors/AddTokenRow.vue'

const store = useDesignSystemStore()
const { schema } = storeToRefs(store)
</script>

<template>
  <section class="stack">
    <div>
      <h3 class="head">Duration</h3>
      <DimensionEditor
        v-for="(value, key) in schema.transitions.duration"
        :key="key"
        :token-key="key"
        :value="value"
        :units="['ms', 's']"
        @update="(k, v) => store.setPath(['transitions', 'duration', k], v)"
        @remove="(k) => store.removePath(['transitions', 'duration', k])"
      />
      <AddTokenRow placeholder="new duration" @add="(n) => store.setPath(['transitions', 'duration', n], '200ms')" />
    </div>

    <div>
      <h3 class="head">Easing</h3>
      <EasingEditor
        v-for="(value, key) in schema.transitions.easing"
        :key="key"
        :token-key="key"
        :value="value"
        @update="(k, v) => store.setPath(['transitions', 'easing', k], v)"
        @remove="(k) => store.removePath(['transitions', 'easing', k])"
      />
      <AddTokenRow
        placeholder="new easing"
        @add="(n) => store.setPath(['transitions', 'easing', n], 'cubic-bezier(0.4, 0, 0.2, 1)')"
      />
    </div>

    <label class="reduced">
      <input
        type="checkbox"
        :checked="schema.transitions.reducedMotion"
        @change="store.setPath(['transitions', 'reducedMotion'], ($event.target as HTMLInputElement).checked)"
      />
      Emit <code>prefers-reduced-motion</code> guards
    </label>
  </section>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}
.head {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-on-surface-subtle);
  margin: 0 0 var(--spacing-sm);
}
.reduced {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-on-surface-muted);
}
.reduced code {
  font-family: var(--font-mono);
  font-size: 11px;
}
</style>
