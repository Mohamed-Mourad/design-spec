<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'
import type { CSSProperties } from 'vue'
import { usePreviewKit, type PreviewProps } from './usePreviewKit'

const props = defineProps<PreviewProps>()
const { groupStyle, layoutReached, propDefault } = usePreviewKit()

const TABS = [
  { label: 'Overview', body: 'Project summary and recent changes.' },
  { label: 'Activity', body: 'Everything that happened this week.' },
  { label: 'Settings', body: 'Names, members, and integrations.' },
]
const uid = useId()
const selected = ref(0)
const tabEls = ref<HTMLButtonElement[]>([])

// Vertical only once the layout breakpoint is reached; below it tabs are one
// horizontal row that scrolls (mobile-first).
const vertical = computed(() => propDefault<string>(props.name, 'orientation', 'horizontal') === 'vertical' && layoutReached(props.name))

// The variant's border (line) draws only the edge the tabs sit on.
const listStyle = computed<CSSProperties>(() => {
  const s: CSSProperties = { ...props.rootStyle }
  if (s.borderColor || s.borderWidth) {
    const edge = `${s.borderWidth ?? '1px'} solid ${s.borderColor ?? 'currentColor'}`
    delete s.borderColor
    delete s.borderWidth
    delete s.borderStyle
    if (vertical.value) s.borderRight = edge
    else s.borderBottom = edge
  }
  return s
})
function tabStyle(i: number): CSSProperties {
  const base = groupStyle(props.name, 'tab')
  if (i !== selected.value) return base
  if (props.variant === 'pill') return { ...base, ...groupStyle(props.name, 'pillActive') }
  if (props.variant === 'contained') return { ...base, ...groupStyle(props.name, 'containedActive') }
  return { ...base, ...groupStyle(props.name, 'tabActive') }
}
const indicatorStyle = computed(() => groupStyle(props.name, 'indicator'))

function select(i: number, focus = false) {
  selected.value = (i + TABS.length) % TABS.length
  if (focus) nextTick(() => tabEls.value[selected.value]?.focus())
}
function onKey(e: KeyboardEvent) {
  const next = vertical.value ? 'ArrowDown' : 'ArrowRight'
  const prev = vertical.value ? 'ArrowUp' : 'ArrowLeft'
  if (e.key === next) select(selected.value + 1, true)
  else if (e.key === prev) select(selected.value - 1, true)
  else if (e.key === 'Home') select(0, true)
  else if (e.key === 'End') select(TABS.length - 1, true)
  else return
  e.preventDefault()
}
</script>

<template>
  <div class="tabs" :class="{ 'tabs--vertical': vertical }">
    <div
      role="tablist"
      class="tabs__list"
      :aria-orientation="vertical ? 'vertical' : 'horizontal'"
      :data-testid="testid"
      :style="listStyle"
      @keydown="onKey"
    >
      <button
        v-for="(t, i) in TABS"
        :id="`${uid}-tab-${i}`"
        :key="t.label"
        ref="tabEls"
        type="button"
        role="tab"
        class="tabs__tab"
        :aria-selected="i === selected"
        :aria-controls="`${uid}-panel`"
        :tabindex="i === selected ? 0 : -1"
        :style="tabStyle(i)"
        @click="select(i)"
      >
        {{ t.label }}
        <span v-if="variant === 'line' && i === selected" class="tabs__indicator" :style="indicatorStyle" aria-hidden="true" />
      </button>
    </div>
    <div :id="`${uid}-panel`" role="tabpanel" class="tabs__panel" :aria-labelledby="`${uid}-tab-${selected}`" tabindex="0" :style="groupStyle(name, 'panel')">
      {{ TABS[selected].body }}
    </div>
  </div>
</template>

<style scoped>
.tabs {
  display: flex;
  flex-direction: column;
  width: 22rem;
  max-width: 100%;
}
.tabs--vertical {
  flex-direction: row;
}
.tabs__list {
  display: flex;
  overflow-x: auto;
  scrollbar-width: thin;
  box-sizing: border-box;
  max-width: 100%;
}
.tabs--vertical .tabs__list {
  flex-direction: column;
  overflow-x: visible;
  flex-shrink: 0;
}
.tabs__tab {
  position: relative;
  flex-shrink: 0;
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  cursor: pointer;
  white-space: nowrap;
  text-align: left;
}
.tabs__tab:focus-visible,
.tabs__panel:focus-visible {
  outline: 2px solid var(--color-interactive-focus-ring);
  outline-offset: -2px;
}
.tabs__indicator {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 0;
}
.tabs--vertical .tabs__indicator {
  left: auto;
  top: 0;
  width: 2px;
  height: auto !important;
}
.tabs__panel {
  flex: 1;
  min-width: 0;
}
@media (prefers-reduced-motion: no-preference) {
  .tabs__tab {
    transition: background-color 150ms ease-out, color 150ms ease-out;
  }
}
</style>
