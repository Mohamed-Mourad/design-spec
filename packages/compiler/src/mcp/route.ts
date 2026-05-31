// mcp/route.ts — semantic routing resolvers for the MCP server.
//
// Pure (schema, query) => slice. Each resolver returns ONLY the slice an agent
// asked for — the whole point of the upstream "semantic firewall" is to never
// dump the entire schema. No I/O. `design-spec serve` registers each as an MCP
// tool; the web app and any agent client call the identical functions.

import type { DesignSystemSchema, ComponentTokenGroup } from '../types/schema.js'
import { resolveValue } from '../tokenResolver.js'

/** Resolve every `{ref}` value in a component token group to its concrete value. */
function resolveGroup(schema: DesignSystemSchema, group: ComponentTokenGroup): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(group)) {
    if (k === 'responsive') continue
    out[k] = resolveValue(schema, v)
  }
  return out
}

export interface ComponentTokensSlice {
  component: string
  description: string
  variants: string[]
  states: string[]
  /** Resolved token values per variant (`base` + each variant). */
  tokens: Record<string, Record<string, unknown>>
  /** Present only on a non-exact (fuzzy) match — tells the agent this was a guess. */
  note?: string
}

/** Levenshtein edit distance — small, pure, for closest-name matching. */
function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  let curr = new Array<number>(n + 1)
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[n]
}

/**
 * Resolve a requested component name to a blueprint key. Exact match wins; then
 * case-insensitive ("button" → "Button"); then the closest-spelled name within a
 * tolerance (typos). Returns the key plus whether it was an exact/insensitive hit.
 */
function resolveComponentKey(
  keys: string[],
  name: string,
): { key: string; fuzzy: boolean } | null {
  if (keys.includes(name)) return { key: name, fuzzy: false }
  const lower = name.toLowerCase()
  const ci = keys.find((k) => k.toLowerCase() === lower)
  if (ci) return { key: ci, fuzzy: false } // case-insensitive counts as a real match

  // Closest-spelled name (typo/abbreviation tolerance), deterministic on ties.
  // Two guards compose to reject no-signal input: only consider candidates that
  // share the query's FIRST letter (typos/abbrevs rarely change it; garbage like
  // "xyz" usually does), then require the edit distance to be within tolerance
  // (kills same-first-letter-but-unrelated words like "bowl" → "button").
  if (lower.length === 0) return null
  let best: { key: string; d: number } | null = null
  for (const k of keys) {
    if (k.toLowerCase()[0] !== lower[0]) continue
    const d = editDistance(k.toLowerCase(), lower)
    if (best === null || d < best.d || (d === best.d && k < best.key)) best = { key: k, d }
  }
  if (!best) return null
  const tolerance = Math.max(2, Math.ceil(best.key.length / 2))
  return best.d <= tolerance ? { key: best.key, fuzzy: true } : null
}

/**
 * Tokens for ONE component. Match is case-insensitive; an unrecognized name falls
 * back to the closest-spelled component with a `note` flagging it as a guess.
 * Returns null only when nothing is close. Leaks nothing about other components or
 * unrelated token groups — only the matched component's blueprint tokens, resolved.
 */
export function get_component_tokens(schema: DesignSystemSchema, name: string): ComponentTokensSlice | null {
  const match = resolveComponentKey(Object.keys(schema.componentBlueprints), name)
  if (!match) return null
  const bp = schema.componentBlueprints[match.key]
  const tokens: Record<string, Record<string, unknown>> = {}
  for (const [variant, group] of Object.entries(bp.tokens)) {
    tokens[variant] = resolveGroup(schema, group as ComponentTokenGroup)
  }
  const slice: ComponentTokensSlice = {
    component: bp.name,
    description: bp.description,
    variants: bp.variants,
    states: bp.states,
    tokens,
  }
  if (match.fuzzy) {
    slice.note = `No component named "${name}". This is the closest match ("${bp.name}") and may not be what you intended — verify the component name.`
  }
  return slice
}

export interface LayoutSystemSlice {
  grid: { columns: number; gutter: unknown; margin: unknown }
  container: { maxWidth: unknown; paddingX: unknown }
  spacing: Record<string, unknown>
  breakpoints: Record<string, unknown>
}

/** The layout system only: grid, container, spacing scale, breakpoints. */
export function get_layout_system(schema: DesignSystemSchema): LayoutSystemSlice {
  return {
    grid: {
      columns: schema.layout.grid.columns,
      gutter: resolveValue(schema, schema.layout.grid.gutter),
      margin: resolveValue(schema, schema.layout.grid.margin),
    },
    container: {
      maxWidth: schema.layout.container.maxWidth,
      paddingX: resolveValue(schema, schema.layout.container.paddingX),
    },
    spacing: { ...schema.spacing },
    breakpoints: { ...schema.breakpoints },
  }
}

/**
 * Semantic color roles only — excludes raw palette scale steps (e.g.
 * `primary-60`). An agent gets the roles it should reason about, not the full
 * numeric ramp.
 */
export function get_semantic_colors(schema: DesignSystemSchema): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [name, hex] of Object.entries(schema.colors)) {
    if (/-\d+$/.test(name)) continue // raw scale step — not a semantic role
    out[name] = hex
  }
  return out
}
