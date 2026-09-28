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
// --sync (§16.4): pull the dashboard's presentation once at start (remote wins,
// export stays local — the same merge as `sync`), then push the schema to the
// dashboard after every recompile. Pushes never write locally, so they cannot
// re-trigger the watcher; they are serialized so two saves never race on the
// dashboard revision. A failed push is reported and the watch carries on.

import type { Command } from 'commander'
import chokidar from 'chokidar'
import { action } from '../run.js'
import { findSchema, loadSchema } from '../project.js'
import { NotInitializedError } from '../errors.js'
import { emit } from '../emit.js'
import { isPlanMode, disablePlan } from '../plan.js'
import { splashContext } from '../branding.js'
import * as ui from '../ui.js'
import { runPush, runSync, type Session } from '../sync/run.js'
import { createPushQueue } from '../sync/pushQueue.js'

const DEBOUNCE_MS = 50

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
    .option('--sync', 'also sync with your dashboard: pull presentation at start, push after each recompile', false)
    .option('--key <key>', 'API key for --sync (ds_live_… / ds_test_…)')
    .option('--project <slug>', 'dashboard project for --sync (default: the schema name, kebab-cased)')
    .addHelpText('after', '\nExamples:\n  $ design-spec watch\n  $ design-spec watch --sync --key ds_live_xxxxx')
    .action(
      action(async (opts: { sync?: boolean; key?: string; project?: string }) => {
        // watch is a continuous writer with no terminal state to diff — a one-shot
        // preview makes no sense, so opt out of plan mode and run normally.
        if (isPlanMode()) {
          ui.warn('--dry-run is not supported for watch (it writes continuously); running normally.')
          disablePlan()
        }
        // Validate + initial compile up front so a bad project fails fast.
        const cwd = process.cwd()
        let session: Session | null = null
        if (opts.sync) {
          // The initial pull compiles too; an auth or network failure here
          // stops the watch before it starts, rather than failing every save.
          const pulled = await runSync(cwd, { key: opts.key, project: opts.project })
          session = pulled.session
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

        if (session) {
          const live = session
          const pushes = createPushQueue(async () => {
            try {
              const r = await runPush(cwd, {}, live)
              ui.info(`pushed "${r.project}" (rev ${r.saved?.revision}) — ${r.tokens.changes.length} token change(s)`)
            } catch (e) {
              ui.warn(`push failed: ${e instanceof Error ? e.message : String(e)} — will retry on the next save`)
            }
          })
          handle.onCompiled(() => pushes.kick())
        }

        await new Promise<void>((resolve) => {
          process.on('SIGINT', () => {
            sp.stop()
            void handle.close().then(resolve)
          })
        })
      }),
    )
}
