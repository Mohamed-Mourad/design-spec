// commands/push.ts — push the local schema to the dashboard.
//
// Like `sync`, the receiving backend is a later surface. Registered for a
// complete CLI surface; fails with a clean actionable error. See §16.4.

import type { Command } from 'commander'
import { action } from '../run.js'
import { NotImplementedError } from '../errors.js'

export function registerPush(program: Command): void {
  program
    .command('push')
    .description('push your local schema to your design-spec.ai dashboard')
    .option('--key <key>', 'API key (ds_live_… / ds_test_…)')
    .addHelpText('after', '\nExample:\n  $ design-spec push --key ds_live_xxxxx')
    .action(
      action(() => {
        throw new NotImplementedError('push', 'Dashboard push requires a design-spec.ai account, available in a later release.')
      }),
    )
}
