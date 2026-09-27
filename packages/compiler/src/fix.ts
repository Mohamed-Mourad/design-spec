// fix.ts — the auto-refactor heuristic engine (apply stage).
//
// Pure: (source, Drift[], schema, options) => patchedSource. The best-match
// heuristic lives in `detect` via the shared matchers: perceptual color snapping
// (CIELAB ΔE ≤ 2.5 → nearest token, `colorMatch`) and dimensional proximity
// snapping (≤ 2px to the nearest scale slot, equidistant/over → bypass,
// `scaleMatch`). Those decide each Drift's `nearestToken` + strict `fixable`
// flag. This function applies only the fixable drifts, rewriting the raw string
// in place; unfixable drift (nearestToken === null, ΔE > 2.5 or > 2px) is left
// untouched and never auto-committed.
//
// Idempotent: fix(fix(x)) === fix(x), because the rewritten forms (`var(--…)`,
// `text-primary`, `AppColors.…` / `c_…` / `kColor…`) contain no raw values
// left to match. This single pipeline (detect → fix) powers local
// `design-spec fix` and the hosted CI Drift-Janitor — same drift in, same
// rewrite out, no second source of truth.

import type { DesignSystemSchema } from './types/schema.js'
import type { Drift } from './detect.js'
import { flutterRefForPath } from './flutter/naming.js'

export interface FixOptions {
  /** Output dialect. Web → CSS vars / Tailwind classes. Flutter → the lib/theme identifier for `export.flutterNaming`. */
  target?: 'web' | 'flutter'
}

/** Bare token name from a "group.name" path, e.g. "colors.primary" → "primary". */
function tokenName(path: string): string {
  return path.slice(path.indexOf('.') + 1)
}

function classUtility(found: string): string {
  // "text-[#abc]" → "text" ; "bg-[#abc]" → "bg"
  return found.slice(0, found.indexOf('-['))
}

/**
 * The Dart identifier for a token, exactly as the Flutter compiler declares it
 * (`AppColors.onSurface` / `c_on_surface` / `kColorOnSurface`), so a fixed
 * file compiles against the generated lib/theme. A path with no Flutter declaration
 * is left as found rather than pointed at an identifier that doesn't exist.
 */
function flutterToken(path: string, schema: DesignSystemSchema, found: string): string {
  return flutterRefForPath(schema.export.flutterNaming ?? 'prefixed-class', path) ?? found
}

/** Render the replacement string for one fixable drift. */
function replacement(drift: Drift, schema: DesignSystemSchema, target: 'web' | 'flutter'): string {
  const path = drift.nearestToken!
  const group = path.slice(0, path.indexOf('.'))
  const name = tokenName(path)
  const p = schema.export.cssVariablePrefix

  switch (drift.kind) {
    case 'arbitrary-class':
      // text-[#2563EB] → text-primary (utility prefix preserved)
      return `${classUtility(drift.found)}-${name}`
    case 'flutter-color':
      return flutterToken(path, schema, drift.found)
    case 'inline-hex':
      return target === 'flutter' ? flutterToken(path, schema, drift.found) : `var(--${p}${group === 'colors' ? 'color' : group}-${name})`
    case 'raw-px':
      return `var(--${p}${group}-${name})`
    default:
      return drift.found
  }
}

/**
 * Apply all fixable drifts to `source`. Drifts are applied last-position-first
 * within each line so earlier column offsets stay valid. Order-independent in
 * effect — the output is deterministic for a given (source, drifts) pair.
 */
export function fix(source: string, drifts: Drift[], schema: DesignSystemSchema, options: FixOptions = {}): string {
  const target = options.target ?? 'web'
  const lines = source.split('\n')

  // Group fixable drifts by line, then apply right-to-left within the line.
  const byLine = new Map<number, Drift[]>()
  for (const d of drifts) {
    if (!d.fixable) continue
    const arr = byLine.get(d.line) ?? []
    arr.push(d)
    byLine.set(d.line, arr)
  }

  for (const [line, ds] of byLine) {
    const idx = line - 1
    if (idx < 0 || idx >= lines.length) continue
    let text = lines[idx]
    ds.sort((a, b) => b.column - a.column)
    for (const d of ds) {
      const start = d.column - 1
      if (text.slice(start, start + d.found.length) !== d.found) continue // stale offset — skip safely
      text = text.slice(0, start) + replacement(d, schema, target) + text.slice(start + d.found.length)
    }
    lines[idx] = text
  }

  return lines.join('\n')
}
