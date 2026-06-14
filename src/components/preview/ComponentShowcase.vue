<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { Info, CircleCheck, TriangleAlert, CircleAlert } from '@lucide/vue'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import type { ComponentBlueprint } from '@/types/schema'
import { resolveComponentStyle } from '@/utils/previewStyle'
import type { CSSProperties, Component } from 'vue'

const store = useDesignSystemStore()
const { schema, viewportWidth } = storeToRefs(store)

// Alert: icon + title/message driven by the blueprint's prop defaults.
const alertBp = computed(() => schema.value.componentBlueprints.Alert)
const alertCfg = computed(() => ({
  placement: (alertBp.value?.props.iconPlacement?.default as string) ?? 'leading',
  content: (alertBp.value?.props.content?.default as string) ?? 'title-message',
}))
const ALERT_ICONS: Record<string, Component> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
}
const ALERT_TITLES: Record<string, string> = {
  info: 'Information',
  success: 'Success',
  warning: 'Warning',
  error: 'Error',
}
const alertIcon = (v: string) => ALERT_ICONS[v] ?? Info
const alertTitle = (v: string) => ALERT_TITLES[v] ?? v

interface VariantRender {
  variant: string
  style: CSSProperties
  hidden: boolean
}
interface Rendered {
  name: string
  variants: VariantRender[]
}

const rendered = computed<Rendered[]>(() =>
  Object.values(schema.value.componentBlueprints).map((bp: ComponentBlueprint) => {
    // No declared variants → a single "default" sample from base tokens.
    const variants = bp.variants.length ? bp.variants : ['default']
    return {
      name: bp.name,
      variants: variants.map((variant) => {
        const { style, hidden } = resolveComponentStyle(
          schema.value,
          bp,
          viewportWidth.value,
          bp.variants.length ? variant : undefined,
        )
        return { variant, style, hidden }
      }),
    }
  }),
)

// Sample label per component for the rendered element's inner text.
function sampleText(name: string, variant: string): string {
  return variant === 'default' ? name : variant
}
</script>

<template>
  <div class="showcase">
    <section v-for="c in rendered" :key="c.name" class="showcase__group">
      <header class="showcase__name">{{ c.name }}</header>
      <div class="showcase__variants">
        <div v-for="(vr, i) in c.variants" :key="vr.variant" class="showcase__cell">
          <span class="showcase__variant-label">{{ vr.variant }}</span>

          <template v-if="!vr.hidden">
            <button
              v-if="c.name === 'Button'"
              :data-testid="i === 0 ? `preview-${c.name}` : `preview-${c.name}-${vr.variant}`"
              :style="vr.style"
            >
              {{ sampleText(c.name, vr.variant) }}
            </button>

            <input
              v-else-if="c.name === 'Input'"
              :data-testid="i === 0 ? `preview-${c.name}` : `preview-${c.name}-${vr.variant}`"
              :style="vr.style"
              placeholder="Placeholder"
            />

            <span
              v-else-if="c.name === 'Badge'"
              :data-testid="i === 0 ? `preview-${c.name}` : `preview-${c.name}-${vr.variant}`"
              :style="vr.style"
              >{{ sampleText(c.name, vr.variant) }}</span
            >

            <div
              v-else-if="c.name === 'Card'"
              :data-testid="i === 0 ? `preview-${c.name}` : `preview-${c.name}-${vr.variant}`"
              :style="vr.style"
            >
              <strong>Card title</strong>
              <p class="showcase__card-body">Grouped content lives here.</p>
            </div>

            <div
              v-else-if="c.name === 'Alert'"
              class="showcase__alert"
              :data-testid="i === 0 ? `preview-${c.name}` : `preview-${c.name}-${vr.variant}`"
              :style="vr.style"
            >
              <component
                :is="alertIcon(vr.variant)"
                v-if="alertCfg.placement === 'leading'"
                :size="16"
                :style="{ color: vr.style.borderColor }"
                aria-hidden="true"
              />
              <div class="showcase__alert-body">
                <strong v-if="alertCfg.content === 'title-message'">{{ alertTitle(vr.variant) }}</strong>
                <span>Something needs your attention.</span>
              </div>
              <component
                :is="alertIcon(vr.variant)"
                v-if="alertCfg.placement === 'trailing'"
                :size="16"
                :style="{ color: vr.style.borderColor }"
                aria-hidden="true"
              />
            </div>

            <label
              v-else-if="c.name === 'Checkbox'"
              class="showcase__checkbox-row"
              :data-testid="i === 0 ? `preview-${c.name}` : `preview-${c.name}-${vr.variant}`"
            >
              <span class="showcase__checkbox" :style="vr.style" />
              Label
            </label>

            <span
              v-else-if="c.name === 'Tooltip'"
              :data-testid="i === 0 ? `preview-${c.name}` : `preview-${c.name}-${vr.variant}`"
              :style="vr.style"
              >{{ sampleText(c.name, vr.variant) }}</span
            >

            <div
              v-else
              :data-testid="i === 0 ? `preview-${c.name}` : `preview-${c.name}-${vr.variant}`"
              :style="vr.style"
            >
              {{ sampleText(c.name, vr.variant) }}
            </div>
          </template>

          <span v-else class="showcase__hidden">hidden</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.showcase {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}
.showcase__group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}
.showcase__name {
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-on-surface-subtle);
  border-bottom: 1px solid var(--color-surface-border);
  padding-bottom: var(--spacing-xs);
}
.showcase__variants {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-lg);
  align-items: flex-start;
}
.showcase__cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
}
.showcase__variant-label {
  font-family: var(--font-sans);
  font-size: 10px;
  color: var(--color-on-surface-subtle);
}
.showcase__card-body {
  margin: var(--spacing-xs) 0 0;
  font-size: 13px;
  opacity: 0.8;
}
.showcase__alert {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  min-width: 240px;
}
.showcase__alert-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}
.showcase__alert-body span {
  font-size: 13px;
  opacity: 0.85;
}
.showcase__checkbox-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.showcase__checkbox {
  display: inline-block;
}
.showcase__hidden {
  font-family: var(--font-sans);
  font-size: 11px;
  font-style: italic;
  color: var(--color-on-surface-subtle);
}
button[data-testid],
input[data-testid] {
  cursor: pointer;
  border: 0;
}
</style>
