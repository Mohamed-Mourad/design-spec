<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import ColorTokenEditor from '@/components/editors/ColorTokenEditor.vue'
import AddTokenRow from '@/components/editors/AddTokenRow.vue'

const store = useDesignSystemStore()
const { schema } = storeToRefs(store)

function update(key: string, value: string) {
  store.setPath(['colors', key], value)
}
function remove(key: string) {
  store.removePath(['colors', key])
}
function add(name: string) {
  if (name in schema.value.colors) return
  store.setPath(['colors', name], '#888888')
}
</script>

<template>
  <section>
    <ColorTokenEditor
      v-for="(value, key) in schema.colors"
      :key="key"
      :token-key="key"
      :value="value"
      @update="update"
      @remove="remove"
    />
    <AddTokenRow placeholder="new color token" @add="add" />
  </section>
</template>
