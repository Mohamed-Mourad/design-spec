<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CSSProperties } from 'vue'
import { ArrowDown, ArrowUp, ArrowUpDown } from '@lucide/vue'
import { usePreviewKit, type PreviewProps } from './usePreviewKit'

const props = defineProps<PreviewProps>()
const { groupStyle, groupVal, layoutReached, propDefault } = usePreviewKit()

interface Row {
  name: string
  role: string
  status: string
}
const COLS: Array<{ key: keyof Row; label: string }> = [
  { key: 'name', label: 'Name' },
  { key: 'role', label: 'Role' },
  { key: 'status', label: 'Status' },
]
const ROWS: Row[] = [
  { name: 'Ada Lovelace', role: 'Owner', status: 'Active' },
  { name: 'Grace Hopper', role: 'Editor', status: 'Invited' },
  { name: 'Alan Turing', role: 'Viewer', status: 'Active' },
]

const sortable = computed(() => propDefault(props.name, 'sortable', true))
const selectable = computed(() => propDefault(props.name, 'selectable', true))
// Mobile-first: rows stack into label/value cards until the layout breakpoint.
const stacked = computed(() => !layoutReached(props.name))

const sortKey = ref<keyof Row>('name')
const sortDir = ref<'ascending' | 'descending'>('ascending')
const selected = ref<Set<string>>(new Set(['Grace Hopper']))

const rows = computed(() => {
  const out = [...ROWS]
  if (!sortable.value) return out
  const dir = sortDir.value === 'ascending' ? 1 : -1
  return out.sort((a, b) => a[sortKey.value].localeCompare(b[sortKey.value]) * dir)
})
function sortBy(k: keyof Row) {
  if (sortKey.value === k) sortDir.value = sortDir.value === 'ascending' ? 'descending' : 'ascending'
  else {
    sortKey.value = k
    sortDir.value = 'ascending'
  }
}
function toggle(name: string) {
  const next = new Set(selected.value)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  selected.value = next
}
const allSelected = computed(() => selected.value.size === ROWS.length)
function toggleAll() {
  selected.value = allSelected.value ? new Set() : new Set(ROWS.map((r) => r.name))
}

const cell = computed(() => groupStyle(props.name, 'cell'))
const rowEdge = computed(() => `${groupVal(props.name, 'row', 'borderWidth', '1px')} solid ${groupVal(props.name, 'row', 'borderColor', 'currentColor')}`)
function rowStyle(r: Row, i: number): CSSProperties {
  return {
    ...(i > 0 ? { borderTop: rowEdge.value } : {}),
    ...(selected.value.has(r.name) ? groupStyle(props.name, 'rowSelected') : {}),
  }
}
// Stacked cards reuse the header's type + color for their labels, not its fill.
const labelStyle = computed<CSSProperties>(() => {
  const s = { ...groupStyle(props.name, 'header') }
  delete s.background
  return s
})
// The root border wraps the table; cells never inherit it.
const rootStyle = computed<CSSProperties>(() => ({ ...props.rootStyle, overflow: 'hidden' }))
</script>

<template>
  <div class="tbl" :class="{ 'tbl--stacked': stacked }" :data-testid="testid" :style="rootStyle">
    <table v-if="!stacked" class="tbl__table">
      <thead :style="groupStyle(name, 'header')">
        <tr>
          <th v-if="selectable" scope="col" class="tbl__select" :style="cell">
            <input type="checkbox" :checked="allSelected" aria-label="Select all rows" @change="toggleAll" />
          </th>
          <th
            v-for="c in COLS"
            :key="c.key"
            scope="col"
            :aria-sort="sortable && sortKey === c.key ? sortDir : undefined"
            :style="cell"
          >
            <button v-if="sortable" type="button" class="tbl__sort" @click="sortBy(c.key)">
              {{ c.label }}
              <component :is="sortKey !== c.key ? ArrowUpDown : sortDir === 'ascending' ? ArrowUp : ArrowDown" :size="12" aria-hidden="true" />
            </button>
            <template v-else>{{ c.label }}</template>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(r, i) in rows" :key="r.name" :aria-selected="selectable ? selected.has(r.name) : undefined" :style="rowStyle(r, i)">
          <td v-if="selectable" class="tbl__select" :style="cell">
            <input type="checkbox" :checked="selected.has(r.name)" :aria-label="`Select ${r.name}`" @change="toggle(r.name)" />
          </td>
          <td v-for="c in COLS" :key="c.key" :style="cell">{{ r[c.key] }}</td>
        </tr>
      </tbody>
    </table>

    <ul v-else class="tbl__cards" aria-label="Members">
      <li v-for="(r, i) in rows" :key="r.name" class="tbl__card" :style="{ ...cell, ...rowStyle(r, i) }">
        <label v-if="selectable" class="tbl__card-select">
          <input type="checkbox" :checked="selected.has(r.name)" :aria-label="`Select ${r.name}`" @change="toggle(r.name)" />
        </label>
        <dl class="tbl__dl">
          <template v-for="c in COLS" :key="c.key">
            <dt :style="labelStyle">{{ c.label }}</dt>
            <dd class="tbl__dd">{{ r[c.key] }}</dd>
          </template>
        </dl>
      </li>
    </ul>

    <!-- pagination slot -->
    <div class="tbl__footer" :style="{ ...cell, borderTop: rowEdge }">
      <span>1–3 of 24</span>
      <span class="tbl__pager" aria-hidden="true">‹ ›</span>
    </div>
  </div>
</template>

<style scoped>
.tbl {
  width: 30rem;
  max-width: 100%;
  box-sizing: border-box;
}
.tbl__table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}
.tbl__table th {
  font-weight: inherit;
}
.tbl__select {
  width: 1%;
}
.tbl__sort {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  font: inherit;
  color: inherit;
  text-transform: inherit;
  letter-spacing: inherit;
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
}
.tbl__sort:focus-visible,
.tbl input:focus-visible {
  outline: 2px solid var(--color-interactive-focus-ring);
  outline-offset: 2px;
}
.tbl input[type='checkbox'] {
  accent-color: var(--color-primary);
}
.tbl__cards {
  margin: 0;
  padding: 0;
  list-style: none;
}
.tbl__card {
  display: flex;
  gap: var(--spacing-sm);
  align-items: flex-start;
}
.tbl__dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2px var(--spacing-sm);
  margin: 0;
  flex: 1;
}
.tbl__dd {
  margin: 0;
}
.tbl__footer {
  display: flex;
  justify-content: space-between;
  opacity: 0.8;
}
</style>
