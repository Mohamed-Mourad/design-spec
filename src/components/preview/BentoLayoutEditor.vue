<script setup lang="ts">
import { computed, ref } from 'vue'
import { Eye, EyeOff, GripVertical, RotateCcw } from '@lucide/vue'
import {
  BENTO_CELL_LABELS,
  defaultBentoLayout,
  resolveBentoLayout,
  type BentoCellId,
} from '@/defaults/bento'
import type { BentoCellConfig, BentoLayoutConfig } from '@/types/schema'

const props = defineProps<{ layout?: BentoLayoutConfig }>()
const emit = defineEmits<{ update: [layout: BentoLayoutConfig] }>()

const layout = computed(() => resolveBentoLayout(props.layout))

const COLUMN_CHOICES = [2, 3, 4] as const
const THEME_CHOICES = ['light', 'dark', 'system'] as const

function commit(patch: Partial<BentoLayoutConfig>) {
  emit('update', { ...layout.value, ...patch })
}

function patchCell(id: BentoCellId, patch: Partial<BentoCellConfig>) {
  commit({ cells: layout.value.cells.map((c) => (c.id === id ? { ...c, ...patch } : c)) })
}

/** Move the cell at `from` to `to`, clamped — the single reorder primitive. */
function move(from: number, to: number) {
  const cells = [...layout.value.cells]
  const target = Math.max(0, Math.min(cells.length - 1, to))
  if (from === target) return
  const [moved] = cells.splice(from, 1)
  cells.splice(target, 0, moved)
  commit({ cells })
}

// ── Drag reorder ──
// Pointer dragging is the fast path; the ↑/↓ buttons on every row are the
// accessible one. Both call move(), so neither can drift from the other.
const draggingIndex = ref<number | null>(null)
const dropIndex = ref<number | null>(null)

function onDragStart(index: number, e: DragEvent) {
  draggingIndex.value = index
  e.dataTransfer?.setData('text/plain', String(index))
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(index: number, e: DragEvent) {
  if (draggingIndex.value === null) return
  e.preventDefault()
  dropIndex.value = index
}

function onDrop(index: number) {
  if (draggingIndex.value !== null) move(draggingIndex.value, index)
  draggingIndex.value = null
  dropIndex.value = null
}

function onDragEnd() {
  draggingIndex.value = null
  dropIndex.value = null
}

function labelFor(cell: BentoCellConfig): string {
  return BENTO_CELL_LABELS[cell.id]
}

function onLabelInput(cell: BentoCellConfig, e: Event) {
  const value = (e.target as HTMLInputElement).value.trim()
  patchCell(cell.id, { customLabel: value || undefined })
}
</script>

<template>
  <div class="ble" data-testid="bento-layout-editor">
    <div class="ble__group">
      <span class="ble__group-label">Columns</span>
      <div class="ble__choices" role="group" aria-label="Grid columns">
        <button
          v-for="n in COLUMN_CHOICES"
          :key="n"
          class="ble__choice"
          :class="{ 'ble__choice--on': layout.gridColumns === n }"
          :aria-pressed="layout.gridColumns === n"
          @click="commit({ gridColumns: n })"
        >
          {{ n }}
        </button>
      </div>
    </div>

    <div class="ble__group">
      <span class="ble__group-label">Theme</span>
      <div class="ble__choices" role="group" aria-label="Preview theme">
        <button
          v-for="t in THEME_CHOICES"
          :key="t"
          class="ble__choice"
          :class="{ 'ble__choice--on': layout.theme === t }"
          :aria-pressed="layout.theme === t"
          @click="commit({ theme: t })"
        >
          {{ t }}
        </button>
      </div>
    </div>

    <div class="ble__group">
      <span class="ble__group-label">Header</span>
      <label class="ble__check">
        <input
          type="checkbox"
          :checked="layout.showTitle"
          @change="commit({ showTitle: ($event.target as HTMLInputElement).checked })"
        />
        <span>Title</span>
      </label>
      <label class="ble__check">
        <input
          type="checkbox"
          :checked="layout.showDescription"
          @change="commit({ showDescription: ($event.target as HTMLInputElement).checked })"
        />
        <span>Description</span>
      </label>
    </div>

    <ul class="ble__cells">
      <li
        v-for="(cell, index) in layout.cells"
        :key="cell.id"
        class="ble__cell"
        :class="{
          'ble__cell--hidden': !cell.visible,
          'ble__cell--drop': dropIndex === index && draggingIndex !== index,
        }"
        :data-testid="`bento-cell-row-${cell.id}`"
        draggable="true"
        @dragstart="onDragStart(index, $event)"
        @dragover="onDragOver(index, $event)"
        @drop.prevent="onDrop(index)"
        @dragend="onDragEnd"
      >
        <GripVertical class="ble__grip" :size="14" aria-hidden="true" />

        <input
          class="ble__label"
          :value="cell.customLabel ?? ''"
          :placeholder="labelFor(cell)"
          :aria-label="`Label for the ${labelFor(cell)} cell`"
          @change="onLabelInput(cell, $event)"
        />

        <button
          class="ble__span"
          :aria-label="`${labelFor(cell)} width`"
          :title="cell.span === 2 ? 'Full width — click for half' : 'Half width — click for full'"
          @click="patchCell(cell.id, { span: cell.span === 2 ? 1 : 2 })"
        >
          {{ cell.span === 2 ? 'wide' : 'half' }}
        </button>

        <button
          class="ble__icon"
          :aria-label="`${cell.visible ? 'Hide' : 'Show'} the ${labelFor(cell)} cell`"
          :aria-pressed="cell.visible"
          @click="patchCell(cell.id, { visible: !cell.visible })"
        >
          <component :is="cell.visible ? Eye : EyeOff" :size="14" aria-hidden="true" />
        </button>

        <button
          class="ble__icon"
          :disabled="index === 0"
          :aria-label="`Move ${labelFor(cell)} up`"
          @click="move(index, index - 1)"
        >
          ↑
        </button>
        <button
          class="ble__icon"
          :disabled="index === layout.cells.length - 1"
          :aria-label="`Move ${labelFor(cell)} down`"
          @click="move(index, index + 1)"
        >
          ↓
        </button>
      </li>
    </ul>

    <button class="ble__reset" @click="emit('update', defaultBentoLayout())">
      <RotateCcw :size="13" aria-hidden="true" />
      <span>Reset layout</span>
    </button>
  </div>
</template>

<style scoped>
.ble {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  font-family: var(--font-sans);
}

.ble__group {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.ble__group-label {
  flex: 0 0 76px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-on-surface-subtle);
}

.ble__choices {
  display: flex;
  gap: 4px;
}

.ble__choice {
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  background-color: transparent;
  font-family: inherit;
  font-size: 12px;
  color: var(--color-on-surface-muted);
  cursor: pointer;
}

.ble__choice--on {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.ble__check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-on-surface-muted);
  cursor: pointer;
}

.ble__cells {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ble__cell {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background-color: var(--color-surface-raised);
}

.ble__cell--hidden {
  opacity: 0.5;
}

.ble__cell--drop {
  border-color: var(--color-primary);
}

.ble__grip {
  flex-shrink: 0;
  color: var(--color-on-surface-subtle);
  cursor: grab;
}

.ble__label {
  flex: 1;
  min-width: 0;
  min-height: 28px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background-color: transparent;
  font-family: inherit;
  font-size: 12px;
  color: var(--color-on-surface);
}

.ble__label:hover,
.ble__label:focus {
  border-color: var(--color-surface-border);
  outline: none;
}

.ble__span {
  flex-shrink: 0;
  min-height: 28px;
  padding: 0 8px;
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  background-color: transparent;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-on-surface-muted);
  cursor: pointer;
}

.ble__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  min-height: 28px;
  border: none;
  border-radius: var(--radius-sm);
  background-color: transparent;
  font-size: 12px;
  color: var(--color-on-surface-muted);
  cursor: pointer;
}

.ble__icon:hover:not(:disabled) {
  color: var(--color-on-surface);
  background-color: var(--color-surface-overlay);
}

.ble__icon:disabled {
  opacity: 0.38;
  cursor: default;
}

.ble__choice:focus-visible,
.ble__span:focus-visible,
.ble__icon:focus-visible,
.ble__reset:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-interactive-focus-ring);
}

.ble__reset {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 6px;
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  background-color: transparent;
  font-family: inherit;
  font-size: 12px;
  color: var(--color-on-surface-muted);
  cursor: pointer;
}

.ble__reset:hover {
  color: var(--color-on-surface);
}
</style>
