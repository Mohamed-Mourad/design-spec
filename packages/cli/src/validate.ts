// validate.ts — structural validation of a design-spec.schema.json.
//
// Lightweight, dependency-free checks that catch the mistakes that would make a
// compile produce garbage. Not a full JSON-Schema validation (Phase 2 owns the
// authoritative design-spec.schema.json round-trip); enough for lint/compile to
// fail fast with an actionable message.

import type { DesignSystemSchema } from '@design-spec/compiler'

export interface ValidationIssue {
  path: string
  message: string
}

const HEX = /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/

/** Return a list of validation issues; empty means valid. */
export function validateSchema(value: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const push = (path: string, message: string) => issues.push({ path, message })

  if (typeof value !== 'object' || value === null) {
    return [{ path: '', message: 'schema must be a JSON object' }]
  }
  const s = value as Partial<DesignSystemSchema>

  if (!s.name || typeof s.name !== 'string') push('name', 'required string')
  if (!s.version || typeof s.version !== 'string') push('version', 'required string')

  if (typeof s.colors !== 'object' || s.colors === null) {
    push('colors', 'required object')
  } else {
    if (!('primary' in s.colors)) push('colors.primary', 'at least the primary color must be defined')
    for (const [name, val] of Object.entries(s.colors)) {
      if (typeof val !== 'string' || !HEX.test(val)) push(`colors.${name}`, `must be a hex color, got ${JSON.stringify(val)}`)
    }
  }

  if (typeof s.typography !== 'object' || s.typography === null) push('typography', 'required object')
  if (typeof s.spacing !== 'object' || s.spacing === null) push('spacing', 'required object')
  if (typeof s.rounded !== 'object' || s.rounded === null) push('rounded', 'required object')

  if (!s.export || typeof s.export !== 'object') {
    push('export', 'required object (run "design-spec config")')
  } else if (!Array.isArray(s.export.frameworks) || s.export.frameworks.length === 0) {
    push('export.frameworks', 'at least one framework must be selected')
  }

  return issues
}
