<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { Info, CircleCheck, TriangleAlert, CircleAlert, X } from '@lucide/vue'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import type { ComponentBlueprint } from '@/types/schema'
import { resolveComponentStyle } from '@/utils/previewStyle'
import type { CSSProperties, Component } from 'vue'

const store = useDesignSystemStore()
const { schema, viewportWidth, selectedComponent } = storeToRefs(store)

// Alert: icon + title/message driven by the blueprint's prop defaults.
const alertBp = computed(() => schema.value.componentBlueprints.Alert)
const alertCfg = computed(() => ({
  placement: (alertBp.value?.props.iconPlacement?.default as string) ?? 'leading',
  content: (alertBp.value?.props.content?.default as string) ?? 'title-message',
}))
const ALERT_ICONS: Record<string, Component> = { info: Info, success: CircleCheck, warning: TriangleAlert, error: CircleAlert }
const ALERT_TITLES: Record<string, string> = { info: 'Information', success: 'Success', warning: 'Warning', error: 'Error' }
const alertIcon = (v: string) => ALERT_ICONS[v] ?? Info
const alertTitle = (v: string) => ALERT_TITLES[v] ?? v

// Blueprint capability helpers (driven by suggestions in the inspector).
const bpOf = (n: string) => schema.value.componentBlueprints[n]
const anatomyHas = (n: string, k: string) => bpOf(n)?.anatomy.includes(k) ?? false
const isDismissible = (n: string) => bpOf(n)?.props.dismissible?.default === true || anatomyHas(n, 'close')
const hasHover = (n: string) => !!bpOf(n)?.tokens.hover

interface VariantRender {
  variant: string
  style: CSSProperties
  hoverStyle: CSSProperties | null
  hidden: boolean
}
interface Rendered {
  name: string
  variants: VariantRender[]
}

const rendered = computed<Rendered[]>(() =>
  Object.values(schema.value.componentBlueprints).map((bp: ComponentBlueprint) => {
    const variants = bp.variants.length ? bp.variants : ['default']
    return {
      name: bp.name,
      variants: variants.map((variant) => {
        const v = bp.variants.length ? variant : undefined
        const { style, hidden } = resolveComponentStyle(schema.value, bp, viewportWidth.value, v)
        const hoverStyle = bp.tokens.hover
          ? resolveComponentStyle(schema.value, bp, viewportWidth.value, v, ['hover']).style
          : null
        return { variant, style, hoverStyle, hidden }
      }),
    }
  }),
)

const hovered = ref<string | null>(null)
const key = (name: string, variant: string) => `${name}:${variant}`
function styleFor(name: string, vr: VariantRender): CSSProperties {
  return hasHover(name) && vr.hoverStyle && hovered.value === key(name, vr.variant) ? vr.hoverStyle : vr.style
}

function sampleText(name: string, variant: string): string {
  return variant === 'default' ? name : variant
}
</script>

<template>
  <div class="showcase">
    <section
      v-for="c in rendered"
      :key="c.name"
      class="showcase__group"
      :class="{ 'showcase__group--selected': selectedComponent === c.name }"
      role="button"
      :tabindex="0"
      @click="store.selectComponent(c.name)"
      @keydown.enter="store.selectComponent(c.name)"
    >
      <header class="showcase__name">{{ c.name }}<span class="showcase__edit">edit</span></header>
      <div class="showcase__variants">
        <div
          v-for="(vr, i) in c.variants"
          :key="vr.variant"
          class="showcase__cell"
          @mouseenter="hovered = key(c.name, vr.variant)"
          @mouseleave="hovered = null"
        >
          <span class="showcase__variant-label">{{ vr.variant }}</span>

          <template v-if="!vr.hidden">
            <button v-if="c.name === 'Button'" :data-testid="i === 0 ? `preview-${c.name}` : `preview-${c.name}-${vr.variant}`" :style="styleFor(c.name, vr)">
              {{ sampleText(c.name, vr.variant) }}
            </button>

            <input v-else-if="c.name === 'Input'" :data-testid="i === 0 ? `preview-${c.name}` : `preview-${c.name}-${vr.variant}`" :style="styleFor(c.name, vr)" placeholder="Placeholder" />

            <span v-else-if="c.name === 'Badge'" :data-testid="i === 0 ? `preview-${c.name}` : `preview-${c.name}-${vr.variant}`" :style="styleFor(c.name, vr)">{{ sampleText(c.name, vr.variant) }}</span>

            <!-- Card: title, optional separator, body, optional actions/close -->
            <div v-else-if="c.name === 'Card'" class="showcase__card" :data-testid="i === 0 ? `preview-${c.name}` : `preview-${c.name}-${vr.variant}`" :style="styleFor(c.name, vr)">
              <div class="showcase__card-head">
                <strong>Card title</strong>
                <button v-if="isDismissible('Card')" class="showcase__x" aria-label="Close"><X :size="14" /></button>
              </div>
              <hr v-if="anatomyHas('Card', 'separator')" class="showcase__sep" />
              <p class="showcase__card-body">Grouped content lives here.</p>
              <div v-if="anatomyHas('Card', 'actions')" class="showcase__actions">
                <button class="showcase__btn showcase__btn--ghost">Cancel</button>
                <button class="showcase__btn showcase__btn--primary">Confirm</button>
              </div>
            </div>

            <!-- Alert: icon + title/message, optional separator, actions, close -->
            <div v-else-if="c.name === 'Alert'" class="showcase__alert" :data-testid="i === 0 ? `preview-${c.name}` : `preview-${c.name}-${vr.variant}`" :style="styleFor(c.name, vr)">
              <component :is="alertIcon(vr.variant)" v-if="alertCfg.placement === 'leading'" :size="16" :style="{ color: vr.style.borderColor }" aria-hidden="true" />
              <div class="showcase__alert-body">
                <strong v-if="alertCfg.content === 'title-message'">{{ alertTitle(vr.variant) }}</strong>
                <hr v-if="anatomyHas('Alert', 'separator')" class="showcase__sep" />
                <span>Something needs your attention.</span>
                <div v-if="anatomyHas('Alert', 'actions')" class="showcase__actions">
                  <button class="showcase__btn showcase__btn--ghost">Dismiss</button>
                  <button class="showcase__btn showcase__btn--primary">View</button>
                </div>
              </div>
              <component :is="alertIcon(vr.variant)" v-if="alertCfg.placement === 'trailing'" :size="16" :style="{ color: vr.style.borderColor }" aria-hidden="true" />
              <button v-if="isDismissible('Alert')" class="showcase__x" aria-label="Close"><X :size="14" /></button>
            </div>

            <label v-else-if="c.name === 'Checkbox'" class="showcase__checkbox-row" :data-testid="i === 0 ? `preview-${c.name}` : `preview-${c.name}-${vr.variant}`">
              <span class="showcase__checkbox" :style="styleFor(c.name, vr)" />
              Label
            </label>

            <span v-else-if="c.name === 'Tooltip'" :data-testid="i === 0 ? `preview-${c.name}` : `preview-${c.name}-${vr.variant}`" :style="styleFor(c.name, vr)">{{ sampleText(c.name, vr.variant) }}</span>

            <div v-else :data-testid="i === 0 ? `preview-${c.name}` : `preview-${c.name}-${vr.variant}`" :style="styleFor(c.name, vr)">{{ sampleText(c.name, vr.variant) }}</div>
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
  gap: var(--spacing-lg);
}
.showcase__group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color var(--transition-duration-fast) var(--transition-easing-ease-out);
}
.showcase__group:hover {
  border-color: var(--color-surface-border);
}
.showcase__group--selected {
  border-color: var(--color-primary);
}
.showcase__name {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-on-surface-subtle);
  border-bottom: 1px solid var(--color-surface-border);
  padding-bottom: var(--spacing-xs);
}
.showcase__edit {
  font-size: 10px;
  color: var(--color-primary);
  opacity: 0;
  transition: opacity var(--transition-duration-fast) var(--transition-easing-ease-out);
}
.showcase__group:hover .showcase__edit {
  opacity: 1;
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
.showcase__card {
  display: flex;
  flex-direction: column;
  min-width: 200px;
}
.showcase__card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
.showcase__sep {
  width: 100%;
  border: 0;
  border-top: 1px solid currentColor;
  opacity: 0.2;
  margin: var(--spacing-xs) 0;
}
.showcase__x {
  display: inline-flex;
  background: none;
  border: none;
  color: currentColor;
  opacity: 0.6;
  cursor: pointer;
  padding: 0;
}
.showcase__x:hover {
  opacity: 1;
}
.showcase__actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
}
.showcase__btn {
  font-family: var(--font-sans);
  font-size: 12px;
  border-radius: var(--radius-sm);
  padding: 4px 10px;
  border: 1px solid var(--color-surface-border);
  cursor: pointer;
}
.showcase__btn--primary {
  background: var(--color-primary);
  color: var(--color-on-primary);
  border-color: var(--color-primary);
}
.showcase__btn--ghost {
  background: transparent;
  color: inherit;
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
