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
import * as ui from '../ui.js'

const DEBOUNCE_MS = 50

export interface WatchHandle {
  close: () => Promise<void>
  /** Resolves after the next compile settles — for tests. */
  onCompiled: (fn: (files: string[]) => void) => void
}

/** Start watching; exposed for integration tests (the command wraps this). */
export async function startWatch(cwd: string): Promise<WatchHandle> {
  const schemaPath = findSchema(cwd)
  if (!schemaPath) throw new NotInitializedError(cwd)

  let compiling = false
  let pending = false
  let timer: NodeJS.Timeout | null = null
  const listeners: Array<(files: string[]) => void> = []

  async function compileOnce(): Promise<void> {
    if (compiling) {
      pending = true // a change arrived mid-compile — run exactly once more after
      return
    }
    compiling = true
    try {
      const { schema, root } = await loadSchema(cwd)
      const start = Date.now()
      const files = await emit(schema, root)
      ui.success(`recompiled ${files.length} file(s) in ${Date.now() - start}ms`)
      listeners.forEach((fn) => fn(files))
    } catch (e) {
      ui.error(e instanceof Error ? e.message : String(e), { hint: 'fix the schema; watch will retry on next save' })
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
        // Validate + initial compile up front so a bad project fails fast.
        const { schema, root } = await loadSchema(process.cwd())
        await emit(schema, root)
        const handle = await startWatch(process.cwd())
        ui.info('Watching design-spec.schema.json — press Ctrl+C to stop.')
        ui.json({ ok: true, watching: 'design-spec.schema.json' })
        await new Promise<void>((resolve) => {
          process.on('SIGINT', () => {
            void handle.close().then(resolve)
          })
        })
      }),
    )
}
