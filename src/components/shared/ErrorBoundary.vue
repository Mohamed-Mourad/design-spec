<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import { captureError } from '@/utils/telemetry'
import { useErrorReport } from '@/composables/useErrorReport'

const store = useDesignSystemStore()
const { actionTrace } = storeToRefs(store)
const { openReport } = useErrorReport()

const error = ref<Error | null>(null)

onErrorCaptured((err: Error) => {
  error.value = err
  captureError(err, {
    actionTrace: actionTrace.value.slice(-20),
    schemaName: store.schema.name,
  })
  return false
})
</script>

<template>
  <slot v-if="!error" />
  <div v-else class="error-boundary">
    <p class="error-boundary__message">Something went wrong in this panel.</p>
    <div class="error-boundary__actions">
      <button class="error-boundary__btn error-boundary__btn--retry" @click="error = null">
        Try again
      </button>
      <button
        class="error-boundary__btn error-boundary__btn--report"
        @click="openReport(error!, actionTrace.slice(-20))"
      >
        Report problem
      </button>
    </div>
  </div>
</template>

<style scoped>
.error-boundary {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  height: 100%;
  padding: var(--spacing-xl);
  background-color: var(--color-surface-default);
}

.error-boundary__message {
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--color-on-surface-muted);
  margin: 0;
}

.error-boundary__actions {
  display: flex;
  gap: var(--spacing-sm);
}

.error-boundary__btn {
  display: inline-flex;
  align-items: center;
  border-radius: var(--radius-md);
  padding: 6px 14px;
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--color-surface-border);
  transition: background-color var(--transition-duration-fast) var(--transition-easing-ease-out);
}

.error-boundary__btn--retry {
  background-color: var(--color-surface-raised);
  color: var(--color-on-surface);
}

.error-boundary__btn--retry:hover {
  background-color: var(--color-surface-overlay);
}

.error-boundary__btn--report {
  background-color: transparent;
  color: var(--color-on-surface-muted);
}

.error-boundary__btn--report:hover {
  color: var(--color-on-surface);
  background-color: var(--color-surface-raised);
}
</style>
