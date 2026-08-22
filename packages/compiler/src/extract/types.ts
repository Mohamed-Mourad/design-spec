// extract/types.ts — the Git Import / Retrofit extraction contract.
//
// These shapes describe *import provenance*, not the design system itself, so
// none of them belong in types/schema.ts: a `DesignSystemSchema` is identical
// whether it was hand-authored, scanned, or inferred. The web workspace reads
// `TokenStateMap` to render the Extracted / Verify / Review chips; the backend
// stores it alongside the synthesized schema and nothing else.

import type { DesignSystemSchema, FrameworkStack } from '../types/schema.js'

/**
 * Where a token's value came from.
 *
 * - `extracted` — read verbatim from a config or a source `:root` declaration.
 * - `inferred`  — recovered from a compiled CSS bundle, or resolved by
 *                 closest-match (nearest color / nearest scale step). Needs a
 *                 human `Verify`.
 * - `defaulted` — no signal in the repo at all; the baseline preset's value.
 *                 Needs a human `Review`.
 */
export type TokenState = 'extracted' | 'inferred' | 'defaulted'

/** What kind of file the harvester handed us. Drives which parser runs. */
export type ImportFileKind =
  | 'package_json'
  | 'pubspec'
  | 'tailwind_config'
  | 'source_css'
  | 'compiled_css'
  | 'dart_theme'

/** One harvested file. Content is in memory only — never persisted anywhere. */
export interface ImportFile {
  path: string
  kind: ImportFileKind
  content: string
  /** The harvester hit its per-file byte cap; the tail is missing. */
  truncated?: boolean
}

export interface ImportInput {
  /** `owner/repo`, used to name the synthesized system when nothing better exists. */
  repo?: string
  files: ImportFile[]
  /**
   * Every path in the repo tree, when the caller has it. Framework detection
   * uses it for signals a manifest cannot give (a `pubspec.yaml`, a Tailwind
   * config that was too large to fetch).
   */
  paths?: string[]
}

/**
 * Token states keyed by schema group, then token key. Group keys are dotted for
 * nested groups (`borders.width`, `darkMode.colors`) so one flat map covers the
 * whole schema.
 */
export type TokenStateMap = Record<string, Record<string, TokenState>>

export type SignalKind = 'parsed' | 'fallback' | 'inferred' | 'skipped'

/** One line of the "here is what we found and what we did about it" report. */
export interface ExtractionSignal {
  kind: SignalKind
  /** File path, or a pseudo-source like `closest-match`. */
  source: string
  message: string
}

export interface FrameworkDetection {
  frameworks: FrameworkStack[]
  signals: string[]
  hasTailwind: boolean
  /** Project name from `package.json` / `pubspec.yaml`, when present. */
  projectName?: string
}

export interface ExtractionSummary {
  extracted: number
  inferred: number
  defaulted: number
}

export interface ImportExtraction {
  schema: DesignSystemSchema
  states: TokenStateMap
  summary: ExtractionSummary
  signals: ExtractionSignal[]
  detection: FrameworkDetection
  /** True when the compiled-CSS bundle had to stand in for an unparseable config. */
  usedFallback: boolean
  /**
   * Dotted config paths the static parser refused to evaluate — imports,
   * spreads, `process.env`, plugin calls. Only these layers are isolated; every
   * statically safe sibling is still extracted.
   */
  unparseableLayers: string[]
}
