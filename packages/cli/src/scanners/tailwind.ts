// scanners/tailwind.ts — extract tokens from a tailwind.config.{js,mjs,cjs}.
//
// We dynamic-import the config on the developer's own machine (the CLI is the
// "byte-exact JS extraction" path the web retrofit can't do server-side). Only
// flat hex color leaves and string spacing/radius values are lifted; nested or
// computed values are left for the schema defaults to fill. TS configs are
// skipped in Phase 1 (no transpile step) — reported via `skipped`.

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { ColorValue, DimensionValue } from '@design-spec/compiler'

export interface TailwindScan {
  colors: Record<string, ColorValue>
  spacing: Record<string, DimensionValue>
  rounded: Record<string, DimensionValue>
  skipped?: string
}

const CANDIDATES = ['tailwind.config.js', 'tailwind.config.mjs', 'tailwind.config.cjs']
const HEX = /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/

/** Flatten a (possibly nested) Tailwind color map to dotted hex leaves. */
function flattenColors(obj: unknown, prefix = ''): Record<string, ColorValue> {
  const out: Record<string, ColorValue> = {}
  if (typeof obj !== 'object' || obj === null) return out
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}-${k}` : k
    if (typeof v === 'string' && HEX.test(v)) out[key] = v as ColorValue
    else if (typeof v === 'object' && v !== null) Object.assign(out, flattenColors(v, key))
  }
  return out
}

function pickDimensions(obj: unknown): Record<string, DimensionValue> {
  const out: Record<string, DimensionValue> = {}
  if (typeof obj !== 'object' || obj === null) return out
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v as DimensionValue
    else if (typeof v === 'number') out[k] = v
  }
  return out
}

/** Scan a project root for a Tailwind config and lift its theme tokens. */
export async function scanTailwind(root: string): Promise<TailwindScan> {
  // A .ts config exists but we can't import it without a transpiler.
  if (existsSync(join(root, 'tailwind.config.ts'))) {
    return { colors: {}, spacing: {}, rounded: {}, skipped: 'tailwind.config.ts (TS config — run from a built project for extraction)' }
  }

  const found = CANDIDATES.map((c) => join(root, c)).find((p) => existsSync(p))
  if (!found) return { colors: {}, spacing: {}, rounded: {} }

  let mod: { default?: unknown } & Record<string, unknown>
  try {
    mod = (await import(pathToFileURL(found).href)) as typeof mod
  } catch (e) {
    return { colors: {}, spacing: {}, rounded: {}, skipped: `${found} (import failed: ${(e as Error).message})` }
  }

  const config = (mod.default ?? mod) as { theme?: { extend?: Record<string, unknown> } & Record<string, unknown> }
  const theme = config.theme ?? {}
  const extend = theme.extend ?? {}

  return {
    colors: { ...flattenColors(theme.colors), ...flattenColors(extend.colors) },
    spacing: { ...pickDimensions(theme.spacing), ...pickDimensions(extend.spacing) },
    rounded: { ...pickDimensions(theme.borderRadius), ...pickDimensions(extend.borderRadius) },
  }
}
