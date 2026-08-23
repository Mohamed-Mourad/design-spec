// exportBundle.ts — the Free-tier deliverable: everything the workspace produced,
// as a ZIP the developer drops into their repo.
//
// The bundle is exactly the compiler's output set plus the committed schema, so
// what you download is byte-identical to what `design-spec compile` writes on
// disk. Nothing is re-serialized here beyond the schema itself, and the schema
// uses the CLI's canonical form (2-space, trailing newline) so a `git diff`
// between a downloaded bundle and a CLI-generated one is empty.

import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import type { DesignSystemSchema } from '@/types/schema'
import type { FileOutput } from '@/types/compiler'

export const SCHEMA_FILENAME = 'design-spec.schema.json'

/** The canonical committed form of the schema — matches the CLI byte for byte. */
export function serializeSchema(schema: DesignSystemSchema): string {
  return JSON.stringify(schema, null, 2) + '\n'
}

/** A filesystem-safe stem derived from the system's name. */
export function bundleName(schemaName: string): string {
  const slug = schemaName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'design-spec'}.zip`
}

/** Build the bundle's file list: the schema first, then every compiled output. */
export function bundleFiles(schema: DesignSystemSchema, outputs: FileOutput[]): FileOutput[] {
  return [
    { filename: SCHEMA_FILENAME, content: serializeSchema(schema), language: 'json' },
    ...outputs,
  ]
}

/**
 * Assemble the archive without serializing it. Kept separate from `buildBundle`
 * so what goes into the ZIP is assertable without a Blob — jsdom's Blob has no
 * `arrayBuffer()`, and the contents are the part worth testing.
 */
export function packBundle(schema: DesignSystemSchema, outputs: FileOutput[]): JSZip {
  const zip = new JSZip()
  for (const file of bundleFiles(schema, outputs)) {
    // `filename` may be a nested path (components/react-tailwind/Button.tsx);
    // JSZip creates the directories from it.
    zip.file(file.filename, file.content)
  }
  return zip
}

/** Zip the bundle to a Blob. */
export async function buildBundle(schema: DesignSystemSchema, outputs: FileOutput[]): Promise<Blob> {
  return packBundle(schema, outputs).generateAsync({ type: 'blob' })
}

/** Build the bundle and hand it to the browser as a download. */
export async function downloadBundle(schema: DesignSystemSchema, outputs: FileOutput[]): Promise<void> {
  saveAs(await buildBundle(schema, outputs), bundleName(schema.name))
}
