// commands/fix.ts — local auto-refactor: rewrite raw values → token refs.
//
// Walks the project's source files, detects drift (inline hex, arbitrary
// Tailwind classes, raw px, Flutter Color()), and rewrites each fixable hit to
// the nearest schema token via the compiler's pure fix engine — the same engine
// the hosted CI Drift-Janitor runs. --dry-run reports without writing.

import type { Command } from 'commander'
import { readFile } from 'node:fs/promises'
import { glob } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { action } from '../run.js'
import { loadSchema } from '../project.js'
import { stageWrite, isPlanMode } from '../plan.js'
import { compileAll, detect, fix, type Drift } from '@design-spec/compiler'
import * as ui from '../ui.js'

const SOURCE_GLOB = '**/*.{ts,tsx,js,jsx,vue,css,scss,dart}'
const IGNORE = /(^|[\\/])(node_modules|dist|build|\.next|\.git)([\\/]|$)/

export function registerFix(program: Command): void {
  program
    .command('fix')
    .description('rewrite raw values (hex, px, arbitrary classes) to the nearest design token')
    .addHelpText('after', '\nExamples:\n  $ design-spec fix\n  $ design-spec fix --plan   # preview the rewrites as a diff')
    .action(
      action(async () => {
        const cwd = process.cwd()
        const { schema, root } = await loadSchema(cwd)
        const planning = isPlanMode()

        // Never rewrite our own generated output — its raw hex/px ARE the token
        // definitions (e.g. `--color-primary: #2563EB`), not drift. Rewriting them
        // would produce self-referential garbage (`--color-primary: var(--color-primary)`).
        const generated = new Set(compileAll(schema).map((o) => o.filename.replace(/\\/g, '/')))

        const changed: Array<{ file: string; fixes: number }> = []
        const unfixable: Drift[] = []
        let totalFixes = 0

        for await (const rel of glob(SOURCE_GLOB, { cwd: root })) {
          if (IGNORE.test(rel) || generated.has(rel.replace(/\\/g, '/'))) continue
          const path = join(root, rel)
          const source = await readFile(path, 'utf8')
          const drifts = detect(source, schema, rel)
          if (drifts.length === 0) continue

          unfixable.push(...drifts.filter((d) => !d.fixable))
          const fixable = drifts.filter((d) => d.fixable)
          if (fixable.length === 0) continue

          const target = extname(rel) === '.dart' ? 'flutter' : 'web'
          const patched = fix(source, fixable, schema, { target })
          if (patched !== source) {
            await stageWrite(path, patched) // staged (not written) in plan mode
            changed.push({ file: rel, fixes: fixable.length })
            totalFixes += fixable.length
          }
        }

        // In plan mode the diff report (rendered by run.ts) is the output.
        ui.json({
          ok: true,
          fixed: totalFixes,
          files: changed,
          unfixable: unfixable.map((d) => ({ file: d.file, line: d.line, found: d.found })),
        })

        if (totalFixes === 0) {
          ui.success('No fixable drift found.')
        } else {
          for (const c of changed) ui.info(`${planning ? 'would fix' : 'fixed'} ${c.fixes} in ${c.file}`)
          ui.success(`Rewrote ${totalFixes} raw value(s) across ${changed.length} file(s).`)
        }
        if (unfixable.length > 0) ui.warn(`${unfixable.length} value(s) had no matching token — left untouched.`)
      }),
    )
}
