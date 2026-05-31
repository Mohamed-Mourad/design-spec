// scaleMatch.ts — dimensional proximity matching for the auto-refactor engine.
//
// Pure and deterministic. Snaps a raw pixel measurement (spacing step, margin,
// radius) to the nearest scale token. A value snaps only when the nearest token
// is within a strict ≤ 2px delta. If the value sits equidistant between two
// distinct scale slots, OR no slot is within 2px, it bypasses remediation
// (returns null) — snapping there would silently corrupt the layout.

import type { DesignSystemSchema } from './types/schema.js'

/** Max px delta for an automated dimensional snap. ≤ this → fixable. */
export const SCALE_PX_THRESHOLD = 2

/** A `DimensionValue` to its px magnitude, or null for non-px units (rem/em). */
function parsePx(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return null
  const m = value.match(/^(\d+(?:\.\d+)?)px$/)
  return m ? Number(m[1]) : null
}

/**
 * Nearest spacing/rounded token to a px value. Spacing is searched before
 * rounded, each in insertion order, so the result is deterministic.
 *
 * - exact / within ≤ 2px of a single nearest value → that token
 * - equidistant between two distinct slot values → null (would corrupt layout)
 * - nearest slot further than 2px → null (left untouched, unmapped)
 */
export function nearestScaleToken(schema: DesignSystemSchema, px: number): string | null {
  const candidates: Array<{ path: string; value: number }> = []
  for (const [name, v] of Object.entries(schema.spacing)) {
    const n = parsePx(v)
    if (n !== null) candidates.push({ path: `spacing.${name}`, value: n })
  }
  for (const [name, v] of Object.entries(schema.rounded)) {
    const n = parsePx(v)
    if (n !== null) candidates.push({ path: `rounded.${name}`, value: n })
  }
  if (candidates.length === 0) return null

  let minD = Infinity
  for (const c of candidates) {
    const d = Math.abs(c.value - px)
    if (d < minD) minD = d
  }
  if (minD > SCALE_PX_THRESHOLD) return null

  const atMin = candidates.filter((c) => Math.abs(c.value - px) === minD)
  const distinctValues = new Set(atMin.map((c) => c.value))
  if (distinctValues.size > 1) return null // equidistant between distinct slots — bypass

  return atMin[0].path // same value (or one slot) — first in iteration order
}
