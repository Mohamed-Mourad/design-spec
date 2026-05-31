// commands/watch.ts — recompile on schema save. Terminal-resident, not a daemon.
//
// Invariants (architecture-plan §16.2):
//   - watch design-spec.schema.json ONLY — never the generated output, so an
//     agent editing Button.tsx can't trigger a recompile loop. One-directional:
//     schema → compile → output.
//   - 50ms debounce + a compile lock — coalesce save bursts, drop concurrent
//     ticks (a save during a compile re-runs once after, never overlaps).
//   - atomic writes (via emit) — readers see complete old or complete new.

import type { Command } from 'commander'
import chokidar from 'chokidar'
import { action } from '../run.js'
import { findSchema, loadSchema } from '../project.js'
import { NotInitializedError } from '../errors.js'
import { emit } from '../emit.js'
import { isPlanMode, disablePlan } from '../plan.js'
import { splashContext } from '../branding.js'
import * as ui from '../ui.js'

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
    .addHelpText('after', '\nExample:\n  $ design-spec watch')
    .action(
      action(async () => {
        // watch is a continuous writer with no terminal state to diff — a one-shot
        // preview makes no sense, so opt out of plan mode and run normally.
        if (isPlanMode()) {
          ui.warn('--dry-run is not supported for watch (it writes continuously); running normally.')
          disablePlan()
        }
        // Validate + initial compile up front so a bad project fails fast.
        const cwd = process.cwd()
        const { schema, root } = await loadSchema(cwd)
        await emit(schema, root)
        ui.json({ ok: true, watching: 'design-spec.schema.json' })
        ui.splash(
          splashContext(cwd, {
            tip: 'Recompiles design-spec.schema.json on every save · Press Ctrl+C to stop.',
            status: `${schema.name} · ${schema.export.frameworks.join(', ')}`,
          }),
        )

        const sp = ui.spinner('watching for changes…')
        const handle = await startWatch(cwd, {
          onRecompileStart: () => sp.begin('Recompiling…'),
          onError: (m) => sp.fail(m),
        })
        handle.onCompiled((files, ms) => sp.done(`recompiled ${files.length} file(s) in ${ms}ms`))

        await new Promise<void>((resolve) => {
          process.on('SIGINT', () => {
            sp.stop()
            void handle.close().then(resolve)
          })
        })
      }),
    )
}
