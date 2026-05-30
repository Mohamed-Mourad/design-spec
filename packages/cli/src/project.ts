// project.ts — locate, load, and save the project's design-spec.schema.json.
//
// The committed schema is the single source of truth. It is discovered by
// walking up from the cwd (like git), so commands work from any subdirectory.
// Writes go through the compiler's atomic helper.

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { atomicWrite, type DesignSystemSchema } from '@design-spec/compiler'
import { InvalidSchemaError, NotInitializedError } from './errors.js'
import { validateSchema } from './validate.js'

export const SCHEMA_FILE = 'design-spec.schema.json'

/** Walk up from `start` to find the nearest schema file. Returns its path or null. */
export function findSchema(start: string): string | null {
  let dir = start
  for (;;) {
    const candidate = join(dir, SCHEMA_FILE)
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/** The project root (dir containing the schema), or null if uninitialized. */
export function findProjectRoot(start: string): string | null {
  const schema = findSchema(start)
  return schema ? dirname(schema) : null
}

/**
 * Load and validate the project schema. Throws NotInitializedError when no
 * schema exists, InvalidSchemaError when it is malformed or fails validation.
 */
export async function loadSchema(cwd: string): Promise<{ schema: DesignSystemSchema; path: string; root: string }> {
  const path = findSchema(cwd)
  if (!path) throw new NotInitializedError(cwd)

  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch (e) {
    throw new InvalidSchemaError('could not read the file', e)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    throw new InvalidSchemaError('not valid JSON', e)
  }

  const issues = validateSchema(parsed)
  if (issues.length > 0) {
    const first = issues[0]
    throw new InvalidSchemaError(`${first.path || '<root>'}: ${first.message}`)
  }

  return { schema: parsed as DesignSystemSchema, path, root: dirname(path) }
}

/** Serialize a schema to the canonical committed JSON form (2-space, trailing newline). */
export function serializeSchema(schema: DesignSystemSchema): string {
  return JSON.stringify(schema, null, 2) + '\n'
}

/** Atomically write the schema to disk. */
export async function saveSchema(path: string, schema: DesignSystemSchema): Promise<void> {
  await atomicWrite(path, serializeSchema(schema))
}
