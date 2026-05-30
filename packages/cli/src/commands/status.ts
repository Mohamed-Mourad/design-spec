// commands/status.ts — a sync-state report (read-only).
//
// Shows where the project stands: schema location, configured frameworks,
// token counts, and whether generated output is current. `--json | cat` must be
// clean JSON (no color, no spinner) — that flows from ui.ts honoring --json.

import type { Command } from 'commander'
import { relative } from 'node:path'
import { action } from '../run.js'
import { loadSchema } from '../project.js'
import { checkStale } from '../emit.js'
import * as ui from '../ui.js'

export function registerStatus(program: Command): void {
  program
    .command('status')
    .description('report schema location, configured frameworks, and output freshness')
    .addHelpText('after', '\nExamples:\n  $ design-spec status\n  $ design-spec status --json | cat')
    .action(
      action(async () => {
        const cwd = process.cwd()
        const { schema, path, root } = await loadSchema(cwd)
        const { stale, missing, current } = await checkStale(schema, root)

        const result = {
          ok: true,
          schema: relative(cwd, path) || path,
          name: schema.name,
          version: schema.version,
          frameworks: schema.export.frameworks,
          tokens: {
            colors: Object.keys(schema.colors).length,
            typography: Object.keys(schema.typography).length,
            spacing: Object.keys(schema.spacing).length,
            components: Object.keys(schema.componentBlueprints).length,
          },
          output: { current, stale, missing },
        }
        ui.json(result)

        ui.info(`${schema.name} (${schema.version})`)
        ui.table(
          ['Property', 'Value'],
          [
            ['schema', result.schema],
            ['frameworks', schema.export.frameworks.join(', ')],
            ['colors', String(result.tokens.colors)],
            ['typography', String(result.tokens.typography)],
            ['components', String(result.tokens.components)],
            ['output', current ? 'up to date' : `stale (${[...missing, ...stale].join(', ')})`],
          ],
        )
        if (current) ui.success('Output is up to date.')
        else ui.warn('Output is stale — run "design-spec compile".')
      }),
    )
}
