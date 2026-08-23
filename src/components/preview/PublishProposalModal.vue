<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Check, Copy, Loader, X } from '@lucide/vue'
import { ApiError, apiConfigured, portfolio, type Proposal } from '@/utils/api'
import type { DesignSystemSchema } from '@/types/schema'

const props = defineProps<{ schema: DesignSystemSchema }>()
const emit = defineEmits<{ close: []; published: [proposal: Proposal] }>()

type Availability = 'idle' | 'checking' | 'free' | 'taken' | 'reserved' | 'invalid'

/** A schema name turned into a plausible first slug: "Acme UI" → "acme-ui". */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

const slug = ref(slugify(props.schema.name))
const availability = ref<Availability>('idle')
const publishing = ref(false)
const error = ref<string | null>(null)
const published = ref<Proposal | null>(null)
const copied = ref(false)

const canPublish = computed(
  () => availability.value === 'free' && !publishing.value && apiConfigured(),
)

// Debounced: the field is checked as it is typed, and a half-typed slug is a
// normal state the API answers 200 for rather than an error.
let checkTimer: ReturnType<typeof setTimeout> | undefined

watch(
  slug,
  (value) => {
    clearTimeout(checkTimer)
    error.value = null
    if (!apiConfigured()) return
    if (!value) {
      availability.value = 'invalid'
      return
    }
    availability.value = 'checking'
    checkTimer = setTimeout(async () => {
      try {
        const result = await portfolio.slugAvailability(value)
        // A slower answer for an older keystroke must not overwrite a newer one.
        if (result.slug !== slug.value) return
        availability.value = result.available ? 'free' : (result.reason ?? 'taken')
      } catch (e) {
        availability.value = 'idle'
        error.value = e instanceof ApiError ? e.message : 'Could not check that address.'
      }
    }, 300)
  },
  { immediate: true },
)

onBeforeUnmount(() => clearTimeout(checkTimer))

const AVAILABILITY_MESSAGE: Record<Availability, string> = {
  idle: '',
  checking: 'Checking…',
  free: 'Available',
  taken: 'Already taken',
  reserved: 'Reserved — pick another',
  invalid: '3–48 characters: lowercase letters, digits and hyphens',
}

async function publish() {
  publishing.value = true
  error.value = null
  try {
    const proposal = await portfolio.publish(slug.value, props.schema)
    published.value = proposal
    emit('published', proposal)
  } catch (e) {
    error.value =
      e instanceof ApiError
        ? e.status === 403
          ? 'Publishing a proposal is part of Pro.'
          : e.message
        : 'Could not publish.'
  } finally {
    publishing.value = false
  }
}

async function copyUrl() {
  if (!published.value) return
  try {
    await navigator.clipboard.writeText(published.value.url)
    copied.value = true
    setTimeout(() => (copied.value = false), 3000)
  } catch {
    window.prompt('Copy this link', published.value.url)
  }
}
</script>

<template>
  <div class="ppm" role="dialog" aria-modal="true" aria-labelledby="ppm-title" data-testid="publish-modal">
    <header class="ppm__head">
      <h2 id="ppm-title" class="ppm__title">Publish this proposal</h2>
      <button class="ppm__icon" aria-label="Close" @click="emit('close')">
        <X :size="16" aria-hidden="true" />
      </button>
    </header>

    <template v-if="!published">
      <p class="ppm__lede">
        A short public address for this design system, with your branding on it. Sharing without
        an account still works — that is the link the Share button copies.
      </p>

      <label class="ppm__field">
        <span class="ppm__label">Address</span>
        <span class="ppm__slug">
          <span class="ppm__prefix">/p/</span>
          <input
            v-model="slug"
            class="ppm__input"
            data-testid="slug-input"
            autocomplete="off"
            spellcheck="false"
            aria-describedby="ppm-availability"
          />
        </span>
        <span
          id="ppm-availability"
          class="ppm__status"
          :class="`ppm__status--${availability}`"
          data-testid="slug-status"
        >
          {{ AVAILABILITY_MESSAGE[availability] }}
        </span>
      </label>

      <p v-if="!apiConfigured()" class="ppm__error">
        Publishing needs a Design Spec account. Hash links work without one.
      </p>
      <p v-else-if="error" class="ppm__error" data-testid="publish-error">{{ error }}</p>

      <button class="ppm__publish" :disabled="!canPublish" data-testid="publish-submit" @click="publish">
        <Loader v-if="publishing" :size="15" aria-hidden="true" />
        <span>{{ publishing ? 'Publishing…' : 'Publish' }}</span>
      </button>
    </template>

    <template v-else>
      <p class="ppm__lede">Published. This address is live now.</p>
      <div class="ppm__result">
        <code class="ppm__url" data-testid="published-url">{{ published.url }}</code>
        <button class="ppm__icon" :aria-label="copied ? 'Copied' : 'Copy the link'" @click="copyUrl">
          <component :is="copied ? Check : Copy" :size="15" aria-hidden="true" />
        </button>
      </div>
      <p class="ppm__hint">
        The social card is rendering in the background. Until it is ready, links to this page
        preview with the card drawn in your browser.
      </p>
    </template>
  </div>
</template>

<style scoped>
.ppm {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  width: 420px;
  max-width: calc(100vw - var(--spacing-lg));
  padding: var(--spacing-lg);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-lg);
  background-color: var(--color-surface-default);
  box-shadow: var(--shadow-xl);
  font-family: var(--font-sans);
}

.ppm__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ppm__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 400;
  color: var(--color-on-surface);
}

.ppm__lede,
.ppm__hint {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-on-surface-muted);
}

.ppm__hint {
  font-size: 12px;
  color: var(--color-on-surface-subtle);
}

.ppm__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ppm__label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-on-surface-subtle);
}

.ppm__slug {
  display: flex;
  align-items: center;
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface-raised);
}

.ppm__slug:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-interactive-focus-ring);
}

.ppm__prefix {
  padding: 0 2px 0 10px;
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--color-on-surface-subtle);
}

.ppm__input {
  flex: 1;
  min-width: 0;
  min-height: 34px;
  padding: 0 10px 0 0;
  border: none;
  background: none;
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--color-on-surface);
}

.ppm__input:focus {
  outline: none;
}

.ppm__status {
  min-height: 16px;
  font-size: 12px;
  color: var(--color-on-surface-subtle);
}

.ppm__status--free {
  color: var(--color-status-success);
}

.ppm__status--taken,
.ppm__status--reserved,
.ppm__status--invalid {
  color: var(--color-status-warning);
}

.ppm__error {
  margin: 0;
  font-size: 12px;
  color: var(--color-status-error);
}

.ppm__publish {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 var(--spacing-md);
  border: none;
  border-radius: var(--radius-md);
  background-color: var(--color-primary);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-on-primary);
  cursor: pointer;
}

.ppm__publish:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}

.ppm__result {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface-raised);
}

.ppm__url {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-on-surface);
}

.ppm__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  min-height: 32px;
  border: none;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--color-on-surface-muted);
  cursor: pointer;
}

.ppm__icon:hover {
  color: var(--color-on-surface);
  background-color: var(--color-surface-overlay);
}

.ppm__icon:focus-visible,
.ppm__publish:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-interactive-focus-ring);
}
</style>
