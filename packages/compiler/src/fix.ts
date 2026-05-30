// fix.ts — the auto-refactor engine.
//
// Pure: (source, Drift[], schema, options) => patchedSource. For each fixable
// drift it resolves the raw value to its nearest schema token and rewrites the
// source string in place. Unfixable drift (nearestToken === null) is left
// untouched. Idempotent: fix(fix(x)) === fix(x), because the rewritten forms
// (`var(--…)`, `text-primary`, `AppColors.…`) contain no raw values to match.
//
// This single function powers local `design-spec fix` and the hosted CI
// Drift-Janitor — same drift in, same rewrite out, no second source of truth.

import type { DesignSystemSchema } from './types/schema'
import type { Drift } from './detect'

export interface FixOptions {
  /** Output dialect. Web → CSS vars / Tailwind classes. Flutter → AppColors. */
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

function flutterClass(group: string): string {
  return group === 'colors' ? 'AppColors' : 'AppTokens'
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
      return `${flutterClass(group)}.${name}`
    case 'inline-hex':
      return target === 'flutter' ? `${flutterClass(group)}.${name}` : `var(--${p}${group === 'colors' ? 'color' : group}-${name})`
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
