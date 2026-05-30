// commands/compile.ts — schema → all configured output files.

import type { Command } from 'commander'
import { action } from '../run.js'
import { loadSchema } from '../project.js'
import { emit } from '../emit.js'
import * as ui from '../ui.js'

export function registerCompile(program: Command): void {
  program
    .command('compile')
    .description('compile design-spec.schema.json to all output files')
    .addHelpText('after', '\nExample:\n  $ design-spec compile')
    .action(
      action(async () => {
        const { schema, root } = await loadSchema(process.cwd())
        const files = await ui.spin('Compiling output', () => emit(schema, root))
        ui.json({ ok: true, files })
        ui.success(`Compiled ${files.length} file(s): ${files.join(', ')}`)
      }),
    )
}
