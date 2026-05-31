// run.ts — the action wrapper every command is invoked through.
//
// Centralizes: reading global flags into the UI, running the command body, and
// turning any thrown value into an actionable error + stable exit code. In
// --json mode a structured error envelope is emitted to stdout; otherwise
// ui.error renders message + hint (stack only under --verbose).

import type { Command } from 'commander'
import * as ui from './ui.js'
import { toCliError } from './errors.js'
import { beginPlan, endPlan, isPlanMode } from './plan.js'

export interface GlobalFlags {
  json: boolean
  quiet: boolean
  verbose: boolean
  color: boolean
  /** Preview mode: write nothing, render a diff of would-be changes. `--dry-run` aliases it. */
  plan: boolean
}

/** Resolve global flags from the root program (they live on the root command). */
export function globalFlags(cmd: Command): GlobalFlags {
  let root = cmd
  while (root.parent) root = root.parent
  const o = root.opts<{ json?: boolean; quiet?: boolean; verbose?: boolean; color?: boolean; plan?: boolean; dryRun?: boolean }>()
  return {
    json: Boolean(o.json),
    quiet: Boolean(o.quiet),
    verbose: Boolean(o.verbose),
    color: o.color !== false,
    plan: Boolean(o.plan) || Boolean(o.dryRun),
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
    ui.configureUi({ json: flags.json, quiet: flags.quiet, verbose: flags.verbose, noColor: !flags.color, plan: flags.plan })
    if (flags.plan) beginPlan()
    try {
      await body(...args)
      // Plan mode: render the staged changes as a diff and exit having written
      // nothing. (Long-running commands like watch/serve call disablePlan, so
      // isPlanMode is false here for them.)
      if (flags.plan && isPlanMode()) {
        const records = endPlan()
        if (flags.json) ui.planJson(records)
        else ui.planReport(records)
      }
    } catch (e) {
      if (isPlanMode()) endPlan() // discard staged writes
      // Leave plan mode so the error envelope (and its JSON) is emitted normally.
      if (flags.plan) ui.configureUi({ plan: false })
      const err = toCliError(e)
      ui.error(err.message, { code: err.code, hint: err.hint, cause: err })
      ui.json({ ok: false, error: { code: err.code, message: err.message, hint: err.hint } })
      process.exitCode = err.exitCode
    }
  }
}
