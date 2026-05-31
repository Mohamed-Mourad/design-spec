// colorMatch.ts — perceptual color matching for the auto-refactor engine.
//
// Pure and deterministic. Translates sRGB hex into the CIELAB (L*a*b*) space and
// scores a raw color against the active theme's tokens with the ΔE (Delta E)
// metric. `detect` uses `nearestColorToken` to resolve a found hex to the
// closest token; `fix` then rewrites it. A raw value snaps only when its ΔE to
// the nearest token is ≤ 2.5 (a perceptual just-noticeable-difference); past
// that it is left untouched and marked unfixable — never auto-committed.
//
// ΔE here is CIE76 (Euclidean distance in CIELAB): "translate into L*a*b*, then
// measure distance." Deterministic and trivially boundary-testable at 2.5.

import type { DesignSystemSchema } from './types/schema.js'

/** ΔE ceiling for an automated color snap. ≤ this → fixable; > this → unfixable. */
export const COLOR_DELTA_E_THRESHOLD = 2.5

export interface Rgb {
  r: number
  g: number
  b: number
}

export interface Lab {
  L: number
  a: number
  b: number
}

/** Parse a 3- or 6-digit hex (with or without `#`) to 0–255 RGB, or null. */
export function parseHex(hex: string): Rgb | null {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return null
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }
}

/** sRGB channel (0–255) → linear-light (0–1), per the sRGB transfer function. */
function srgbToLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

// D65 reference white.
const Xn = 0.95047
const Yn = 1.0
const Zn = 1.08883

function pivot(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116
}

/** Convert sRGB to CIELAB (D65). */
export function rgbToLab({ r, g, b }: Rgb): Lab {
  const rl = srgbToLinear(r)
  const gl = srgbToLinear(g)
  const bl = srgbToLinear(b)

  // linear sRGB → CIEXYZ (D65)
  const x = rl * 0.4124 + gl * 0.3576 + bl * 0.1805
  const y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722
  const z = rl * 0.0193 + gl * 0.1192 + bl * 0.9505

  const fx = pivot(x / Xn)
  const fy = pivot(y / Yn)
  const fz = pivot(z / Zn)

  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) }
}

/** hex → CIELAB, or null for a malformed hex. */
export function hexToLab(hex: string): Lab | null {
  const rgb = parseHex(hex)
  return rgb ? rgbToLab(rgb) : null
}

/** CIE76 ΔE — Euclidean distance between two CIELAB colors. */
export function deltaE76(a: Lab, b: Lab): number {
  return Math.sqrt((a.L - b.L) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2)
}

/**
 * Nearest color token to a hex by perceptual distance. An exact hex match wins
 * outright; otherwise the closest token in CIELAB is returned only if its ΔE is
 * within `maxDeltaE`. Beyond the threshold → null (unmapped, left untouched).
 * Ties keep the first token in schema insertion order — deterministic.
 */
export function nearestColorToken(
  schema: DesignSystemSchema,
  hex: string,
  maxDeltaE = COLOR_DELTA_E_THRESHOLD,
): string | null {
  const targetLab = hexToLab(hex)
  if (!targetLab) return null

  let best: { name: string; d: number } | null = null
  for (const [name, value] of Object.entries(schema.colors)) {
    if (value.toLowerCase() === hex.toLowerCase()) return `colors.${name}`
    const lab = hexToLab(value)
    if (!lab) continue
    const d = deltaE76(targetLab, lab)
    if (best === null || d < best.d) best = { name, d }
  }
  if (best && best.d <= maxDeltaE) return `colors.${best.name}`
  return null
}
