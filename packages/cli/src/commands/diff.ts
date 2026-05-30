// commands/diff.ts — token drift between the schema and the live config.
//
// Read-only. Compares the schema's color tokens against what the project's live
// framework config (tailwind.config.js / tokens.css) actually declares, so a
// developer can see where the two have diverged before compiling.

import type { Command } from 'commander'
import { join } from 'node:path'
import { glob } from 'node:fs/promises'
import { action } from '../run.js'
import { loadSchema } from '../project.js'
import { scanTailwind } from '../scanners/tailwind.js'
import { scanCssFiles } from '../scanners/cssVars.js'
import * as ui from '../ui.js'

interface ColorDiff {
  token: string
  schema: string | null
  live: string | null
  status: 'added' | 'removed' | 'changed'
}

async function liveColors(root: string): Promise<Record<string, string>> {
  const tw = await scanTailwind(root)
  if (Object.keys(tw.colors).length > 0) return tw.colors
  const cssFiles: string[] = []
  for await (const f of glob('**/tokens.css', { cwd: root })) cssFiles.push(join(root, f))
  const css = await scanCssFiles(cssFiles)
  return css.colors
}

export function registerDiff(program: Command): void {
  program
    .command('diff')
    .description('show token drift between the schema and the live framework config')
    .addHelpText('after', '\nExample:\n  $ design-spec diff')
    .action(
      action(async () => {
        const cwd = process.cwd()
        const { schema, root } = await loadSchema(cwd)
        const live = await liveColors(root)

        const diffs: ColorDiff[] = []
        for (const [token, value] of Object.entries(schema.colors)) {
          const liveVal = live[token]
          if (liveVal === undefined) diffs.push({ token, schema: value, live: null, status: 'added' })
          else if (liveVal.toLowerCase() !== value.toLowerCase())
            diffs.push({ token, schema: value, live: liveVal, status: 'changed' })
        }
        for (const token of Object.keys(live)) {
          if (!(token in schema.colors)) diffs.push({ token, schema: null, live: live[token], status: 'removed' })
        }

        ui.json({ ok: true, drift: diffs.length, diffs })
        if (diffs.length === 0) {
          ui.success('No color-token drift between schema and live config.')
          return
        }
        ui.table(
          ['Token', 'Schema', 'Live', 'Status'],
          diffs.map((d) => [d.token, d.schema ?? '—', d.live ?? '—', d.status]),
        )
        ui.info(`${diffs.length} token(s) differ. Run "design-spec compile" to regenerate from the schema.`)
      }),
    )
}
