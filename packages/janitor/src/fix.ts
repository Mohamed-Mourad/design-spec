// fix.ts — apply the compiler's pure `fix` to the scanned drift and write the
// patched files back to the workspace.
//
// Like commands/fix.ts: only `fixable` drift is rewritten; advisory drift
// (nearestToken === null — outside the ΔE / gap-relative tolerance the compiler
// owns) is left untouched and surfaced for the 🧹 comment, never auto-committed.
// The per-drift "Now" string is derived by running the SAME `fix` on the lone
// matched token, so the comment never reimplements the replacement logic.

import { writeFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { fix, type Drift, type DesignSystemSchema } from '@design-spec/compiler'
import type { FileDrift } from './detect.js'

export interface DriftRow {
  file: string
  line: number
  /** Raw value found, e.g. "#3B6EF5". */
  was: string
  /** Token reference written, e.g. "var(--color-primary)". */
  now: string
  /** Schema token path, e.g. "colors.primary". */
  token: string
}

export interface ChangedFile {
  rel: string
  fixes: number
}

export interface FixResult {
  /** Files actually rewritten. */
  changed: ChangedFile[]
  totalFixes: number
  /** Detail rows for the summary comment. */
  rows: DriftRow[]
  /** Non-fixable drift left in place (advisory). */
  advisory: Drift[]
}

function targetFor(rel: string): 'web' | 'flutter' {
  return extname(rel) === '.dart' ? 'flutter' : 'web'
}

/** Derive the replacement string for a single drift by reusing the fix engine. */
function replacementOf(drift: Drift, schema: DesignSystemSchema, target: 'web' | 'flutter'): string {
  return fix(drift.found, [{ ...drift, line: 1, column: 1 }], schema, { target })
}

/**
 * Apply fixes to every drifted file. When `write` is false (preview), files are
 * not touched but the result is computed identically — used by tests/dry runs.
 */
export async function applyFixes(files: FileDrift[], schema: DesignSystemSchema, write = true): Promise<FixResult> {
  const changed: ChangedFile[] = []
  const rows: DriftRow[] = []
  const advisory: Drift[] = []
  let totalFixes = 0

  for (const f of files) {
    advisory.push(...f.drifts.filter((d) => !d.fixable))
    const fixable = f.drifts.filter((d) => d.fixable)
    if (fixable.length === 0) continue

    const target = targetFor(f.rel)
    const patched = fix(f.source, fixable, schema, { target })
    if (patched === f.source) continue

    if (write) await writeFile(f.path, patched, 'utf8')
    changed.push({ rel: f.rel, fixes: fixable.length })
    totalFixes += fixable.length
    for (const d of fixable) {
      rows.push({
        file: f.rel,
        line: d.line,
        was: d.found,
        now: replacementOf(d, schema, target),
        token: d.nearestToken!,
      })
    }
  }

  return { changed, totalFixes, rows, advisory }
}
