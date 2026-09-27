<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CSSProperties } from 'vue'
import { storeToRefs } from 'pinia'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import type { ComponentBlueprint } from '@/types/schema'
import { resolveComponentStyle } from '@/utils/previewStyle'
import { previewFor } from '@/components/preview/showcase/registry'
import '@/components/preview/showcase/showcase.css'

// The showcase frame: one selectable section per blueprint, one cell per
// variant. Each cell's content comes from the blueprint's renderer in
// `showcase/` (registry), handed the resolved root style for its variant.

const store = useDesignSystemStore()
const { schema, viewportWidth, selectedComponent } = storeToRefs(store)

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
  return vr.hoverStyle && hovered.value === key(name, vr.variant) ? vr.hoverStyle : vr.style
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
          <component
            :is="previewFor(c.name)"
            v-if="!vr.hidden"
            :name="c.name"
            :variant="vr.variant"
            :testid="i === 0 ? `preview-${c.name}` : `preview-${c.name}-${vr.variant}`"
            :root-style="styleFor(c.name, vr)"
          />
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
  border-color: var(--ds-accent);
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
  color: var(--ds-accent);
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
.showcase__hidden {
  font-family: var(--font-sans);
  font-size: 11px;
  font-style: italic;
  color: var(--color-on-surface-subtle);
}
</style>
