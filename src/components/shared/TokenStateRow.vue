<script setup lang="ts">
import { computed } from 'vue'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import TokenStateChip from '@/components/shared/TokenStateChip.vue'

// Wraps a token editor row with its import provenance chip.
//
// Deliberately inert when the workspace was not imported: `tokenStateFor`
// returns null, the chip renders nothing, and this is a transparent flex row. So
// every editor can be wrapped unconditionally without a hand-authored workspace
// growing a column of empty badges.

const props = defineProps<{
  /** Dotted schema group — `colors`, `darkMode.colors`, `borders.width`. */
  group: string
  tokenKey: string
}>()

const store = useDesignSystemStore()
const state = computed(() => store.tokenStateFor(props.group, props.tokenKey))
</script>

<template>
  <div class="tsr">
    <slot />
    <TokenStateChip :state="state" @confirm="store.clearTokenState(group, tokenKey)" />
  </div>
</template>

<style scoped>
.tsr {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* The editor keeps the row; the chip is an aside, never a gate. */
.tsr > :slotted(*) {
  flex: 1;
  min-width: 0;
}
</style>
