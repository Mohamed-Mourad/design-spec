<script setup lang="ts">
import { computed } from 'vue'
import type { CSSProperties } from 'vue'
import { BENTO_CELL_LABELS, resolveBentoLayout, type BentoCellId } from '@/defaults/bento'
import { schemaCssVars } from '@/utils/previewStyle'
import type { BentoLayoutConfig, DesignSystemSchema, WebPresentationConfig } from '@/types/schema'
import BentoCell from './BentoCell.vue'
import IdentityCell from './cells/IdentityCell.vue'
import ColorsCell from './cells/ColorsCell.vue'
import TypographyCell from './cells/TypographyCell.vue'
import ScaleCell from './cells/ScaleCell.vue'
import ShadowsCell from './cells/ShadowsCell.vue'
import MotionCell from './cells/MotionCell.vue'
import ComponentCell from './cells/ComponentCell.vue'

/**
 * Presentational. Everything it draws comes from props — no store, no router,
 * no fetch — because the same component renders the workspace preview, a
 * hash-shared link, a published proposal and the off-screen OG capture.
 */
const props = withDefaults(
  defineProps<{
    schema: DesignSystemSchema
    /** Overrides the layout stored on `schema.presentation.bentoLayout`. */
    layout?: BentoLayoutConfig
    branding?: WebPresentationConfig['proposalBranding']
  }>(),
  {},
)

const layout = computed(() =>
  resolveBentoLayout(props.layout ?? props.schema.presentation?.bentoLayout),
)

const visibleCells = computed(() => layout.value.cells.filter((c) => c.visible))

/** `system` follows the viewer's OS; the other two are the author's choice. */
const dark = computed(() => layout.value.theme === 'dark')

const BLUEPRINT_FOR: Partial<Record<BentoCellId, string>> = {
  buttons: 'Button',
  inputs: 'Input',
  cards: 'Card',
  badges: 'Badge',
}

/**
 * Per-blueprint thumbnail factor. A Card carries a title, body and padding, so
 * it needs to shrink much harder than a Badge to sit in the same tile.
 */
const THUMB_SCALE: Record<string, number> = { Button: 0.9, Input: 0.85, Card: 0.62, Badge: 1 }

function labelFor(id: BentoCellId, custom?: string): string {
  return custom?.trim() || BENTO_CELL_LABELS[id]
}

const rootStyle = computed<CSSProperties>(() => ({
  ...schemaCssVars(props.schema, dark.value),
  '--bento-columns': String(layout.value.gridColumns),
  ...(props.branding?.accentColor ? { '--bento-accent': props.branding.accentColor } : {}),
}))
</script>

<template>
  <div
    class="bento"
    :class="[`bento--${layout.theme}`]"
    :style="rootStyle"
    data-testid="bento-preview"
  >
    <header v-if="layout.showTitle || branding?.logoUrl" class="bento__header">
      <img
        v-if="branding?.logoUrl"
        class="bento__logo"
        :src="branding.logoUrl"
        :alt="branding.companyName ? `${branding.companyName} logo` : 'Logo'"
      />
      <div class="bento__titles">
        <p v-if="branding?.companyName" class="bento__company">{{ branding.companyName }}</p>
        <h1 v-if="layout.showTitle" class="bento__title">{{ schema.name }}</h1>
        <p v-if="layout.showDescription && schema.description" class="bento__subtitle">
          {{ schema.description }}
        </p>
      </div>
    </header>

    <div class="bento__grid">
      <BentoCell
        v-for="cell in visibleCells"
        :key="cell.id"
        :label="labelFor(cell.id, cell.customLabel)"
        :span="cell.span"
        :data-bento-cell="cell.id"
      >
        <IdentityCell v-if="cell.id === 'identity'" :schema="schema" />
        <ColorsCell v-else-if="cell.id === 'colors'" :schema="schema" :dark="dark" />
        <TypographyCell v-else-if="cell.id === 'typography'" :schema="schema" />
        <ScaleCell v-else-if="cell.id === 'spacing'" :tokens="schema.spacing" render="bar" />
        <ScaleCell v-else-if="cell.id === 'radius'" :tokens="schema.rounded" render="radius" />
        <ShadowsCell v-else-if="cell.id === 'shadows'" :schema="schema" />
        <MotionCell v-else-if="cell.id === 'motion'" :schema="schema" />
        <ComponentCell
          v-else
          :schema="schema"
          :blueprint="BLUEPRINT_FOR[cell.id] ?? 'Button'"
          :scale="THUMB_SCALE[BLUEPRINT_FOR[cell.id] ?? 'Button'] ?? 1"
        />
      </BentoCell>
    </div>

    <footer v-if="!branding?.hideDesignSpecBranding" class="bento__footer">
      <span>Made with Design Spec</span>
    </footer>
  </div>
</template>

<style scoped>
/*
 * The bento's own chrome is a neutral frame, deliberately independent of the
 * system being shown: a design system whose surface color is near-white must
 * still be legible inside it, and vice versa. The system's tokens are the
 * content of the cells, never the frame around them.
 */
.bento {
  --bento-bg: #0f0e0c;
  --bento-surface: #161513;
  --bento-surface-raised: #1f1d1a;
  --bento-border: #2c2a27;
  --bento-border-subtle: #201f1c;
  --bento-fg: #f0ede6;
  --bento-fg-muted: #9b9690;
  --bento-fg-subtle: #615e59;
  --bento-accent: #c8813d;

  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 28px;
  background-color: var(--bento-bg);
  color: var(--bento-fg);
}

.bento--light {
  --bento-bg: #faf8f4;
  --bento-surface: #ffffff;
  --bento-surface-raised: #f2efe9;
  --bento-border: #e2ddd4;
  --bento-border-subtle: #eeeae3;
  --bento-fg: #1f1d1a;
  --bento-fg-muted: #5c5852;
  --bento-fg-subtle: #918b83;
}

@media (prefers-color-scheme: light) {
  .bento--system {
    --bento-bg: #faf8f4;
    --bento-surface: #ffffff;
    --bento-surface-raised: #f2efe9;
    --bento-border: #e2ddd4;
    --bento-border-subtle: #eeeae3;
    --bento-fg: #1f1d1a;
    --bento-fg-muted: #5c5852;
    --bento-fg-subtle: #918b83;
  }
}

.bento__header {
  display: flex;
  align-items: center;
  gap: 14px;
}

.bento__logo {
  height: 34px;
  width: auto;
  max-width: 160px;
  object-fit: contain;
}

.bento__titles {
  min-width: 0;
}

.bento__company {
  margin: 0 0 2px;
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--bento-fg-subtle);
}

.bento__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 26px;
  font-weight: 400;
  letter-spacing: -0.01em;
  color: var(--bento-fg);
}

.bento__subtitle {
  margin: 4px 0 0;
  max-width: 68ch;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--bento-fg-muted);
}

.bento__grid {
  display: grid;
  grid-template-columns: repeat(var(--bento-columns), minmax(0, 1fr));
  gap: 14px;
}

@media (max-width: 720px) {
  .bento__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.bento__footer {
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--bento-fg-subtle);
}
</style>
