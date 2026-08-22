<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import BreakpointEditor from '@/components/editors/BreakpointEditor.vue'

const store = useDesignSystemStore()
const { schema } = storeToRefs(store)
</script>

<template>
  <section>
    <BreakpointEditor
      :breakpoints="schema.breakpoints"
      @update="(k, v) => store.setPath(['breakpoints', k], v)"
      @remove="(k) => store.removePath(['breakpoints', k])"
      @add="(k, v) => store.setPath(['breakpoints', k], v)"
    />
  </section>
</template>
