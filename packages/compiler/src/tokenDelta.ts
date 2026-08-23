// tokenDelta — what changed between two design systems, as data.
//
// One delta shape, three readers: the web app builds it to stage a change for
// designer approval, the Figma plugin renders it as the "Pending Structural
// Changes" diff, and the Go backend mirrors this walk in `model.DiffTokens` to
// write a pull-request body. All three must agree on what "changed" means, so
// the rules live here and the others follow.
//
// Pure and deterministic, like every other export: same pair of schemas in,
// byte-identical delta out, no side effects.

/**
 * The top-level schema keys that hold tokens, in `DesignSystemSchema` order —
 * which is the order a reader expects to meet them in.
 *
 * Everything else (version, name, overview, componentBlueprints, prose, export,
 * presentation) is metadata, prose, or config. None of it is a token, so none of
 * it is diffed: a renamed workspace is not a design change.
 */
export const TOKEN_GROUPS = [
  'colors',
  'typography',
  'spacing',
  'rounded',
  'shadows',
  'borders',
  'transitions',
  'breakpoints',
  'zIndex',
  'opacity',
  'icons',
  'layout',
  'components',
  'darkMode',
] as const

export type TokenGroup = (typeof TOKEN_GROUPS)[number]

/**
 * One changed token. A missing side means the token was not there: an added
 * token has no `old`, a removed one has no `new`. Values are literals, already
 * rendered — the consumer displays them, it does not re-interpret them.
 */
export interface TokenChange {
  path: string
  old?: string
  new?: string
}

/** Every token that differs between two schemas. */
export interface TokenDelta {
  changes: TokenChange[]
  /** The distinct top-level groups touched, in schema order. */
  groups: string[]
}

/**
 * Compare two schemas and return what changed.
 *
 * Accepts `unknown` on both sides on purpose. A delta is often taken against a
 * schema that came off the wire or out of localStorage, which may predate a
 * token group or carry one this build has never heard of; walking the value
 * structurally means neither case needs a migration to diff correctly.
 */
export function diffTokens(previous: unknown, current: unknown): TokenDelta {
  const before = leaves(previous)
  const after = leaves(current)

  const paths = Object.keys(after)
  for (const path of Object.keys(before)) {
    if (!(path in after)) paths.push(path)
  }
  paths.sort(byGroupThenPath)

  const delta: TokenDelta = { changes: [], groups: [] }
  const seen = new Set<string>()
  for (const path of paths) {
    const old = before[path]
    const next = after[path]
    if (old !== undefined && next !== undefined && old === next) continue

    const change: TokenChange = { path }
    if (old !== undefined) change.old = old
    if (next !== undefined) change.new = next
    delta.changes.push(change)

    const group = tokenGroupOf(path)
    if (!seen.has(group)) {
      seen.add(group)
      delta.groups.push(group)
    }
  }
  delta.groups.sort((a, b) => groupRank(a) - groupRank(b))
  return delta
}

/** True when the two schemas were token-for-token identical. */
export function isEmptyDelta(delta: TokenDelta): boolean {
  return delta.changes.length === 0
}

/** The top-level token group a flattened path belongs to. */
export function tokenGroupOf(path: string): string {
  const dot = path.indexOf('.')
  return dot > 0 ? path.slice(0, dot) : path
}

/**
 * Group a delta for display, keeping schema order — the shape the approval diff
 * and the review table both want.
 */
export function changesByGroup(delta: TokenDelta): { group: string; changes: TokenChange[] }[] {
  return delta.groups.map((group) => ({
    group,
    changes: delta.changes.filter((c) => tokenGroupOf(c.path) === group),
  }))
}

// ── internals ────────────────────────────────────────────────────────────────

/** Flatten every token group of a schema into `group.sub.key` → literal value. */
function leaves(schema: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (schema === null || typeof schema !== 'object') return out
  const root = schema as Record<string, unknown>
  for (const group of TOKEN_GROUPS) {
    flatten(group, root[group], out)
  }
  return out
}

/**
 * Only leaves land in the map: an object contributes its children, never
 * itself. Re-nesting a value therefore reads as a removal plus additions rather
 * than as an unreadable object-to-object diff.
 */
function flatten(prefix: string, value: unknown, out: Record<string, string>): void {
  if (value === undefined || value === null) return
  if (Array.isArray(value)) {
    value.forEach((child, i) => flatten(`${prefix}[${i}]`, child, out))
    return
  }
  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      flatten(`${prefix}.${key}`, child, out)
    }
    return
  }
  out[prefix] = String(value)
}

function byGroupThenPath(a: string, b: string): number {
  const ra = groupRank(tokenGroupOf(a))
  const rb = groupRank(tokenGroupOf(b))
  if (ra !== rb) return ra - rb
  return a < b ? -1 : a > b ? 1 : 0
}

function groupRank(group: string): number {
  const i = (TOKEN_GROUPS as readonly string[]).indexOf(group)
  return i === -1 ? TOKEN_GROUPS.length : i
}
