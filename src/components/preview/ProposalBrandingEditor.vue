<script setup lang="ts">
import { computed } from 'vue'
import { isHexColor } from '@/utils/colorUtils'
import type { ColorValue, WebPresentationConfig } from '@/types/schema'

const props = defineProps<{ presentation?: WebPresentationConfig }>()
const emit = defineEmits<{ update: [patch: Partial<WebPresentationConfig>] }>()

const branding = computed(() => props.presentation?.proposalBranding ?? {})
const embed = computed(
  () => props.presentation?.embedOptions ?? { allowIframe: true, showTokenValues: true },
)

function patchBranding(patch: Partial<NonNullable<WebPresentationConfig['proposalBranding']>>) {
  emit('update', { proposalBranding: { ...branding.value, ...patch } })
}

function patchEmbed(patch: Partial<NonNullable<WebPresentationConfig['embedOptions']>>) {
  emit('update', { embedOptions: { ...embed.value, ...patch } })
}

function onText(
  key: 'logoUrl' | 'companyName',
  e: Event,
) {
  const value = (e.target as HTMLInputElement).value.trim()
  patchBranding({ [key]: value || undefined })
}

// Validated on change rather than on input: a half-typed hex is not an error,
// it is someone still typing.
function onAccent(e: Event) {
  const value = (e.target as HTMLInputElement).value.trim()
  if (!value) return patchBranding({ accentColor: undefined })
  if (isHexColor(value)) patchBranding({ accentColor: value as ColorValue })
}

/**
 * One origin per line. Stored as an array because that is what the API reads
 * to widen CORS, and an author thinks in "the sites I will embed this on".
 */
const originsText = computed(() => (embed.value.allowedOrigins ?? []).join('\n'))

function onOrigins(e: Event) {
  const origins = (e.target as HTMLTextAreaElement).value
    .split('\n')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean)
  patchEmbed({ allowedOrigins: origins.length ? origins : undefined })
}
</script>

<template>
  <div class="pbe" data-testid="proposal-branding-editor">
    <label class="pbe__field">
      <span class="pbe__label">Company name</span>
      <input
        class="pbe__input"
        :value="branding.companyName ?? ''"
        placeholder="Acme Inc."
        @change="onText('companyName', $event)"
      />
    </label>

    <label class="pbe__field">
      <span class="pbe__label">Logo URL</span>
      <input
        class="pbe__input"
        type="url"
        :value="branding.logoUrl ?? ''"
        placeholder="https://acme.example/logo.svg"
        @change="onText('logoUrl', $event)"
      />
    </label>

    <label class="pbe__field">
      <span class="pbe__label">Accent</span>
      <span class="pbe__accent">
        <input
          class="pbe__swatch"
          type="color"
          aria-label="Accent color"
          :value="branding.accentColor ?? '#c8813d'"
          @change="onAccent"
        />
        <input
          class="pbe__input pbe__input--mono"
          :value="branding.accentColor ?? ''"
          placeholder="#c8813d"
          aria-label="Accent hex"
          @change="onAccent"
        />
      </span>
    </label>

    <label class="pbe__check">
      <input
        type="checkbox"
        :checked="branding.hideDesignSpecBranding === true"
        @change="patchBranding({ hideDesignSpecBranding: ($event.target as HTMLInputElement).checked })"
      />
      <span>Hide the Design Spec footer</span>
    </label>

    <hr class="pbe__rule" />

    <label class="pbe__check">
      <input
        type="checkbox"
        data-testid="allow-iframe"
        :checked="embed.allowIframe"
        @change="patchEmbed({ allowIframe: ($event.target as HTMLInputElement).checked })"
      />
      <span>Allow embedding in an iframe</span>
    </label>

    <label class="pbe__check">
      <input
        type="checkbox"
        :checked="embed.showTokenValues"
        @change="patchEmbed({ showTokenValues: ($event.target as HTMLInputElement).checked })"
      />
      <span>Show raw token values in the embed</span>
    </label>

    <label v-if="embed.allowIframe" class="pbe__field">
      <span class="pbe__label">Sites allowed to embed</span>
      <textarea
        class="pbe__input pbe__input--area"
        rows="3"
        :value="originsText"
        placeholder="https://www.notion.so&#10;https://acme.example"
        @change="onOrigins"
      />
      <span class="pbe__hint">
        One origin per line. Leave empty to allow only pages on Design Spec itself —
        the embed is never opened to every site.
      </span>
    </label>
  </div>
</template>

<style scoped>
.pbe {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  font-family: var(--font-sans);
}

.pbe__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pbe__label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-on-surface-subtle);
}

.pbe__input {
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface-raised);
  font-family: inherit;
  font-size: 13px;
  color: var(--color-on-surface);
}

.pbe__input--mono {
  font-family: var(--font-mono);
  font-size: 12px;
}

.pbe__input--area {
  padding: 8px 10px;
  font-family: var(--font-mono);
  font-size: 12px;
  resize: vertical;
}

.pbe__input:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-interactive-focus-ring);
}

.pbe__accent {
  display: flex;
  gap: var(--spacing-sm);
}

.pbe__swatch {
  width: 34px;
  height: 32px;
  padding: 2px;
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface-raised);
  cursor: pointer;
}

.pbe__check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-on-surface-muted);
  cursor: pointer;
}

.pbe__hint {
  font-size: 11px;
  line-height: 1.5;
  color: var(--color-on-surface-subtle);
}

.pbe__rule {
  margin: 0;
  border: none;
  border-top: 1px solid var(--color-surface-border);
}
</style>
