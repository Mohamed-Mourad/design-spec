<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import IconEditor from '@/components/editors/IconEditor.vue'
import DimensionEditor from '@/components/editors/DimensionEditor.vue'
import ColorTokenEditor from '@/components/editors/ColorTokenEditor.vue'
import AddTokenRow from '@/components/editors/AddTokenRow.vue'

const store = useDesignSystemStore()
const { schema } = storeToRefs(store)
</script>

<template>
  <section class="stack">
    <div>
      <h3 class="head">Icons</h3>
      <IconEditor
        :library="schema.icons.library"
        :sizes="schema.icons.size"
        @update-library="(v) => store.setPath(['icons', 'library'], v)"
        @update-size="(k, v) => store.setPath(['icons', 'size', k], v)"
        @remove-size="(k) => store.removePath(['icons', 'size', k])"
      />
    </div>

    <div>
      <h3 class="head">Border width</h3>
      <DimensionEditor
        v-for="(value, key) in schema.borders.width"
        :key="key"
        :token-key="key"
        :value="value"
        @update="(k, v) => store.setPath(['borders', 'width', k], v)"
        @remove="(k) => store.removePath(['borders', 'width', k])"
      />
      <AddTokenRow placeholder="new border width" @add="(n) => store.setPath(['borders', 'width', n], '1px')" />
    </div>

    <div>
      <h3 class="head">Border color</h3>
      <ColorTokenEditor
        v-for="(value, key) in schema.borders.color"
        :key="key"
        :token-key="key"
        :value="value"
        @update="(k, v) => store.setPath(['borders', 'color', k], v)"
        @remove="(k) => store.removePath(['borders', 'color', k])"
      />
      <AddTokenRow
        placeholder="new border color"
        @add="(n) => store.setPath(['borders', 'color', n], '{colors.surface-border}')"
      />
    </div>
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
</style>
