// mcp/route.ts — semantic routing resolvers for the MCP server.
//
// Pure (schema, query) => slice. Each resolver returns ONLY the slice an agent
// asked for — the whole point of the upstream "semantic firewall" is to never
// dump the entire schema. No I/O. `design-spec serve` registers each as an MCP
// tool; the web app and any agent client call the identical functions.

import type { DesignSystemSchema, ComponentTokenGroup } from '../types/schema'
import { resolveValue } from '../tokenResolver'

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
}

/**
 * Tokens for ONE component. Returns null if the component is unknown. Leaks
 * nothing about other components or unrelated token groups — only this
 * component's blueprint tokens, resolved to concrete values.
 */
export function get_component_tokens(schema: DesignSystemSchema, name: string): ComponentTokensSlice | null {
  const bp = schema.componentBlueprints[name]
  if (!bp) return null
  const tokens: Record<string, Record<string, unknown>> = {}
  for (const [variant, group] of Object.entries(bp.tokens)) {
    tokens[variant] = resolveGroup(schema, group as ComponentTokenGroup)
  }
  return {
    component: bp.name,
    description: bp.description,
    variants: bp.variants,
    states: bp.states,
    tokens,
  }
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
