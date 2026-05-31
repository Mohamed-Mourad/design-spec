// components/shared.ts — token-group → Tailwind-class / CSS-declaration mappers.
//
// Shared by the React (Tailwind) and Vue (scoped CSS) component compilers so the
// two stay in lockstep: the same token prop maps to the same utility and the same
// CSS property. Pure, deterministic. A `{group.name}` ref maps to the matching
// generated artifact (`bg-primary`, `var(--color-primary)`); a literal value is
// emitted as a Tailwind arbitrary value or an inline CSS literal.

import { refPath } from '../tokenResolver.js'

/** Token prop → Tailwind utility prefix. Props absent here are skipped. */
const TW_PREFIX: Record<string, string> = {
  backgroundColor: 'bg',
  textColor: 'text',
  typography: 'text',
  rounded: 'rounded',
  padding: 'p',
  paddingX: 'px',
  paddingY: 'py',
  borderColor: 'border',
  borderWidth: 'border',
  shadow: 'shadow',
  size: 'size',
  height: 'h',
  width: 'w',
}

/** Token prop → CSS property name(s). */
const CSS_PROP: Record<string, string[]> = {
  backgroundColor: ['background-color'],
  textColor: ['color'],
  rounded: ['border-radius'],
  padding: ['padding'],
  paddingX: ['padding-left', 'padding-right'],
  paddingY: ['padding-top', 'padding-bottom'],
  borderColor: ['border-color'],
  borderWidth: ['border-width'],
  shadow: ['box-shadow'],
  size: ['width', 'height'],
  height: ['height'],
  width: ['width'],
}

/** First path segment of a ref → the CSS-var group name used by tokens.css. */
const CSS_VAR_GROUP: Record<string, string> = {
  colors: 'color',
  spacing: 'spacing',
  rounded: 'rounded',
  shadows: 'shadow',
}

/** Last dot-segment of a ref path, e.g. `colors.primary` → `primary`. */
function refName(path: string): string {
  return path.slice(path.lastIndexOf('.') + 1)
}

/**
 * The CSS-var suffix for a ref path — matching the names cssVars.ts emits.
 * Single-group refs map by their first segment; the nested `borders.{width,color}`
 * groups map to `border-width-*` / `border-color-*`.
 */
function cssVarName(path: string): string {
  const seg = path.split('.')
  if (seg[0] === 'borders' && (seg[1] === 'width' || seg[1] === 'color')) {
    return `border-${seg[1]}-${seg.slice(2).join('-')}`
  }
  const group = CSS_VAR_GROUP[seg[0]]
  return group ? `${group}-${refName(path)}` : refName(path)
}

/**
 * Build the Tailwind utility for one token prop, or null if the prop has no
 * mapping. A ref uses the token name (`bg-primary`); a literal becomes an
 * arbitrary value (`bg-[#1D4ED8]`, `px-[12px]`).
 */
export function tokenToClass(prop: string, value: unknown): string | null {
  const prefix = TW_PREFIX[prop]
  if (prefix === undefined || value === undefined || value === null) return null
  const path = refPath(value)
  if (path !== null) return `${prefix}-${refName(path)}`
  return `${prefix}-[${String(value)}]`
}

/**
 * Build CSS declarations for one token prop (multiple for shorthand props like
 * `paddingX`). A ref maps to its `var(--…)` when the group has CSS vars,
 * otherwise to the raw value; `typography` expands to the font sub-variables.
 */
export function tokenToCss(prop: string, value: unknown, cssPrefix: string): string[] {
  if (value === undefined || value === null) return []
  const path = refPath(value)

  if (prop === 'typography') {
    if (path === null) return []
    const n = refName(path)
    return [
      `font-family: var(--${cssPrefix}font-${n}-family);`,
      `font-size: var(--${cssPrefix}font-${n}-size);`,
      `font-weight: var(--${cssPrefix}font-${n}-weight);`,
      `line-height: var(--${cssPrefix}font-${n}-line-height);`,
    ]
  }

  const props = CSS_PROP[prop]
  if (!props) return []
  let rendered: string
  if (path !== null) {
    rendered = `var(--${cssPrefix}${cssVarName(path)})`
  } else {
    rendered = String(value)
  }
  return props.map((p) => `${p}: ${rendered};`)
}

/** Stable ordering for token props so generated class lists / CSS are byte-stable. */
const PROP_ORDER = [
  'backgroundColor',
  'textColor',
  'typography',
  'borderColor',
  'borderWidth',
  'rounded',
  'shadow',
  'padding',
  'paddingX',
  'paddingY',
  'size',
  'width',
  'height',
]

/** Order a token group's keys deterministically: known props first, then the rest sorted. */
export function orderedProps(group: Record<string, unknown>): string[] {
  const keys = Object.keys(group).filter((k) => k !== 'responsive' && group[k] !== undefined)
  const known = PROP_ORDER.filter((p) => keys.includes(p))
  const rest = keys.filter((k) => !PROP_ORDER.includes(k)).sort()
  return [...known, ...rest]
}

/** PascalCase a component name for a class / file identifier. */
export function pascal(name: string): string {
  return name.replace(/(^|[-_\s]+)(\w)/g, (_, _sep, c: string) => c.toUpperCase())
}
