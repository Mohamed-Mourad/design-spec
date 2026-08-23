// extract/detectFramework.ts — framework × styling detection from file *content*,
// not from a filesystem.
//
// The CLI's own detector reads `package.json` off disk; the cloud retrofit gets
// the same manifest as a string plus the repo's path list. Keeping the rules
// here means both paths agree on what "this is a react-tailwind project" means,
// and the web never re-implements it.

import type { FrameworkStack } from '../types/schema.js'
import type { FrameworkDetection, ImportFile } from './types.js'

const TAILWIND_CONFIG_RE = /(^|\/)tailwind\.config\.(js|ts|cjs|mjs)$/
/** Tailwind v4 drops the config file and declares the theme in CSS. */
const TAILWIND_V4_CSS_RE = /@import\s+["']tailwindcss["']|@tailwind\s+(base|utilities)|@theme\b/

interface Manifest {
  name?: string
  deps: Record<string, string>
}

function readManifest(content: string): Manifest | null {
  try {
    const pkg = JSON.parse(content) as {
      name?: string
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
    }
    return {
      name: typeof pkg.name === 'string' ? pkg.name : undefined,
      deps: { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies },
    }
  } catch {
    return null
  }
}

/** `name: my_app` out of a pubspec, without a YAML parser. */
function pubspecName(content: string): string | undefined {
  const m = /^name:\s*(["']?)([\w.-]+)\1\s*$/m.exec(content)
  return m?.[2]
}

/**
 * Detect the framework stacks a scanned repo uses.
 *
 * Falls back to `react-tailwind` when nothing is recognisable — the import must
 * never dead-end, and a populated schema for the wrong stack is still editable
 * (the workspace has a framework selector).
 */
export function detectFramework(files: ImportFile[], paths: string[] = []): FrameworkDetection {
  const signals: string[] = []
  const frameworks: FrameworkStack[] = []
  let projectName: string | undefined

  const pubspec = files.find((f) => f.kind === 'pubspec')
  const hasPubspec = pubspec !== undefined || paths.some((p) => p === 'pubspec.yaml')
  if (hasPubspec) {
    signals.push('found pubspec.yaml')
    frameworks.push('flutter')
    if (pubspec) projectName = pubspecName(pubspec.content)
  }

  const pkgFile = files.find((f) => f.kind === 'package_json')
  const manifest = pkgFile ? readManifest(pkgFile.content) : null
  if (pkgFile) {
    signals.push(manifest ? 'found package.json' : 'found package.json (unparseable)')
    if (manifest?.name && !projectName) projectName = manifest.name
  }
  const deps = manifest?.deps ?? {}

  const hasConfigFile =
    files.some((f) => f.kind === 'tailwind_config') || paths.some((p) => TAILWIND_CONFIG_RE.test(p))
  const hasV4Css = files.some(
    (f) => (f.kind === 'source_css' || f.kind === 'compiled_css') && TAILWIND_V4_CSS_RE.test(f.content),
  )
  const hasTailwind = 'tailwindcss' in deps || hasConfigFile || hasV4Css
  if (hasTailwind) {
    signals.push(
      'tailwindcss' in deps
        ? 'found tailwindcss dependency'
        : hasConfigFile
          ? 'found tailwind.config'
          : 'found a Tailwind CSS entrypoint',
    )
  }

  if ('react' in deps || 'next' in deps || 'react-dom' in deps) {
    signals.push('found react/next')
    frameworks.push(hasTailwind ? 'react-tailwind' : 'react-css')
  }
  if ('vue' in deps || 'nuxt' in deps) {
    signals.push('found vue/nuxt')
    frameworks.push(hasTailwind ? 'vue-tailwind' : 'vue-css')
  }

  const seen = new Set<FrameworkStack>()
  const unique = frameworks.filter((f) => (seen.has(f) ? false : (seen.add(f), true)))

  if (unique.length === 0) {
    signals.push('no framework detected — defaulting to react-tailwind')
    unique.push('react-tailwind')
  }

  return { frameworks: unique, signals, hasTailwind, projectName }
}
