<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useHead } from '@unhead/vue'
import { ArrowLeft, Check, ChevronUp, Loader, Sparkles, Zap } from '@lucide/vue'
import { RouterLink } from 'vue-router'
import { useFeatureStore } from '@/stores/useFeatureStore'
import type { FeatureStatus } from '@/utils/api'

// The feature board. Vote weight is a membership benefit: Free counts once, Pro
// counts five times (architecture-plan.md §12). Everything here reads that
// number off the API — nothing on this page multiplies anything by five.
//
// The dedup flow is the reason the submit form is below the suggestions rather
// than above them: somebody typing "dark mode" should see the request that
// already exists before they see the button that files a second one.

useHead({ title: 'Feature Requests — Design Spec' })

const store = useFeatureStore()
const {
  requests,
  similar,
  statusFilter,
  loading,
  loadingMore,
  submitting,
  voting,
  probing,
  dedupAvailable,
  error,
  draftTitle,
  draftDescription,
  available,
  signedIn,
  hasMore,
  voteWeight,
  showUpsell,
} = storeToRefs(store)

const composing = ref(false)
const filed = ref(false)

const FILTERS: { label: string; value: FeatureStatus | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Open', value: 'open' },
  { label: 'Planned', value: 'planned' },
  { label: 'In progress', value: 'in-progress' },
  { label: 'Shipped', value: 'done' },
]

const STATUS_LABEL: Record<FeatureStatus, string> = {
  open: 'Open',
  planned: 'Planned',
  'in-progress': 'In progress',
  done: 'Shipped',
  declined: 'Declined',
}

const canSubmit = computed(
  () => draftTitle.value.trim().length >= 8 && !submitting.value && signedIn.value,
)

function openComposer() {
  composing.value = true
  filed.value = false
}

function closeComposer() {
  composing.value = false
  store.resetDraft()
}

function onTitleInput(event: Event) {
  draftTitle.value = (event.target as HTMLInputElement).value
  store.probeSimilar(draftTitle.value)
}

async function file() {
  const created = await store.submit()
  if (created) {
    composing.value = false
    filed.value = true
  }
}

/** Voting on a suggestion is the whole point of showing it — then get out. */
async function voteOnSuggestion(id: string) {
  await store.vote(id)
  closeComposer()
}

onMounted(() => store.init())
onUnmounted(() => store.cancelProbe())
</script>

<template>
  <main class="board">
    <header class="board__head">
      <RouterLink to="/workspace" class="board__back">
        <ArrowLeft :size="14" aria-hidden="true" />
        Workspace
      </RouterLink>
      <h1 class="board__title">Feature Requests</h1>
      <p class="board__lede">
        Vote on what gets built next. Every account votes once per request; a Pro Team seat is
        worth five.
      </p>
    </header>

    <p v-if="!available" class="board__offline">
      The feature board needs a Design Spec backend. Everything else in this build runs entirely in
      your browser.
    </p>

    <template v-else>
      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <div class="board__bar">
        <nav class="filters" aria-label="Filter by status">
          <button
            v-for="f in FILTERS"
            :key="f.value"
            class="filter"
            :class="{ 'filter--on': statusFilter === f.value }"
            :aria-pressed="statusFilter === f.value"
            @click="store.setStatus(f.value)"
          >
            {{ f.label }}
          </button>
        </nav>

        <button
          v-if="signedIn && !composing"
          class="btn btn--primary"
          data-testid="open-composer"
          @click="openComposer"
        >
          Request a feature
        </button>
      </div>

      <p v-if="filed" class="board__filed" role="status">
        Filed, and your vote is on it.
      </p>

      <!-- Composer. Suggestions come first: the point is to find the request
           that already exists before filing a second one. -->
      <section v-if="composing" class="composer" aria-label="New feature request">
        <label class="field">
          <span class="field__label">What should we build?</span>
          <input
            :value="draftTitle"
            class="input"
            type="text"
            maxlength="200"
            placeholder="Tailwind v4 @theme output"
            data-testid="request-title"
            @input="onTitleInput"
          />
        </label>

        <div v-if="probing" class="composer__probing">
          <Loader :size="12" aria-hidden="true" />
          Checking for existing requests…
        </div>

        <section v-if="similar.length" class="suggestions" data-testid="similar">
          <h2 class="suggestions__title">
            <Sparkles :size="13" aria-hidden="true" />
            Already asked — vote instead of filing a duplicate
          </h2>
          <ul class="suggestions__list">
            <li v-for="s in similar" :key="s.id" class="suggestion">
              <button
                class="vote"
                :class="{ 'vote--cast': s.viewer_vote }"
                :disabled="!!s.viewer_vote || voting === s.id"
                :data-testid="`vote-similar-${s.id}`"
                @click="voteOnSuggestion(s.id)"
              >
                <Check v-if="s.viewer_vote" :size="12" aria-hidden="true" />
                <ChevronUp v-else :size="14" aria-hidden="true" />
                <span class="vote__count">{{ s.vote_count }}</span>
              </button>
              <div class="suggestion__body">
                <p class="suggestion__title">{{ s.title }}</p>
                <p class="suggestion__meta">
                  <span class="status" :class="`status--${s.status}`">{{ STATUS_LABEL[s.status] }}</span>
                  <span v-if="s.viewer_vote">You voted</span>
                </p>
              </div>
            </li>
          </ul>
        </section>

        <p v-else-if="!dedupAvailable && draftTitle.trim().length >= 8" class="composer__fine">
          Duplicate checking is off on this deployment — have a scan of the board below before you
          file.
        </p>

        <label class="field">
          <span class="field__label">Anything else? <span class="field__hint">optional</span></span>
          <textarea
            v-model="draftDescription"
            class="input input--area"
            rows="3"
            maxlength="4000"
            placeholder="What it would unblock, and what you do today instead."
            data-testid="request-description"
          />
        </label>

        <div class="composer__actions">
          <button
            class="btn btn--primary"
            :disabled="!canSubmit"
            data-testid="file-request"
            @click="file"
          >
            File it — and vote {{ voteWeight }}×
          </button>
          <button class="btn btn--ghost" @click="closeComposer">Cancel</button>
        </div>
      </section>

      <p v-if="showUpsell" class="upsell">
        <Zap :size="13" aria-hidden="true" />
        Your votes count once. A Pro Team seat makes them count five times — it comes with the
        plan, there's no separate vote pass.
        <RouterLink to="/settings" class="upsell__link">See Pro Team</RouterLink>
      </p>

      <p v-if="loading" class="board__empty">Loading the board…</p>

      <ul v-else-if="requests.length" class="requests" data-testid="board">
        <li v-for="r in requests" :key="r.id" class="request">
          <button
            class="vote"
            :class="{ 'vote--cast': r.viewer_vote }"
            :disabled="!signedIn || !!r.viewer_vote || voting === r.id"
            :title="signedIn ? undefined : 'Connect GitHub to vote'"
            :data-testid="`vote-${r.id}`"
            @click="store.vote(r.id)"
          >
            <Check v-if="r.viewer_vote" :size="12" aria-hidden="true" />
            <ChevronUp v-else :size="14" aria-hidden="true" />
            <span class="vote__count">{{ r.vote_count }}</span>
          </button>

          <div class="request__body">
            <p class="request__title">{{ r.title }}</p>
            <p v-if="r.description" class="request__desc">{{ r.description }}</p>
            <p class="request__meta">
              <span class="status" :class="`status--${r.status}`">{{ STATUS_LABEL[r.status] }}</span>
              <span class="mono">{{ r.author }}</span>
              <span v-if="r.viewer_vote">You voted {{ r.viewer_vote.weight }}×</span>
            </p>
          </div>
        </li>
      </ul>

      <p v-else class="board__empty">
        Nothing on the board yet. <template v-if="signedIn">Be the first to ask.</template>
      </p>

      <div v-if="hasMore" class="board__more">
        <button class="btn btn--ghost" :disabled="loadingMore" @click="store.loadMore()">
          {{ loadingMore ? 'Loading…' : 'Load more' }}
        </button>
      </div>
    </template>
  </main>
</template>

<style scoped>
.board {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  width: min(760px, 100%);
  margin: 0 auto;
  padding: var(--spacing-xl) var(--spacing-md) var(--spacing-3xl);
  min-height: 100dvh;
  background-color: var(--color-surface-page);
}

.board__head {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.board__back {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--color-on-surface-muted);
  text-decoration: none;
}

.board__back:hover {
  color: var(--color-on-surface);
}

.board__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 32px;
  font-weight: 400;
  color: var(--color-on-surface);
}

.board__lede {
  margin: 0;
  max-width: 60ch;
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-on-surface-muted);
}

.board__offline,
.board__empty {
  margin: var(--spacing-lg) 0;
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-on-surface-muted);
}

.board__filed {
  margin: 0;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-md);
  background-color: var(--color-surface-sunken);
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--color-status-success);
}

.error {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--color-status-error);
}

.board__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.filter {
  padding: 4px 10px;
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  background: none;
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-on-surface-subtle);
  cursor: pointer;
  transition: color var(--transition-duration-fast) var(--transition-easing-ease-out);
}

.filter:hover {
  color: var(--color-on-surface);
}

.filter--on {
  border-color: var(--color-surface-border);
  background-color: var(--color-surface-raised);
  color: var(--color-on-surface);
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  height: 34px;
  padding: 0 var(--spacing-md);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-family: var(--font-sans);
  font-size: 13px;
  cursor: pointer;
  transition: background-color var(--transition-duration-fast) var(--transition-easing-ease-out);
}

.btn:disabled {
  opacity: 0.38;
  pointer-events: none;
}

.btn--primary {
  background-color: var(--color-primary);
  color: var(--color-on-primary);
}

.btn--primary:hover {
  background-color: var(--color-primary-glow);
}

.btn--ghost {
  background: none;
  color: var(--color-on-surface-muted);
}

.btn--ghost:hover {
  color: var(--color-on-surface);
  background-color: var(--color-surface-raised);
}

.composer {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-lg);
  background-color: var(--color-surface-default);
}

.composer__probing,
.composer__fine {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin: 0;
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-on-surface-subtle);
}

.composer__actions {
  display: flex;
  gap: var(--spacing-sm);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.field__label {
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--color-on-surface);
}

.field__hint {
  color: var(--color-on-surface-subtle);
}

.input {
  padding: var(--spacing-sm);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-md);
  background-color: var(--color-surface-sunken);
  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--color-on-surface);
}

.input:focus-visible {
  outline: 2px solid var(--color-interactive-focus-ring);
  outline-offset: 1px;
}

.input--area {
  resize: vertical;
  line-height: 1.6;
}

.suggestions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-md);
  background-color: var(--color-surface-sunken);
}

.suggestions__title {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin: 0;
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 500;
  color: var(--color-on-surface-muted);
}

.suggestions__list,
.requests {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin: 0;
  padding: 0;
  list-style: none;
}

.suggestion,
.request {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
}

.request {
  padding: var(--spacing-md);
  border: 1px solid var(--color-surface-border-subtle);
  border-radius: var(--radius-md);
  background-color: var(--color-surface-default);
}

.vote {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 48px;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-md);
  background-color: var(--color-surface-raised);
  font-family: var(--font-mono);
  color: var(--color-on-surface);
  cursor: pointer;
  transition: border-color var(--transition-duration-fast) var(--transition-easing-ease-out);
}

.vote:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.vote:disabled {
  cursor: default;
}

.vote--cast {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.vote__count {
  font-size: 13px;
}

.suggestion__body,
.request__body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  min-width: 0;
}

.suggestion__title,
.request__title {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--color-on-surface);
}

.request__desc {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-on-surface-muted);
}

.suggestion__meta,
.request__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
  margin: 0;
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-on-surface-subtle);
}

.status {
  padding: 1px 8px;
  border-radius: var(--radius-full);
  background-color: var(--color-surface-raised);
  font-size: 11px;
  color: var(--color-on-surface-muted);
}

.status--planned {
  color: var(--color-status-info);
}

.status--in-progress {
  color: var(--color-status-warning);
}

.status--done {
  color: var(--color-status-success);
}

.status--declined {
  color: var(--color-on-surface-subtle);
}

.mono {
  font-family: var(--font-mono);
}

.upsell {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-xs);
  margin: 0;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-md);
  background-color: var(--color-surface-sunken);
  font-family: var(--font-sans);
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-on-surface-muted);
}

.upsell svg {
  color: var(--color-primary);
}

.upsell__link {
  color: var(--color-primary);
  text-decoration: none;
}

.upsell__link:hover {
  text-decoration: underline;
}

.board__more {
  display: flex;
  justify-content: center;
}
</style>
