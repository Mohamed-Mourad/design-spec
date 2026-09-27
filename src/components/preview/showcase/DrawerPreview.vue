<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'
import type { CSSProperties } from 'vue'
import { X } from '@lucide/vue'
import { resolveValue } from '@design-spec/compiler'
import { usePreviewKit, type PreviewProps } from './usePreviewKit'

const props = defineProps<PreviewProps>()
const { schema, group, groupStyle, groupVal, layoutReached, propDefault } = usePreviewKit()

// Starts open so token edits are visible at a glance; the trigger reopens it.
const open = ref(true)
const titleId = useId()
const panel = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)

const title = computed(() => propDefault(props.name, 'title', 'Filters'))
// Mobile-first: a bottom sheet until the layout breakpoint, then the chosen edge.
const side = computed(() => (layoutReached(props.name) ? propDefault<string>(props.name, 'side', 'right') : 'bottom'))
const sheet = computed(() => side.value === 'bottom')

const panelStyle = computed<CSSProperties>(() => {
  const s: CSSProperties = { ...props.rootStyle }
  if (sheet.value) {
    // A sheet spans the width; its top corners take the sheet radius.
    delete s.width
    const r = groupVal(props.name, 'sheet', 'rounded', '0px')
    s.borderRadius = `${r} ${r} 0 0`
  }
  return s
})
const overlayStyle = computed<CSSProperties>(() => {
  const o = group(props.name, 'overlay')
  const opacity = Number(resolveValue(schema.value, o?.opacity))
  return { ...groupStyle(props.name, 'overlay'), opacity: Number.isFinite(opacity) ? opacity : 0.5 }
})
const headerStyle = computed<CSSProperties>(() => {
  const h = groupStyle(props.name, 'header')
  const edge = `${h.borderWidth ?? '1px'} solid ${h.borderColor ?? 'currentColor'}`
  return { ...h, borderStyle: undefined, borderWidth: undefined, borderColor: undefined, borderBottom: edge }
})

async function show() {
  open.value = true
  await nextTick()
  panel.value?.focus()
}
async function close() {
  open.value = false
  await nextTick()
  trigger.value?.focus()
}
</script>

<template>
  <div class="dr" :data-side="side">
    <div class="dr__page">
      <span class="dr__line" />
      <span class="dr__line dr__line--short" />
      <button ref="trigger" type="button" class="showcase__btn" :aria-expanded="open" data-testid="drawer-trigger" :style="{ background: 'var(--color-primary)', color: 'var(--color-on-primary)', borderRadius: 'var(--rounded-md)' }" @click="show">
        Open drawer
      </button>
    </div>
    <template v-if="open">
      <div class="dr__overlay" :style="overlayStyle" data-testid="drawer-overlay" aria-hidden="true" @click="close" />
      <section
        ref="panel"
        role="dialog"
        :aria-labelledby="titleId"
        tabindex="-1"
        class="dr__panel"
        :class="`dr__panel--${side}`"
        :data-testid="testid"
        :style="panelStyle"
        @keydown.esc.stop="close"
      >
        <header class="dr__header" :style="headerStyle">
          <h3 :id="titleId" class="dr__title">{{ title }}</h3>
          <button type="button" class="dr__close" aria-label="Close drawer" @click="close"><X :size="16" aria-hidden="true" /></button>
        </header>
        <p class="dr__body">Status, owner, and date range.</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.dr {
  position: relative;
  width: 28rem;
  max-width: 100%;
  height: 15rem;
  overflow: hidden;
  border: 1px solid var(--color-surface-border);
  border-radius: var(--rounded-md);
  background: var(--color-surface-page);
}
.dr__page {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
}
.dr__line {
  display: block;
  width: 70%;
  height: 8px;
  border-radius: var(--rounded-full);
  background: var(--color-surface-overlay);
}
.dr__line--short {
  width: 45%;
}
.dr__overlay {
  position: absolute;
  inset: 0;
}
.dr__panel {
  position: absolute;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  outline: none;
}
.dr__panel:focus-visible {
  outline: 2px solid var(--color-interactive-focus-ring);
  outline-offset: -2px;
}
.dr__panel--right,
.dr__panel--left {
  top: 0;
  bottom: 0;
  max-width: 85%;
}
.dr__panel--right {
  right: 0;
}
.dr__panel--left {
  left: 0;
}
.dr__panel--bottom {
  left: 0;
  right: 0;
  bottom: 0;
  max-height: 80%;
}
.dr__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  padding-bottom: var(--spacing-sm);
}
.dr__title {
  margin: 0;
  font: inherit;
}
.dr__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  min-height: 32px;
  background: none;
  border: 0;
  color: inherit;
  cursor: pointer;
}
.dr__close:focus-visible {
  outline: 2px solid var(--color-interactive-focus-ring);
}
.dr__body {
  margin: 0;
  font-size: 13px;
  opacity: 0.8;
}
@media (prefers-reduced-motion: no-preference) {
  .dr__panel--right {
    animation: dr-in-right 200ms ease-out;
  }
  .dr__panel--left {
    animation: dr-in-left 200ms ease-out;
  }
  .dr__panel--bottom {
    animation: dr-in-bottom 200ms ease-out;
  }
}
@keyframes dr-in-right {
  from {
    transform: translateX(100%);
  }
}
@keyframes dr-in-left {
  from {
    transform: translateX(-100%);
  }
}
@keyframes dr-in-bottom {
  from {
    transform: translateY(100%);
  }
}
</style>
