<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { Frame, RefreshCw } from '@lucide/vue'
import { useFigmaStore } from '@/stores/useFigmaStore'
import FigmaImportDialog from '@/components/import/FigmaImportDialog.vue'

// The header marker for a workspace that follows a Figma file, and the offer
// that appears when that file moves.
//
// Two things it deliberately does not do: it never applies a change on its own
// — the designer opens the import and decides — and it stops polling the moment
// this component goes away, so a closed tab costs nothing and there is no
// server-side poller that would need the token (architecture-plan.md §15).

const figma = useFigmaStore()
const { link, changeAvailable, canWatch } = storeToRefs(figma)

const syncing = ref(false)

onMounted(async () => {
  await figma.init()
  figma.startWatching()
})

onUnmounted(() => figma.stopWatching())
</script>

<template>
  <template v-if="link">
    <button
      v-if="changeAvailable"
      class="badge badge--change"
      data-testid="figma-change-badge"
      @click="syncing = true"
    >
      <RefreshCw :size="12" aria-hidden="true" />
      <span class="badge__file">{{ link.fileName }}</span>
      <span class="badge__state">updated — sync</span>
    </button>

    <button v-else class="badge" data-testid="figma-badge" @click="syncing = true">
      <Frame :size="12" aria-hidden="true" />
      <span class="badge__file">{{ link.fileName }}</span>
      <span v-if="canWatch" class="badge__state">watching</span>
    </button>

    <FigmaImportDialog v-if="syncing" @close="syncing = false" />
  </template>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  max-width: 260px;
  padding: 3px 7px;
  background: none;
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-full);
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-on-surface-muted);
  cursor: pointer;
}
.badge:hover {
  color: var(--color-on-surface);
  background-color: var(--color-surface-raised);
}
.badge:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-interactive-focus-ring);
}
.badge--change {
  border-color: color-mix(in srgb, var(--color-primary) 45%, transparent);
}
.badge__file {
  font-family: var(--font-mono);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.badge__state {
  white-space: nowrap;
  color: var(--color-on-surface-subtle);
}
.badge--change .badge__state {
  color: var(--color-primary);
}
</style>
