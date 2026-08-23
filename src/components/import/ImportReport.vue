<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronRight, FileWarning, Layers, Search, Sparkles } from '@lucide/vue'
import type { ImportExtraction, SignalKind } from '@design-spec/compiler'

// What the scan found — framed as a result, never as a failure.
//
// This is the "no dead-end banner" requirement made concrete. A config full of
// spreads and env vars is not an error the user has to resolve before
// continuing; it is a line in this report saying which layers needed the build
// output, next to a count of what came through. The workspace is already
// populated by the time anyone reads this.

const props = defineProps<{
  extraction: ImportExtraction
  repoFullName: string
  branch: string
  filesFetched: number
  durationMs: number
  skipped: string[]
}>()

const summary = computed(() => props.extraction.summary)
const total = computed(() => summary.value.extracted + summary.value.inferred + summary.value.defaulted)

const showAllSignals = ref(false)
const SIGNAL_PREVIEW = 6
const visibleSignals = computed(() =>
  showAllSignals.value ? props.extraction.signals : props.extraction.signals.slice(0, SIGNAL_PREVIEW),
)

const KIND_ICON: Record<SignalKind, typeof Search> = {
  parsed: Search,
  fallback: Layers,
  inferred: Sparkles,
  skipped: FileWarning,
}

const frameworks = computed(() => props.extraction.detection.frameworks.join(', '))
</script>

<template>
  <div class="report">
    <header class="report__head">
      <p class="report__title">
        Read <strong>{{ total }}</strong> tokens from
        <code>{{ repoFullName }}</code> on <code>{{ branch }}</code>
      </p>
      <p class="report__sub">
        {{ filesFetched }} file{{ filesFetched === 1 ? '' : 's' }} scanned in
        {{ (durationMs / 1000).toFixed(1) }}s · detected {{ frameworks }}
      </p>
    </header>

    <ul class="tally">
      <li class="tally__item" data-testid="tally-extracted">
        <span class="tally__n">{{ summary.extracted }}</span>
        <span class="tally__label">Extracted</span>
        <span class="tally__hint">read verbatim</span>
      </li>
      <li class="tally__item tally__item--inferred" data-testid="tally-inferred">
        <span class="tally__n">{{ summary.inferred }}</span>
        <span class="tally__label">Verify</span>
        <span class="tally__hint">inferred — worth a glance</span>
      </li>
      <li class="tally__item tally__item--defaulted" data-testid="tally-defaulted">
        <span class="tally__n">{{ summary.defaulted }}</span>
        <span class="tally__label">Review</span>
        <span class="tally__hint">baseline values</span>
      </li>
    </ul>

    <p v-if="extraction.usedFallback" class="fallback" data-testid="fallback-notice">
      <Layers :size="12" aria-hidden="true" />
      <span>
        {{ extraction.unparseableLayers.length }} config layer{{ extraction.unparseableLayers.length === 1 ? '' : 's' }}
        could not be read without running your build, so the compiled CSS was read instead. Those
        tokens are flagged <strong>Verify</strong> below.
      </span>
    </p>

    <section v-if="extraction.signals.length" class="signals">
      <h3 class="signals__title">What the scan did</h3>
      <ul class="signals__list">
        <li v-for="(s, i) in visibleSignals" :key="i" class="signal" :class="`signal--${s.kind}`">
          <component :is="KIND_ICON[s.kind]" :size="11" aria-hidden="true" />
          <span class="signal__source">{{ s.source }}</span>
          <span class="signal__msg">{{ s.message }}</span>
        </li>
      </ul>
      <button
        v-if="extraction.signals.length > SIGNAL_PREVIEW"
        class="signals__more"
        @click="showAllSignals = !showAllSignals"
      >
        <ChevronRight :size="11" :class="{ 'signals__caret--open': showAllSignals }" aria-hidden="true" />
        {{ showAllSignals ? 'Show less' : `${extraction.signals.length - SIGNAL_PREVIEW} more` }}
      </button>
    </section>

    <section v-if="skipped.length" class="signals">
      <h3 class="signals__title">Skipped</h3>
      <ul class="signals__list">
        <li v-for="(s, i) in skipped" :key="i" class="signal signal--skipped">
          <FileWarning :size="11" aria-hidden="true" />
          <span class="signal__msg">{{ s }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.report {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.report__head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.report__title {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--color-on-surface);
}
.report__title code,
.report__sub code {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-primary);
}
.report__sub {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-on-surface-muted);
}

.tally {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-sm);
  list-style: none;
  margin: 0;
  padding: 0;
}
.tally__item {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-md);
  background-color: var(--color-surface-sunken);
}
.tally__item--inferred {
  border-color: color-mix(in srgb, var(--color-status-warning) 40%, transparent);
}
.tally__n {
  font-family: var(--font-mono);
  font-size: 20px;
  color: var(--color-on-surface);
  line-height: 1.1;
}
.tally__label {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-on-surface-muted);
}
.tally__item--inferred .tally__label {
  color: var(--color-status-warning);
}
.tally__hint {
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-on-surface-subtle);
}

.fallback {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  padding: var(--spacing-sm);
  border: 1px solid color-mix(in srgb, var(--color-status-warning) 35%, transparent);
  border-radius: var(--radius-md);
  background-color: color-mix(in srgb, var(--color-status-warning) 8%, transparent);
  font-family: var(--font-sans);
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-on-surface);
}
.fallback svg {
  flex-shrink: 0;
  margin-top: 3px;
  color: var(--color-status-warning);
}

.signals__title {
  margin: 0 0 6px;
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-on-surface-subtle);
}
.signals__list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 220px;
  overflow-y: auto;
}
.signal {
  display: grid;
  grid-template-columns: 14px minmax(0, auto) minmax(0, 1fr);
  align-items: baseline;
  gap: 6px;
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-on-surface-muted);
}
.signal svg {
  color: var(--color-on-surface-subtle);
}
.signal--fallback svg,
.signal--inferred svg {
  color: var(--color-status-warning);
}
.signal__source {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-on-surface-subtle);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}
.signal__msg {
  min-width: 0;
}

.signals__more {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  background: none;
  border: none;
  padding: 2px 0;
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-on-surface-muted);
  cursor: pointer;
}
.signals__more:hover {
  color: var(--color-on-surface);
}
.signals__caret--open {
  transform: rotate(90deg);
}
</style>
