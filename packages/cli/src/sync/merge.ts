// sync/merge.ts — the three-layer merge policy, as pure functions.
//
// architecture-plan §16.4 / §20:
//   schema.presentation  (visual, DB)       → REMOTE wins, always — removal too.
//   schema.export        (code-gen, git)    → LOCAL wins; remote only with --force.
//   tokens / blueprints / prose             → local is canonical (git); a pull
//                                             reports differences, never applies them.
//   Figma PAT, browser prefs                → never in a schema, never synced.
//
// No I/O here: same inputs, same result, so the policy is unit-testable on its own.

import { diffTokens, type DesignSystemSchema, type TokenDelta } from '@design-spec/compiler'

/** One changed leaf inside a config layer. Values are JSON-rendered. */
export interface LayerChange {
  path: string
  old?: string
  new?: string
}

export interface SyncMerge {
  /** The schema to write locally. */
  schema: DesignSystemSchema
  /** Presentation leaves the pull changed locally (remote → local). */
  presentation: LayerChange[]
  /** Export leaves where remote differs from local. */
  exportDiff: LayerChange[]
  /** Whether exportDiff was applied (only under --force). */
  exportTaken: boolean
  /** Token differences between the dashboard and local — reported, not pulled. */
  tokensNotPulled: TokenDelta
  /** True when the local schema file needs rewriting. */
  changed: boolean
}

export interface PushMerge {
  /** The schema to send to the dashboard. */
  schema: DesignSystemSchema
  /** Token changes the push makes on the dashboard (remote → local). */
  tokens: TokenDelta
  /** Export leaves the push changes on the dashboard. */
  exportDiff: LayerChange[]
  /** Presentation leaves where local differs from the dashboard — kept remote. */
  presentationKept: LayerChange[]
  /** True when the first push creates the project. */
  created: boolean
}

/** Flatten a JSON value to `path → JSON literal` leaves. Arrays are leaves. */
function leaves(value: unknown, prefix: string, out: Record<string, string> = {}): Record<string, string> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0 && prefix) out[prefix] = '{}'
    for (const [k, v] of entries) leaves(v, prefix ? `${prefix}.${k}` : k, out)
    return out
  }
  if (value !== undefined && prefix) out[prefix] = JSON.stringify(value)
  return out
}

/** Leaf-level diff of one layer, `before → after`, sorted by path. */
export function diffLayer(before: unknown, after: unknown, prefix: string): LayerChange[] {
  const a = leaves(before, prefix)
  const b = leaves(after, prefix)
  const paths = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()
  const out: LayerChange[] = []
  for (const path of paths) {
    if (a[path] === b[path]) continue
    const change: LayerChange = { path }
    if (a[path] !== undefined) change.old = a[path]
    if (b[path] !== undefined) change.new = b[path]
    out.push(change)
  }
  return out
}

function withPresentation(schema: DesignSystemSchema, presentation: DesignSystemSchema['presentation']): DesignSystemSchema {
  const next = { ...schema }
  if (presentation === undefined) delete next.presentation
  else next.presentation = structuredClone(presentation)
  return next
}

/**
 * `design-spec sync`: pull the dashboard into the local schema.
 *
 * Presentation is taken from remote wholesale (a presentation the designer
 * removed is removed locally). Export stays local unless `force`. Everything
 * else stays local and is only reported.
 */
export function mergeForSync(
  local: DesignSystemSchema,
  remote: DesignSystemSchema,
  opts: { force?: boolean } = {},
): SyncMerge {
  const presentation = diffLayer(local.presentation, remote.presentation, 'presentation')
  const exportDiff = diffLayer(local.export, remote.export, 'export')
  const exportTaken = Boolean(opts.force) && exportDiff.length > 0

  let schema = withPresentation(local, remote.presentation)
  if (exportTaken) schema = { ...schema, export: structuredClone(remote.export) }

  return {
    schema,
    presentation,
    exportDiff,
    exportTaken,
    tokensNotPulled: diffTokens(local, remote),
    changed: presentation.length > 0 || exportTaken,
  }
}

/**
 * `design-spec push`: what to send to the dashboard.
 *
 * Local wins for tokens and export (the dev owns compilation). Presentation is
 * carried over from the dashboard untouched — it is a designer's layer and a
 * push never overwrites it. With no project yet, local presentation (if any)
 * seeds it.
 */
export function mergeForPush(local: DesignSystemSchema, remote: DesignSystemSchema | null): PushMerge {
  if (!remote) {
    return {
      schema: structuredClone(local),
      tokens: diffTokens({}, local),
      exportDiff: diffLayer(undefined, local.export, 'export'),
      presentationKept: [],
      created: true,
    }
  }
  return {
    schema: withPresentation(local, remote.presentation),
    tokens: diffTokens(remote, local),
    exportDiff: diffLayer(remote.export, local.export, 'export'),
    presentationKept: diffLayer(remote.presentation, local.presentation, 'presentation'),
    created: false,
  }
}

/**
 * Whether two schemas are the same once on the wire: compared as parsed JSON,
 * so key order is ignored and undefined fields (which JSON drops) don't count.
 * Array order does count.
 */
export function sameSchema(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b)
}

function canonical(value: unknown): string {
  return JSON.stringify(sortKeys(JSON.parse(JSON.stringify(value ?? null))))
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(obj).sort()) out[k] = sortKeys(obj[k])
    return out
  }
  return value
}

/** Project slug from a schema name — kebab-case, the §16.3 commit-scope rule. */
export function projectSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '') // strip the accents NFKD split off
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '')
  return slug
}
