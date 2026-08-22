<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { MessageSquareWarning } from '@lucide/vue'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import { useErrorReport } from '@/composables/useErrorReport'

// Always-available trigger for proactively reporting weird/unexpected behavior
// that did NOT throw (crashes are captured automatically by the ErrorBoundary).
// Opens the shared report modal in `behavior` mode with the recent action trace.
const store = useDesignSystemStore()
const { actionTrace } = storeToRefs(store)
const { openBehaviorReport } = useErrorReport()

function launch() {
  openBehaviorReport(actionTrace.value.slice(-20))
}
</script>

<template>
  <button class="report-launcher" aria-label="Report unexpected behavior" @click="launch">
    <MessageSquareWarning :size="15" aria-hidden="true" />
    <span class="report-launcher__label">Report</span>
  </button>
</template>

<style scoped>
.report-launcher {
  position: fixed;
  right: var(--spacing-lg);
  bottom: var(--spacing-lg);
  z-index: var(--z-sticky, 1100);
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-height: 36px;
  padding: 0 12px;
  background-color: var(--color-surface-overlay);
  color: var(--color-on-surface-muted);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-md);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.report-launcher:hover {
  color: var(--color-on-surface);
  background-color: var(--color-surface-raised);
}

.report-launcher:focus-visible {
  outline: none;
  border-color: var(--color-interactive-focus-ring);
  box-shadow: 0 0 0 2px var(--color-interactive-focus-ring);
}

@media (prefers-reduced-motion: no-preference) {
  .report-launcher {
    transition:
      color var(--transition-duration-fast) var(--transition-easing-ease-out),
      background-color var(--transition-duration-fast) var(--transition-easing-ease-out);
  }
}
</style>
