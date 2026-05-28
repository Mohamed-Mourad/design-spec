<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'

const store = useDesignSystemStore()
const { schema } = storeToRefs(store)
</script>

<template>
  <main class="center-panel">
    <div class="center-panel__header">
      <span class="center-panel__label">Live Preview</span>
    </div>

    <div class="center-panel__content">
      <div class="center-panel__placeholder">
        <p class="center-panel__system-name">{{ schema.name }}</p>
        <p class="center-panel__hint">Component showcase — Phase 5</p>
        <div class="center-panel__color-chips">
          <div
            v-for="(value, key) in Object.fromEntries(
              Object.entries(schema.colors).slice(0, 8)
            )"
            :key="key"
            class="center-panel__chip"
            :style="{ backgroundColor: value }"
            :title="`${key}: ${value}`"
          />
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.center-panel {
  display: flex;
  flex-direction: column;
  background-color: var(--color-surface-page);
  overflow: hidden;
}

.center-panel__header {
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 var(--spacing-md);
  border-bottom: 1px solid var(--color-surface-border);
  flex-shrink: 0;
}

.center-panel__label {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-on-surface-subtle);
}

.center-panel__content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl);
}

.center-panel__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  text-align: center;
}

.center-panel__system-name {
  font-family: var(--font-display);
  font-size: 32px;
  font-weight: 400;
  letter-spacing: -0.01em;
  color: var(--color-on-surface);
  margin: 0;
}

.center-panel__hint {
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--color-on-surface-subtle);
  margin: 0;
}

.center-panel__color-chips {
  display: flex;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
  justify-content: center;
  margin-top: var(--spacing-sm);
}

.center-panel__chip {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
</style>
