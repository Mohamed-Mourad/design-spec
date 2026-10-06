// commands/watch.ts — recompile on schema save. Terminal-resident, not a daemon.
//
// Invariants (architecture-plan §16.2):
//   - watch design-spec.schema.json ONLY — never the generated output, so an
//     agent editing Button.tsx can't trigger a recompile loop. One-directional:
//     schema → compile → output.
//   - 50ms debounce + a compile lock — coalesce save bursts, drop concurrent
//     ticks (a save during a compile re-runs once after, never overlaps).
//   - atomic writes (via emit) — readers see complete old or complete new.
//
// --sync (§16.4): pull the dashboard's presentation at start (remote wins,
// export stays local — the same merge as `sync`), then push the schema to the
// dashboard after every recompile. Pushes never write locally, so they cannot
// re-trigger the watcher. Every --sync-interval the dashboard is read again;
// when its revision moved and its presentation differs, that presentation is
// written locally. The write recompiles, and the push that follows is a no-op
// (the dashboard already holds that schema), so a pull never ping-pongs.
// Pulls and pushes run one at a time on a shared lane, so neither races the
// other on the dashboard revision. A failure is reported and the watch carries on.

import type { Command } from 'commander'
import chokidar from 'chokidar'
import { action } from '../run.js'
import { findSchema, loadSchema } from '../project.js'
import { NotInitializedError } from '../errors.js'
import { emit } from '../emit.js'
import { isPlanMode, disablePlan } from '../plan.js'
import { splashContext } from '../branding.js'
import * as ui from '../ui.js'
import { runPull, runPush, runSync, type Session } from '../sync/run.js'
import { createPushQueue } from '../sync/pushQueue.js'

const DEBOUNCE_MS = 50

/** --sync-interval: how often watch --sync re-reads the dashboard. */
const SYNC_INTERVAL_DEFAULT_S = 60
const SYNC_INTERVAL_MIN_S = 15

/**
 * The re-pull period. Under Vitest only, DESIGN_SPEC_SYNC_INTERVAL_MS overrides
 * it without the floor, so an integration test needn't wait 15 seconds (the
 * spawned CLI inherits VITEST from the runner). Anywhere else the variable is
 * ignored: the floor is what keeps a watch from hammering the dashboard.
 */
export function syncIntervalMs(flag?: string, env: NodeJS.ProcessEnv = process.env): number {
  if (env.VITEST) {
    const override = Number(env.DESIGN_SPEC_SYNC_INTERVAL_MS)
    if (Number.isFinite(override) && override > 0) return override
  }
  const seconds = flag === undefined ? SYNC_INTERVAL_DEFAULT_S : Number(flag)
  if (!Number.isFinite(seconds) || seconds < SYNC_INTERVAL_MIN_S) {
    ui.warn(`--sync-interval must be at least ${SYNC_INTERVAL_MIN_S}s; using ${SYNC_INTERVAL_MIN_S}s.`)
    return SYNC_INTERVAL_MIN_S * 1000
  }
  return seconds * 1000
}

/** Run async jobs one at a time, in call order. A failed job doesn't stop the next. */
export function createLane(): (job: () => Promise<void>) => Promise<void> {
  let tail: Promise<void> = Promise.resolve()
  return (job) => {
    const run = tail.then(job, job)
    tail = run.catch(() => undefined)
    return run
  }
}

/** UI hooks so the command owns all rendering; startWatch stays presentation-free. */
export interface WatchHooks {
  onRecompileStart?: () => void
  onError?: (message: string) => void
}

export interface WatchHandle {
  close: () => Promise<void>
  /** Fires after each compile settles — files written + elapsed ms (for tests/UI). */
  onCompiled: (fn: (files: string[], ms: number) => void) => void
}

/** Start watching; exposed for integration tests (the command wraps this). */
export async function startWatch(cwd: string, hooks: WatchHooks = {}): Promise<WatchHandle> {
  const schemaPath = findSchema(cwd)
  if (!schemaPath) throw new NotInitializedError(cwd)

  let compiling = false
  let pending = false
  let timer: NodeJS.Timeout | null = null
  const listeners: Array<(files: string[], ms: number) => void> = []

  async function compileOnce(): Promise<void> {
    if (compiling) {
      pending = true // a change arrived mid-compile — run exactly once more after
      return
    }
    compiling = true
    hooks.onRecompileStart?.()
    try {
      const { schema, root } = await loadSchema(cwd)
      const start = Date.now()
      const files = await emit(schema, root)
      const ms = Date.now() - start
      listeners.forEach((fn) => fn(files, ms))
    } catch (e) {
      hooks.onError?.(e instanceof Error ? e.message : String(e))
    } finally {
      compiling = false
      if (pending) {
        pending = false
        void compileOnce()
      }
    }
  }

  function schedule(): void {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void compileOnce(), DEBOUNCE_MS)
  }

  // Watch the single file only. `ignoreInitial` so startup doesn't double-compile.
  const watcher = chokidar.watch(schemaPath, { ignoreInitial: true })
  watcher.on('change', schedule)
  watcher.on('add', schedule)

  return {
    close: async () => {
      if (timer) clearTimeout(timer)
      await watcher.close()
    },
    onCompiled: (fn) => listeners.push(fn),
  }
}

export function registerWatch(program: Command): void {
  program
    .command('watch')
    .description('recompile whenever design-spec.schema.json is saved (schema only)')
    .option('--sync', 'also sync with your dashboard: pull presentation at start and every --sync-interval, push after each recompile', false)
    .option('--sync-interval <seconds>', `with --sync, how often to pull dashboard edits (default ${SYNC_INTERVAL_DEFAULT_S}, min ${SYNC_INTERVAL_MIN_S})`)
    .option('--key <key>', 'API key for --sync (ds_live_… / ds_test_…); prefer DESIGN_SPEC_API_KEY (a flag lands in shell history)')
    .option('--project <slug>', 'dashboard project for --sync (default: the schema name, kebab-cased)')
    .addHelpText('after', '\nExamples:\n  $ design-spec watch\n  $ DESIGN_SPEC_API_KEY=ds_live_xxxxx design-spec watch --sync')
    .action(
      action(async (opts: { sync?: boolean; key?: string; project?: string; syncInterval?: string }) => {
        // watch is a continuous writer with no terminal state to diff — a one-shot
        // preview makes no sense, so opt out of plan mode and run normally.
        if (isPlanMode()) {
          ui.warn('--dry-run is not supported for watch (it writes continuously); running normally.')
          disablePlan()
        }
        // Validate + initial compile up front so a bad project fails fast.
        const cwd = process.cwd()
        let session: Session | null = null
        let syncedRevision = 0
        if (opts.sync) {
          // The initial pull compiles too; an auth or network failure here
          // stops the watch before it starts, rather than failing every save.
          const pulled = await runSync(cwd, { key: opts.key, project: opts.project })
          session = pulled.session
          syncedRevision = pulled.revision
          ui.info(
            `Synced "${pulled.project}" (rev ${pulled.revision}): ${pulled.presentation.length} presentation change(s) pulled` +
              (pulled.exportDiff.length > 0 ? `, export kept local (${pulled.exportDiff.length} difference(s))` : ''),
          )
        }
        const { schema, root } = await loadSchema(cwd)
        await emit(schema, root)
        ui.json({ ok: true, watching: 'design-spec.schema.json', sync: Boolean(opts.sync) })
        ui.splash(
          splashContext(cwd, {
            tip: opts.sync
              ? 'Recompiles and pushes to your dashboard on every save · Press Ctrl+C to stop.'
              : 'Recompiles design-spec.schema.json on every save · Press Ctrl+C to stop.',
            status: `${schema.name} · ${schema.export.frameworks.join(', ')}`,
          }),
        )

        const sp = ui.spinner('watching for changes…')
        const handle = await startWatch(cwd, {
          onRecompileStart: () => sp.begin('Recompiling…'),
          onError: (m) => sp.fail(m),
        })
        handle.onCompiled((files, ms) => sp.done(`recompiled ${files.length} file(s) in ${ms}ms`))

        let stopPulling = () => {}
        if (session) {
          const live = session
          let known = syncedRevision
          // Pulls and pushes share one lane: never a pull while a push is in
          // flight (or the reverse), so each reads the revision the other left.
          const lane = createLane()

          const pushes = createPushQueue(() =>
            lane(async () => {
              try {
                const r = await runPush(cwd, {}, live)
                if (r.saved) known = r.saved.revision
                // A no-op is the normal echo of a pull's write — stay quiet.
                if (!r.unchanged) {
                  ui.info(`pushed "${r.project}" (rev ${r.saved?.revision}) — ${r.tokens.changes.length} token change(s)`)
                }
              } catch (e) {
                ui.warn(`push failed: ${e instanceof Error ? e.message : String(e)} — will retry on the next save`)
              }
            }),
          )
          handle.onCompiled(() => pushes.kick())

          let pulling = false
          const timer = setInterval(() => {
            if (pulling) return
            pulling = true
            void lane(async () => {
              try {
                // The write (if any) wakes the watcher; its recompile's push is
                // then a no-op, because the dashboard already has this schema.
                const r = await runPull(cwd, live, known)
                known = r.revision
                if (r.presentation.length > 0) {
                  ui.info(`pulled ${r.presentation.length} presentation change(s) from the dashboard (rev ${r.revision})`)
                }
              } catch (e) {
                ui.warn(`pull failed: ${e instanceof Error ? e.message : String(e)} — will retry`)
              }
            }).finally(() => (pulling = false))
          }, syncIntervalMs(opts.syncInterval))
          stopPulling = () => clearInterval(timer)
        }

        await new Promise<void>((resolve) => {
          process.on('SIGINT', () => {
            sp.stop()
            stopPulling()
            void handle.close().then(resolve)
          })
        })
      }),
    )
}
