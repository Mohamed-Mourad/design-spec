<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'

const store = useDesignSystemStore()
const { outputFiles, activePreviewFile } = storeToRefs(store)

const activeFile = computed(
  () => outputFiles.value.find((f) => f.filename === activePreviewFile.value) ?? outputFiles.value[0],
)

function copyToClipboard() {
  if (activeFile.value) {
    navigator.clipboard.writeText(activeFile.value.content)
  }
}
</script>

<template>
  <aside class="right-panel">
    <div class="right-panel__tabs">
      <button
        v-for="file in outputFiles"
        :key="file.filename"
        class="right-panel__tab"
        :class="{ 'right-panel__tab--active': activePreviewFile === file.filename }"
        @click="activePreviewFile = file.filename"
      >
        {{ file.filename }}
      </button>
    </div>

    <div class="right-panel__toolbar">
      <span class="right-panel__filename">{{ activeFile?.filename }}</span>
      <button class="right-panel__copy-btn" title="Copy to clipboard" @click="copyToClipboard">
        Copy
      </button>
    </div>

    <div class="right-panel__content">
      <pre class="right-panel__code">{{ activeFile?.content }}</pre>
    </div>

    <div class="right-panel__footer">
      <button class="right-panel__export-btn" disabled title="Export ZIP — Phase 6">
        Download Bundle
      </button>
    </div>
  </aside>
</template>

<style scoped>
.right-panel {
  display: flex;
  flex-direction: column;
  background-color: var(--color-surface-default);
  overflow: hidden;
}

.right-panel__tabs {
  display: flex;
  gap: 1px;
  padding: 0 var(--spacing-sm);
  border-bottom: 1px solid var(--color-surface-border);
  flex-shrink: 0;
  overflow-x: auto;
}

.right-panel__tab {
  flex-shrink: 0;
  padding: 10px var(--spacing-sm);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-on-surface-muted);
  cursor: pointer;
  transition: color var(--transition-duration-fast) var(--transition-easing-ease-out);
  margin-bottom: -1px;
}

.right-panel__tab:hover {
  color: var(--color-on-surface);
}

.right-panel__tab--active {
  color: var(--color-on-surface);
  border-bottom-color: var(--color-primary);
}

.right-panel__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-xs) var(--spacing-md);
  border-bottom: 1px solid var(--color-surface-border-subtle);
  flex-shrink: 0;
}

.right-panel__filename {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-on-surface-subtle);
}

.right-panel__copy-btn {
  background: none;
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 3px 8px;
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 500;
  color: var(--color-on-surface-muted);
  cursor: pointer;
  transition: color var(--transition-duration-fast) var(--transition-easing-ease-out),
    border-color var(--transition-duration-fast) var(--transition-easing-ease-out);
}

.right-panel__copy-btn:hover {
  color: var(--color-on-surface);
  border-color: var(--color-on-surface-subtle);
}

.right-panel__content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
}

.right-panel__code {
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.65;
  color: var(--color-on-surface-muted);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

.right-panel__footer {
  padding: var(--spacing-sm) var(--spacing-md);
  border-top: 1px solid var(--color-surface-border);
  flex-shrink: 0;
}

.right-panel__export-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-surface-raised);
  color: var(--color-on-surface-muted);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-md);
  padding: 8px;
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 500;
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
