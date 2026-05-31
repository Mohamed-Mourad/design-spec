// runner.ts — orchestrate one janitor run. The whole body is wrapped so it can
// NEVER throw past this layer: any unexpected failure is logged and the run
// still exits 0. Remediation, not obstruction.
//
// Flow: loop-safety guard → load committed schema → scan drift → apply fixes →
// commit + force-with-lease push → upsert 🧹 comment → resolve exit code.
//
// Exit code is 0 on every path EXCEPT the sanctioned strict opt-in: when
// `strict: true` and advisory (non-fixable) drift remains, it returns 1 so the
// consuming repo's check fails on those items only. Auto-fixes are still
// committed regardless of strict. A force-with-lease abort short-circuits to
// exit 0 — the run didn't complete, so it never fails the build.

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DesignSystemSchema } from '@design-spec/compiler'
import type { JanitorConfig } from './config.js'
import { headCommitMeta, type Git } from './checkout.js'
import { scanDrift } from './detect.js'
import { applyFixes, type FixResult } from './fix.js'
import { commitAndPush, type CommitOutcome } from './commit.js'
import { buildComment, upsertComment, type GitHubClient } from './prComment.js'

export interface Logger {
  info(msg: string): void
  warn(msg: string): void
  error(msg: string): void
}

export interface RunnerDeps {
  config: JanitorConfig
  git: Git
  /** null when no PR/token context — the comment step is then skipped. */
  github: GitHubClient | null
  log?: Logger
}

export interface RunResult {
  exitCode: number
  skipped: boolean
  fixes: number
  advisory: number
  pushed: boolean
  leaseFailed: boolean
}

const noop: Logger = { info() {}, warn() {}, error() {} }

async function loadSchema(root: string, schemaPath: string): Promise<DesignSystemSchema | null> {
  try {
    const raw = await readFile(join(root, schemaPath), 'utf8')
    return JSON.parse(raw) as DesignSystemSchema
  } catch {
    return null
  }
}

export async function run(deps: RunnerDeps): Promise<RunResult> {
  const { config, git } = deps
  const log = deps.log ?? noop
  const idle: RunResult = { exitCode: 0, skipped: true, fixes: 0, advisory: 0, pushed: false, leaseFailed: false }

  try {
    // Loop-safety: never act on a commit the janitor itself authored or that
    // carries [skip ci]. (Also guards against re-triggering on our own push.)
    const meta = await headCommitMeta(git, config.botName)
    if (meta && (meta.isBot || meta.skipCi)) {
      log.info('Tip commit is a janitor/[skip ci] commit — skipping (loop-safety).')
      return idle
    }

    const schema = await loadSchema(config.root, config.schemaPath)
    if (!schema) {
      log.warn(`No readable schema at ${config.schemaPath} — nothing to do.`)
      return idle
    }

    const files = await scanDrift(config.root, schema, config.sourceGlob)
    const result: FixResult = await applyFixes(files, schema)

    let outcome: CommitOutcome = { committed: false, pushed: false, leaseFailed: false }
    if (result.totalFixes > 0) {
      if (!config.headRef) {
        log.warn('No PR head ref in the environment — cannot push fixes; leaving them in the working tree.')
      } else {
        outcome = await commitAndPush(git, {
          count: result.totalFixes,
          headRef: config.headRef,
          botName: config.botName,
          botEmail: config.botEmail,
        })
        if (outcome.refusedProtectedRef) {
          // Invariant: never write to main/master. Leave fixes in the tree, exit 0.
          log.warn(`Refusing to push to a protected ref (${config.headRef}) — no remote write to main/master.`)
        } else if (outcome.leaseFailed) {
          // Concurrent manual push moved the branch — abort clean, exit 0.
          log.warn('Branch moved during the run (force-with-lease rejected) — aborting clean. Build is not blocked.')
        } else if (outcome.pushed) {
          log.info(`Pushed ${result.totalFixes} fix(es) to ${config.headRef}.`)
        }
      }
    }

    // Post/update the 🧹 summary. Best-effort: a comment failure never blocks.
    if (deps.github && config.prNumber != null) {
      try {
        const body = buildComment(result, outcome.leaseFailed)
        await upsertComment(deps.github, config.prNumber, body)
      } catch (e) {
        log.warn(`Could not post the summary comment: ${(e as Error).message}`)
      }
    }

    // strict opt-in: fail the check on advisory drift only (and only when the
    // run completed — a lease abort never fails the build).
    const exitCode = config.strict && !outcome.leaseFailed && result.advisory.length > 0 ? 1 : 0
    if (exitCode === 1) log.warn(`strict mode: ${result.advisory.length} advisory item(s) — failing the check.`)

    return {
      exitCode,
      skipped: false,
      fixes: result.totalFixes,
      advisory: result.advisory.length,
      pushed: outcome.pushed,
      leaseFailed: outcome.leaseFailed,
    }
  } catch (e) {
    // The janitor never blocks a build — log and exit 0 on any unexpected error.
    log.error(`Janitor run failed unexpectedly (non-blocking): ${(e as Error).message}`)
    return idle
  }
}
