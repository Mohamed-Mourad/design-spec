// scaleMatch.ts — dimensional proximity matching for the auto-refactor engine.
//
// Pure and deterministic. Snaps a raw pixel measurement (spacing step, margin,
// radius) to the nearest scale token. The snap tolerance is NOT a fixed absolute
// — it is derived from the user's own scale: a fraction of the local step gap,
// capped. A 4px-rhythm scale gets a tight radius; an 8px grid a wider one; the
// scale's tokens are the single source of truth, so picking a coarser grid
// automatically loosens snapping with no extra config.
//
// Because the fraction is < 0.5, a value at the midpoint between two slots is
// always outside tolerance → bypassed. No separate equidistant branch is needed.
// Cross-scale disagreement on the actual px value also bypasses, so an ambiguous
// raw value is never snapped to a wrong, layout-corrupting slot.

import type { DesignSystemSchema } from './types/schema.js'

/** Snap radius as a fraction of the local step gap. < 0.5 so midpoints bypass. */
export const SCALE_GAP_FRACTION = 0.4

/** Absolute ceiling on the derived radius — stops a coarse scale snapping from afar. */
export const SCALE_SNAP_CAP_PX = 8

/** A `DimensionValue` to its px magnitude, or null for non-px units (rem/em). */
function parsePx(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return null
  const m = value.match(/^(\d+(?:\.\d+)?)px$/)
  return m ? Number(m[1]) : null
}

interface ScaleHit {
  path: string
  value: number
}

/**
 * Nearest token within one scale, or null if the nearest slot is outside the
 * gap-relative tolerance. The tolerance is `min(FRACTION × localGap, CAP)`,
 * where localGap is the distance between the nearest slot and its neighbour on
 * the side the value falls — so the radius tracks the scale's own granularity.
 */
function nearestInScale(group: string, entries: Record<string, unknown>, px: number): ScaleHit | null {
  const slots: Array<{ name: string; value: number }> = []
  for (const [name, v] of Object.entries(entries)) {
    const n = parsePx(v)
    if (n !== null) slots.push({ name, value: n })
  }
  if (slots.length === 0) return null

  // Nearest slot (first in insertion order wins a tie — deterministic).
  let nearest = slots[0]
  let minD = Math.abs(slots[0].value - px)
  for (const s of slots) {
    const d = Math.abs(s.value - px)
    if (d < minD) {
      minD = d
      nearest = s
    }
  }

  // Local gap: distance from the nearest slot to the closest *other* slot value.
  // With one slot the gap is unknown → fall back to the absolute cap.
  let localGap = Infinity
  for (const s of slots) {
    if (s.value === nearest.value) continue
    const g = Math.abs(s.value - nearest.value)
    if (g < localGap) localGap = g
  }

  const tolerance = Math.min(SCALE_GAP_FRACTION * localGap, SCALE_SNAP_CAP_PX)
  if (minD > tolerance) return null
  return { path: `${group}.${nearest.name}`, value: nearest.value }
}

/**
 * Nearest spacing/rounded token to a px value, or null when nothing is within
 * the derived tolerance. Each scale is matched independently against its own
 * gap; if both yield candidates with *different* px values the result is
 * ambiguous and bypassed. Same value (or a single candidate) snaps to the first
 * in iteration order (spacing before rounded) — deterministic.
 */
export function nearestScaleToken(schema: DesignSystemSchema, px: number): string | null {
  const hits = [
    nearestInScale('spacing', schema.spacing, px),
    nearestInScale('rounded', schema.rounded, px),
  ].filter((h): h is ScaleHit => h !== null)

  if (hits.length === 0) return null
  if (new Set(hits.map((h) => h.value)).size > 1) return null // distinct slots → bypass
  return hits[0].path
}
