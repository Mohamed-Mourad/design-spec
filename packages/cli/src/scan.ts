// scan.ts — collect the files the shared extraction engine reads, off disk.
//
// The web retrofit harvests the same file set through the GitHub Contents API.
// Both hand it to `extractDesignSystem`, so a repo produces the same schema
// whether it was scanned locally or in the cloud. The only difference is what
// the CLI is additionally allowed to do: evaluate the project's own config
// (`scanners/tailwind.ts`), which the server may never do.

import { readFile, glob } from 'node:fs/promises'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { ImportFile, ImportFileKind } from '@design-spec/compiler'

/** Per-file byte cap, matching the cloud harvester. */
const MAX_FILE_BYTES = 512 * 1024
const MAX_SOURCE_CSS = 20
const MAX_COMPILED_CSS = 3

const BUILD_DIR_RE = /(^|\/)(node_modules|\.git|dist|build|out|coverage|\.next|\.nuxt|\.output|public)(\/|$)/
const COMPILED_DIR_RE = /(^|\/)(dist|build|out|\.next\/static\/css|\.nuxt\/dist|public)(\/|$)/

const TAILWIND_CONFIGS = [
  'tailwind.config.ts',
  'tailwind.config.js',
  'tailwind.config.mjs',
  'tailwind.config.cjs',
]

const DART_THEMES = [
  'lib/theme/app_colors.dart',
  'lib/theme/app_theme.dart',
  'lib/app_colors.dart',
  'lib/app_theme.dart',
]

async function read(root: string, rel: string, kind: ImportFileKind): Promise<ImportFile | null> {
  const abs = join(root, rel)
  if (!existsSync(abs)) return null
  try {
    if (statSync(abs).size > MAX_FILE_BYTES) return null
    return { path: rel.replace(/\\/g, '/'), kind, content: await readFile(abs, 'utf8') }
  } catch {
    return null
  }
}

/** Every path in the project, build output excluded — feeds framework detection. */
async function projectPaths(root: string): Promise<{ paths: string[]; css: string[]; compiled: string[] }> {
  const paths: string[] = []
  const css: string[] = []
  const compiled: string[] = []
  try {
    for await (const entry of glob('**/*.{css,scss,json,yaml,js,ts,cjs,mjs,dart}', { cwd: root })) {
      const rel = entry.replace(/\\/g, '/')
      if (BUILD_DIR_RE.test(rel)) {
        if (/\.css$/.test(rel) && COMPILED_DIR_RE.test(rel) && !/node_modules/.test(rel)) compiled.push(rel)
        continue
      }
      paths.push(rel)
      if (/\.(css|scss)$/.test(rel)) css.push(rel)
    }
  } catch {
    /* an unreadable tree still yields whatever we got */
  }
  // Shallowest first for source CSS, largest first for compiled bundles: the
  // same preference order the cloud harvester uses.
  css.sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b))
  compiled.sort((a, b) => size(root, b) - size(root, a) || a.localeCompare(b))
  return { paths, css, compiled }
}

function size(root: string, rel: string): number {
  try {
    return statSync(join(root, rel)).size
  } catch {
    return 0
  }
}

/** Gather the design-relevant files under `root` for `extractDesignSystem`. */
export async function collectImportFiles(root: string): Promise<{ files: ImportFile[]; paths: string[] }> {
  const { paths, css, compiled } = await projectPaths(root)
  const candidates: (ImportFile | null)[] = []

  candidates.push(await read(root, 'package.json', 'package_json'))
  candidates.push(await read(root, 'pubspec.yaml', 'pubspec'))

  for (const config of TAILWIND_CONFIGS) {
    const f = await read(root, config, 'tailwind_config')
    if (f) {
      candidates.push(f)
      break // one config per project
    }
  }

  for (const rel of css.slice(0, MAX_SOURCE_CSS)) candidates.push(await read(root, rel, 'source_css'))
  for (const rel of compiled.slice(0, MAX_COMPILED_CSS)) candidates.push(await read(root, rel, 'compiled_css'))
  for (const rel of DART_THEMES) candidates.push(await read(root, rel, 'dart_theme'))

  return { files: candidates.filter((f): f is ImportFile => f !== null), paths }
}
