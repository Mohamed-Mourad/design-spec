// framework.ts — detect a project's UI framework from its manifest + file tree.
//
// Pure-ish: reads the filesystem but returns a plain result. `init` uses this to
// pre-select export frameworks and decide which scanners to run.

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export type Framework = 'react-tailwind' | 'vue-css' | 'flutter'

export interface Detection {
  frameworks: Framework[]
  /** Human-readable signals that drove the detection (shown in --verbose/init). */
  signals: string[]
  hasTailwind: boolean
}

async function readPackageJson(root: string): Promise<{ deps: Record<string, string>; raw: boolean }> {
  const p = join(root, 'package.json')
  if (!existsSync(p)) return { deps: {}, raw: false }
  try {
    const pkg = JSON.parse(await readFile(p, 'utf8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    return { deps: { ...pkg.dependencies, ...pkg.devDependencies }, raw: true }
  } catch {
    return { deps: {}, raw: true }
  }
}

const TAILWIND_CONFIGS = ['tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.cjs', 'tailwind.config.mjs']

/** Detect the framework(s) in `root`. Falls back to react-tailwind if unknown. */
export async function detectFramework(root: string): Promise<Detection> {
  const signals: string[] = []
  const frameworks: Framework[] = []

  // Flutter
  if (existsSync(join(root, 'pubspec.yaml'))) {
    signals.push('found pubspec.yaml')
    frameworks.push('flutter')
  }

  const { deps, raw } = await readPackageJson(root)
  if (raw) signals.push('found package.json')

  const hasTailwind =
    'tailwindcss' in deps || TAILWIND_CONFIGS.some((c) => existsSync(join(root, c)))
  if (hasTailwind) signals.push('found tailwindcss')

  if ('react' in deps || 'next' in deps) {
    signals.push('found react/next')
    frameworks.push('react-tailwind')
  }
  if ('vue' in deps || 'nuxt' in deps) {
    signals.push('found vue/nuxt')
    frameworks.push('vue-css')
  }

  // De-dupe while preserving order.
  const seen = new Set<Framework>()
  const unique = frameworks.filter((f) => (seen.has(f) ? false : (seen.add(f), true)))

  if (unique.length === 0) {
    signals.push('no framework detected — defaulting to react-tailwind')
    unique.push('react-tailwind')
  }

  return { frameworks: unique, signals, hasTailwind }
}
