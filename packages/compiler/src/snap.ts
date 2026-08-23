// snap.ts — the snapping utilities the generative bootstrapper runs vision
// output through, before anything reaches a canvas.
//
// A screenshot parser guesses. It reports `#3b6ef4` where the system says
// `#3B6EF5`, and a 23px gutter where the scale says 24. Left alone those
// guesses become the drift this product exists to remove — so nothing a parser
// produces is ever used as a value. It is snapped here first, against the
// project's own tokens, by the SAME engine the CI Drift-Janitor uses to rewrite
// a developer's stray hex (architecture-plan.md §11, §19.1.1): CIELAB ΔE for
// color, the gap-relative scale tolerance for geometry.
//
// The rule these two functions exist to enforce: out of tolerance is left
// unsnapped, never invented. A miss still names its nearest neighbour and the
// distance to it, because "unmapped — add a token?" is a useful answer and a
// silently invented value is not.
//
// Pure `(input) => output`. No I/O, no clock, no randomness — the same
// screenshot snapped twice is byte-identical.

import type { DesignSystemSchema } from './types/schema.js'
import { COLOR_DELTA_E_THRESHOLD, nearestColorMatch, parseHex, type Rgb } from './colorMatch.js'
import { matchScales, SCALE_ORDER, type ScaleName } from './scaleMatch.js'

/** Why a raw value was left unsnapped. Absent when it snapped. */
export type SnapMiss =
  /** The input was not a value this snapper can read at all. */
  | 'unreadable'
  /** The schema has no tokens in the scales asked for. */
  | 'no-tokens'
  /** There is a nearest token, but it is further away than the tolerance. */
  | 'out-of-tolerance'
  /** Two scales matched slots with different values — snapping either would guess. */
  | 'ambiguous'

/**
 * The result of snapping one raw value.
 *
 * `token` is the load-bearing field: it is non-null only when the value snapped,
 * so a consumer that writes `snap.token ?? raw` can never emit an invented
 * token. `nearest` is populated either way — it is what a miss is reported with.
 */
export interface Snap<V> {
  /** The input, normalised (`#RRGGBB` for color, px for geometry). */
  input: V
  /** The token path when it snapped — `colors.primary`, `spacing.md`. Never a guess. */
  token: string | null
  /** The token's own value when it snapped. */
  value: V | null
  /** How far the nearest candidate was: ΔE for color, px for geometry. */
  distance: number | null
  /** What `distance` had to be under to license the snap. */
  tolerance: number | null
  /** The closest token considered, snapped or not. Null when there was none. */
  nearest: { token: string; value: V; distance: number } | null
  snapped: boolean
  /** Why it did not snap. Absent when it did. */
  reason?: SnapMiss
}

export type ColorSnap = Snap<string>
export type SpatialSnap = Snap<number>

export interface SnapColorOptions {
  /** ΔE ceiling. Defaults to the Janitor's 2.5 — raise it and you are guessing. */
  maxDeltaE?: number
}

export interface SnapSpatialOptions {
  /**
   * Which scales may be matched, in priority order. Narrow it when the caller
   * knows what the measurement is: a corner radius should reach `rounded` only,
   * a gap `spacing` only. Defaults to both, like the Janitor's rewrite.
   */
  scales?: readonly ScaleName[]
}

function miss<V>(input: V, reason: SnapMiss, tolerance: number | null): Snap<V> {
  return { input, token: null, value: null, distance: null, tolerance, nearest: null, snapped: false, reason }
}

/** `#RRGGBB`, uppercase — the form the schema is written in. */
function normalizeHex(rgb: Rgb): string {
  const channel = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0')
  return ('#' + channel(rgb.r) + channel(rgb.g) + channel(rgb.b)).toUpperCase()
}

/** Anything a vision parser might call a color, down to 0–255 RGB. */
function readColor(input: string | Rgb): Rgb | null {
  if (typeof input === 'string') return parseHex(input.trim())
  const { r, g, b } = input
  if (![r, g, b].every((c) => typeof c === 'number' && Number.isFinite(c))) return null
  // Figma and most vision parsers report 0–1 channels; hex is 0–255. A triple
  // that is entirely ≤ 1 is the former — the only reading that is not lossy.
  const unit = r <= 1 && g <= 1 && b <= 1
  return unit ? { r: r * 255, g: g * 255, b: b * 255 } : { r, g, b }
}

/** A px magnitude from a number or a `24px` / `24` string. */
function readPx(input: number | string): number | null {
  if (typeof input === 'number') return Number.isFinite(input) ? input : null
  const m = input.trim().match(/^(-?\d+(?:\.\d+)?)(?:px)?$/)
  return m ? Number(m[1]) : null
}

/**
 * Snap a rough color to the nearest `colors.*` token.
 *
 * Accepts a hex string or an RGB triple (0–255, or 0–1 as Figma and most vision
 * parsers report). Snaps only when the nearest token is within `maxDeltaE` —
 * 2.5 by default, the perceptual just-noticeable-difference the Drift-Janitor
 * rewrites at. Past that the value comes back unsnapped with its nearest
 * neighbour named, for the caller to offer as "add a token?".
 */
export function snapColor(
  schema: DesignSystemSchema,
  input: string | Rgb,
  options: SnapColorOptions = {},
): ColorSnap {
  const tolerance = options.maxDeltaE ?? COLOR_DELTA_E_THRESHOLD
  const rgb = readColor(input)
  if (!rgb) return miss(typeof input === 'string' ? input.trim() : '', 'unreadable', tolerance)

  const hex = normalizeHex(rgb)
  const best = nearestColorMatch(schema, hex)
  if (!best) return miss(hex, 'no-tokens', tolerance)

  const nearest = { token: best.path, value: best.value, distance: best.deltaE }
  if (best.deltaE > tolerance) {
    return {
      input: hex,
      token: null,
      value: null,
      distance: best.deltaE,
      tolerance,
      nearest,
      snapped: false,
      reason: 'out-of-tolerance',
    }
  }
  return { input: hex, token: best.path, value: best.value, distance: best.deltaE, tolerance, nearest, snapped: true }
}

/**
 * Snap a loose measurement to the nearest scale step.
 *
 * The tolerance is not a constant: it is a fraction of the project's own local
 * step gap, capped — so an 8px grid snaps from further out than a 4px one, and
 * a value at the midpoint between two steps never snaps at all. Grid gutters and
 * margins land here too: `layout.grid` holds refs into `spacing`, so the grid
 * step and the spacing scale are the same set of slots.
 *
 * When two scales both match but on *different* px values the result is
 * ambiguous and is bypassed — a layout snapped to the wrong slot is worse than
 * one left alone.
 */
export function snapSpatial(
  schema: DesignSystemSchema,
  input: number | string,
  options: SnapSpatialOptions = {},
): SpatialSnap {
  const scales = options.scales ?? SCALE_ORDER
  const px = readPx(input)
  if (px === null) return miss(typeof input === 'number' ? input : NaN, 'unreadable', null)

  const matches = matchScales(schema, px, scales)
  if (matches.length === 0) return miss(px, 'no-tokens', null)

  // The closest candidate across the requested scales — first wins a tie, so
  // the scale order the caller gave decides. This is the reported `nearest`
  // whether or not anything snaps.
  let closest = matches[0]
  for (const m of matches) if (m.distance < closest.distance) closest = m
  const nearest = { token: closest.path, value: closest.value, distance: closest.distance }

  const within = matches.filter((m) => m.within)
  if (within.length === 0) {
    return {
      input: px,
      token: null,
      value: null,
      distance: closest.distance,
      tolerance: closest.tolerance,
      nearest,
      snapped: false,
      reason: 'out-of-tolerance',
    }
  }
  if (new Set(within.map((m) => m.value)).size > 1) {
    return {
      input: px,
      token: null,
      value: null,
      distance: closest.distance,
      tolerance: closest.tolerance,
      nearest,
      snapped: false,
      reason: 'ambiguous',
    }
  }

  const hit = within[0]
  return { input: px, token: hit.path, value: hit.value, distance: hit.distance, tolerance: hit.tolerance, nearest, snapped: true }
}

/** `{spacing.md}` — a snapped token path in the schema's own reference syntax. */
export function snapRef(snap: Snap<unknown>): string | null {
  return snap.token === null ? null : '{' + snap.token + '}'
}
