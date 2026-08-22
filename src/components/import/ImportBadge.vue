<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { Github, X } from '@lucide/vue'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import ImportReport from '@/components/import/ImportReport.vue'
import type { ImportExtraction } from '@design-spec/compiler'

// A quiet marker in the header saying where this workspace came from, and how
// many tokens still want a human glance.
//
// It counts down as flags are cleared and disappears at zero, so it reads as
// progress rather than as an alarm. It is never modal and never blocks the
// editors — the workspace is fully usable from the moment the import lands.

const store = useDesignSystemStore()
const { importProvenance, pendingReview } = storeToRefs(store)

const open = ref(false)

/** The report component wants an extraction; rebuild one from what we stored. */
const extraction = computed<ImportExtraction | null>(() => {
  const p = importProvenance.value
  if (!p) return null
  let extracted = 0
  let inferred = 0
  let defaulted = 0
  for (const tokens of Object.values(p.states)) {
    for (const state of Object.values(tokens)) {
      if (state === 'extracted') extracted++
      else if (state === 'inferred') inferred++
      else defaulted++
    }
  }
  return {
    schema: store.schema,
    states: p.states,
    summary: { extracted, inferred, defaulted },
    signals: p.signals,
    detection: { frameworks: store.schema.export.frameworks, signals: [], hasTailwind: false },
    usedFallback: p.usedFallback,
    unparseableLayers: p.unparseableLayers,
  } as ImportExtraction
})
</script>

<template>
  <template v-if="importProvenance">
    <button class="badge" :class="{ 'badge--clear': pendingReview.total === 0 }" @click="open = true">
      <Github :size="12" aria-hidden="true" />
      <span class="badge__repo">{{ importProvenance.repoFullName }}</span>
      <span v-if="pendingReview.total > 0" class="badge__count">{{ pendingReview.total }} to check</span>
      <span v-else class="badge__count">all checked</span>
    </button>

    <div v-if="open && extraction" class="overlay" role="dialog" aria-modal="true" aria-label="Import report" @click.self="open = false">
      <div class="sheet">
        <header class="sheet__head">
          <h2 class="sheet__title">Import report</h2>
          <button class="sheet__close" aria-label="Close" @click="open = false">
            <X :size="15" aria-hidden="true" />
          </button>
        </header>
        <div class="sheet__body">
          <ImportReport
            :extraction="extraction"
            :repo-full-name="importProvenance.repoFullName"
            :branch="importProvenance.branch"
            :files-fetched="0"
            :duration-ms="0"
            :skipped="[]"
          />
          <p class="sheet__note">
            {{ pendingReview.inferred }} inferred and {{ pendingReview.defaulted }} baseline tokens
            still carry a chip. Editing a token — or clicking its chip — clears it.
          </p>
        </div>
        <footer class="sheet__foot">
          <button class="sheet__dismiss" @click="store.dismissImport(); open = false">
            Clear all flags
          </button>
        </footer>
      </div>
    </div>
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
  border: 1px solid color-mix(in srgb, var(--color-status-warning) 40%, transparent);
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
.badge--clear {
  border-color: var(--color-surface-border);
}
.badge__repo {
  font-family: var(--font-mono);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.badge__count {
  color: var(--color-status-warning);
  white-space: nowrap;
}
.badge--clear .badge__count {
  color: var(--color-on-surface-subtle);
}

.overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
  background-color: color-mix(in srgb, var(--color-surface-page) 78%, transparent);
}
.sheet {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 520px;
  max-height: min(80dvh, 700px);
  background-color: var(--color-surface-default);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}
.sheet__head {
  display: flex;
  align-items: center;
  height: 44px;
  padding: 0 var(--spacing-md);
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-surface-border);
}
.sheet__title {
  flex: 1;
  margin: 0;
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 400;
  color: var(--color-on-surface);
}
.sheet__close {
  display: inline-flex;
  min-width: 28px;
  min-height: 28px;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-on-surface-muted);
  cursor: pointer;
}
.sheet__close:hover {
  color: var(--color-on-surface);
  background-color: var(--color-surface-raised);
}
.sheet__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
.sheet__note {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 11px;
  line-height: 1.5;
  color: var(--color-on-surface-subtle);
}
.sheet__foot {
  display: flex;
  justify-content: flex-end;
  padding: var(--spacing-sm) var(--spacing-md);
  flex-shrink: 0;
  border-top: 1px solid var(--color-surface-border);
}
.sheet__dismiss {
  min-height: 30px;
  padding: 0 var(--spacing-sm);
  background: none;
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-on-surface-muted);
  cursor: pointer;
}
.sheet__dismiss:hover {
  color: var(--color-on-surface);
  background-color: var(--color-surface-raised);
}
</style>
