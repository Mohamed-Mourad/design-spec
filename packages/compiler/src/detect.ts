// detect.ts — locate token drift in source files.
//
// Pure: (source, schema, options) => Drift[]. Finds raw values that should be
// design-token references: inline hex, arbitrary Tailwind classes (`text-[#…]`),
// inline Flutter `Color(0xFF…)`, and raw `px` lengths. For each hit it resolves
// the nearest schema token via the shared best-match engine — perceptual CIELAB
// ΔE for colors (`colorMatch`), dimensional proximity for px (`scaleMatch`) —
// and records a strict `fixable` flag so `fix` can rewrite deterministically.
// No I/O. The same engine powers local `design-spec fix` and the hosted Janitor.

import type { DesignSystemSchema } from './types/schema.js'
import { nearestColorToken } from './colorMatch.js'
import { nearestScaleToken } from './scaleMatch.js'

export { nearestColorToken } from './colorMatch.js'

export type DriftKind = 'inline-hex' | 'arbitrary-class' | 'flutter-color' | 'raw-px'

export interface Drift {
  /** File the drift was found in (caller-supplied; detect itself is pure). */
  file: string
  line: number
  column: number
  /** The exact raw text matched, e.g. "#3B6EF5" or "text-[#3B6EF5]". */
  found: string
  kind: DriftKind
  /** Nearest schema token path (e.g. "colors.primary"), or null if none in tolerance. */
  nearestToken: string | null
  /** True when `fix` can rewrite this deterministically (nearestToken != null). */
  fixable: boolean
}

const HEX = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g
const ARBITRARY = /(?:text|bg|border|fill|stroke|ring)-\[#[0-9a-fA-F]{3,6}\]/g
const FLUTTER = /Color\(0x[0-9a-fA-F]{8}\)/g
const RAW_PX = /\b(\d+)px\b/g

/**
 * Scan one source string for drift. `file` is attached to every Drift for
 * reporting; detection logic does not read the filesystem.
 */
export function detect(source: string, schema: DesignSystemSchema, file = '<source>'): Drift[] {
  const drifts: Drift[] = []
  const lines = source.split('\n')

  lines.forEach((text, i) => {
    const line = i + 1
    const push = (found: string, kind: DriftKind, nearestToken: string | null, index: number) => {
      drifts.push({ file, line, column: index + 1, found, kind, nearestToken, fixable: nearestToken !== null })
    }

    // Arbitrary Tailwind classes first (they contain a hex we don't want double-counted).
    const claimed: Array<[number, number]> = []
    for (const m of text.matchAll(ARBITRARY)) {
      const idx = m.index ?? 0
      claimed.push([idx, idx + m[0].length])
      const hex = m[0].slice(m[0].indexOf('#'), m[0].length - 1)
      push(m[0], 'arbitrary-class', nearestColorToken(schema, hex), idx)
    }

    const within = (idx: number) => claimed.some(([s, e]) => idx >= s && idx < e)

    for (const m of text.matchAll(FLUTTER)) {
      const idx = m.index ?? 0
      const hex = '#' + m[0].slice(m[0].indexOf('0x') + 4, m[0].length - 1)
      push(m[0], 'flutter-color', nearestColorToken(schema, hex), idx)
    }

    for (const m of text.matchAll(HEX)) {
      const idx = m.index ?? 0
      if (within(idx)) continue // already reported as an arbitrary class
      push(m[0], 'inline-hex', nearestColorToken(schema, m[0]), idx)
    }

    for (const m of text.matchAll(RAW_PX)) {
      const idx = m.index ?? 0
      if (within(idx)) continue
      const val = Number(m[1])
      push(m[0], 'raw-px', nearestScaleToken(schema, val), idx)
    }
  })

  return drifts
}
