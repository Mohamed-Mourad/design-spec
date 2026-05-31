// validate.ts — authoritative schema validation against the published JSON Schema.
//
// The contract lives in one place: @design-spec/compiler's `designSpecJsonSchema`
// (generated from the same TS types the compiler uses). The CLI compiles it once
// with ajv and reports issues in a stable shape; lint, load, and the pre-commit
// hook all gate on this. There is no second, hand-rolled validator to drift.

import Ajv2020Module, { type ErrorObject } from 'ajv/dist/2020.js'
import { designSpecJsonSchema } from '@design-spec/compiler'

// ajv is CJS; under Node ESM the default import may arrive wrapped as { default }.
const Ajv2020 = ((Ajv2020Module as unknown as { default?: typeof Ajv2020Module }).default ??
  Ajv2020Module) as typeof Ajv2020Module

export interface ValidationIssue {
  path: string
  message: string
}

const ajv = new Ajv2020({ allErrors: true, strict: false })
const validateFn = ajv.compile(designSpecJsonSchema)

/** ajv instancePath (`/colors/primary`) → dotted schema path (`colors.primary`). */
function issuePath(e: ErrorObject): string {
  const base = e.instancePath.replace(/^\//, '').replace(/\//g, '.')
  if (e.keyword === 'required') {
    const prop = String((e.params as { missingProperty?: string }).missingProperty ?? '')
    return base ? `${base}.${prop}` : prop
  }
  if (e.keyword === 'additionalProperties') {
    const prop = String((e.params as { additionalProperty?: string }).additionalProperty ?? '')
    return base ? `${base}.${prop}` : prop
  }
  return base
}

/** Return a list of validation issues; empty means valid. */
export function validateSchema(value: unknown): ValidationIssue[] {
  if (validateFn(value)) return []
  const issues: ValidationIssue[] = []
  const seen = new Set<string>()
  for (const e of validateFn.errors ?? []) {
    const path = issuePath(e)
    const message = e.message ?? 'is invalid'
    const key = `${path}|${message}`
    if (seen.has(key)) continue
    seen.add(key)
    issues.push({ path, message })
  }
  return issues
}
