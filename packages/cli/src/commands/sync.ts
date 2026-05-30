// commands/sync.ts — pull presentation config from the dashboard (remote wins).
//
// The backend that serves presentation config is a later surface; this command
// is registered so the CLI surface is complete and `--help` documents it, but
// it fails with a clean, actionable error rather than making a dead network
// call. See architecture-plan §16.4.

import type { Command } from 'commander'
import { action } from '../run.js'
import { NotImplementedError } from '../errors.js'

export function registerSync(program: Command): void {
  program
    .command('sync')
    .description('pull presentation config from your design-spec.ai account (remote wins)')
    .option('--key <key>', 'API key (ds_live_… / ds_test_…)')
    .option('--force', 'overwrite local export config with remote', false)
    .addHelpText('after', '\nExample:\n  $ design-spec sync --key ds_live_xxxxx')
    .action(
      action(() => {
        throw new NotImplementedError('sync', 'Account sync requires a design-spec.ai account, available in a later release.')
      }),
    )
}
