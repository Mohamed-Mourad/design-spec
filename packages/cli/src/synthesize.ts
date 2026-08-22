// synthesize.ts — turn a scan into the project's committed schema.
//
// The extraction itself lives in `@design-spec/compiler`
// (`extractDesignSystem`), shared byte-for-byte with the cloud retrofit. This
// module is the CLI's thin layer on top: run the shared engine over the files on
// disk, hand it the byte-exact tokens only the CLI can produce (a locally
// evaluated config), then apply the CLI's own flags — an explicit
// `--frameworks` list and the export-config overrides from the survey.
//
// `init` therefore never produces a half-empty schema: everything the repo does
// not speak to is filled from the baseline preset and reported as `defaulted`.

import {
  extractDesignSystem,
  type DesignSystemSchema,
  type ExportConfig,
  type ImportExtraction,
  type ImportFile,
  type ResolvedTokens,
} from '@design-spec/compiler'

type Framework = ExportConfig['frameworks'][number]

export interface SynthInput {
  /** Project display name (from package.json name or dir). */
  name?: string
  /** Explicit `--frameworks` list; when absent, detection decides. */
  frameworks?: Framework[]
  files: ImportFile[]
  paths?: string[]
  /** Tokens lifted by evaluating the project's own config locally. */
  resolved?: ResolvedTokens
  /** Optional export-config overrides from flags/survey. */
  exportOverrides?: Partial<ExportConfig>
}

export interface SynthResult {
  schema: DesignSystemSchema
  extraction: ImportExtraction
  frameworks: Framework[]
}

export function synthesizeSchema(input: SynthInput): SynthResult {
  const extraction = extractDesignSystem(
    { repo: input.name, files: input.files, paths: input.paths },
    { resolved: input.resolved },
  )

  const schema: DesignSystemSchema = extraction.schema
  const frameworks = input.frameworks?.length ? input.frameworks : extraction.detection.frameworks

  schema.export = { ...schema.export, frameworks, ...input.exportOverrides }

  return { schema, extraction, frameworks }
}
