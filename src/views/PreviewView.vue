<script setup lang="ts">
// Phase 5: BentoPreview renders here
// Route params: /preview (current schema) | /preview/:id (Pro short URL) | /preview#hash (free share)
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'

const router = useRouter()
const store = useDesignSystemStore()
const { schema } = storeToRefs(store)
</script>

<template>
  <div class="preview-view">
    <header class="preview-view__header">
      <button class="preview-view__back" @click="router.back()">← Back</button>
      <span class="preview-view__title">{{ schema.name }}</span>
      <button class="preview-view__share" disabled title="Share — Phase 5">Share</button>
    </header>
    <main class="preview-view__content">
      <div class="preview-view__placeholder">
        <p class="preview-view__system">{{ schema.name }}</p>
        <p class="preview-view__hint">Bento grid preview — Phase 5</p>
      </div>
    </main>
  </div>
</template>

<style scoped>
.preview-view {
  display: grid;
  grid-template-rows: 48px 1fr;
  height: 100dvh;
  background-color: var(--color-surface-page);
}

.preview-view__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--spacing-md);
  border-bottom: 1px solid var(--color-surface-border);
  background-color: var(--color-surface-default);
}

.preview-view__back {
  background: none;
  border: none;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--color-on-surface-muted);
  cursor: pointer;
}

.preview-view__back:hover {
  color: var(--color-on-surface);
}

.preview-view__title {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 400;
  color: var(--color-on-surface);
}

.preview-view__share {
  background-color: var(--color-surface-raised);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-md);
  padding: 6px 14px;
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-on-surface-muted);
  cursor: not-allowed;
  opacity: 0.6;
}

.preview-view__content {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
}

.preview-view__placeholder {
  text-align: center;
}

.preview-view__system {
  font-family: var(--font-display);
  font-size: 40px;
  font-weight: 400;
  letter-spacing: -0.015em;
  color: var(--color-on-surface);
  margin: 0 0 var(--spacing-sm);
}

.preview-view__hint {
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--color-on-surface-subtle);
  margin: 0;
}
</style>
