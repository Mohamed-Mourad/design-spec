// extract/index.ts — the Git Import / Retrofit engine.
//
// `extractDesignSystem` is the single shared entry point: the CLI feeds it files
// read off disk, the web app feeds it files harvested through the GitHub
// Contents API. Same function, same result, no duplicated extraction logic and
// no server-side evaluation of repository code.
//
// It is a pure `(files) => { schema, states, signals }`. The guarantee it makes
// is the activation guarantee: it ALWAYS returns a complete, valid schema. There
// is no failure mode that dead-ends the caller — every token is either
// Extracted, Inferred, or Defaulted, and the caller renders that provenance so
// the user knows what to check.
//
// Layered, lowest priority first:
//   1. compiled CSS bundle   → inferred   (Smart Fallback; post-build truth)
//   2. hand-written CSS      → extracted
//   3. tailwind.config       → extracted  (the declared theme wins)
//   4. semantic inference    → inferred   (alias match, then nearest colour/step)
//   5. baseline preset       → defaulted  (whatever nothing spoke to)

import { defaultSchema } from '../defaultSchema.js'
import { deltaE76, hexToLab } from '../colorMatch.js'
import type {
  ColorValue,
  DesignSystemSchema,
  DimensionValue,
  ShadowToken,
  TypographyToken,
} from '../types/schema.js'
import { detectFramework } from './detectFramework.js'
import { extractCssCustomProps, toDimension, type CssVarExtraction } from './cssCustomProps.js'
import { extractTailwindConfig, type TailwindExtraction } from './tailwindConfig.js'
import { parseFlutterColors } from './flutterTheme.js'
import type {
  ExtractionSignal,
  ExtractionSummary,
  ImportExtraction,
  ImportFile,
  ImportInput,
  TokenState,
  TokenStateMap,
} from './types.js'

export * from './types.js'
export { normalizeColor, isColorValue } from './color.js'
export { parseStaticConfigObject } from './staticJs.js'
export type { JsValue, StaticParseResult } from './staticJs.js'
export { extractTailwindConfig, liftTailwindTheme } from './tailwindConfig.js'
export type { TailwindExtraction, TailwindTheme } from './tailwindConfig.js'
export {
  extractCssCustomProps,
  scanCssRules,
  parseDeclarations,
  classifyCssVar,
  tokenKeyFor,
  toDimension,
} from './cssCustomProps.js'
export type { CssVarExtraction, CssVarGroup, CssRule } from './cssCustomProps.js'
export { parseFlutterColors } from './flutterTheme.js'
export { detectFramework } from './detectFramework.js'

/**
 * ΔE ceiling for inferring a *semantic* slot from a repo palette. Far wider than
 * the auto-fix snap threshold (2.5) on purpose: this is not rewriting the user's
 * code, it is proposing "your `#E11D48` is probably this system's error colour"
 * and flagging it `inferred` for a human to confirm. Beyond this the families
 * are unrelated and the baseline value is the honest answer.
 */
export const SEMANTIC_INFERENCE_MAX_DELTA_E = 25

/** Relative tolerance for snapping a default scale step to a repo scale step. */
export const SCALE_INFERENCE_TOLERANCE = 0.5

/** Caps that keep a 250-swatch framework palette from swamping the workspace. */
const MAX_COLORS = 96
const MAX_SCALE_ENTRIES = 48

const STATE_RANK: Record<TokenState, number> = { defaulted: 0, inferred: 1, extracted: 2 }

/** A token group being assembled from layered sources. */
class Layer<T> {
  private readonly entries = new Map<string, { value: T; state: TokenState }>()

  /** Record a value; a same-or-higher-confidence source overwrites. */
  set(key: string, value: T, state: TokenState): void {
    const prev = this.entries.get(key)
    if (prev && STATE_RANK[state] < STATE_RANK[prev.state]) return
    this.entries.set(key, { value, state })
  }

  has(key: string): boolean {
    return this.entries.has(key)
  }

  get size(): number {
    return this.entries.size
  }

  values(): Record<string, T> {
    const out: Record<string, T> = {}
    for (const [k, v] of this.entries) out[k] = v.value
    return out
  }

  states(): Record<string, TokenState> {
    const out: Record<string, TokenState> = {}
    for (const [k, v] of this.entries) out[k] = v.state
    return out
  }

  /** Insertion-order-stable truncation — deterministic across runs. */
  truncate(max: number): number {
    if (this.entries.size <= max) return 0
    const keys = [...this.entries.keys()].slice(max)
    for (const k of keys) this.entries.delete(k)
    return keys.length
  }
}

// ── semantic inference tables ────────────────────────────────────────────────

/**
 * Candidate repo token names for each semantic slot the schema (and therefore
 * every component blueprint) relies on. Order is preference order.
 */
const COLOR_ALIASES: Record<string, string[]> = {
  primary: ['primary', 'brand', 'accent', 'main', 'theme', 'action'],
  secondary: ['secondary', 'brand-secondary', 'accent-secondary', 'accent-2', 'alt'],
  neutral: ['neutral', 'foreground', 'fg', 'text', 'ink', 'black', 'gray-900', 'slate-900', 'zinc-900'],
  surface: ['surface', 'background', 'bg', 'base', 'card', 'paper', 'canvas', 'white'],
  'on-surface': ['on-surface', 'foreground', 'fg', 'text', 'body', 'ink', 'card-foreground'],
  muted: ['muted', 'muted-foreground', 'subtle', 'secondary-foreground', 'gray-500', 'slate-500', 'neutral-500'],
  border: ['border', 'divider', 'outline', 'stroke', 'input', 'gray-200', 'slate-200', 'neutral-200'],
  error: ['error', 'danger', 'destructive', 'negative', 'red', 'red-500'],
  success: ['success', 'positive', 'ok', 'green', 'green-500'],
}

/** Numeric palette steps to prefer when an alias matches a whole family. */
const FAMILY_STEPS = ['500', '600', '400', '700', '300', '800', '200', '900', '100', '50']

function lower(s: string): string {
  return s.toLowerCase()
}

/** Resolve one semantic slot against a repo palette by name. */
function aliasMatch(palette: Record<string, ColorValue>, aliases: string[]): string | null {
  const byLower = new Map(Object.keys(palette).map((k) => [lower(k), k]))
  for (const alias of aliases) {
    const exact = byLower.get(lower(alias))
    if (exact) return exact
    for (const step of FAMILY_STEPS) {
      const stepped = byLower.get(`${lower(alias)}-${step}`)
      if (stepped) return stepped
    }
  }
  return null
}

/** Resolve one semantic slot by perceptual distance to its baseline value. */
function nearestMatch(palette: Record<string, ColorValue>, target: ColorValue): string | null {
  const targetLab = hexToLab(target)
  if (!targetLab) return null
  let best: { key: string; d: number } | null = null
  for (const [key, value] of Object.entries(palette)) {
    const lab = hexToLab(value)
    if (!lab) continue
    const d = deltaE76(targetLab, lab)
    if (best === null || d < best.d) best = { key, d }
  }
  return best && best.d <= SEMANTIC_INFERENCE_MAX_DELTA_E ? best.key : null
}

function toPx(value: DimensionValue | number): number | null {
  if (typeof value === 'number') return value
  const m = /^(-?(?:\d*\.\d+|\d+))(px|rem|em)$/.exec(value)
  if (!m) return null
  const n = Number(m[1])
  return m[2] === 'px' ? n : n * 16
}

/** Nearest step in a repo scale to a baseline value, within relative tolerance. */
function nearestScaleValue(
  scale: Record<string, DimensionValue>,
  target: DimensionValue,
): DimensionValue | null {
  const targetPx = toPx(target)
  if (targetPx === null || targetPx === 0) return null
  let best: { value: DimensionValue; d: number } | null = null
  for (const value of Object.values(scale)) {
    const px = toPx(value)
    if (px === null) continue
    const d = Math.abs(px - targetPx)
    if (best === null || d < best.d) best = { value, d }
  }
  if (!best) return null
  return best.d / targetPx <= SCALE_INFERENCE_TOLERANCE ? best.value : null
}

function titleCase(s: string): string {
  return s
    .replace(/^@[^/]+\//, '') // drop an npm scope
    .replace(/[-_./]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

// ── the engine ───────────────────────────────────────────────────────────────

/**
 * Tokens a caller resolved by actually *executing* the project's config. Only
 * the CLI ever supplies these: `dynamic import()` of untrusted repo code is
 * legal on the developer's own machine and forbidden server-side, so the cloud
 * scanner leaves this undefined and relies on the static + fallback layers.
 * Applied above every other layer and always `extracted`.
 */
export interface ResolvedTokens {
  colors?: Record<string, ColorValue>
  spacing?: Record<string, DimensionValue>
  rounded?: Record<string, DimensionValue>
  screens?: Record<string, DimensionValue>
  fontFamily?: Record<string, string>
  fontSize?: Record<string, DimensionValue>
  shadows?: Record<string, string>
}

export interface ExtractOptions {
  /** Baseline to fill gaps from. Defaults to the "Clean Professional" preset. */
  base?: DesignSystemSchema
  /** Byte-exact tokens from a local config evaluation (CLI only). */
  resolved?: ResolvedTokens
}

interface CssLayer {
  file: ImportFile
  vars: CssVarExtraction
}

function firstOf(files: ImportFile[], kind: ImportFile['kind']): ImportFile | undefined {
  return files.find((f) => f.kind === kind)
}

/**
 * Turn harvested repository files into a complete design-system schema plus the
 * provenance of every token in it.
 */
export function extractDesignSystem(input: ImportInput, opts: ExtractOptions = {}): ImportExtraction {
  const files = input.files ?? []
  const signals: ExtractionSignal[] = []
  const schema: DesignSystemSchema = structuredClone(opts.base ?? defaultSchema)

  const detection = detectFramework(files, input.paths)
  schema.export = { ...schema.export, frameworks: detection.frameworks }
  for (const s of detection.signals) signals.push({ kind: 'parsed', source: 'detection', message: s })

  // ── layer sources ─────────────────────────────────────────────────────────
  const colors = new Layer<ColorValue>()
  const darkColors = new Layer<ColorValue>()
  const spacing = new Layer<DimensionValue>()
  const rounded = new Layer<DimensionValue>()
  const shadows = new Layer<string>()
  const breakpoints = new Layer<DimensionValue>()
  const borderWidth = new Layer<DimensionValue>()
  const fontFamily = new Layer<string>()
  const fontSize = new Layer<DimensionValue>()

  const sourceCss: CssLayer[] = files
    .filter((f) => f.kind === 'source_css')
    .map((file) => ({ file, vars: extractCssCustomProps(file.content) }))
  const compiledCss: CssLayer[] = files
    .filter((f) => f.kind === 'compiled_css')
    .map((file) => ({ file, vars: extractCssCustomProps(file.content) }))

  const twFile = firstOf(files, 'tailwind_config')
  const tw: TailwindExtraction | null = twFile ? extractTailwindConfig(twFile.content) : null
  const unparseableLayers = tw?.unparseable ?? []

  // Statically safe signal, before any fallback: what the source actually declares.
  const declaredColorCount =
    Object.keys(tw?.colors ?? {}).length +
    sourceCss.reduce((n, l) => n + Object.keys(l.vars.colors).length, 0) +
    (firstOf(files, 'dart_theme') ? 1 : 0)

  const needFallback =
    compiledCss.length > 0 &&
    (tw?.error !== undefined || unparseableLayers.length > 0 || declaredColorCount < 4)

  // 1 — compiled bundle (inferred). Post-build values bypass JS evaluation.
  if (needFallback) {
    for (const { file, vars } of compiledCss) {
      applyCssLayer(vars, 'inferred', {
        colors, darkColors, spacing, rounded, shadows, breakpoints, borderWidth, fontFamily, fontSize,
      })
      signals.push({
        kind: 'fallback',
        source: file.path,
        message: `read ${vars.declarationCount} resolved custom properties from the compiled bundle`,
      })
    }
  } else if (compiledCss.length > 0) {
    signals.push({
      kind: 'skipped',
      source: compiledCss[0].file.path,
      message: 'compiled bundle not needed — the source config parsed cleanly',
    })
  }

  // 2 — hand-written CSS (extracted).
  for (const { file, vars } of sourceCss) {
    applyCssLayer(vars, 'extracted', {
      colors, darkColors, spacing, rounded, shadows, breakpoints, borderWidth, fontFamily, fontSize,
    })
    if (vars.declarationCount > 0) {
      signals.push({
        kind: 'parsed',
        source: file.path,
        message: `read ${vars.declarationCount} custom properties`,
      })
    }
  }

  // 2b — Flutter theme colors (extracted).
  for (const file of files.filter((f) => f.kind === 'dart_theme')) {
    const dartColors = parseFlutterColors(file.content)
    for (const [k, v] of Object.entries(dartColors)) colors.set(kebab(k), v, 'extracted')
    if (Object.keys(dartColors).length) {
      signals.push({
        kind: 'parsed',
        source: file.path,
        message: `read ${Object.keys(dartColors).length} theme colors`,
      })
    }
  }

  // 3 — tailwind.config (extracted); the declared theme outranks everything.
  if (tw && twFile) {
    for (const [k, v] of Object.entries(tw.colors)) colors.set(k, v, 'extracted')
    for (const [k, v] of Object.entries(tw.spacing)) spacing.set(k, v, 'extracted')
    for (const [k, v] of Object.entries(tw.rounded)) rounded.set(k, v, 'extracted')
    for (const [k, v] of Object.entries(tw.screens)) breakpoints.set(k, v, 'extracted')
    for (const [k, v] of Object.entries(tw.borderWidth)) borderWidth.set(k, v, 'extracted')
    for (const [k, v] of Object.entries(tw.shadows)) shadows.set(k, v, 'extracted')
    for (const [k, v] of Object.entries(tw.fontFamily)) fontFamily.set(k, v, 'extracted')
    for (const [k, v] of Object.entries(tw.fontSize)) fontSize.set(k, v, 'extracted')

    if (tw.prefix) schema.export = { ...schema.export, tailwindClassPrefix: tw.prefix }
    if (tw.darkMode) schema.darkMode.enabled = true

    if (tw.error) {
      signals.push({ kind: 'skipped', source: twFile.path, message: tw.error })
    } else {
      signals.push({
        kind: 'parsed',
        source: twFile.path,
        message: `read ${Object.keys(tw.colors).length} colors statically`,
      })
    }
    for (const path of unparseableLayers.slice(0, 12)) {
      signals.push({
        kind: 'skipped',
        source: twFile.path,
        message: `\`${path}\` cannot be evaluated without running the config`,
      })
    }
    if (unparseableLayers.length > 12) {
      signals.push({
        kind: 'skipped',
        source: twFile.path,
        message: `…and ${unparseableLayers.length - 12} more unparseable layers`,
      })
    }
  }

  // 3b — locally evaluated config (CLI only). Byte-exact, so it outranks all.
  const resolved = opts.resolved
  if (resolved) {
    for (const [k, v] of Object.entries(resolved.colors ?? {})) colors.set(k, v, 'extracted')
    for (const [k, v] of Object.entries(resolved.spacing ?? {})) spacing.set(k, v, 'extracted')
    for (const [k, v] of Object.entries(resolved.rounded ?? {})) rounded.set(k, v, 'extracted')
    for (const [k, v] of Object.entries(resolved.screens ?? {})) breakpoints.set(k, v, 'extracted')
    for (const [k, v] of Object.entries(resolved.fontFamily ?? {})) fontFamily.set(k, v, 'extracted')
    for (const [k, v] of Object.entries(resolved.fontSize ?? {})) fontSize.set(k, v, 'extracted')
    for (const [k, v] of Object.entries(resolved.shadows ?? {})) shadows.set(k, v, 'extracted')
    const count = Object.values(resolved).reduce((n, group) => n + Object.keys(group ?? {}).length, 0)
    if (count > 0) {
      signals.push({
        kind: 'parsed',
        source: 'local config evaluation',
        message: `read ${count} tokens byte-exact by running the config locally`,
      })
    }
  }

  // Keep the palette workable.
  const droppedColors = colors.truncate(MAX_COLORS)
  if (droppedColors > 0) {
    signals.push({
      kind: 'skipped',
      source: 'palette',
      message: `kept the first ${MAX_COLORS} colors; dropped ${droppedColors}`,
    })
  }
  spacing.truncate(MAX_SCALE_ENTRIES)
  rounded.truncate(MAX_SCALE_ENTRIES)
  fontSize.truncate(MAX_SCALE_ENTRIES)

  // ── 4 — semantic inference for the slots the schema depends on ────────────
  const palette = colors.values()
  const baseColors = (opts.base ?? defaultSchema).colors

  for (const [slot, aliases] of Object.entries(COLOR_ALIASES)) {
    if (colors.has(slot)) continue
    const baseline = baseColors[slot]
    if (!baseline) continue

    const byName = aliasMatch(palette, aliases)
    if (byName) {
      colors.set(slot, palette[byName], 'inferred')
      signals.push({
        kind: 'inferred',
        source: 'closest-match',
        message: `\`colors.${slot}\` taken from \`${byName}\``,
      })
      continue
    }
    const byColor = nearestMatch(palette, baseline)
    if (byColor) {
      colors.set(slot, palette[byColor], 'inferred')
      signals.push({
        kind: 'inferred',
        source: 'closest-match',
        message: `\`colors.${slot}\` snapped to the nearest palette color \`${byColor}\``,
      })
    }
  }

  inferScale(spacing, (opts.base ?? defaultSchema).spacing, 'spacing', signals)
  inferScale(rounded, (opts.base ?? defaultSchema).rounded, 'rounded', signals)

  // ── assemble the schema ──────────────────────────────────────────────────
  const states: TokenStateMap = {}

  schema.colors = { ...baseColors, ...colors.values() }
  states.colors = fillStates(schema.colors, colors.states())

  schema.spacing = { ...schema.spacing, ...spacing.values() }
  states.spacing = fillStates(schema.spacing, spacing.states())

  schema.rounded = { ...schema.rounded, ...rounded.values() }
  states.rounded = fillStates(schema.rounded, rounded.states())

  schema.breakpoints = { ...schema.breakpoints, ...breakpoints.values() }
  states.breakpoints = fillStates(schema.breakpoints, breakpoints.states())

  schema.borders = {
    ...schema.borders,
    width: { ...schema.borders.width, ...borderWidth.values() },
  }
  states['borders.width'] = fillStates(schema.borders.width, borderWidth.states())

  const shadowTokens: Record<string, ShadowToken> = { ...schema.shadows }
  for (const [key, value] of Object.entries(shadows.values())) {
    shadowTokens[key] = { value, inset: /(^|\s)inset(\s|$)/i.test(value) || undefined }
  }
  schema.shadows = shadowTokens
  states.shadows = fillStates(schema.shadows, shadows.states())

  applyTypography(schema, fontFamily, fontSize, signals)
  states.typography = fillStates(schema.typography, typographyStates(schema, fontFamily, fontSize))

  const darkValues = darkColors.values()
  const darkOverrides: Record<string, ColorValue> = {}
  for (const [key, value] of Object.entries(darkValues)) {
    if (schema.colors[key] !== undefined) darkOverrides[key] = value
  }
  if (Object.keys(darkOverrides).length > 0) {
    schema.darkMode = { enabled: true, colors: { ...schema.darkMode.colors, ...darkOverrides } }
    signals.push({
      kind: 'parsed',
      source: 'dark scheme',
      message: `read ${Object.keys(darkOverrides).length} dark-mode color overrides`,
    })
  }
  states['darkMode.colors'] = fillStates(schema.darkMode.colors, darkColors.states())

  // Name the system after the project.
  const projectName = detection.projectName ?? input.repo?.split('/').pop()
  if (projectName) {
    schema.name = titleCase(projectName)
    schema.description = `Design system extracted from ${input.repo ?? projectName}.`
  }

  return {
    schema,
    states,
    summary: summarize(states),
    signals,
    detection,
    usedFallback: needFallback,
    unparseableLayers,
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function kebab(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase()
}

interface Layers {
  colors: Layer<ColorValue>
  darkColors: Layer<ColorValue>
  spacing: Layer<DimensionValue>
  rounded: Layer<DimensionValue>
  shadows: Layer<string>
  breakpoints: Layer<DimensionValue>
  borderWidth: Layer<DimensionValue>
  fontFamily: Layer<string>
  fontSize: Layer<DimensionValue>
}

function applyCssLayer(vars: CssVarExtraction, state: TokenState, into: Layers): void {
  for (const [k, v] of Object.entries(vars.colors)) into.colors.set(k, v, state)
  for (const [k, v] of Object.entries(vars.darkColors)) into.darkColors.set(k, v, state)
  for (const [k, v] of Object.entries(vars.spacing)) into.spacing.set(k, v, state)
  for (const [k, v] of Object.entries(vars.rounded)) into.rounded.set(k, v, state)
  for (const [k, v] of Object.entries(vars.shadows)) into.shadows.set(k, v, state)
  for (const [k, v] of Object.entries(vars.breakpoints)) into.breakpoints.set(k, v, state)
  for (const [k, v] of Object.entries(vars.borderWidth)) into.borderWidth.set(k, v, state)
  for (const [k, v] of Object.entries(vars.fontFamily)) into.fontFamily.set(k, v, state)
  for (const [k, v] of Object.entries(vars.fontSize)) into.fontSize.set(k, v, state)
}

/**
 * Fill baseline scale steps the repo did not declare by snapping to its nearest
 * step — the dimensional half of closest-match inference.
 */
function inferScale(
  layer: Layer<DimensionValue>,
  baseline: Record<string, DimensionValue | number>,
  group: string,
  signals: ExtractionSignal[],
): void {
  const scale = layer.values()
  if (Object.keys(scale).length === 0) return
  for (const [key, value] of Object.entries(baseline)) {
    if (layer.has(key)) continue
    const near = nearestScaleValue(scale, value as DimensionValue)
    if (near === null) continue
    layer.set(key, near, 'inferred')
    signals.push({
      kind: 'inferred',
      source: 'closest-match',
      message: `\`${group}.${key}\` snapped to the nearest declared step \`${String(near)}\``,
    })
  }
}

/** Which font-family layer entry stands in for a body / display role. */
const BODY_FAMILY_KEYS = ['sans', 'body', 'base', 'default', 'text', 'DEFAULT']
const DISPLAY_FAMILY_KEYS = ['display', 'heading', 'headline', 'serif', 'title']

function pickFamily(layer: Layer<string>, keys: string[]): { key: string; value: string } | null {
  const values = layer.values()
  for (const k of keys) {
    if (values[k] !== undefined) return { key: k, value: values[k] }
  }
  return null
}

function isHeadline(tokenKey: string): boolean {
  return /^(display|headline|heading|title)/.test(tokenKey)
}

/**
 * Overlay the repo's font families and size scale onto the baseline typography
 * tokens. Families are a direct read; sizes are a nearest-step inference, and
 * only when the repo declares a scale worth trusting.
 */
function applyTypography(
  schema: DesignSystemSchema,
  fontFamily: Layer<string>,
  fontSize: Layer<DimensionValue>,
  signals: ExtractionSignal[],
): void {
  const body = pickFamily(fontFamily, BODY_FAMILY_KEYS)
  const display = pickFamily(fontFamily, DISPLAY_FAMILY_KEYS)
  const sizes = fontSize.values()
  const useSizes = Object.keys(sizes).length >= 3

  const next: Record<string, TypographyToken> = {}
  for (const [key, token] of Object.entries(schema.typography)) {
    const updated: TypographyToken = { ...token }
    const family = isHeadline(key) ? (display ?? body) : (body ?? display)
    if (family) updated.fontFamily = family.value
    if (useSizes) {
      const near = nearestScaleValue(sizes, token.fontSize)
      if (near !== null) updated.fontSize = near
    }
    next[key] = updated
  }
  schema.typography = next

  if (body) {
    signals.push({
      kind: 'parsed',
      source: 'font stack',
      message: `body typography set to \`${body.value}\` (from \`${body.key}\`)`,
    })
  }
  if (display && display.value !== body?.value) {
    signals.push({
      kind: 'parsed',
      source: 'font stack',
      message: `display typography set to \`${display.value}\` (from \`${display.key}\`)`,
    })
  }
  if (useSizes) {
    signals.push({
      kind: 'inferred',
      source: 'closest-match',
      message: `type sizes snapped to the repo's ${Object.keys(sizes).length}-step scale`,
    })
  }
}

/**
 * Typography provenance is per token, and a token is a composite: it counts as
 * touched when the repo supplied either its family or (via the size scale) its
 * size. The weakest contributing source sets the state.
 */
function typographyStates(
  schema: DesignSystemSchema,
  fontFamily: Layer<string>,
  fontSize: Layer<DimensionValue>,
): Record<string, TokenState> {
  const body = pickFamily(fontFamily, BODY_FAMILY_KEYS)
  const display = pickFamily(fontFamily, DISPLAY_FAMILY_KEYS)
  const familyStates = fontFamily.states()
  const useSizes = Object.keys(fontSize.values()).length >= 3

  const out: Record<string, TokenState> = {}
  for (const key of Object.keys(schema.typography)) {
    const family = isHeadline(key) ? (display ?? body) : (body ?? display)
    if (!family) continue
    // A size snap is always an inference, so it caps the token at `inferred`.
    out[key] = useSizes ? 'inferred' : (familyStates[family.key] ?? 'inferred')
  }
  return out
}

/** Every key present in the group gets a state; unspoken keys are `defaulted`. */
function fillStates(group: Record<string, unknown>, known: Record<string, TokenState>): Record<string, TokenState> {
  const out: Record<string, TokenState> = {}
  for (const key of Object.keys(group)) out[key] = known[key] ?? 'defaulted'
  return out
}

function summarize(states: TokenStateMap): ExtractionSummary {
  const summary: ExtractionSummary = { extracted: 0, inferred: 0, defaulted: 0 }
  for (const group of Object.values(states)) {
    for (const state of Object.values(group)) summary[state]++
  }
  return summary
}
