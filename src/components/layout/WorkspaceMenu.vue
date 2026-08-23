<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { ChevronDown, Plus, Pencil, Trash2, Check, RotateCcw, Copy, Frame, GitFork } from '@lucide/vue'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import ImportDialog from '@/components/import/ImportDialog.vue'
import FigmaImportDialog from '@/components/import/FigmaImportDialog.vue'

const store = useDesignSystemStore()
const { workspaces, activeWorkspaceId, activeWorkspaceName } = storeToRefs(store)

const importing = ref(false)
const importingFigma = ref(false)

const root = ref<HTMLDetailsElement | null>(null)
const newName = ref('')
const editingId = ref<string | null>(null)
const editName = ref('')
const editInput = ref<HTMLInputElement | null>(null)

function close() {
  if (root.value) root.value.open = false
}
function onDocClick(e: MouseEvent) {
  if (root.value?.open && !root.value.contains(e.target as Node)) close()
}
onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))

function addWorkspace() {
  store.createWorkspace(newName.value)
  newName.value = ''
  close()
}
function startRename(id: string, name: string) {
  editingId.value = id
  editName.value = name
  nextTick(() => editInput.value?.focus())
}
function commitRename() {
  if (editingId.value) store.renameWorkspace(editingId.value, editName.value)
  editingId.value = null
}
function remove(id: string, name: string) {
  if (confirm(`Delete workspace "${name}"? This can't be undone.`)) store.deleteWorkspace(id)
}
function resetActive() {
  if (confirm('Reset this workspace to all default values?')) store.resetWorkspace()
}
</script>

<template>
  <details ref="root" class="wm">
    <summary class="wm__summary" data-testid="workspace-menu">
      <span class="wm__current">{{ activeWorkspaceName }}</span>
      <ChevronDown :size="13" aria-hidden="true" />
    </summary>

    <div class="wm__panel">
      <div class="wm__list">
        <div v-for="w in workspaces" :key="w.id" class="wm__row" :class="{ 'wm__row--active': w.id === activeWorkspaceId }">
          <template v-if="editingId === w.id">
            <input ref="editInput" v-model="editName" class="wm__rename" @keydown.enter="commitRename" @keydown.escape="editingId = null" @blur="commitRename" />
            <button class="wm__icon" aria-label="Save name" @click="commitRename"><Check :size="13" /></button>
          </template>
          <template v-else>
            <button class="wm__name" @click="store.switchWorkspace(w.id); close()">
              {{ w.name }}<span v-if="w.id === activeWorkspaceId" class="wm__dot" />
            </button>
            <button class="wm__icon" aria-label="Duplicate" title="Duplicate" @click="store.duplicateWorkspace(w.id); close()"><Copy :size="12" /></button>
            <button class="wm__icon" aria-label="Rename" title="Rename" @click="startRename(w.id, w.name)"><Pencil :size="12" /></button>
            <button class="wm__icon wm__icon--danger" aria-label="Delete" title="Delete" @click="remove(w.id, w.name)"><Trash2 :size="12" /></button>
          </template>
        </div>
      </div>

      <div class="wm__add">
        <input v-model="newName" placeholder="New workspace name" aria-label="New workspace name" @keydown.enter="addWorkspace" />
        <button class="wm__icon" aria-label="Create workspace" title="Create" @click="addWorkspace"><Plus :size="14" /></button>
      </div>

      <button class="wm__import" data-testid="open-import" @click="importing = true; close()">
        <GitFork :size="12" /> Import from GitHub…
      </button>
      <button class="wm__import" data-testid="open-figma-import" @click="importingFigma = true; close()">
        <Frame :size="12" /> Import from Figma…
      </button>
      <button class="wm__reset" @click="resetActive"><RotateCcw :size="12" /> Reset to defaults</button>
    </div>
  </details>

  <ImportDialog v-if="importing" @close="importing = false" />
  <FigmaImportDialog v-if="importingFigma" @close="importingFigma = false" />
</template>

<style scoped>
.wm {
  position: relative;
  flex-shrink: 0;
}
.wm__summary {
  list-style: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 500;
  color: var(--color-on-surface);
  background-color: var(--color-surface-raised);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
}
.wm__summary::-webkit-details-marker {
  display: none;
}
.wm__current {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wm__panel {
  position: absolute;
  left: 0;
  top: calc(100% + 4px);
  z-index: var(--z-dropdown);
  width: 260px;
  background-color: var(--color-surface-overlay);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: var(--spacing-sm);
}
.wm__list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  max-height: 240px;
  overflow-y: auto;
}
.wm__row {
  display: flex;
  align-items: center;
  gap: 4px;
  border-radius: var(--radius-sm);
  padding: 2px;
}
.wm__row--active {
  background-color: var(--color-surface-raised);
}
.wm__name {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  text-align: left;
  background: none;
  border: none;
  color: var(--color-on-surface);
  font-family: var(--font-sans);
  font-size: 13px;
  padding: 4px 6px;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wm__dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: var(--color-primary);
}
.wm__rename {
  flex: 1;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--color-on-surface);
  background-color: var(--color-surface-sunken);
  border: 1px solid var(--color-interactive-focus-ring);
  border-radius: var(--radius-sm);
  padding: 3px 6px;
}
.wm__icon {
  display: inline-flex;
  background: none;
  border: none;
  color: var(--color-on-surface-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-sm);
}
.wm__icon:hover {
  color: var(--color-on-surface);
  background-color: var(--color-surface-raised);
}
.wm__icon--danger:hover {
  color: var(--color-status-error);
}
.wm__add {
  display: flex;
  gap: 4px;
  margin-top: var(--spacing-sm);
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--color-surface-border);
}
.wm__add input {
  flex: 1;
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-on-surface);
  background-color: var(--color-surface-sunken);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 4px 6px;
}
.wm__import {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  margin-top: var(--spacing-sm);
  background: none;
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 6px;
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-on-surface-muted);
  cursor: pointer;
}
.wm__import:hover {
  color: var(--color-on-surface);
  border-color: var(--color-primary);
}
.wm__reset {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  margin-top: 4px;
  background: none;
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  padding: 6px;
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-on-surface-muted);
  cursor: pointer;
}
.wm__reset:hover {
  color: var(--color-status-error);
  border-color: var(--color-status-error);
}
</style>
