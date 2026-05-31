// resolveResponsive.ts — responsive cascade merge + validation.
//
// Pure, deterministic. A component declares a `base` token group plus optional
// per-breakpoint overrides. `resolveResponsive` flattens that into a mobile-first
// cascade: every breakpoint layer is `base` merged with its own overrides (the
// override wins), with all `{ref}` values resolved to concrete tokens. Layers are
// ordered ascending by the breakpoint's pixel min-width so consumers (the React
// and Vue component compilers) emit mobile-first `sm:`/`md:` prefixes and
// `@media (min-width: …)` blocks in a stable order.
//
// `validateResponsiveCascade` is the inverse: it flags a cascade a buyer would
// reject — an override keyed by a breakpoint the schema doesn't define, or a
// `{ref}` that resolves to nothing.

import type { DesignSystemSchema, ComponentTokenGroup } from './types/schema.js'
import { resolveValue, refPath, getPath, isTokenRef } from './tokenResolver.js'

/** One breakpoint's overrides, plus optional layout/visibility prose. */
export interface BreakpointLayer {
  tokens?: Omit<ComponentTokenGroup, 'responsive'>
  /** Prose: "collapses to hamburger", "stacks vertically". */
  layout?: string
  /** false = component hidden at this breakpoint. */
  visibleAt?: boolean
  notes?: string
}

export interface ResolvedBreakpoint {
  name: string
  /** Breakpoint min-width from `schema.breakpoints`, or null if unknown. */
  minWidth: string | null
  /** `base` merged with this breakpoint's overrides, all refs resolved. */
  tokens: Record<string, unknown>
  layout?: string
  visibleAt?: boolean
  notes?: string
}

export interface ResolvedResponsive {
  /** Resolved base token group (refs → concrete values). */
  base: Record<string, unknown>
  /** Breakpoint layers, mobile-first (ascending min-width). */
  breakpoints: ResolvedBreakpoint[]
}

export type ResponsiveIssueKind = 'unknown-breakpoint' | 'unresolved-ref'

export interface ResponsiveCascadeIssue {
  breakpoint: string
  /** The offending token key, when the issue is a bad ref. */
  token?: string
  kind: ResponsiveIssueKind
  message: string
}

/** Parse a dimension's leading number for ordering; NaN sorts last. */
function widthOrder(value: string | null): number {
  if (value === null) return Number.POSITIVE_INFINITY
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY
}

/** Resolve every value in a token group to a concrete value, dropping `responsive`. */
function resolveGroup(
  schema: DesignSystemSchema,
  group: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(group)) {
    if (k === 'responsive') continue
    if (v === undefined) continue
    out[k] = resolveValue(schema, v)
  }
  return out
}

/**
 * Shallow-merge an override onto base; override keys win, `responsive` excluded.
 * Values pass through *unresolved* (refs stay `{group.name}`) — the component
 * compilers need the ref name to emit `bg-primary` / `var(--color-primary)`.
 */
export function mergeTokens(
  base: Record<string, unknown>,
  override: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(base)) {
    if (k === 'responsive' || v === undefined) continue
    out[k] = v
  }
  if (override) {
    for (const [k, v] of Object.entries(override)) {
      if (k === 'responsive' || v === undefined) continue
      out[k] = v
    }
  }
  return out
}

/**
 * Breakpoint layers sorted mobile-first (ascending min-width), values left
 * *unresolved*. Shared by `resolveResponsive` and the component compilers so
 * every consumer emits breakpoints in one stable order.
 */
export function orderBreakpoints(
  schema: DesignSystemSchema,
  responsive?: Record<string, BreakpointLayer>,
): Array<{ name: string; minWidth: string | null; layer: BreakpointLayer }> {
  const entries = Object.entries(responsive ?? {}).map(([name, layer]) => ({
    name,
    minWidth: (schema.breakpoints[name] as string | undefined) ?? null,
    layer,
  }))
  entries.sort((a, b) => {
    const d = widthOrder(a.minWidth) - widthOrder(b.minWidth)
    return d !== 0 ? d : a.name.localeCompare(b.name)
  })
  return entries
}

/**
 * Flatten a component's `base` + per-breakpoint overrides into a resolved,
 * mobile-first cascade. Unknown breakpoint names are not dropped (they sort
 * last, `minWidth: null`) so output stays total and deterministic — use
 * `validateResponsiveCascade` to reject them.
 */
export function resolveResponsive(
  schema: DesignSystemSchema,
  base: Omit<ComponentTokenGroup, 'responsive'>,
  responsive?: Record<string, BreakpointLayer>,
): ResolvedResponsive {
  const resolvedBase = resolveGroup(schema, base as Record<string, unknown>)

  const layers: ResolvedBreakpoint[] = orderBreakpoints(schema, responsive).map(({ name, minWidth, layer }) => {
    const merged = mergeTokens(base as Record<string, unknown>, layer.tokens as Record<string, unknown> | undefined)
    const entry: ResolvedBreakpoint = { name, minWidth, tokens: resolveGroup(schema, merged) }
    if (layer.layout !== undefined) entry.layout = layer.layout
    if (layer.visibleAt !== undefined) entry.visibleAt = layer.visibleAt
    if (layer.notes !== undefined) entry.notes = layer.notes
    return entry
  })

  return { base: resolvedBase, breakpoints: layers }
}

/** Recursively collect unresolved `{ref}` keys in a token group (one level deep). */
function badRefs(
  schema: DesignSystemSchema,
  breakpoint: string,
  group: Record<string, unknown> | undefined,
  issues: ResponsiveCascadeIssue[],
): void {
  if (!group) return
  for (const [k, v] of Object.entries(group)) {
    if (k === 'responsive') continue
    if (isTokenRef(v)) {
      const path = refPath(v)!
      if (getPath(schema, path) === undefined) {
        issues.push({
          breakpoint,
          token: k,
          kind: 'unresolved-ref',
          message: `token "${k}" references {${path}}, which does not exist in the schema`,
        })
      }
    }
  }
}

/**
 * Flag an invalid responsive cascade: overrides keyed by a breakpoint the schema
 * doesn't define, or `{ref}` values that resolve to nothing. Empty array = valid.
 * Deterministic order: base refs first, then breakpoints in declared order.
 */
export function validateResponsiveCascade(
  schema: DesignSystemSchema,
  base: Omit<ComponentTokenGroup, 'responsive'>,
  responsive?: Record<string, BreakpointLayer>,
): ResponsiveCascadeIssue[] {
  const issues: ResponsiveCascadeIssue[] = []
  badRefs(schema, '<base>', base as Record<string, unknown>, issues)

  for (const [name, layer] of Object.entries(responsive ?? {})) {
    if (!(name in schema.breakpoints)) {
      issues.push({
        breakpoint: name,
        kind: 'unknown-breakpoint',
        message: `breakpoint "${name}" is not defined in schema.breakpoints`,
      })
    }
    badRefs(schema, name, layer.tokens as Record<string, unknown> | undefined, issues)
  }

  return issues
}
