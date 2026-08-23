<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { ExternalLink, GitPullRequest, Lock } from '@lucide/vue'
import { compileAll } from '@design-spec/compiler'
import { useImportStore } from '@/stores/useImportStore'
import type { DesignSystemSchema } from '@/types/schema'

// The Pro half of the retrofit: commit the generated design system back to the
// repository as a pull request.
//
// The write target is not negotiable and not ours to choose here — the API
// generates a `design-spec/retrofit-*` branch and refuses any request that tries
// to name one. This component sends files and a base; that is all it can do.

const imports = useImportStore()
const { result, canPush, busy, pullRequest } = storeToRefs(imports)

const files = computed(() => {
  const schema = result.value?.extraction.schema as DesignSystemSchema | undefined
  if (!schema) return []
  return compileAll(schema).map((f) => ({ path: f.filename, content: f.content }))
})

const askedForAccess = ref(false)

async function push() {
  if (!canPush.value) {
    askedForAccess.value = true
    return
  }
  await imports.pushRetrofit(files.value)
}
</script>

<template>
  <div class="push">
    <a v-if="pullRequest" class="push__link" :href="pullRequest.pull_request_url" target="_blank" rel="noopener noreferrer">
      <ExternalLink :size="13" aria-hidden="true" />
      PR #{{ pullRequest.pull_request_number }} opened
    </a>

    <template v-else>
      <button class="push__btn" :disabled="busy || files.length === 0" @click="push">
        <component :is="canPush ? GitPullRequest : Lock" :size="13" aria-hidden="true" />
        Push as pull request
      </button>
      <p v-if="askedForAccess && !canPush" class="push__hint">
        Needs repository write access —
        <button class="push__inline" @click="imports.connect(true)">grant it</button>
        — and a Pro Team plan.
      </p>
    </template>
  </div>
</template>

<style scoped>
.push {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-right: auto;
}

.push__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 var(--spacing-md);
  background: none;
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-on-surface-muted);
  cursor: pointer;
}
.push__btn:hover:not(:disabled) {
  color: var(--color-on-surface);
  background-color: var(--color-surface-raised);
}
.push__btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-interactive-focus-ring);
}
.push__btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.push__link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-status-success);
  text-decoration: none;
}
.push__link:hover {
  text-decoration: underline;
}

.push__hint {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-on-surface-subtle);
}
.push__inline {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: var(--color-primary);
  cursor: pointer;
  text-decoration: underline;
}
</style>
