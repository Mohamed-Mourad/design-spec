<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { ExternalLink, GitPullRequest, Lock } from '@lucide/vue'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import { useImportStore } from '@/stores/useImportStore'
import { bundleFiles } from '@/utils/exportBundle'

// The designer loop's one button: send what this workspace now says back to the
// repository it came from, as a pull request a developer reviews.
//
// It appears only for an imported workspace, because provenance is what makes a
// push addressable — a hand-authored system has no repo, no branch, and no base
// commit to be behind. Provenance is persisted per workspace, so this survives a
// reload: import in the morning, edit all day, push in the afternoon.
//
// What it sends is exactly what Export downloads. Not a similar set built for
// the network — the same `bundleFiles`, so a reviewer's diff and a designer's
// ZIP can never disagree about what the workspace produced.

const store = useDesignSystemStore()
const imports = useImportStore()
const { schema, outputFiles, importProvenance } = storeToRefs(store)
const { available, connected, canPush, pushingTokens, tokenPushResult, tokenPushError } =
  storeToRefs(imports)

const shown = computed(() => available.value && importProvenance.value !== null)

const files = computed(() =>
  bundleFiles(schema.value, outputFiles.value).map((f) => ({
    path: f.filename,
    content: f.content,
  })),
)

onMounted(() => {
  if (shown.value) void imports.init()
})

async function push() {
  const provenance = importProvenance.value
  if (!provenance) return
  // No connection, or a read-only one: the fix is the same escalated grant, and
  // GitHub is the only place that can give it.
  if (!connected.value || !canPush.value) {
    imports.connect(true)
    return
  }
  await imports.pushTokenUpdate(provenance.importSessionId, files.value)
}
</script>

<template>
  <div v-if="shown" class="push">
    <a
      v-if="tokenPushResult"
      class="push__link"
      data-testid="push-pr-link"
      :href="tokenPushResult.pull_request_url"
      target="_blank"
      rel="noopener noreferrer"
    >
      <ExternalLink :size="13" aria-hidden="true" />
      PR #{{ tokenPushResult.pull_request_number }} — awaiting developer review
    </a>

    <template v-else>
      <button
        class="push__btn"
        data-testid="push-to-github"
        :disabled="pushingTokens"
        :title="`Open a pull request on ${importProvenance?.repoFullName}`"
        @click="push"
      >
        <component :is="canPush ? GitPullRequest : Lock" :size="13" aria-hidden="true" />
        {{ pushingTokens ? 'Pushing…' : 'Push to GitHub' }}
      </button>
      <p v-if="tokenPushError" class="push__error" role="status">{{ tokenPushError }}</p>
    </template>
  </div>
</template>

<style scoped>
.push {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.push__btn {
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
  white-space: nowrap;
}
.push__link:hover {
  text-decoration: underline;
}

.push__error {
  margin: 0;
  max-width: 260px;
  font-family: var(--font-sans);
  font-size: 11px;
  line-height: 1.4;
  color: var(--color-status-error);
}
</style>
