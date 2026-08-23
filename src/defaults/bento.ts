import type { BentoCellConfig, BentoLayoutConfig } from '@/types/schema'

export type BentoCellId = BentoCellConfig['id']

/**
 * Cell order as it ships. A stored layout is merged against this list rather
 * than replacing it, so a schema that adds a cell later shows up for systems
 * saved before it existed instead of silently disappearing from their preview.
 */
export const BENTO_CELL_IDS: readonly BentoCellId[] = [
  'identity',
  'colors',
  'typography',
  'spacing',
  'radius',
  'shadows',
  'buttons',
  'inputs',
  'cards',
  'badges',
  'motion',
]

export const BENTO_CELL_LABELS: Record<BentoCellId, string> = {
  identity: 'Identity',
  colors: 'Colors',
  typography: 'Typography',
  spacing: 'Spacing',
  radius: 'Radius',
  shadows: 'Elevation',
  buttons: 'Buttons',
  inputs: 'Inputs',
  cards: 'Cards',
  badges: 'Badges',
  motion: 'Motion',
}

/** Cells wide enough that a half-width tile would crop their content. */
const DEFAULT_SPANS: Partial<Record<BentoCellId, 1 | 2>> = {
  identity: 2,
  colors: 2,
  typography: 2,
}

export function defaultBentoLayout(): BentoLayoutConfig {
  return {
    cells: BENTO_CELL_IDS.map((id) => ({ id, visible: true, span: DEFAULT_SPANS[id] ?? 1 })),
    gridColumns: 4,
    theme: 'dark',
    showTitle: true,
    showDescription: true,
  }
}

/**
 * A stored layout, completed. Unknown ids are dropped (a cell removed from the
 * schema must not render), missing ids are appended in canonical order, and the
 * user's ordering of the cells they did configure is preserved.
 */
export function resolveBentoLayout(stored?: BentoLayoutConfig): BentoLayoutConfig {
  const base = defaultBentoLayout()
  if (!stored) return base

  const known = new Set<string>(BENTO_CELL_IDS)
  const seen = new Set<string>()
  const cells: BentoCellConfig[] = []
  for (const cell of stored.cells ?? []) {
    if (!known.has(cell.id) || seen.has(cell.id)) continue
    seen.add(cell.id)
    cells.push({ ...cell })
  }
  for (const fallback of base.cells) {
    if (!seen.has(fallback.id)) cells.push(fallback)
  }

  return {
    cells,
    gridColumns: stored.gridColumns ?? base.gridColumns,
    theme: stored.theme ?? base.theme,
    showTitle: stored.showTitle ?? base.showTitle,
    showDescription: stored.showDescription ?? base.showDescription,
  }
}
