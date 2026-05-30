// run.ts — the action wrapper every command is invoked through.
//
// Centralizes: reading global flags into the UI, running the command body, and
// turning any thrown value into an actionable error + stable exit code. In
// --json mode a structured error envelope is emitted to stdout; otherwise
// ui.error renders message + hint (stack only under --verbose).

import type { Command } from 'commander'
import * as ui from './ui.js'
import { toCliError } from './errors.js'

export interface GlobalFlags {
  json: boolean
  quiet: boolean
  verbose: boolean
  color: boolean
}

/** Resolve global flags from the root program (they live on the root command). */
export function globalFlags(cmd: Command): GlobalFlags {
  let root = cmd
  while (root.parent) root = root.parent
  const o = root.opts<{ json?: boolean; quiet?: boolean; verbose?: boolean; color?: boolean }>()
  return {
    json: Boolean(o.json),
    quiet: Boolean(o.quiet),
    verbose: Boolean(o.verbose),
    color: o.color !== false,
  }
}

/**
 * Wrap a command body. Commander passes the command's own arguments/options to
 * `body` (and binds the Command to `this`); this wrapper reads the GLOBAL flags
 * off the root command, configures the UI, runs the body, and turns any thrown
 * value into an actionable error + stable exit code.
 */
export function action<A extends unknown[]>(body: (...args: A) => Promise<void> | void) {
  return async function (this: Command, ...args: A): Promise<void> {
    const flags = globalFlags(this)
    ui.configureUi({ json: flags.json, quiet: flags.quiet, verbose: flags.verbose, noColor: !flags.color })
    try {
      await body(...args)
    } catch (e) {
      const err = toCliError(e)
      ui.error(err.message, { code: err.code, hint: err.hint, cause: err })
      ui.json({ ok: false, error: { code: err.code, message: err.message, hint: err.hint } })
      process.exitCode = err.exitCode
    }
  }
}
