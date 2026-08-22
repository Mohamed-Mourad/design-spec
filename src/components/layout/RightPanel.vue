<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import FilePreviewPane from '@/components/preview/FilePreviewPane.vue'

const store = useDesignSystemStore()
const { outputFiles, activePreviewFile } = storeToRefs(store)

const activeFile = computed(
  () => outputFiles.value.find((f) => f.filename === activePreviewFile.value) ?? outputFiles.value[0],
)

const copied = ref(false)
async function copyActive() {
  if (!activeFile.value) return
  await navigator.clipboard.writeText(activeFile.value.content)
  copied.value = true
  setTimeout(() => (copied.value = false), 1200)
}
</script>

<template>
  <aside class="right-panel">
    <div class="right-panel__toolbar">
      <span class="right-panel__filename">{{ activeFile?.filename }}</span>
      <button class="right-panel__copy" :title="copied ? 'Copied' : 'Copy file'" @click="copyActive">
        {{ copied ? 'Copied' : 'Copy' }}
      </button>
    </div>

    <FilePreviewPane class="right-panel__preview" />

    <div class="right-panel__footer">
      <button class="right-panel__export" disabled title="Export ZIP — Phase 7">Download Bundle</button>
    </div>
  </aside>
</template>

<style scoped>
.right-panel {
  display: grid;
  grid-template-rows: auto 1fr auto;
  background-color: var(--color-surface-default);
  overflow: hidden;
  min-height: 0;
}
.right-panel__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-xs) var(--spacing-md);
  border-bottom: 1px solid var(--color-surface-border);
  flex-shrink: 0;
}
.right-panel__filename {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-on-surface-subtle);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.right-panel__copy {
  background: none;
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 3px 8px;
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 500;
  color: var(--color-on-surface-muted);
  cursor: pointer;
  flex-shrink: 0;
}
.right-panel__copy:hover {
  color: var(--color-on-surface);
  border-color: var(--color-on-surface-subtle);
}
.right-panel__preview {
  min-height: 0;
}
.right-panel__footer {
  padding: var(--spacing-sm) var(--spacing-md);
  border-top: 1px solid var(--color-surface-border);
  flex-shrink: 0;
}
.right-panel__export {
  width: 100%;
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
