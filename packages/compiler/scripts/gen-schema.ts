// scripts/gen-schema.ts — regenerate the committed repo-root design-spec.schema.json
// from the canonical TS const. Run `npx tsx scripts/gen-schema.ts` from the
// compiler package after editing jsonSchema.ts. A test asserts the file matches.

import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { designSpecJsonSchema } from '../src/jsonSchema.js'
import { SCHEMA_JSON_PATH, serializeSchema } from '../src/schemaFile.js'

const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(here, '..', '..', '..', SCHEMA_JSON_PATH)
await writeFile(out, serializeSchema(designSpecJsonSchema), 'utf8')
console.log(`wrote ${out}`)
