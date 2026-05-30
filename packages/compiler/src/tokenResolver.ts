// tokenResolver.ts — resolve `{path.to.token}` references against a schema.
//
// Pure and deterministic. References use dot paths into the schema tree, e.g.
// `{colors.primary}`, `{spacing.md}`, `{typography.label-md}`. A reference may
// point at a primitive (most groups) or a composite (typography, inside the
// components section), per spec.md.

const REF = /^\{([^}]+)\}$/

/** Is `value` a `{token.ref}` string? */
export function isTokenRef(value: unknown): value is string {
  return typeof value === 'string' && REF.test(value)
}

/** Extract the dot-path from a `{a.b.c}` reference, or null if not a reference. */
export function refPath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const m = value.match(REF)
  return m ? m[1] : null
}

/** Walk a dot-path into an object tree. Returns undefined if any segment misses. */
export function getPath(root: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc != null && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, root)
}

/**
 * Resolve a value one or more hops. If `value` is a `{ref}`, follow it (and any
 * chained refs, with cycle protection) until a non-reference value is reached.
 * Non-references pass through unchanged. Unresolvable refs return the original
 * string untouched, per spec.md ("leave unmapped values untouched").
 */
export function resolveValue(root: unknown, value: unknown, _seen: Set<string> = new Set()): unknown {
  const path = refPath(value)
  if (path === null) return value
  if (_seen.has(path)) return value // cycle — bail with the raw ref
  _seen.add(path)
  const next = getPath(root, path)
  if (next === undefined) return value
  return resolveValue(root, next, _seen)
}
