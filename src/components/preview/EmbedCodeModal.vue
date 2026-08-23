<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, Copy, X } from '@lucide/vue'

const props = defineProps<{ embedUrl: string; allowIframe: boolean }>()
const emit = defineEmits<{ close: [] }>()

type Flavor = 'iframe' | 'notion'

const flavor = ref<Flavor>('iframe')
const copied = ref(false)

/**
 * Notion (and Confluence, and Coda) take a bare URL and build the iframe
 * themselves, so pasting HTML there produces a literal block of markup. The two
 * tabs exist because the right answer genuinely differs by destination.
 */
const snippet = computed(() =>
  flavor.value === 'notion'
    ? props.embedUrl
    : `<iframe src="${props.embedUrl}" width="100%" height="720" style="border:0;border-radius:12px" loading="lazy" title="Design system"></iframe>`,
)

async function copy() {
  try {
    await navigator.clipboard.writeText(snippet.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 3000)
  } catch {
    window.prompt('Copy this', snippet.value)
  }
}
</script>

<template>
  <div class="ecm" role="dialog" aria-modal="true" aria-labelledby="ecm-title" data-testid="embed-modal">
    <header class="ecm__head">
      <h2 id="ecm-title" class="ecm__title">Embed this proposal</h2>
      <button class="ecm__icon" aria-label="Close" @click="emit('close')">
        <X :size="16" aria-hidden="true" />
      </button>
    </header>

    <p v-if="!allowIframe" class="ecm__warning" data-testid="embed-disabled">
      Embedding is turned off for this proposal. Turn on “Allow embedding in an iframe” in the
      branding panel, and add the sites you will embed it on.
    </p>

    <template v-else>
      <div class="ecm__tabs" role="tablist" aria-label="Embed format">
        <button
          v-for="tab in (['iframe', 'notion'] as Flavor[])"
          :key="tab"
          class="ecm__tab"
          :class="{ 'ecm__tab--on': flavor === tab }"
          role="tab"
          :aria-selected="flavor === tab"
          @click="flavor = tab"
        >
          {{ tab === 'iframe' ? 'HTML' : 'Notion' }}
        </button>
      </div>

      <pre class="ecm__snippet" data-testid="embed-snippet">{{ snippet }}</pre>

      <div class="ecm__actions">
        <button class="ecm__copy" data-testid="copy-embed" @click="copy">
          <component :is="copied ? Check : Copy" :size="15" aria-hidden="true" />
          <span>{{ copied ? 'Copied' : 'Copy' }}</span>
        </button>
        <p class="ecm__hint">
          {{
            flavor === 'notion'
              ? 'Paste into Notion and choose “Embed”.'
              : 'Only sites on the allowlist can frame this.'
          }}
        </p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ecm {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  width: 520px;
  max-width: calc(100vw - var(--spacing-lg));
  padding: var(--spacing-lg);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-lg);
  background-color: var(--color-surface-default);
  box-shadow: var(--shadow-xl);
  font-family: var(--font-sans);
}

.ecm__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ecm__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 400;
  color: var(--color-on-surface);
}

.ecm__tabs {
  display: flex;
  gap: 4px;
}

.ecm__tab {
  min-height: 30px;
  padding: 0 12px;
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  background: none;
  font-family: inherit;
  font-size: 12px;
  color: var(--color-on-surface-muted);
  cursor: pointer;
}

.ecm__tab--on {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.ecm__snippet {
  margin: 0;
  padding: var(--spacing-md);
  overflow-x: auto;
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface-sunken);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-on-surface);
  white-space: pre-wrap;
  word-break: break-all;
}

.ecm__actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.ecm__copy {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 var(--spacing-md);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-md);
  background-color: var(--color-surface-raised);
  font-family: inherit;
  font-size: 13px;
  color: var(--color-on-surface);
  cursor: pointer;
}

.ecm__hint {
  margin: 0;
  font-size: 12px;
  color: var(--color-on-surface-subtle);
}

.ecm__warning {
  margin: 0;
  padding: var(--spacing-sm) var(--spacing-md);
  border-left: 2px solid var(--color-status-warning);
  background-color: var(--color-surface-raised);
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-on-surface-muted);
}

.ecm__icon {
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

.ecm__icon:hover {
  color: var(--color-on-surface);
  background-color: var(--color-surface-overlay);
}

.ecm__icon:focus-visible,
.ecm__copy:focus-visible,
.ecm__tab:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-interactive-focus-ring);
}
</style>
