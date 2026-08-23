<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { Check, Frame, Info, Lock, ShieldCheck, X } from '@lucide/vue'
import { useFigmaStore } from '@/stores/useFigmaStore'
import { maskedPat } from '@/utils/figma/pat'

// Paste a file link, paste a token, read the tokens, decide what to do with
// them. Two screens: the form, and the summary of what was read.
//
// The token field is the only place in the app that takes a Figma PAT, and the
// copy says plainly where it goes — the browser calls Figma directly, so this
// is a claim the network tab can check.

const emit = defineEmits<{ close: [] }>()

const figma = useFigmaStore()
const { busy, error, fileInput, imported, file, isPro, link, mergeMode, canImport } =
  storeToRefs(figma)

/** Typing a new token is a deliberate act; a stored one shows masked. */
const editingPat = ref(!figma.hasPat)
const patDraft = ref('')

onMounted(async () => {
  await figma.init()
  figma.reset()
})

const groups = computed(() => {
  const result = imported.value
  if (!result) return []
  return [
    { label: 'Colors', count: Object.keys(result.colors).length },
    { label: 'Typography', count: Object.keys(result.typography).length },
    { label: 'Shadows', count: Object.keys(result.shadows).length },
    { label: 'Spacing', count: Object.keys(result.spacing).length },
    { label: 'Radius', count: Object.keys(result.rounded).length },
    { label: 'Dark mode', count: Object.keys(result.darkColors).length },
  ].filter((g) => g.count > 0)
})

function savePat() {
  if (!patDraft.value.trim()) return
  figma.rememberPat(patDraft.value)
  patDraft.value = ''
  editingPat.value = false
}

function changePat() {
  editingPat.value = true
  patDraft.value = ''
}

function forget() {
  figma.forgetPat()
  editingPat.value = true
}

function apply() {
  if (figma.applyToWorkspace()) emit('close')
}
</script>

<template>
  <div
    class="overlay"
    role="dialog"
    aria-modal="true"
    aria-label="Import from Figma"
    @click.self="emit('close')"
  >
    <div class="dialog">
      <header class="dialog__head">
        <h2 class="dialog__title">
          <Frame :size="15" aria-hidden="true" />
          Import from Figma
        </h2>
        <span v-if="isPro" class="dialog__tier">Pro</span>
        <button class="dialog__close" aria-label="Close" @click="emit('close')">
          <X :size="15" aria-hidden="true" />
        </button>
      </header>

      <div class="dialog__body">
        <p v-if="error" class="error" role="alert">{{ error }}</p>

        <!-- Step one: where to read from, and with what. -->
        <div v-if="!imported" class="step">
          <div class="field">
            <label class="field__label" for="figma-file">Figma file link</label>
            <input
              id="figma-file"
              v-model="fileInput"
              class="field__input"
              placeholder="https://www.figma.com/design/…"
              data-testid="figma-file-input"
              spellcheck="false"
            />
          </div>

          <div class="field">
            <label class="field__label" for="figma-pat">
              <Lock :size="11" aria-hidden="true" />
              Personal access token
            </label>

            <template v-if="editingPat">
              <input
                id="figma-pat"
                v-model="patDraft"
                class="field__input"
                type="password"
                placeholder="figd_…"
                autocomplete="off"
                spellcheck="false"
                data-testid="figma-pat-input"
                @keydown.enter="savePat"
              />
              <div class="field__row">
                <button class="btn btn--ghost" :disabled="!patDraft.trim()" @click="savePat">
                  Save token
                </button>
              </div>
            </template>

            <div v-else class="stored">
              <span class="stored__value">{{ maskedPat(figma.pat) }}</span>
              <button class="stored__link" @click="changePat">Replace</button>
              <button class="stored__link stored__link--danger" @click="forget">Forget</button>
            </div>
          </div>

          <p class="privacy">
            <ShieldCheck :size="12" aria-hidden="true" />
            <span>
              Your token stays in this browser. Design Spec calls Figma directly from this tab — the
              token is never sent to our servers, and revoking it in Figma revokes it here.
            </span>
          </p>

          <p class="step__fine">
            <template v-if="isPro">
              Styles, variables and modes are read. A second variable mode named “Dark” becomes your
              dark-mode colors.
            </template>
            <template v-else>
              Published styles — colors, text and effects — are read on the Free plan. Pro adds
              variables, modes and dark-mode colors.
            </template>
          </p>
        </div>

        <!-- Step two: what came back. -->
        <div v-else class="step">
          <p class="step__lead">
            Read <strong>{{ file?.name }}</strong> — {{ imported.counts.tokens }} tokens from
            {{ imported.counts.styles }} styles<template v-if="imported.counts.variables">
              and {{ imported.counts.variables }} variables</template
            >.
          </p>

          <ul class="groups">
            <li v-for="group in groups" :key="group.label" class="group">
              <span class="group__name">{{ group.label }}</span>
              <span class="group__count">{{ group.count }}</span>
            </li>
          </ul>

          <div v-if="imported.notes.length" class="notes">
            <p class="notes__title">
              <Info :size="12" aria-hidden="true" />
              {{ imported.notes.length }} skipped
            </p>
            <ul class="notes__list">
              <li v-for="(note, i) in imported.notes" :key="i" class="note">
                <span class="note__source">{{ note.source }}</span>
                <span class="note__reason">{{ note.reason }}</span>
              </li>
            </ul>
          </div>

          <fieldset class="modes">
            <legend class="field__label">Apply as</legend>
            <label class="mode">
              <input v-model="mergeMode" type="radio" value="merge" />
              <span class="mode__body">
                <span class="mode__name">Merge</span>
                <span class="mode__hint">Add and update these tokens, keep everything else.</span>
              </span>
            </label>
            <label class="mode">
              <input v-model="mergeMode" type="radio" value="replace" data-testid="figma-replace" />
              <span class="mode__body">
                <span class="mode__name">Replace all</span>
                <span class="mode__hint">
                  Swap each group Figma populated for what the file has.
                </span>
              </span>
            </label>
          </fieldset>
        </div>
      </div>

      <footer class="dialog__foot">
        <span v-if="link && !imported" class="linked">
          Following <span class="linked__name">{{ link.fileName }}</span>
          <button class="stored__link" @click="figma.unlink()">Unlink</button>
        </span>
        <button v-if="imported" class="btn btn--ghost" @click="figma.reset()">Back</button>
        <button
          v-if="!imported"
          class="btn btn--primary"
          :disabled="!canImport"
          data-testid="figma-read"
          @click="figma.runImport()"
        >
          {{ busy ? 'Reading…' : 'Read file' }}
        </button>
        <button v-else class="btn btn--primary" data-testid="figma-apply" @click="apply">
          <Check :size="14" aria-hidden="true" />
          Apply to workspace
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
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
.dialog__tier {
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background-color: color-mix(in srgb, var(--color-primary) 16%, transparent);
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-primary);
}
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
.step__lead {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.55;
  color: var(--color-on-surface);
}
.step__fine {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 11px;
  line-height: 1.5;
  color: var(--color-on-surface-subtle);
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
  padding: 0;
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-on-surface-subtle);
}
.field__input {
  min-height: 34px;
  padding: 0 var(--spacing-sm);
  background-color: var(--color-surface-sunken);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-on-surface);
}
.field__input:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-interactive-focus-ring);
}
.field__row {
  display: flex;
  gap: var(--spacing-sm);
}

.stored {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-height: 34px;
  padding: 0 var(--spacing-sm);
  background-color: var(--color-surface-sunken);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
}
.stored__value {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-on-surface);
}
.stored__link {
  background: none;
  border: none;
  padding: 0;
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-on-surface-muted);
  cursor: pointer;
}
.stored__link:hover {
  color: var(--color-on-surface);
}
.stored__link--danger:hover {
  color: var(--color-status-error);
}

.privacy {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin: 0;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface-sunken);
  font-family: var(--font-sans);
  font-size: 11px;
  line-height: 1.55;
  color: var(--color-on-surface-muted);
}
.privacy svg {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--color-status-success);
}

.groups {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  list-style: none;
  margin: 0;
  padding: 0;
}
.group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface-sunken);
}
.group__name {
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-on-surface-muted);
}
.group__count {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-on-surface);
}

.notes {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface-sunken);
}
.notes__title {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 0;
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 500;
  color: var(--color-on-surface-muted);
}
.notes__list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 140px;
  overflow-y: auto;
}
.note {
  display: flex;
  gap: 6px;
  font-family: var(--font-sans);
  font-size: 11px;
  line-height: 1.45;
}
.note__source {
  flex-shrink: 0;
  font-family: var(--font-mono);
  color: var(--color-on-surface);
}
.note__reason {
  color: var(--color-on-surface-subtle);
}

.modes {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin: 0;
  padding: 0;
  border: none;
}
.mode {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  cursor: pointer;
}
.mode__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.mode__name {
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--color-on-surface);
}
.mode__hint {
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-on-surface-subtle);
}

.linked {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-right: auto;
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-on-surface-subtle);
}
.linked__name {
  font-family: var(--font-mono);
  color: var(--color-on-surface-muted);
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
</style>
