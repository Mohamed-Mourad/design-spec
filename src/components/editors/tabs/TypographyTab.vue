<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import type { TypographyToken } from '@/types/schema'
import TypographyEditor from '@/components/editors/TypographyEditor.vue'
import AddTokenRow from '@/components/editors/AddTokenRow.vue'
import TokenStateRow from '@/components/shared/TokenStateRow.vue'

const store = useDesignSystemStore()
const { schema } = storeToRefs(store)

function update(key: string, value: TypographyToken) {
  store.setPath(['typography', key], value)
}
function remove(key: string) {
  store.removePath(['typography', key])
}
function add(name: string) {
  if (name in schema.value.typography) return
  store.setPath(['typography', name], {
    fontFamily: 'Inter',
    fontSize: '16px',
    fontWeight: 400,
    lineHeight: 1.5,
  } satisfies TypographyToken)
}
</script>

<template>
  <section>
    <TokenStateRow v-for="(value, key) in schema.typography" :key="key" group="typography" :token-key="key">
      <TypographyEditor :token-key="key" :value="value" @update="update" @remove="remove" />
    </TokenStateRow>
    <AddTokenRow placeholder="new type scale" @add="add" />
  </section>
</template>
