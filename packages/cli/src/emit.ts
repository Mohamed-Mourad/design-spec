// emit.ts — compile a schema to disk and detect stale output.
//
// Shared by compile, watch, hook, lint, and status so the "what files does this
// schema produce, and are they current?" logic lives in one place. All writes
// are atomic (compiler's helper) so agents never read a half-written file.

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { compileAll, atomicWrite, type DesignSystemSchema, type FileOutput } from '@design-spec/compiler'

/** Compile every output for the schema and write it under `root`. Returns the filenames. */
export async function emit(schema: DesignSystemSchema, root: string): Promise<string[]> {
  const outputs = compileAll(schema)
  await Promise.all(outputs.map((o) => atomicWrite(join(root, o.filename), o.content)))
  return outputs.map((o) => o.filename)
}

export interface Staleness {
  /** Files whose on-disk content differs from the freshly compiled output. */
  stale: string[]
  /** Expected output files that are missing entirely. */
  missing: string[]
  /** True when every output is present and up to date. */
  current: boolean
}

/** Compare on-disk output against what the schema currently compiles to. */
export async function checkStale(schema: DesignSystemSchema, root: string): Promise<Staleness> {
  const outputs: FileOutput[] = compileAll(schema)
  const stale: string[] = []
  const missing: string[] = []

  await Promise.all(
    outputs.map(async (o) => {
      const path = join(root, o.filename)
      if (!existsSync(path)) {
        missing.push(o.filename)
        return
      }
      const onDisk = await readFile(path, 'utf8')
      if (onDisk !== o.content) stale.push(o.filename)
    }),
  )

  return { stale, missing, current: stale.length === 0 && missing.length === 0 }
}
