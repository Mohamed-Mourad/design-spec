// schemaFile.ts — shared serialization + path for the generated repo-root
// design-spec.schema.json. Both the generator script and the sync test use these
// so "generate" and "verify" agree byte-for-byte.

/** Repo-root-relative path of the committed JSON Schema artifact. */
export const SCHEMA_JSON_PATH = 'design-spec.schema.json'

/** Canonical serialization: 2-space indent + trailing newline. */
export function serializeSchema(schema: unknown): string {
  return JSON.stringify(schema, null, 2) + '\n'
}
