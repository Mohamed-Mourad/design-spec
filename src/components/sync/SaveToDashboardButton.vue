<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { Check, CloudUpload } from '@lucide/vue'
import { useSyncStore } from '@/stores/useSyncStore'

// Save this workspace to the dashboard — the copy the developer's CLI reads
// with `design-spec sync`. Dashboard only: no repository, no branch; that is
// what "Push to GitHub" is for.
//
// Shown only with a session, because the dashboard is per account. The save
// names the revision the workspace last saw, so a `design-spec push` that
// landed in between comes back as a conflict to resolve, not an overwrite.

const sync = useSyncStore()
const { available, activeLink, activeTarget, saving, saveError, lastSaved } = storeToRefs(sync)

onMounted(() => sync.checkSession())

const justSaved = computed(
  () => lastSaved.value !== null && lastSaved.value.project === activeLink.value?.project
    && lastSaved.value.revision === activeLink.value?.revision,
)

const title = computed(() =>
  activeLink.value
    ? `Save to dashboard project "${activeLink.value.project}" (rev ${activeLink.value.revision})`
    : `Create dashboard project "${activeTarget.value}"`,
)
</script>

<template>
  <div v-if="available" class="save">
    <button
      class="save__btn"
      data-testid="save-to-dashboard"
      :disabled="saving"
      :title="title"
      @click="sync.saveActive()"
    >
      <component :is="justSaved ? Check : CloudUpload" :size="13" aria-hidden="true" />
      <template v-if="saving">Saving…</template>
      <template v-else-if="justSaved">Saved · rev {{ activeLink?.revision }}</template>
      <template v-else>Save to dashboard</template>
    </button>
    <p v-if="saveError" class="save__error" role="status" data-testid="save-to-dashboard-error">
      {{ saveError }}
    </p>
  </div>
</template>

<style scoped>
.save {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.save__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 var(--spacing-sm);
  background: none;
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 500;
  color: var(--color-on-surface-muted);
  white-space: nowrap;
  cursor: pointer;
}
.save__btn:hover:not(:disabled) {
  color: var(--color-on-surface);
  background-color: var(--color-surface-raised);
}
.save__btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-interactive-focus-ring);
}
.save__btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.save__error {
  margin: 0;
  max-width: 280px;
  font-family: var(--font-sans);
  font-size: 11px;
  line-height: 1.4;
  color: var(--color-status-error);
}
</style>
