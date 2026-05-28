<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'

const store = useDesignSystemStore()
const { activeEditorTab } = storeToRefs(store)

const tabs = [
  { id: 'colors', label: 'Colors' },
  { id: 'typography', label: 'Typography' },
  { id: 'spacing', label: 'Spacing & Layout' },
  { id: 'elevation', label: 'Elevation' },
  { id: 'motion', label: 'Motion' },
  { id: 'structure', label: 'Structure' },
  { id: 'breakpoints', label: 'Breakpoints' },
  { id: 'components', label: 'Components' },
]
</script>

<template>
  <aside class="left-panel">
    <nav class="left-panel__nav">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="left-panel__tab"
        :class="{ 'left-panel__tab--active': activeEditorTab === tab.id }"
        @click="activeEditorTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </nav>

    <div class="left-panel__content">
      <div class="left-panel__placeholder">
        <span class="left-panel__placeholder-label">{{ activeEditorTab }}</span>
        <p class="left-panel__placeholder-text">Token editors — Phase 2</p>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.left-panel {
  display: flex;
  flex-direction: column;
  background-color: var(--color-surface-default);
  overflow: hidden;
}

.left-panel__nav {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: var(--spacing-sm);
  border-bottom: 1px solid var(--color-surface-border);
  flex-shrink: 0;
}

.left-panel__tab {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 7px var(--spacing-sm);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 400;
  color: var(--color-on-surface-muted);
  cursor: pointer;
  text-align: left;
  transition: color var(--transition-duration-fast) var(--transition-easing-ease-out),
    background-color var(--transition-duration-fast) var(--transition-easing-ease-out);
}

.left-panel__tab:hover {
  color: var(--color-on-surface);
  background-color: var(--color-surface-raised);
}

.left-panel__tab--active {
  color: var(--color-on-surface);
  background-color: var(--color-surface-raised);
  font-weight: 500;
}

.left-panel__content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
}

.left-panel__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  height: 120px;
  border: 1px dashed var(--color-surface-border);
  border-radius: var(--radius-lg);
}

.left-panel__placeholder-label {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-on-surface-muted);
}

.left-panel__placeholder-text {
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-on-surface-subtle);
  margin: 0;
}
</style>
