<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import DimensionEditor from '@/components/editors/DimensionEditor.vue'
import NumberTokenEditor from '@/components/editors/NumberTokenEditor.vue'
import ScaleGenerator from '@/components/editors/ScaleGenerator.vue'
import TokenRefPicker from '@/components/editors/TokenRefPicker.vue'
import AddTokenRow from '@/components/editors/AddTokenRow.vue'

const store = useDesignSystemStore()
const { schema } = storeToRefs(store)

function applyScale(tokens: Record<string, string>) {
  for (const [k, v] of Object.entries(tokens)) store.setPath(['spacing', k], v)
}
</script>

<template>
  <section class="stack">
    <div>
      <h3 class="head">Spacing scale</h3>
      <ScaleGenerator @generate="applyScale" />
      <DimensionEditor
        v-for="(value, key) in schema.spacing"
        :key="key"
        :token-key="key"
        :value="value"
        @update="(k, v) => store.setPath(['spacing', k], v)"
        @remove="(k) => store.removePath(['spacing', k])"
      />
      <AddTokenRow placeholder="new spacing token" @add="(n) => store.setPath(['spacing', n], '16px')" />
    </div>

    <div>
      <h3 class="head">Radius</h3>
      <DimensionEditor
        v-for="(value, key) in schema.rounded"
        :key="key"
        :token-key="key"
        :value="value"
        @update="(k, v) => store.setPath(['rounded', k], v)"
        @remove="(k) => store.removePath(['rounded', k])"
      />
      <AddTokenRow placeholder="new radius token" @add="(n) => store.setPath(['rounded', n], '8px')" />
    </div>

    <div>
      <h3 class="head">Layout grid</h3>
      <NumberTokenEditor
        token-key="columns"
        :value="schema.layout.grid.columns"
        :removable="false"
        @update="(_, v) => store.setPath(['layout', 'grid', 'columns'], v)"
      />
      <label class="field">
        <span>gutter</span>
        <TokenRefPicker
          :model-value="String(schema.layout.grid.gutter)"
          :groups="['spacing']"
          @update:model-value="(v) => store.setPath(['layout', 'grid', 'gutter'], v)"
        />
      </label>
      <label class="field">
        <span>margin</span>
        <TokenRefPicker
          :model-value="String(schema.layout.grid.margin)"
          :groups="['spacing']"
          @update:model-value="(v) => store.setPath(['layout', 'grid', 'margin'], v)"
        />
      </label>
      <DimensionEditor
        token-key="container max-width"
        :value="schema.layout.container.maxWidth"
        :removable="false"
        @update="(_, v) => store.setPath(['layout', 'container', 'maxWidth'], v)"
      />
      <label class="field">
        <span>container padding-x</span>
        <TokenRefPicker
          :model-value="String(schema.layout.container.paddingX)"
          :groups="['spacing']"
          @update:model-value="(v) => store.setPath(['layout', 'container', 'paddingX'], v)"
        />
      </label>
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
.field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: var(--spacing-xs);
}
.field span {
  font-family: var(--font-sans);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-on-surface-subtle);
}
</style>
