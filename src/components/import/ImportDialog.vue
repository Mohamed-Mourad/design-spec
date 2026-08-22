<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ArrowLeft, GitBranch, Github, Lock, Search, Terminal, X } from '@lucide/vue'
import { useImportStore } from '@/stores/useImportStore'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import ImportReport from '@/components/import/ImportReport.vue'
import RetrofitPushButton from '@/components/import/RetrofitPushButton.vue'
import type { DesignSystemSchema } from '@/types/schema'

// Connect → pick a repo → pick a branch → scan → review → apply.
//
// Every step forward is optional and every step back is available; nothing here
// can leave the user stuck. The Free cap and a missing `repo` scope both render
// as an offer (upgrade, or escalate the grant, or use the unmetered CLI) rather
// than as a wall.

const emit = defineEmits<{ close: [] }>()

const imports = useImportStore()
const { step, busy, error, capReached, repos, reposCursor, repoQuery, selectedRepo, branches, selectedBranch, result, connected, canPush, login } =
  storeToRefs(imports)
const design = useDesignSystemStore()

const query = ref('')
let searchTimer: ReturnType<typeof setTimeout> | undefined

onMounted(async () => {
  await imports.init()
  if (connected.value && repos.value.length === 0) await imports.loadRepos()
})

// Server-side filtering is one page deep, so debounce rather than fire per key.
watch(query, (q) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    repoQuery.value = q
    if (connected.value) void imports.loadRepos()
  }, 300)
})

const needsEscalation = computed(() => selectedRepo.value?.private === true && !canPush.value)

function applyToWorkspace() {
  const scanned = result.value
  if (!scanned) return
  design.applyImport(scanned.extraction.schema as DesignSystemSchema, {
    repoFullName: scanned.repoFullName,
    branch: scanned.branch,
    commitSha: scanned.commitSha,
    importSessionId: scanned.sessionId,
    signals: scanned.extraction.signals,
    usedFallback: scanned.extraction.usedFallback,
    unparseableLayers: scanned.extraction.unparseableLayers,
    states: scanned.extraction.states,
    scannedAt: Date.now(),
  })
  emit('close')
}

function back() {
  if (step.value === 'review') step.value = 'pick-branch'
  else if (step.value === 'pick-branch') step.value = 'pick-repo'
}
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" aria-label="Import from GitHub" @click.self="emit('close')">
    <div class="dialog">
      <header class="dialog__head">
        <button v-if="step === 'pick-branch' || step === 'review'" class="dialog__back" aria-label="Back" @click="back">
          <ArrowLeft :size="14" aria-hidden="true" />
        </button>
        <h2 class="dialog__title">
          <Github :size="15" aria-hidden="true" />
          Import from GitHub
        </h2>
        <span v-if="login" class="dialog__login">{{ login }}</span>
        <button class="dialog__close" aria-label="Close" @click="emit('close')">
          <X :size="15" aria-hidden="true" />
        </button>
      </header>

      <div class="dialog__body">
        <!-- Backend not configured: say so plainly and point at the unmetered path. -->
        <div v-if="!imports.available" class="notice">
          <p class="notice__title">Cloud import isn't enabled in this build.</p>
          <p class="notice__text">
            The local CLI does the same scan on your machine, with no account and no limits:
          </p>
          <code class="notice__code">npx design-spec init</code>
        </div>

        <template v-else>
          <p v-if="error" class="error" role="alert">{{ error }}</p>

          <!-- Free cap: an offer, not a dead end. -->
          <div v-if="capReached" class="notice notice--cap">
            <p class="notice__title">You've used your 2 cloud scans this month.</p>
            <p class="notice__text">
              Pro Team makes cloud scans unlimited. The local CLI is unmetered on any plan and runs
              the same extraction on your machine — it can also read configs the cloud scanner can't,
              because it may evaluate your own JavaScript.
            </p>
            <code class="notice__code"><Terminal :size="11" aria-hidden="true" /> npx design-spec init</code>
          </div>

          <!-- Step: connect -->
          <div v-else-if="step === 'connect'" class="step">
            <p class="step__lead">
              Connect GitHub to scan a repository. Design Spec reads your files to extract tokens and
              stores none of them — only the design system it synthesizes.
            </p>
            <button class="btn btn--primary" :disabled="busy" @click="imports.connect(false)">
              <Github :size="14" aria-hidden="true" />
              Connect GitHub
            </button>
            <p class="step__fine">
              Starts with read access to your public repositories. Private repos and pull requests
              ask for permission separately, when you need them.
            </p>
          </div>

          <!-- Step: pick a repo -->
          <div v-else-if="step === 'pick-repo'" class="step">
            <label class="search">
              <Search :size="13" aria-hidden="true" />
              <input v-model="query" type="search" placeholder="Filter repositories" aria-label="Filter repositories" />
            </label>

            <ul v-if="repos.length" class="list">
              <li v-for="repo in repos" :key="repo.full_name">
                <button class="row" :disabled="busy" @click="imports.selectRepo(repo)">
                  <span class="row__name">{{ repo.full_name }}</span>
                  <Lock v-if="repo.private" :size="11" class="row__lock" aria-label="Private" />
                  <span class="row__meta">{{ repo.default_branch }}</span>
                </button>
              </li>
            </ul>
            <p v-else-if="!busy" class="empty">No repositories matched.</p>

            <button v-if="reposCursor" class="btn btn--ghost" :disabled="busy" @click="imports.loadRepos(true)">
              Load more
            </button>
          </div>

          <!-- Step: pick a branch -->
          <div v-else-if="step === 'pick-branch'" class="step">
            <p class="step__lead">
              <code>{{ selectedRepo?.full_name }}</code>
            </p>

            <div v-if="needsEscalation" class="notice">
              <p class="notice__title">This repository is private.</p>
              <p class="notice__text">Grant repository access to scan it.</p>
              <button class="btn btn--primary" @click="imports.connect(true)">
                <Github :size="14" aria-hidden="true" />
                Grant repository access
              </button>
            </div>

            <template v-else>
              <label class="field">
                <span class="field__label"><GitBranch :size="12" aria-hidden="true" /> Branch</span>
                <select v-model="selectedBranch" class="field__select">
                  <option v-for="b in branches" :key="b.name" :value="b.name">{{ b.name }}</option>
                </select>
              </label>
              <button class="btn btn--primary" :disabled="busy || !selectedBranch" @click="imports.scan()">
                Scan repository
              </button>
            </template>
          </div>

          <!-- Step: scanning -->
          <div v-else-if="step === 'scanning'" class="step step--center">
            <div class="spinner" aria-hidden="true" />
            <p class="step__lead">Reading <code>{{ selectedRepo?.full_name }}</code>…</p>
            <p class="step__fine">File by file over the Contents API — no clone, nothing stored.</p>
          </div>

          <!-- Step: review -->
          <div v-else-if="step === 'review' && result" class="step">
            <ImportReport
              :extraction="result.extraction"
              :repo-full-name="result.repoFullName"
              :branch="result.branch"
              :files-fetched="result.filesFetched"
              :duration-ms="result.durationMs"
              :skipped="result.skipped"
            />
            <p v-if="!result.quota.unlimited" class="quota">
              {{ result.quota.runs_used }} of {{ result.quota.runs_limit }} cloud scans used this month.
            </p>
          </div>
        </template>
      </div>

      <footer v-if="step === 'review' && result" class="dialog__foot">
        <RetrofitPushButton />
        <button class="btn btn--primary" @click="applyToWorkspace">Populate workspace</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
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

.dialog {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 560px;
  max-height: min(80dvh, 720px);
  background-color: var(--color-surface-default);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.dialog__head {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 0 var(--spacing-md);
  height: 48px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-surface-border);
}
.dialog__title {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  margin: 0;
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 400;
  color: var(--color-on-surface);
}
.dialog__login {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-on-surface-subtle);
}
.dialog__back,
.dialog__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  min-height: 28px;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-on-surface-muted);
  cursor: pointer;
}
.dialog__back:hover,
.dialog__close:hover {
  color: var(--color-on-surface);
  background-color: var(--color-surface-raised);
}

.dialog__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--spacing-md);
}

.dialog__foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  flex-shrink: 0;
  border-top: 1px solid var(--color-surface-border);
}

.step {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
.step--center {
  align-items: center;
  text-align: center;
  padding: var(--spacing-xl) 0;
}
.step__lead {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.55;
  color: var(--color-on-surface);
}
.step__lead code,
.notice__text code {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-primary);
}
.step__fine {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 11px;
  line-height: 1.5;
  color: var(--color-on-surface-subtle);
}

.search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 var(--spacing-sm);
  background-color: var(--color-surface-sunken);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  color: var(--color-on-surface-subtle);
}
.search input {
  flex: 1;
  min-height: 32px;
  background: none;
  border: none;
  outline: none;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--color-on-surface);
}

.list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 320px;
  overflow-y: auto;
}
.row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
  min-height: 36px;
  padding: 0 var(--spacing-sm);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-align: left;
}
.row:hover:not(:disabled) {
  background-color: var(--color-surface-raised);
}
.row:disabled {
  opacity: 0.5;
  cursor: default;
}
.row__name {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row__lock {
  color: var(--color-on-surface-subtle);
  flex-shrink: 0;
}
.row__meta {
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-on-surface-subtle);
  flex-shrink: 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field__label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-on-surface-subtle);
}
.field__select {
  min-height: 34px;
  padding: 0 var(--spacing-sm);
  background-color: var(--color-surface-sunken);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-on-surface);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 var(--spacing-md);
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-interactive-focus-ring);
}
.btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.btn--primary {
  background-color: var(--color-primary);
  color: var(--color-on-primary);
}
.btn--primary:hover:not(:disabled) {
  background-color: var(--color-primary-glow);
}
.btn--ghost {
  background: none;
  border-color: var(--color-surface-border);
  color: var(--color-on-surface-muted);
}
.btn--ghost:hover:not(:disabled) {
  color: var(--color-on-surface);
  background-color: var(--color-surface-raised);
}

.notice {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-md);
  background-color: var(--color-surface-sunken);
}
.notice--cap {
  border-color: color-mix(in srgb, var(--color-status-warning) 35%, transparent);
}
.notice__title {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-on-surface);
}
.notice__text {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 12px;
  line-height: 1.55;
  color: var(--color-on-surface-muted);
}
.notice__code {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: var(--radius-sm);
  background-color: var(--color-surface-page);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-on-surface);
}

.error {
  margin: 0 0 var(--spacing-md);
  padding: var(--spacing-sm);
  border: 1px solid color-mix(in srgb, var(--color-status-error) 45%, transparent);
  border-radius: var(--radius-sm);
  background-color: color-mix(in srgb, var(--color-status-error) 10%, transparent);
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-on-surface);
}

.empty,
.quota {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-on-surface-subtle);
}

.spinner {
  width: 22px;
  height: 22px;
  border: 2px solid var(--color-surface-border);
  border-top-color: var(--color-primary);
  border-radius: var(--radius-full);
}
@media (prefers-reduced-motion: no-preference) {
  .spinner {
    animation: spin 800ms linear infinite;
  }
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
