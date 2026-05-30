// commands/lint.ts — schema integrity + stale-output detection (read-only).
//
// Never writes. Exits non-zero (stable codes) when the schema is invalid or the
// generated output has drifted from the schema, so it can gate a pre-commit
// hook or CI step.

import type { Command } from 'commander'
import { readFile } from 'node:fs/promises'
import { action } from '../run.js'
import { findSchema } from '../project.js'
import { NotInitializedError, InvalidSchemaError, StaleOutputError } from '../errors.js'
import { validateSchema } from '../validate.js'
import { checkStale } from '../emit.js'
import type { DesignSystemSchema } from '@design-spec/compiler'
import { dirname } from 'node:path'
import * as ui from '../ui.js'

export function registerLint(program: Command): void {
  program
    .command('lint')
    .description('validate the schema and detect stale generated output (read-only)')
    .addHelpText('after', '\nExample:\n  $ design-spec lint')
    .action(
      action(async () => {
        const cwd = process.cwd()
        const path = findSchema(cwd)
        if (!path) throw new NotInitializedError(cwd)

        const parsed = JSON.parse(await readFile(path, 'utf8')) as unknown
        const issues = validateSchema(parsed)
        if (issues.length > 0) {
          ui.json({ ok: false, valid: false, issues })
          for (const i of issues) ui.warn(`${i.path || '<root>'}: ${i.message}`)
          throw new InvalidSchemaError(`${issues.length} issue(s)`)
        }

        const { stale, missing, current } = await checkStale(parsed as DesignSystemSchema, dirname(path))
        ui.json({ ok: current, valid: true, stale, missing })
        if (!current) {
          for (const f of [...missing, ...stale]) ui.warn(`out of date: ${f}`)
          throw new StaleOutputError([...missing, ...stale])
        }
        ui.success('Schema valid and output up to date.')
      }),
    )
}
