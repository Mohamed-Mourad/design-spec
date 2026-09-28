// commands/sync.ts — pull the dashboard's presentation config into the local
// schema, then compile. See architecture-plan §16.4 / §20:
//
//   schema.presentation → remote wins (always, removal included)
//   schema.export       → local wins; the dashboard's only with --force
//   tokens & the rest   → local (git is canonical); differences are reported
//
// Never touches git. The only writes are design-spec.schema.json and the
// compiled output, both through the atomic/plan-aware writer, so --dry-run
// previews the whole pull as a diff.

import type { Command } from 'commander'
import { action } from '../run.js'
import { runSync } from '../sync/run.js'
import type { LayerChange } from '../sync/merge.js'
import * as ui from '../ui.js'

export interface KeyedOptions {
  key?: string
  project?: string
}

/** Render layer changes as table rows. */
export function changeRows(changes: LayerChange[], note: string): string[][] {
  return changes.map((c) => [c.path, c.old ?? '—', c.new ?? '—', note])
}

export function registerSync(program: Command): void {
  program
    .command('sync')
    .description('pull presentation config from your dashboard (remote wins); export config stays local unless --force')
    .option('--key <key>', 'API key (ds_live_… / ds_test_…); remembered, so pass it once — or use DESIGN_SPEC_API_KEY (a flag lands in shell history)')
    .option('--project <slug>', 'dashboard project (default: the schema name, kebab-cased)')
    .option('--force', 'also take the dashboard export config, overwriting local', false)
    .addHelpText(
      'after',
      '\nExamples:\n  $ DESIGN_SPEC_API_KEY=ds_live_xxxxx design-spec sync\n  $ design-spec sync --force\n  $ design-spec --dry-run sync',
    )
    .action(
      action(async (opts: KeyedOptions & { force?: boolean }) => {
        const r = await ui.spin('Syncing from the dashboard', () =>
          runSync(process.cwd(), { key: opts.key, project: opts.project, force: opts.force }),
        )

        ui.json({
          ok: true,
          project: r.project,
          revision: r.revision,
          changed: r.changed,
          presentation: r.presentation,
          export: { differs: r.exportDiff, taken: r.exportTaken },
          tokensNotPulled: r.tokensNotPulled.changes.length,
          files: r.files,
        })

        if (r.session.rememberedAt) ui.info(`Saved ${r.keyHint} to ${r.session.rememberedAt}`)

        const rows = [
          ...changeRows(r.presentation, 'pulled (remote wins)'),
          ...changeRows(r.exportDiff, r.exportTaken ? 'pulled (--force)' : 'kept local'),
        ]
        if (rows.length > 0) ui.table(['Path', 'Local', 'Dashboard', 'Result'], rows)

        if (r.exportDiff.length > 0 && !r.exportTaken) {
          ui.warn(
            `Export config differs in ${r.exportDiff.length} place(s); kept local. Re-run with --force to take the dashboard's.`,
          )
        }
        const tokenCount = r.tokensNotPulled.changes.length
        if (tokenCount > 0) {
          ui.info(
            `${tokenCount} token(s) differ from the dashboard (${r.tokensNotPulled.groups.join(', ')}) — not pulled; your committed schema is canonical. "design-spec push" sends yours.`,
          )
        }
        ui.success(
          r.changed
            ? `Synced "${r.project}" (rev ${r.revision}): ${r.presentation.length} presentation change(s)${r.exportTaken ? `, ${r.exportDiff.length} export change(s)` : ''}; compiled ${r.files.length} file(s).`
            : `"${r.project}" is already in sync (rev ${r.revision}); compiled ${r.files.length} file(s).`,
        )
      }),
    )
}
