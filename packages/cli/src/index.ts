#!/usr/bin/env node
// index.ts — the commander program: global flags, banner-less help, and the
// subcommand registry. All command logic lives in commands/*; this file only
// wires them up and applies the cross-cutting concerns (global flags, update
// notifier, no-args → help).

import { Command } from 'commander'
import { createRequire } from 'node:module'
import updateNotifier from 'update-notifier'
import * as ui from './ui.js'
import { bareSplash } from './branding.js'
import { registerInit } from './commands/init.js'
import { registerCompile } from './commands/compile.js'
import { registerWatch } from './commands/watch.js'
import { registerConfig } from './commands/config.js'
import { registerStatus } from './commands/status.js'
import { registerDiff } from './commands/diff.js'
import { registerLint } from './commands/lint.js'
import { registerFix } from './commands/fix.js'
import { registerHook } from './commands/hook.js'
import { registerServe } from './commands/serve.js'
import { registerSync } from './commands/sync.js'
import { registerPush } from './commands/push.js'

const require = createRequire(import.meta.url)
const pkg = require('../package.json') as { name: string; version: string }

function notifyUpdate(argv: string[]): void {
  // Unobtrusive; skipped in CI and for machine/quiet output.
  if (process.env.CI || argv.includes('--json') || argv.includes('--quiet')) return
  try {
    updateNotifier({ pkg, updateCheckInterval: 1000 * 60 * 60 * 24 }).notify({ defer: true })
  } catch {
    /* never let the notifier break the CLI */
  }
}

export function buildProgram(): Command {
  const program = new Command()

  program
    .name('design-spec')
    .description('Local-first design-system engine: detect, synthesize, compile, watch, and serve your design tokens to AI agents.')
    .version(pkg.version, '-v, --version', 'print the version')
    .option('--json', 'machine-readable JSON output (no color or spinners)', false)
    .option('-q, --quiet', 'errors only', false)
    .option('--verbose', 'verbose output, including stack traces on error', false)
    .option('--no-color', 'disable color output')
    .showHelpAfterError('(add --help for usage)')
    .showSuggestionAfterError()

  registerInit(program)
  registerConfig(program)
  registerCompile(program)
  registerWatch(program)
  registerStatus(program)
  registerDiff(program)
  registerLint(program)
  registerFix(program)
  registerHook(program)
  registerServe(program)
  registerSync(program)
  registerPush(program)

  // `design-spec` with no args: a launch splash in an interactive TTY, plain
  // help when piped / --json / --quiet / CI (so scripts get clean output).
  program.action(() => {
    const o = program.opts<{ json?: boolean; quiet?: boolean; verbose?: boolean; color?: boolean }>()
    ui.configureUi({ json: Boolean(o.json), quiet: Boolean(o.quiet), verbose: Boolean(o.verbose), noColor: o.color === false })
    const interactive = Boolean(process.stdout.isTTY) && !process.env.CI && !o.json && !o.quiet
    if (!interactive) {
      program.help()
      return
    }
    ui.splash(bareSplash(process.cwd()))
  })

  return program
}

export async function main(argv: string[] = process.argv): Promise<void> {
  notifyUpdate(argv)
  const program = buildProgram()
  await program.parseAsync(argv)
}

// Run when invoked as the bin (not when imported by tests).
const invokedDirectly = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('index.js')
if (invokedDirectly) {
  main().catch((e) => {
    process.stderr.write(String(e instanceof Error ? e.stack : e) + '\n')
    process.exitCode = 1
  })
}
