// synthesize.ts — build a project schema from detected signals + defaults.
//
// Pure given its inputs. Starts from defaultSchema (so every field is present
// and valid), overlays detected frameworks and any scanned tokens, and names
// the system after the project. Anything not detected is filled by the default
// preset — init never produces a half-empty schema.

import { defaultSchema, type DesignSystemSchema, type ColorValue, type DimensionValue } from '@design-spec/compiler'

type Framework = DesignSystemSchema['export']['frameworks'][number]

export interface SynthInput {
  /** Project display name (from package.json name or dir). */
  name?: string
  frameworks: Framework[]
  scanned: {
    colors?: Record<string, ColorValue>
    spacing?: Record<string, DimensionValue>
    rounded?: Record<string, DimensionValue>
  }
  /** Optional export-config overrides from flags/survey. */
  exportOverrides?: Partial<DesignSystemSchema['export']>
}

function titleCase(s: string): string {
  return s.replace(/[-_/]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim()
}

/** Deep-ish clone of the default preset (plain JSON, so structuredClone is safe). */
function freshDefault(): DesignSystemSchema {
  return structuredClone(defaultSchema)
}

export function synthesizeSchema(input: SynthInput): DesignSystemSchema {
  const schema = freshDefault()

  if (input.name) {
    schema.name = titleCase(input.name)
    schema.description = `Design system for ${schema.name}.`
  }

  schema.export = { ...schema.export, frameworks: input.frameworks, ...input.exportOverrides }

  // Overlay scanned tokens; detected values win over defaults for the same key,
  // but default keys with no detected counterpart are preserved.
  if (input.scanned.colors && Object.keys(input.scanned.colors).length) {
    schema.colors = { ...schema.colors, ...input.scanned.colors }
  }
  if (input.scanned.spacing && Object.keys(input.scanned.spacing).length) {
    schema.spacing = { ...schema.spacing, ...input.scanned.spacing }
  }
  if (input.scanned.rounded && Object.keys(input.scanned.rounded).length) {
    schema.rounded = { ...schema.rounded, ...input.scanned.rounded }
  }

  return schema
}
