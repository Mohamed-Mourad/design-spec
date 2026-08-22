<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import type { ShadowToken } from '@/types/schema'
import ShadowEditor from '@/components/editors/ShadowEditor.vue'
import NumberTokenEditor from '@/components/editors/NumberTokenEditor.vue'
import OpacityEditor from '@/components/editors/OpacityEditor.vue'
import AddTokenRow from '@/components/editors/AddTokenRow.vue'
import TokenStateRow from '@/components/shared/TokenStateRow.vue'

const store = useDesignSystemStore()
const { schema } = storeToRefs(store)
</script>

<template>
  <section class="stack">
    <div>
      <h3 class="head">Shadows</h3>
      <TokenStateRow v-for="(value, key) in schema.shadows" :key="key" group="shadows" :token-key="key">
        <ShadowEditor
          :token-key="key"
          :value="value"
          @update="(k, v) => store.setPath(['shadows', k], v)"
          @remove="(k) => store.removePath(['shadows', k])"
        />
      </TokenStateRow>
      <AddTokenRow
        placeholder="new shadow token"
        @add="(n) => store.setPath(['shadows', n], { value: '0 1px 2px rgba(0,0,0,0.1)' } satisfies ShadowToken)"
      />
    </div>

    <div>
      <h3 class="head">Z-index</h3>
      <NumberTokenEditor
        v-for="(value, key) in schema.zIndex"
        :key="key"
        :token-key="key"
        :value="value"
        @update="(k, v) => store.setPath(['zIndex', k], v)"
        @remove="(k) => store.removePath(['zIndex', k])"
      />
      <AddTokenRow placeholder="new z-index layer" @add="(n) => store.setPath(['zIndex', n], 0)" />
    </div>

    <div>
      <h3 class="head">Opacity</h3>
      <OpacityEditor
        v-for="(value, key) in schema.opacity"
        :key="key"
        :token-key="key"
        :value="value"
        @update="(k, v) => store.setPath(['opacity', k], v)"
        @remove="(k) => store.removePath(['opacity', k])"
      />
      <AddTokenRow placeholder="new opacity token" @add="(n) => store.setPath(['opacity', n], 1)" />
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
