<script setup lang="ts">
import { computed } from 'vue'
import { CircleCheck, CircleHelp, Circle } from '@lucide/vue'
import type { TokenState } from '@design-spec/compiler'

// The provenance chip on an imported token. Three states, three jobs:
//
//   extracted — read verbatim from the repo. Nothing to do; renders as a quiet
//               affordance only, so a clean import doesn't look like a to-do list.
//   inferred  — recovered from the compiled bundle or resolved by closest match.
//               Amber `Verify`: probably right, worth a glance.
//   defaulted — the repo said nothing. Grey `Review`: this is our value, not yours.
//
// Clicking clears the flag: the point of the chip is to be dismissed by a human
// who has looked. It is never a blocker and never hides the editor behind itself.

const props = defineProps<{
  state: TokenState | null
  /** Render the label, not just the dot. Off in dense rows. */
  labelled?: boolean
}>()
const emit = defineEmits<{ confirm: [] }>()

const meta = computed(() => {
  switch (props.state) {
    case 'inferred':
      return { label: 'Verify', icon: CircleHelp, title: 'Inferred from the build output or the closest match — confirm it looks right' }
    case 'defaulted':
      return { label: 'Review', icon: Circle, title: 'No signal in the repository — this is the baseline value' }
    case 'extracted':
      return { label: 'Extracted', icon: CircleCheck, title: 'Read verbatim from the repository' }
    default:
      return null
  }
})
</script>

<template>
  <button
    v-if="meta"
    type="button"
    class="chip"
    :class="`chip--${state}`"
    :title="meta.title"
    :aria-label="`${meta.label}: ${meta.title}`"
    @click.stop="emit('confirm')"
  >
    <component :is="meta.icon" :size="10" aria-hidden="true" />
    <span v-if="labelled" class="chip__label">{{ meta.label }}</span>
  </button>
</template>

<style scoped>
.chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
  padding: 1px 4px;
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  background: none;
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.02em;
  cursor: pointer;
  line-height: 1.4;
}

.chip:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-interactive-focus-ring);
}

/* Amber, and never colour alone: the icon differs per state too. */
.chip--inferred {
  color: var(--color-status-warning);
  border-color: color-mix(in srgb, var(--color-status-warning) 40%, transparent);
  background-color: color-mix(in srgb, var(--color-status-warning) 12%, transparent);
}
.chip--inferred:hover {
  background-color: color-mix(in srgb, var(--color-status-warning) 22%, transparent);
}

.chip--defaulted {
  color: var(--color-on-surface-muted);
  border-color: var(--color-surface-border);
}
.chip--defaulted:hover {
  color: var(--color-on-surface);
  background-color: var(--color-surface-raised);
}

.chip--extracted {
  color: var(--color-on-surface-subtle);
  border-color: transparent;
  cursor: default;
}

.chip__label {
  white-space: nowrap;
}
</style>
