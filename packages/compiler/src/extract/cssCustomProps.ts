// extract/cssCustomProps.ts — lift CSS custom properties out of stylesheet text.
//
// One parser serves two very different inputs:
//
//   1. Hand-written source CSS — a `:root { --color-primary: #2563EB }` block,
//      or a Tailwind v4 `@theme { … }` block. These are Extracted values.
//   2. A COMPILED bundle (`dist/*.css`, `.next/static/css/*.css`) — minified,
//      one line, selectors merged. This is the Smart Fallback path: the build
//      already resolved every import, spread, and `process.env` the static JS
//      reader had to skip, so the post-build custom properties are the truth
//      about what the repo actually ships. Those land as Inferred.
//
// Pure, deterministic, no CSS-parser dependency: a brace scanner that respects
// strings, comments, and `url()`, then name/value classification into schema
// groups. Dark-scheme blocks (`.dark`, `[data-theme="dark"]`,
// `@media (prefers-color-scheme: dark)`) are separated out for `darkMode.colors`.

import type { ColorValue, DimensionValue } from '../types/schema.js'
import { normalizeColor } from './color.js'

/** One leaf rule: a block containing declarations and no nested blocks. */
export interface CssRule {
  selector: string
  body: string
  /** Enclosing at-rule preludes, outermost first (`@media (min-width: 40rem)`). */
  atRules: string[]
}

const MAX_CSS = 8 * 1024 * 1024 // 8 MiB — a compiled bundle can be large

/**
 * Split a stylesheet into its leaf rule blocks. An at-rule that directly
 * contains declarations (`@theme { --x: 1 }`) is itself a leaf.
 */
export function scanCssRules(source: string): CssRule[] {
  const rules: CssRule[] = []
  if (source.length > MAX_CSS) return rules

  const stack: { prelude: string; bodyStart: number; hadChild: boolean }[] = []
  let preludeStart = 0
  let i = 0

  while (i < source.length) {
    const c = source[i]

    if (c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2)
      i = end === -1 ? source.length : end + 2
      continue
    }
    if (c === '"' || c === "'") {
      i++
      while (i < source.length && source[i] !== c) i += source[i] === '\\' ? 2 : 1
      i++
      continue
    }
    if (c === '{') {
      const prelude = source.slice(preludeStart, i).trim()
      if (stack.length > 0) stack[stack.length - 1].hadChild = true
      stack.push({ prelude, bodyStart: i + 1, hadChild: false })
      i++
      preludeStart = i
      continue
    }
    if (c === ';') {
      // A statement boundary ends the prelude — otherwise a leading
      // `@import "tailwindcss";` would be glued onto the next rule's selector
      // and a Tailwind v4 `@theme` block would go unrecognised.
      i++
      preludeStart = i
      continue
    }
    if (c === '}') {
      const frame = stack.pop()
      if (frame && !frame.hadChild) {
        rules.push({
          selector: frame.prelude,
          body: source.slice(frame.bodyStart, i),
          atRules: stack.filter((f) => f.prelude.startsWith('@')).map((f) => f.prelude),
        })
      }
      i++
      preludeStart = i
      continue
    }
    i++
  }
  return rules
}

const DECL_RE = /--([\w-]+)\s*:\s*([^;]+)/g

/** Read `--name: value` declarations out of a rule body. Later wins. */
export function parseDeclarations(body: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of body.matchAll(DECL_RE)) {
    const name = m[1].trim()
    const value = m[2].trim().replace(/\s*!important$/i, '')
    if (name === '' || value === '') continue
    out[name] = value
  }
  return out
}

/** Selectors whose custom properties are the document-level theme. */
const BASE_SELECTOR_RE = /(^|[,\s])(:root|:host|html|body|\*)\b/i
const THEME_AT_RULE_RE = /^@(theme|layer\s+(base|theme)|supports)\b/i
const DARK_SELECTOR_RE = /(\.dark\b|\[data-(theme|mode|color-scheme)\s*[~|^$*]?=\s*["']?dark)/i
const DARK_MEDIA_RE = /prefers-color-scheme\s*:\s*dark/i

function isBaseRule(rule: CssRule): boolean {
  if (BASE_SELECTOR_RE.test(rule.selector)) return true
  return THEME_AT_RULE_RE.test(rule.selector)
}

function isDarkRule(rule: CssRule): boolean {
  return DARK_SELECTOR_RE.test(rule.selector) || rule.atRules.some((a) => DARK_MEDIA_RE.test(a))
}

// ── group classification ─────────────────────────────────────────────────────

export type CssVarGroup =
  | 'colors'
  | 'spacing'
  | 'rounded'
  | 'shadows'
  | 'fontFamily'
  | 'fontSize'
  | 'breakpoints'
  | 'borderWidth'
  | 'other'

const LENGTH_RE = /^-?(?:\d*\.\d+|\d+)(px|rem|em)$/
const UNITLESS_RE = /^-?(?:\d*\.\d+|\d+)$/

/** Coerce a CSS length to a schema `DimensionValue`, or null if not one. */
export function toDimension(raw: string): DimensionValue | null {
  const v = raw.trim()
  if (LENGTH_RE.test(v)) return v as DimensionValue
  if (UNITLESS_RE.test(v)) return Number(v)
  return null
}

/** Hint tables, checked as whole hyphen-delimited segments of the name. */
const HINTS: { group: CssVarGroup; words: string[] }[] = [
  { group: 'shadows', words: ['shadow', 'elevation'] },
  { group: 'rounded', words: ['radius', 'rounded', 'radii'] },
  { group: 'breakpoints', words: ['breakpoint', 'screen'] },
  { group: 'fontSize', words: ['fontsize', 'text'] },
  { group: 'fontFamily', words: ['font', 'fontfamily', 'family', 'typeface'] },
  { group: 'borderWidth', words: ['borderwidth'] },
  { group: 'spacing', words: ['spacing', 'space', 'gap', 'size', 'sizing'] },
  {
    group: 'colors',
    words: [
      'color', 'colour', 'bg', 'background', 'fg', 'foreground', 'surface', 'accent',
      'primary', 'secondary', 'tertiary', 'brand', 'muted', 'subtle', 'ring', 'input',
      'destructive', 'danger', 'success', 'warning', 'error', 'info', 'card', 'popover',
      'border', 'divider', 'outline', 'ink', 'neutral', 'gray', 'grey', 'slate', 'zinc',
    ],
  },
]

function segments(name: string): string[] {
  return name.toLowerCase().split('-').filter(Boolean)
}

function hintGroup(name: string): CssVarGroup | null {
  const segs = new Set(segments(name))
  const joined = name.toLowerCase().replace(/-/g, '')
  for (const { group, words } of HINTS) {
    for (const w of words) {
      if (segs.has(w) || joined.startsWith(w)) return group
    }
  }
  return null
}

/** A shadow is two-plus lengths (optionally `inset`) followed by a color. */
function looksLikeShadow(value: string): boolean {
  if (/^inset\b/i.test(value)) return true
  const lengths = value.match(/-?(?:\d*\.\d+|\d+)(?:px|rem|em)\b/g)
  return (lengths?.length ?? 0) >= 2 && /#|rgba?\(|hsla?\(|oklch\(/i.test(value)
}

/** Which schema group a custom property belongs to. */
export function classifyCssVar(name: string, value: string): CssVarGroup {
  const hint = hintGroup(name)
  if (hint === 'shadows' || looksLikeShadow(value)) return 'shadows'
  if (normalizeColor(value) !== null) {
    // A color-valued property is a color even when its name hints otherwise
    // (`--border: #E2E8F0`, `--text-muted: #64748B`).
    return 'colors'
  }
  const dim = toDimension(value)
  if (dim !== null) {
    if (hint === 'rounded' || hint === 'breakpoints' || hint === 'borderWidth') return hint
    if (hint === 'fontSize') return 'fontSize'
    if (hint === 'spacing') return 'spacing'
    return 'other'
  }
  if (hint === 'fontFamily') return 'fontFamily'
  return 'other'
}

/** Prefixes stripped from a key once its group is known. */
const KEY_PREFIXES: Record<CssVarGroup, string[]> = {
  colors: ['color-', 'colors-', 'clr-'],
  spacing: ['spacing-', 'space-', 'size-', 'sizing-'],
  rounded: ['radius-', 'rounded-', 'radii-', 'border-radius-'],
  shadows: ['shadow-', 'elevation-', 'box-shadow-'],
  fontFamily: ['font-family-', 'font-', 'family-'],
  fontSize: ['font-size-', 'text-'],
  breakpoints: ['breakpoint-', 'screen-'],
  borderWidth: ['border-width-', 'border-w-'],
  other: [],
}

/** Turn `--color-primary` into `primary` for the `colors` group. */
export function tokenKeyFor(group: CssVarGroup, name: string): string {
  let key = name
  for (const p of KEY_PREFIXES[group]) {
    if (key.toLowerCase().startsWith(p)) {
      key = key.slice(p.length)
      break
    }
  }
  // `--radius` alone carries no key of its own.
  const bare = KEY_PREFIXES[group].some((p) => `${key.toLowerCase()}-` === p)
  if (key === '' || bare) return 'base'
  return key
}

export interface CssVarExtraction {
  colors: Record<string, ColorValue>
  darkColors: Record<string, ColorValue>
  spacing: Record<string, DimensionValue>
  rounded: Record<string, DimensionValue>
  shadows: Record<string, string>
  fontFamily: Record<string, string>
  fontSize: Record<string, DimensionValue>
  breakpoints: Record<string, DimensionValue>
  borderWidth: Record<string, DimensionValue>
  /** Everything recognised but not mapped into a schema group. */
  other: Record<string, string>
  /** How many `--*` declarations were seen in base/dark theme rules. */
  declarationCount: number
}

function emptyExtraction(): CssVarExtraction {
  return {
    colors: {},
    darkColors: {},
    spacing: {},
    rounded: {},
    shadows: {},
    fontFamily: {},
    fontSize: {},
    breakpoints: {},
    borderWidth: {},
    other: {},
    declarationCount: 0,
  }
}

/** Tailwind's own runtime internals — never design tokens. */
function isInternal(name: string): boolean {
  return name.startsWith('tw-') || name.startsWith('_')
}

/**
 * The head of a font stack, unquoted. The schema stores one family name so font
 * loading can resolve it against a provider; the fallbacks are the compiler's
 * business, not the token's.
 */
function familyHead(raw: string): string {
  return raw.split(',')[0].trim().replace(/^["']|["']$/g, '').trim()
}

/**
 * Extract schema-shaped tokens from a stylesheet's custom properties.
 *
 * Only document-level theme rules are read (`:root`, `:host`, `html`, `body`,
 * `*`, `@theme`, `@layer base`) plus their dark-scheme counterparts —
 * component-scoped custom properties are not design tokens. First value for a
 * key wins, so an earlier, more specific `:root` is not clobbered by a later
 * generic one.
 */
export function extractCssCustomProps(source: string): CssVarExtraction {
  const out = emptyExtraction()

  for (const rule of scanCssRules(source)) {
    const dark = isDarkRule(rule)
    if (!dark && !isBaseRule(rule)) continue

    const decls = parseDeclarations(rule.body)
    for (const [name, value] of Object.entries(decls)) {
      if (isInternal(name)) continue
      out.declarationCount++

      const group = classifyCssVar(name, value)
      const key = tokenKeyFor(group, name)

      if (group === 'colors') {
        const hex = normalizeColor(value)
        if (!hex) continue
        const target = dark ? out.darkColors : out.colors
        if (target[key] === undefined) target[key] = hex
        continue
      }
      // Non-color tokens have no dark-mode dimension in the schema.
      if (dark) continue

      switch (group) {
        case 'spacing':
        case 'rounded':
        case 'fontSize':
        case 'breakpoints':
        case 'borderWidth': {
          const dim = toDimension(value)
          if (dim !== null && out[group][key] === undefined) out[group][key] = dim
          break
        }
        case 'shadows':
          if (out.shadows[key] === undefined) out.shadows[key] = value
          break
        case 'fontFamily': {
          const family = familyHead(value)
          if (family && out.fontFamily[key] === undefined) out.fontFamily[key] = family
          break
        }
        default:
          if (out.other[name] === undefined) out.other[name] = value
      }
    }
  }

  return out
}
