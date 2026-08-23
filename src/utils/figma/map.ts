// Figma → DesignSystemSchema.
//
// Pure functions over already-fetched Figma payloads: no fetch, no store, no
// clock. The network half lives in `client.ts`, which means every mapping rule
// below is testable against a fixture and the PAT never comes near this file.
//
// The rules come from architecture-plan.md §15:
//   FILL style   -> colors.{name}
//   TEXT style   -> typography.{name}
//   EFFECT style -> shadows.{name}
//   COLOR var    -> colors.{name} (+ darkMode.colors on a second, dark mode)
//   FLOAT var    -> rounded.{name} when the name says radius, else spacing.{name}
//
// Nothing is silently dropped. Anything unmapped — a gradient fill, a blur
// effect, a string variable, a key collision — leaves a note, because an import
// that quietly loses half a palette is worse than one that says what it skipped.

import type {
  ColorValue,
  DesignSystemSchema,
  DimensionValue,
  ShadowToken,
  TypographyToken,
} from '@/types/schema'
import type {
  FigmaColor,
  FigmaEffect,
  FigmaNode,
  FigmaStyleMeta,
  FigmaVariable,
  FigmaVariableCollection,
  FigmaVariableValue,
  FigmaTypeStyle,
} from './types'

export type FigmaNoteKind = 'skipped' | 'collision' | 'mode'

export interface FigmaNote {
  kind: FigmaNoteKind
  /** What it was called in Figma — the name the designer will recognise. */
  source: string
  reason: string
}

/** Everything one import produced, before it is merged into a workspace. */
export interface FigmaImport {
  colors: Record<string, ColorValue>
  typography: Record<string, TypographyToken>
  shadows: Record<string, ShadowToken>
  spacing: Record<string, DimensionValue>
  rounded: Record<string, DimensionValue>
  /** Second-mode colors — populated only when a collection has a dark mode. */
  darkColors: Record<string, ColorValue>
  notes: FigmaNote[]
  counts: { styles: number; variables: number; tokens: number }
}

export function emptyImport(): FigmaImport {
  return {
    colors: {},
    typography: {},
    shadows: {},
    spacing: {},
    rounded: {},
    darkColors: {},
    notes: [],
    counts: { styles: 0, variables: 0, tokens: 0 },
  }
}

// ── file key ─────────────────────────────────────────────────────────────────

/**
 * Pull the file key out of anything a designer is likely to paste: a `/file/`
 * URL, the newer `/design/` one, a prototype link, or the bare key copied from
 * the address bar.
 */
export function figmaFileKey(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  const fromUrl = /figma\.com\/(?:file|design|proto|board|slides)\/([A-Za-z0-9]{10,})/.exec(raw)
  if (fromUrl) return fromUrl[1]
  if (/^[A-Za-z0-9]{10,}$/.test(raw)) return raw
  return null
}

// ── value conversion ─────────────────────────────────────────────────────────

/**
 * `{r,g,b}` in 0–1 to `#RRGGBB`.
 *
 * Alpha is deliberately dropped: the schema's `ColorValue` is hex only
 * (spec.md), and a token that silently carried transparency would compile to a
 * value the rest of the system cannot express.
 */
export function figmaColorToHex(color: FigmaColor): ColorValue {
  const channel = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase()
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}` as ColorValue
}

/** A Figma layer name to a schema token key: `Brand/Primary 500` → `brand-primary-500`. */
export function tokenKeyFor(name: string): string {
  const key = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return key || 'unnamed'
}

/** Figma numbers are unitless points; the schema wants a dimension. */
function px(n: number): DimensionValue {
  return `${round(n)}px` as DimensionValue
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

function rgba(color: FigmaColor): string {
  const c = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255)
  const alpha = color.a ?? 1
  return `rgba(${c(color.r)}, ${c(color.g)}, ${c(color.b)}, ${round(alpha)})`
}

// ── styles ───────────────────────────────────────────────────────────────────

/**
 * Map published styles onto tokens. `nodes` is what
 * `GET /v1/files/{key}/nodes?ids=…` returned, keyed by node id — the style list
 * carries names, the nodes carry values, and neither is useful alone.
 */
export function mapFigmaStyles(
  styles: FigmaStyleMeta[],
  nodes: Record<string, FigmaNode | undefined>,
  into: FigmaImport = emptyImport(),
): FigmaImport {
  for (const style of ordered(styles)) {
    const key = tokenKeyFor(style.name)
    const node = nodes[style.node_id]
    if (!node) {
      note(into, 'skipped', style.name, 'the style has no readable node in this file')
      continue
    }

    switch (style.style_type) {
      case 'FILL': {
        const hex = solidFill(node)
        if (!hex) {
          note(into, 'skipped', style.name, 'only solid paint styles map to a color token')
          continue
        }
        claim(into, into.colors, key, hex, style.name)
        break
      }
      case 'TEXT': {
        const token = textStyle(node.style)
        if (!token) {
          note(into, 'skipped', style.name, 'the text style is missing a family or a size')
          continue
        }
        claim(into, into.typography, key, token, style.name)
        break
      }
      case 'EFFECT': {
        const shadow = effectStyle(node.effects ?? [], style.name, into)
        if (!shadow) continue
        claim(into, into.shadows, key, shadow, style.name)
        break
      }
      default:
        note(
          into,
          'skipped',
          style.name,
          `${style.style_type.toLowerCase()} styles have no token equivalent`,
        )
        continue
    }
    into.counts.styles++
  }
  return recount(into)
}

function solidFill(node: FigmaNode): ColorValue | null {
  const paint = (node.fills ?? []).find((p) => p.visible !== false && p.type === 'SOLID' && p.color)
  return paint?.color ? figmaColorToHex(paint.color) : null
}

function textStyle(style: FigmaTypeStyle | undefined): TypographyToken | null {
  if (!style?.fontFamily || typeof style.fontSize !== 'number') return null
  const token: TypographyToken = {
    fontFamily: style.fontFamily,
    fontSize: px(style.fontSize),
    fontWeight: style.fontWeight ?? 400,
    lineHeight:
      typeof style.lineHeightPx === 'number'
        ? px(style.lineHeightPx)
        : round((style.lineHeightPercentFontSize ?? 100) / 100),
  }
  if (typeof style.letterSpacing === 'number' && round(style.letterSpacing) !== 0) {
    token.letterSpacing = px(style.letterSpacing)
  }
  const transform = textTransform(style.textCase)
  if (transform) token.textTransform = transform
  return token
}

function textTransform(textCase: string | undefined): TypographyToken['textTransform'] {
  switch (textCase) {
    case 'UPPER':
      return 'uppercase'
    case 'LOWER':
      return 'lowercase'
    case 'TITLE':
      return 'capitalize'
    default:
      return undefined
  }
}

/**
 * Compose an effect style into a `box-shadow`. Figma layers effects the way CSS
 * does, so several shadows become several layers rather than one merged value;
 * blurs have no shadow equivalent and are reported instead of approximated.
 */
function effectStyle(
  effects: FigmaEffect[],
  sourceName: string,
  into: FigmaImport,
): ShadowToken | null {
  const layers: string[] = []
  let inset = false
  for (const effect of effects) {
    if (effect.visible === false) continue
    if (effect.type !== 'DROP_SHADOW' && effect.type !== 'INNER_SHADOW') {
      note(
        into,
        'skipped',
        sourceName,
        `${effect.type.toLowerCase().replace(/_/g, ' ')} has no box-shadow equivalent`,
      )
      continue
    }
    if (effect.type === 'INNER_SHADOW') inset = true
    const offset = effect.offset ?? { x: 0, y: 0 }
    const parts = [
      `${round(offset.x)}px`,
      `${round(offset.y)}px`,
      `${round(effect.radius ?? 0)}px`,
      `${round(effect.spread ?? 0)}px`,
      rgba(effect.color ?? { r: 0, g: 0, b: 0, a: 1 }),
    ]
    layers.push(`${effect.type === 'INNER_SHADOW' ? 'inset ' : ''}${parts.join(' ')}`)
  }
  if (layers.length === 0) {
    note(into, 'skipped', sourceName, 'the effect style has no visible shadow')
    return null
  }
  const token: ShadowToken = { value: layers.length === 1 ? layers[0] : layers }
  if (inset) token.inset = true
  return token
}

// ── variables ────────────────────────────────────────────────────────────────

/**
 * Map local variables onto tokens, including a second mode as dark-mode colors.
 *
 * Which mode is "dark" is decided by its name, not its position: designers name
 * modes, and a collection whose modes read `Light`/`Dark` should not depend on
 * the order Figma happens to return them in. A collection with more than two
 * modes contributes its default and its dark mode; the rest are reported.
 */
export function mapFigmaVariables(
  variables: Record<string, FigmaVariable>,
  collections: Record<string, FigmaVariableCollection>,
  into: FigmaImport = emptyImport(),
): FigmaImport {
  const all = Object.values(variables ?? {})
  for (const variable of [...all].sort((a, b) => byName(a.name, b.name))) {
    const collection = collections?.[variable.variableCollectionId]
    if (!collection) {
      note(
        into,
        'skipped',
        variable.name,
        'the variable belongs to a collection this file does not expose',
      )
      continue
    }
    const key = tokenKeyFor(variable.name)
    const defaultValue = resolve(
      variable.valuesByMode?.[collection.defaultModeId],
      variables,
      collection.defaultModeId,
    )

    switch (variable.resolvedType) {
      case 'COLOR': {
        if (!isColor(defaultValue)) {
          note(into, 'skipped', variable.name, 'the variable has no value in its default mode')
          continue
        }
        claim(into, into.colors, key, figmaColorToHex(defaultValue), variable.name)
        const dark = darkModeOf(collection)
        if (dark) {
          const darkValue = resolve(variable.valuesByMode?.[dark.modeId], variables, dark.modeId)
          if (isColor(darkValue)) into.darkColors[key] = figmaColorToHex(darkValue)
        }
        break
      }
      case 'FLOAT': {
        if (typeof defaultValue !== 'number') {
          note(
            into,
            'skipped',
            variable.name,
            'the variable has no numeric value in its default mode',
          )
          continue
        }
        const group = isRadiusName(variable.name) ? into.rounded : into.spacing
        claim(into, group, key, px(defaultValue), variable.name)
        break
      }
      default:
        note(
          into,
          'skipped',
          variable.name,
          `${variable.resolvedType.toLowerCase()} variables have no token equivalent`,
        )
        continue
    }
    into.counts.variables++
  }

  for (const collection of Object.values(collections ?? {})) {
    const dark = darkModeOf(collection)
    const extra = collection.modes.filter(
      (m) => m.modeId !== collection.defaultModeId && m.modeId !== dark?.modeId,
    )
    for (const mode of extra) {
      note(
        into,
        'mode',
        `${collection.name} / ${mode.name}`,
        'only the default and dark modes are imported',
      )
    }
  }
  return recount(into)
}

function darkModeOf(
  collection: FigmaVariableCollection,
): { modeId: string; name: string } | undefined {
  return collection.modes.find(
    (m) => m.modeId !== collection.defaultModeId && /dark|night/i.test(m.name),
  )
}

function isRadiusName(name: string): boolean {
  return /radius|rounded|corner/i.test(name)
}

function isColor(value: unknown): value is FigmaColor {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as FigmaColor).r === 'number' &&
    typeof (value as FigmaColor).g === 'number' &&
    typeof (value as FigmaColor).b === 'number'
  )
}

/**
 * Follow variable aliases to a concrete value. Depth-limited rather than
 * cycle-tracked: a file can alias a chain of any length, and a corrupt file can
 * alias a loop; both end here instead of hanging the tab.
 */
function resolve(
  value: FigmaVariableValue | undefined,
  variables: Record<string, FigmaVariable>,
  modeId: string,
  depth = 0,
): FigmaVariableValue | undefined {
  if (!value || depth > 8) return undefined
  if (typeof value === 'object' && 'type' in value && value.type === 'VARIABLE_ALIAS') {
    const target = variables?.[value.id]
    if (!target) return undefined
    const next = target.valuesByMode?.[modeId] ?? Object.values(target.valuesByMode ?? {})[0]
    return resolve(next, variables, modeId, depth + 1)
  }
  return value
}

// ── merging into a workspace ─────────────────────────────────────────────────

export type FigmaMergeMode = 'merge' | 'replace'

/**
 * Fold an import into a schema and return a new one.
 *
 * `merge` adds and updates, never removes — the safe default, and the only one
 * that makes sense when Figma holds part of a system. `replace` swaps a group
 * wholesale, but **only a group the import actually populated**: replacing
 * `shadows` with nothing because the Figma file publishes no effect styles
 * would destroy work the designer never asked to touch.
 */
export function applyFigmaImport(
  schema: DesignSystemSchema,
  imported: FigmaImport,
  mode: FigmaMergeMode,
): DesignSystemSchema {
  const next = JSON.parse(JSON.stringify(schema)) as Record<string, unknown>
  const groups: [string, Record<string, unknown>][] = [
    ['colors', imported.colors],
    ['typography', imported.typography],
    ['shadows', imported.shadows],
    ['spacing', imported.spacing],
    ['rounded', imported.rounded],
  ]
  for (const [name, incoming] of groups) {
    if (Object.keys(incoming).length === 0) continue
    const current = (next[name] ?? {}) as Record<string, unknown>
    next[name] = mode === 'replace' ? { ...incoming } : { ...current, ...incoming }
  }

  if (Object.keys(imported.darkColors).length > 0) {
    const dark = (next.darkMode ?? { enabled: false, colors: {} }) as {
      enabled: boolean
      colors: Record<string, unknown>
    }
    next.darkMode = {
      ...dark,
      // A file that publishes a dark mode is a file whose owner wants one.
      enabled: true,
      colors:
        mode === 'replace'
          ? { ...imported.darkColors }
          : { ...dark.colors, ...imported.darkColors },
    }
  }
  return next as unknown as DesignSystemSchema
}

// ── internals ────────────────────────────────────────────────────────────────

/** Styles in a stable order so an import is deterministic whatever Figma returns. */
function ordered(styles: FigmaStyleMeta[]): FigmaStyleMeta[] {
  return [...styles].sort((a, b) => byName(a.name, b.name))
}

/** Case-insensitive, with the raw name as the tiebreak so the order is total. */
function byName(a: string, b: string): number {
  const la = a.toLowerCase()
  const lb = b.toLowerCase()
  if (la !== lb) return la < lb ? -1 : 1
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Write a token, keeping the first claimant on a key collision. Two Figma
 * layers can normalise to one token key (`Primary/500` and `primary 500`), and
 * last-one-wins would make the result depend on iteration order.
 */
function claim<V>(
  into: FigmaImport,
  group: Record<string, V>,
  key: string,
  value: V,
  source: string,
): void {
  if (key in group) {
    note(into, 'collision', source, `another style or variable already maps to ${key}`)
    return
  }
  group[key] = value
}

function note(into: FigmaImport, kind: FigmaNoteKind, source: string, reason: string): void {
  into.notes.push({ kind, source, reason })
}

function recount(into: FigmaImport): FigmaImport {
  into.counts.tokens =
    Object.keys(into.colors).length +
    Object.keys(into.typography).length +
    Object.keys(into.shadows).length +
    Object.keys(into.spacing).length +
    Object.keys(into.rounded).length
  return into
}
