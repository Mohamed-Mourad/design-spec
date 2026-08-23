<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { Check, Clock, Frame } from '@lucide/vue'
import { useFigmaStore } from '@/stores/useFigmaStore'

// Send what this workspace now says back to the Figma file it came from — as a
// proposal, not a write.
//
// It appears only for a workspace linked to a file, on Pro, and only once there
// is something to send. Nothing it does touches a canvas: the change waits in
// the approval queue until somebody inside Figma accepts it, and the plugin is
// what applies it there.

const figma = useFigmaStore()
const { canStage, pendingDelta, staging, stageError, staged, queue, link, isPro } =
  storeToRefs(figma)

const shown = computed(() => isPro.value && link.value !== null)
const waiting = computed(() => queue.value.length)

onMounted(async () => {
  await figma.init()
  if (shown.value) await figma.loadQueue()
})
</script>

<template>
  <div v-if="shown" class="stage">
    <span v-if="staged" class="stage__done" role="status" data-testid="figma-staged">
      <Check :size="13" aria-hidden="true" />
      {{ staged.payload.changes.length }} changes waiting for approval in Figma
    </span>

    <template v-else>
      <button
        class="stage__btn"
        data-testid="stage-to-figma"
        :disabled="!canStage || staging"
        :title="
          canStage
            ? `Send ${pendingDelta.changes.length} token changes to ${link?.fileName} for approval`
            : 'Nothing has changed since these tokens came from Figma'
        "
        @click="figma.stageChanges()"
      >
        <Frame :size="13" aria-hidden="true" />
        {{ staging ? 'Sending…' : `Send ${pendingDelta.changes.length} to Figma` }}
      </button>
      <span v-if="waiting && !stageError" class="stage__queue">
        <Clock :size="11" aria-hidden="true" />
        {{ waiting }} awaiting approval
      </span>
      <p v-if="stageError" class="stage__error" role="status">{{ stageError }}</p>
    </template>
  </div>
</template>

<style scoped>
.stage {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.stage__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 var(--spacing-sm);
  background: none;
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 500;
  color: var(--color-on-surface-muted);
  white-space: nowrap;
  cursor: pointer;
}
.stage__btn:hover:not(:disabled) {
  color: var(--color-on-surface);
  background-color: var(--color-surface-raised);
}
.stage__btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-interactive-focus-ring);
}
.stage__btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.stage__done {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-status-success);
  white-space: nowrap;
}

.stage__queue {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-on-surface-subtle);
  white-space: nowrap;
}

.stage__error {
  margin: 0;
  max-width: 260px;
  font-family: var(--font-sans);
  font-size: 11px;
  line-height: 1.4;
  color: var(--color-status-error);
}
</style>
