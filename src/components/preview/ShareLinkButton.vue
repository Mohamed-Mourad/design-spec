<script setup lang="ts">
import { ref } from 'vue'
import { Check, Link2, TriangleAlert } from '@lucide/vue'
import { shareLinkFor, ShareLinkTooLargeError } from '@/utils/shareLink'
import type { DesignSystemSchema } from '@/types/schema'

const props = defineProps<{ schema: DesignSystemSchema }>()

type State = 'idle' | 'copied' | 'error'

const state = ref<State>('idle')
const message = ref('')
let resetTimer: ReturnType<typeof setTimeout> | undefined

function settle(next: State, text: string) {
  state.value = next
  message.value = text
  clearTimeout(resetTimer)
  resetTimer = setTimeout(() => {
    state.value = 'idle'
    message.value = ''
  }, 4000)
}

async function copy() {
  let url: string
  try {
    url = shareLinkFor(props.schema)
  } catch (e) {
    settle(
      'error',
      e instanceof ShareLinkTooLargeError ? e.message : 'Could not build a share link.',
    )
    return
  }

  try {
    await navigator.clipboard.writeText(url)
    settle('copied', 'Link copied')
  } catch {
    // Clipboard access can be denied outright (permissions, an insecure
    // origin). The link still exists — put it where it can be copied by hand.
    window.prompt('Copy this link', url)
    settle('idle', '')
  }
}
</script>

<template>
  <button
    class="share"
    :class="`share--${state}`"
    data-testid="share-link"
    :title="message || 'Copy a link that carries this design system — no account needed'"
    @click="copy"
  >
    <Check v-if="state === 'copied'" :size="15" aria-hidden="true" />
    <TriangleAlert v-else-if="state === 'error'" :size="15" aria-hidden="true" />
    <Link2 v-else :size="15" aria-hidden="true" />
    <span>{{ state === 'copied' ? 'Link copied' : 'Share' }}</span>
  </button>
</template>

<style scoped>
.share {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-height: 36px;
  padding: 0 var(--spacing-md);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-md);
  background-color: var(--color-surface-raised);
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--color-on-surface);
  cursor: pointer;
}

.share:hover {
  background-color: var(--color-surface-overlay);
}

.share:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-interactive-focus-ring);
}

.share--copied {
  color: var(--color-status-success);
  border-color: var(--color-status-success);
}

.share--error {
  color: var(--color-status-error);
  border-color: var(--color-status-error);
}
</style>
