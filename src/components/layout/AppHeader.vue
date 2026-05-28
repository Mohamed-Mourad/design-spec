<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'

const store = useDesignSystemStore()
const { schema, canUndo, canRedo } = storeToRefs(store)

const editingName = ref(false)
const nameInput = ref<HTMLInputElement | null>(null)

function startEditName() {
  editingName.value = true
  setTimeout(() => nameInput.value?.select(), 0)
}

function commitName(e: Event) {
  const val = (e.target as HTMLInputElement).value.trim()
  if (val) store.updateMeta({ name: val })
  editingName.value = false
}
</script>

<template>
  <header class="header">
    <div class="header__brand">
      <span class="header__logo">DS</span>
      <span class="header__product">Design Spec</span>
    </div>

    <div class="header__project">
      <input
        v-if="editingName"
        ref="nameInput"
        class="header__name-input"
        :value="schema.name"
        @blur="commitName"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
        @keydown.escape="editingName = false"
      />
      <button v-else class="header__name-btn" @click="startEditName">
        {{ schema.name }}
      </button>
    </div>

    <div class="header__actions">
      <button
        class="header__icon-btn"
        :disabled="!canUndo"
        title="Undo (Ctrl+Z)"
        @click="store.undo()"
      >
        ↩
      </button>
      <button
        class="header__icon-btn"
        :disabled="!canRedo"
        title="Redo (Ctrl+Shift+Z)"
        @click="store.redo()"
      >
        ↪
      </button>
      <button class="header__export-btn" title="Export bundle">
        Export
      </button>
    </div>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: 0 var(--spacing-md);
  height: 48px;
  background-color: var(--color-surface-default);
  border-bottom: 1px solid var(--color-surface-border);
  flex-shrink: 0;
}

.header__brand {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}

.header__logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  border-radius: var(--radius-sm);
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 400;
  flex-shrink: 0;
}

.header__product {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 400;
  color: var(--color-on-surface);
  flex-shrink: 0;
}

.header__project {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header__name-btn {
  background: none;
  border: none;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-on-surface-muted);
  cursor: pointer;
  transition: color var(--transition-duration-fast) var(--transition-easing-ease-out),
    background-color var(--transition-duration-fast) var(--transition-easing-ease-out);
}

.header__name-btn:hover {
  color: var(--color-on-surface);
  background-color: var(--color-surface-raised);
}

.header__name-input {
  background: var(--color-surface-raised);
  border: 1px solid var(--color-interactive-focus-ring);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-on-surface);
  outline: none;
  min-width: 160px;
  text-align: center;
}

.header__actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex-shrink: 0;
}

.header__icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-on-surface-muted);
  cursor: pointer;
  font-size: 14px;
  transition: color var(--transition-duration-fast) var(--transition-easing-ease-out),
    background-color var(--transition-duration-fast) var(--transition-easing-ease-out);
}

.header__icon-btn:hover:not(:disabled) {
  color: var(--color-on-surface);
  background-color: var(--color-surface-raised);
}

.header__icon-btn:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}

.header__export-btn {
  display: inline-flex;
  align-items: center;
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  border: none;
  border-radius: var(--radius-md);
  padding: 6px 14px;
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--transition-duration-normal) var(--transition-easing-ease-out);
}

.header__export-btn:hover {
  background-color: var(--color-primary-glow);
}
</style>
