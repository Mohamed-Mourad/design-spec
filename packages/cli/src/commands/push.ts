// commands/push.ts — send the local schema to the dashboard.
//
// Local wins for tokens and export config; the dashboard's presentation config
// is carried over untouched (it is the designer's layer, §20). The write names
// the revision it read, so a dashboard edit that lands in between is a
// conflict, not a silent overwrite.
//
// Dashboard only — never git, never a branch, never main. Pushing to a repo is
// the web's "Push to GitHub" (a PR branch) or your own `git push`.

import type { Command } from 'commander'
import { changesByGroup } from '@design-spec/compiler'
import { action } from '../run.js'
import { runPush } from '../sync/run.js'
import { disablePlan, isPlanMode } from '../plan.js'
import { changeRows, type KeyedOptions } from './sync.js'
import * as ui from '../ui.js'

export function registerPush(program: Command): void {
  program
    .command('push')
    .description('push your local schema to your dashboard (not git); the dashboard keeps its presentation config')
    .option('--key <key>', 'API key (ds_live_… / ds_test_…); remembered for next time')
    .option('--project <slug>', 'dashboard project (default: the schema name, kebab-cased)')
    .addHelpText('after', '\nExamples:\n  $ design-spec push --key ds_live_xxxxx\n  $ design-spec --dry-run push')
    .action(
      action(async (opts: KeyedOptions) => {
        // push writes no files, so the file-diff plan report has nothing to
        // show. A dry run is handled here instead: read, report, send nothing.
        const dryRun = isPlanMode()
        if (dryRun) {
          disablePlan()
          ui.configureUi({ plan: false })
        }

        const r = await ui.spin('Pushing to the dashboard', () =>
          runPush(process.cwd(), { key: opts.key, project: opts.project, dryRun }),
        )

        ui.json({
          ok: true,
          project: r.project,
          created: r.created,
          dryRun,
          revision: r.saved?.revision ?? null,
          tokens: r.tokens,
          export: r.exportDiff,
          presentationKept: r.presentationKept,
        })

        if (r.rememberedAt) ui.info(`Saved ${r.keyHint} to ${r.rememberedAt}`)

        const groups = changesByGroup(r.tokens).map(({ group, changes }) => [group, String(changes.length)])
        if (groups.length > 0) ui.table(['Token group', 'Changes'], groups)
        if (r.exportDiff.length > 0) {
          ui.table(['Path', 'Dashboard', 'Local', 'Result'], changeRows(r.exportDiff, 'pushed (local wins)'))
        }
        if (r.presentationKept.length > 0) {
          ui.info(
            `${r.presentationKept.length} presentation setting(s) differ locally — kept the dashboard's (remote wins). Run "design-spec sync" to pull them.`,
          )
        }

        const summary = `${r.tokens.changes.length} token change(s), ${r.exportDiff.length} export change(s)`
        if (dryRun) {
          ui.info(`Dry run: would ${r.created ? 'create' : 'update'} "${r.project}" — ${summary}. Nothing was sent.`)
          return
        }
        ui.success(`${r.created ? 'Created' : 'Updated'} "${r.project}" on the dashboard (rev ${r.saved?.revision}) — ${summary}.`)
      }),
    )
}
