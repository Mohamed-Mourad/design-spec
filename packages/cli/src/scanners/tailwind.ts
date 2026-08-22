// scanners/tailwind.ts — the CLI's byte-exact Tailwind extraction.
//
// This is the one place in the product allowed to EXECUTE a project's config:
// `dynamic import()` runs on the developer's own machine, on their own code. The
// cloud retrofit may never do it (hard security invariant), which is why the
// static reader in `@design-spec/compiler` exists — and why this module falls
// back to that same static reader when the import is impossible (a `.ts` config
// with no transpiler, a config that throws). Either way the theme shape is
// interpreted by the compiler's `liftTailwindTheme`, so the byte-exact and
// static paths can never disagree about what a token is.

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { extractTailwindConfig, liftTailwindTheme, type TailwindTheme } from '@design-spec/compiler'

export interface TailwindScan extends TailwindTheme {
  /** Why byte-exact extraction was not possible, when it wasn't. */
  skipped?: string
  /** True when the values came from the static reader, not a live evaluation. */
  static?: boolean
}

/** Import order: what a bundler-free Node can actually load comes first. */
const IMPORTABLE = ['tailwind.config.js', 'tailwind.config.mjs', 'tailwind.config.cjs']
const ALL_CONFIGS = ['tailwind.config.ts', ...IMPORTABLE]

function empty(): TailwindTheme {
  return {
    colors: {},
    spacing: {},
    rounded: {},
    screens: {},
    borderWidth: {},
    fontSize: {},
    fontFamily: {},
    shadows: {},
    darkMode: null,
    prefix: null,
  }
}

/** Static read of whichever config exists — the fallback path. */
async function readStatically(root: string, reason: string): Promise<TailwindScan> {
  const found = ALL_CONFIGS.map((c) => join(root, c)).find((p) => existsSync(p))
  if (!found) return { ...empty(), skipped: reason }
  try {
    const source = await readFile(found, 'utf8')
    const extraction = extractTailwindConfig(source)
    const { unparseable, error, ...theme } = extraction
    return {
      ...theme,
      static: true,
      skipped:
        error !== undefined
          ? `${reason}; static read failed too (${error})`
          : unparseable.length > 0
            ? `${reason}; read statically, ${unparseable.length} layer(s) need a build to resolve`
            : `${reason}; read statically`,
    }
  } catch (e) {
    return { ...empty(), skipped: `${reason}; ${(e as Error).message}` }
  }
}

/** Scan a project root for a Tailwind config and lift its theme tokens. */
export async function scanTailwind(root: string): Promise<TailwindScan> {
  const importable = IMPORTABLE.map((c) => join(root, c)).find((p) => existsSync(p))
  if (!importable) {
    // A .ts config can't be imported without a transpiler — read it statically.
    return readStatically(root, 'no importable config')
  }

  let mod: { default?: unknown } & Record<string, unknown>
  try {
    mod = (await import(pathToFileURL(importable).href)) as typeof mod
  } catch (e) {
    return readStatically(root, `import failed (${(e as Error).message})`)
  }

  return liftTailwindTheme(mod.default ?? mod)
}
