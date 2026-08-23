// extract/tailwindConfig.ts — lift theme tokens out of a tailwind.config.{js,ts}
// using only the static reader. Never evaluates the config.
//
// `theme.<group>` is read first, then `theme.extend.<group>` on top — extend is
// what most projects actually use, and for extraction purposes "both, extend
// last" reproduces the effective palette closely enough to seed a schema.
//
// Anything the static reader could not evaluate arrives as a dotted path in
// `unparseable`. A config that spreads a shared preset still yields every
// literal sibling it declares; only the spread layer is missing, and that is
// exactly the gap the compiled-CSS fallback fills.

import type { ColorValue, DimensionValue } from '../types/schema.js'
import { normalizeColor } from './color.js'
import { toDimension } from './cssCustomProps.js'
import { parseStaticConfigObject, type JsValue } from './staticJs.js'

export interface TailwindExtraction {
  colors: Record<string, ColorValue>
  spacing: Record<string, DimensionValue>
  rounded: Record<string, DimensionValue>
  screens: Record<string, DimensionValue>
  borderWidth: Record<string, DimensionValue>
  fontSize: Record<string, DimensionValue>
  fontFamily: Record<string, string>
  shadows: Record<string, string>
  /** `'media' | 'class' | …` when statically declared. */
  darkMode: string | null
  /** Tailwind class prefix, when declared. */
  prefix: string | null
  /** Dotted config paths the static reader refused to evaluate. */
  unparseable: string[]
  /** Set when no config object was reachable at all. */
  error?: string
}

function emptyExtraction(): TailwindExtraction {
  return {
    colors: {},
    spacing: {},
    rounded: {},
    screens: {},
    borderWidth: {},
    fontSize: {},
    fontFamily: {},
    shadows: {},
    darkMode: null,
    prefix: null,
    unparseable: [],
  }
}

/** The theme half of a Tailwind config, with no parse provenance attached. */
export type TailwindTheme = Omit<TailwindExtraction, 'unparseable' | 'error'>

function isRecord(v: unknown): v is Record<string, JsValue> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** `theme[group]` merged under `theme.extend[group]`. */
function themeGroup(theme: Record<string, JsValue> | null, group: string): Record<string, JsValue> {
  if (!theme) return {}
  const base = isRecord(theme[group]) ? theme[group] : {}
  const extend = isRecord(theme.extend) && isRecord(theme.extend[group]) ? theme.extend[group] : {}
  return { ...base, ...extend }
}

/**
 * Flatten a (possibly nested) Tailwind color map into dashed keys. Tailwind's
 * `DEFAULT` sub-key names the parent, matching how the class `bg-brand` resolves.
 */
function flattenColors(node: Record<string, JsValue>, prefix = ''): Record<string, ColorValue> {
  const out: Record<string, ColorValue> = {}
  for (const [rawKey, value] of Object.entries(node)) {
    const key = rawKey === 'DEFAULT' ? prefix : prefix ? `${prefix}-${rawKey}` : rawKey
    if (key === '') continue
    if (typeof value === 'string') {
      const hex = normalizeColor(value)
      if (hex) out[key] = hex
    } else if (isRecord(value)) {
      Object.assign(out, flattenColors(value, key))
    }
  }
  return out
}

function pickDimensions(node: Record<string, JsValue>): Record<string, DimensionValue> {
  const out: Record<string, DimensionValue> = {}
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === 'number') {
      out[key] = value
      continue
    }
    if (typeof value !== 'string') continue
    const dim = toDimension(value)
    if (dim !== null) out[key] = dim
  }
  return out
}

/** `fontSize` entries are `'1rem'` or `['1rem', { lineHeight }]`. */
function pickFontSizes(node: Record<string, JsValue>): Record<string, DimensionValue> {
  const out: Record<string, DimensionValue> = {}
  for (const [key, value] of Object.entries(node)) {
    const raw = Array.isArray(value) ? value[0] : value
    if (typeof raw === 'number') {
      out[key] = raw
      continue
    }
    if (typeof raw !== 'string') continue
    const dim = toDimension(raw)
    if (dim !== null) out[key] = dim
  }
  return out
}

/**
 * `fontFamily` entries are a stack (`['Inter', 'sans-serif']`) or a string. The
 * schema stores one family name — font loading resolves it against a provider —
 * so the head of the stack is what we keep.
 */
function pickFontFamilies(node: Record<string, JsValue>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(node)) {
    const head = Array.isArray(value) ? value[0] : value
    if (typeof head !== 'string') continue
    const family = head.replace(/^["']|["']$/g, '').trim()
    if (family) out[key] = family
  }
  return out
}

function pickStrings(node: Record<string, JsValue>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === 'string' && value.trim()) out[key] = value.trim()
  }
  return out
}

/**
 * Lift the theme tokens out of an *already-obtained* Tailwind config object.
 *
 * Shared by both paths that can produce one: the static reader here, and the
 * CLI's local `dynamic import()` (legal only on the developer's own machine).
 * One place owns the knowledge of Tailwind's theme shape, so the byte-exact and
 * static paths can never drift apart on what a token is.
 */
export function liftTailwindTheme(config: unknown): TailwindTheme {
  const out = emptyExtraction()
  if (!isRecord(config)) return out

  const theme = isRecord(config.theme) ? config.theme : null

  out.colors = flattenColors(themeGroup(theme, 'colors'))
  out.spacing = pickDimensions(themeGroup(theme, 'spacing'))
  out.rounded = pickDimensions(themeGroup(theme, 'borderRadius'))
  out.screens = pickDimensions(themeGroup(theme, 'screens'))
  out.borderWidth = pickDimensions(themeGroup(theme, 'borderWidth'))
  out.fontSize = pickFontSizes(themeGroup(theme, 'fontSize'))
  out.fontFamily = pickFontFamilies(themeGroup(theme, 'fontFamily'))
  out.shadows = pickStrings(themeGroup(theme, 'boxShadow'))

  if (typeof config.darkMode === 'string') out.darkMode = config.darkMode
  else if (Array.isArray(config.darkMode) && typeof config.darkMode[0] === 'string') {
    out.darkMode = config.darkMode[0]
  }
  if (typeof config.prefix === 'string') out.prefix = config.prefix

  return out
}

/** Read a Tailwind config's theme tokens without executing it. */
export function extractTailwindConfig(source: string): TailwindExtraction {
  const parsed = parseStaticConfigObject(source)
  if (!parsed.value) {
    return {
      ...emptyExtraction(),
      unparseable: parsed.unparseable,
      error: parsed.error ?? 'config not statically readable',
    }
  }
  return { ...liftTailwindTheme(parsed.value), unparseable: parsed.unparseable }
}
