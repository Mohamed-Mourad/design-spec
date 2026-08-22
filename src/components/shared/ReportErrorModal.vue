<script setup lang="ts">
import { ref, computed } from 'vue'
import { useErrorReport } from '@/composables/useErrorReport'
import { captureUserReport } from '@/utils/telemetry'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'

const { isOpen, capturedError, capturedTrace, capturedKind, closeReport } = useErrorReport()
const store = useDesignSystemStore()

const message = ref('')
const submitted = ref(false)

const isBehavior = computed(() => capturedKind.value === 'behavior')
const title = computed(() => (isBehavior.value ? 'Report unexpected behavior' : 'Report a problem'))
const hint = computed(() =>
  isBehavior.value
    ? 'Describe what seemed off or unexpected — what you expected vs. what happened. Your recent action history is included automatically.'
    : 'Describe what you were doing when the error occurred. Your recent action history will be included automatically.',
)
const placeholder = computed(() =>
  isBehavior.value ? 'What did you expect, and what happened instead?' : 'Optional: describe what happened...',
)
// A behavior report has no error attached — the typed comment IS the report, so
// require it. An error report can be sent with the trace alone.
const canSubmit = computed(() => !isBehavior.value || message.value.trim().length > 0)

function submit() {
  if (!canSubmit.value) return
  captureUserReport(
    message.value.trim(),
    capturedError.value,
    {
      actionTrace: capturedTrace.value,
      schemaName: store.schema.name,
      frameworks: store.schema.export.frameworks,
    },
    capturedKind.value,
  )
  submitted.value = true
  setTimeout(() => {
    closeReport()
    submitted.value = false
    message.value = ''
  }, 2000)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeReport()
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="modal-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-title"
      @keydown="handleKeydown"
      @click.self="closeReport"
    >
      <div class="modal">
        <div v-if="submitted" class="modal__submitted">
          <p class="modal__submitted-text">Report sent. Thank you.</p>
        </div>

        <template v-else>
          <header class="modal__header">
            <h2 id="report-title" class="modal__title">{{ title }}</h2>
            <button class="modal__close" aria-label="Close" @click="closeReport">✕</button>
          </header>

          <div class="modal__body">
            <p class="modal__hint">{{ hint }}</p>
            <textarea
              v-model="message"
              class="modal__textarea"
              :placeholder="placeholder"
              rows="4"
              autofocus
            />
            <details class="modal__trace" v-if="capturedTrace.length">
              <summary class="modal__trace-summary">Action trace ({{ capturedTrace.length }} entries)</summary>
              <pre class="modal__trace-content">{{ JSON.stringify(capturedTrace.slice(-10), null, 2) }}</pre>
            </details>
          </div>

          <footer class="modal__footer">
            <button class="modal__btn modal__btn--cancel" @click="closeReport">Cancel</button>
            <button class="modal__btn modal__btn--submit" :disabled="!canSubmit" @click="submit">Send Report</button>
          </footer>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-scrim {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--spacing-lg);
}

.modal {
  background-color: var(--color-surface-overlay);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 480px;
  box-shadow: var(--shadow-xl);
}

.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg) var(--spacing-lg) 0;
}

.modal__title {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 400;
  color: var(--color-on-surface);
  margin: 0;
}

.modal__close {
  background: none;
  border: none;
  color: var(--color-on-surface-muted);
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
  border-radius: var(--radius-sm);
  line-height: 1;
}

.modal__close:hover {
  color: var(--color-on-surface);
  background-color: var(--color-surface-raised);
}

.modal__body {
  padding: var(--spacing-md) var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.modal__hint {
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--color-on-surface-muted);
  margin: 0;
  line-height: 1.5;
}

.modal__textarea {
  width: 100%;
  background-color: var(--color-surface-sunken);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm) 10px;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--color-on-surface);
  resize: vertical;
  outline: none;
  box-sizing: border-box;
  transition: border-color var(--transition-duration-fast) var(--transition-easing-ease-out);
}

.modal__textarea:focus {
  border-color: var(--color-interactive-focus-ring);
}

.modal__trace {
  font-family: var(--font-mono);
  font-size: 11px;
}

.modal__trace-summary {
  color: var(--color-on-surface-subtle);
  cursor: pointer;
  user-select: none;
}

.modal__trace-content {
  margin: var(--spacing-xs) 0 0;
  padding: var(--spacing-sm);
  background-color: var(--color-surface-sunken);
  border-radius: var(--radius-sm);
  color: var(--color-on-surface-muted);
  overflow-x: auto;
  font-size: 10px;
  line-height: 1.5;
}

.modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  padding: 0 var(--spacing-lg) var(--spacing-lg);
}

.modal__btn {
  display: inline-flex;
  align-items: center;
  border-radius: var(--radius-md);
  padding: 7px 16px;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--color-surface-border);
  transition: background-color var(--transition-duration-fast) var(--transition-easing-ease-out);
}

.modal__btn--cancel {
  background-color: transparent;
  color: var(--color-on-surface-muted);
}

.modal__btn--cancel:hover {
  background-color: var(--color-surface-raised);
  color: var(--color-on-surface);
}

.modal__btn--submit {
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  border-color: transparent;
}

.modal__btn--submit:hover:not(:disabled) {
  background-color: var(--color-primary-glow);
}

.modal__btn--submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal__submitted {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-2xl);
}

.modal__submitted-text {
  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--color-status-success);
  margin: 0;
}
</style>
