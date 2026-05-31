// detect.ts — walk the checked-out repo and locate token drift.
//
// This is the hosted half of the SAME pipeline `design-spec fix` runs locally:
// it calls the compiler's pure `detect` per file and reuses two non-obvious
// behaviors copied verbatim from commands/fix.ts so local and hosted results
// stay identical:
//   1. detect → fix is the compiler engine, never reimplemented here.
//   2. The generated-output exclusion: `compileAll(schema)` filenames are
//      skipped, so the janitor never rewrites token-DEFINITION files like
//      tokens.css (whose raw `#hex` ARE the tokens, not drift).
// No thresholds are inlined — `detect` resolves nearestToken via the shared
// ΔE / gap-relative engine and stamps each Drift's `fixable` flag.

import { readFile } from 'node:fs/promises'
import { glob } from 'node:fs/promises'
import { join } from 'node:path'
import { compileAll, detect, type Drift, type DesignSystemSchema } from '@design-spec/compiler'

const IGNORE = /(^|[\\/])(node_modules|dist|build|\.next|\.git)([\\/]|$)/

export interface FileDrift {
  /** Path relative to the repo root (forward-slashed). */
  rel: string
  /** Absolute path on disk. */
  path: string
  /** Original file contents. */
  source: string
  /** All drift in the file (fixable + advisory). */
  drifts: Drift[]
}

/** The set of generated filenames to never rewrite (token definitions). */
export function generatedFilenames(schema: DesignSystemSchema): Set<string> {
  return new Set(compileAll(schema).map((o) => o.filename.replace(/\\/g, '/')))
}

/**
 * Scan every source file under `root` for drift. Skips ignored dirs and the
 * generated token-definition files. Returns only files that actually drifted.
 */
export async function scanDrift(root: string, schema: DesignSystemSchema, sourceGlob: string): Promise<FileDrift[]> {
  const generated = generatedFilenames(schema)
  const results: FileDrift[] = []

  for await (const entry of glob(sourceGlob, { cwd: root })) {
    const rel = entry.replace(/\\/g, '/')
    if (IGNORE.test(rel) || generated.has(rel)) continue
    const path = join(root, entry)
    const source = await readFile(path, 'utf8')
    const drifts = detect(source, schema, rel)
    if (drifts.length > 0) results.push({ rel, path, source, drifts })
  }

  return results
}
