<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { Smartphone, Tablet, Monitor, Maximize, Moon, Sun } from '@lucide/vue'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import ComponentShowcase from '@/components/preview/ComponentShowcase.vue'
import PreviewInspector from '@/components/preview/PreviewInspector.vue'

const store = useDesignSystemStore()
const { schema, activeViewport, viewportWidth, previewDark, selectedComponent } = storeToRefs(store)

const viewports = [
  { id: 'mobile', icon: Smartphone, label: '375' },
  { id: 'tablet', icon: Tablet, label: '768' },
  { id: 'desktop', icon: Monitor, label: '1280' },
  { id: 'fit', icon: Maximize, label: 'Fit' },
] as const

// Inject the *current schema's* tokens as CSS custom properties so the preview
// reflects live edits. Dark mode swaps in schema.darkMode.colors overrides.
const previewVars = computed<Record<string, string>>(() => {
  const vars: Record<string, string> = {}
  const dark = previewDark.value ? schema.value.darkMode.colors : {}
  for (const [k, v] of Object.entries(schema.value.colors)) {
    vars[`--color-${k}`] = (dark[k] as string | undefined) ?? v
  }
  for (const [k, v] of Object.entries(schema.value.spacing)) vars[`--spacing-${k}`] = String(v)
  for (const [k, v] of Object.entries(schema.value.rounded)) vars[`--rounded-${k}`] = String(v)
  for (const [k, v] of Object.entries(schema.value.shadows)) {
    vars[`--shadow-${k}`] = Array.isArray(v.value) ? v.value.join(', ') : v.value
  }
  return vars
})

const frameStyle = computed(() => ({
  width: Number.isFinite(viewportWidth.value) ? `${viewportWidth.value}px` : '100%',
  maxWidth: '100%',
}))
</script>

<template>
  <main class="center-panel">
    <div class="center-panel__header">
      <span class="center-panel__label">Live Preview</span>
      <div class="center-panel__viewports" role="group" aria-label="Preview viewport">
        <button
          v-for="vp in viewports"
          :key="vp.id"
          class="center-panel__vp"
          :class="{ 'center-panel__vp--active': activeViewport === vp.id }"
          :aria-pressed="activeViewport === vp.id"
          :title="`${vp.id} (${vp.label})`"
          @click="store.setViewport(vp.id)"
        >
          <component :is="vp.icon" :size="14" aria-hidden="true" />
          <span class="center-panel__vp-label">{{ vp.label }}</span>
        </button>
      </div>
      <button
        class="center-panel__dark"
        :aria-pressed="previewDark"
        :title="previewDark ? 'Switch to light' : 'Switch to dark'"
        @click="store.togglePreviewDark()"
      >
        <component :is="previewDark ? Sun : Moon" :size="14" aria-hidden="true" />
      </button>
    </div>

    <div class="center-panel__scroll">
      <div
        class="center-panel__frame"
        :style="[previewVars, frameStyle]"
        data-testid="preview-frame"
      >
        <ComponentShowcase />
      </div>
    </div>

    <div v-if="selectedComponent" class="center-panel__inspector">
      <PreviewInspector />
    </div>
  </main>
</template>

<style scoped>
.center-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  background-color: var(--color-surface-page);
  overflow: hidden;
}
.center-panel__inspector {
  position: absolute;
  top: 52px;
  right: var(--spacing-md);
  bottom: var(--spacing-md);
  z-index: var(--z-raised);
  display: flex;
  pointer-events: none;
}
.center-panel__inspector > * {
  pointer-events: auto;
}
.center-panel__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
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
.center-panel__viewports {
  display: flex;
  gap: 2px;
  margin-left: auto;
}
.center-panel__vp {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--color-on-surface-muted);
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 10px;
}
.center-panel__vp:hover {
  color: var(--color-on-surface);
}
.center-panel__vp--active {
  color: var(--color-on-surface);
  background-color: var(--color-surface-raised);
  border-color: var(--color-surface-border);
}
.center-panel__vp-label {
  line-height: 1;
}
.center-panel__dark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 24px;
  background: none;
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-sm);
  color: var(--color-on-surface-muted);
  cursor: pointer;
}
.center-panel__dark:hover {
  color: var(--color-on-surface);
}
.center-panel__scroll {
  flex: 1;
  overflow: auto;
  display: flex;
  justify-content: center;
  padding: var(--spacing-xl);
}
.center-panel__frame {
  background-color: var(--color-surface-page);
  color: var(--color-on-surface);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  height: fit-content;
  transition: width var(--transition-duration-normal) var(--transition-easing-ease-out);
  font-family: var(--font-sans);
}
</style>
