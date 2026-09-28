// sync/pushQueue.ts — serialize pushes from `watch --sync`.
//
// Same shape as watch's compile lock: at most one push in flight; a save that
// lands mid-push runs exactly one more push afterwards (with the newest
// schema), never two overlapping ones racing on base_revision.

export interface PushQueue {
  /** Request a push. Coalesces with one already queued. */
  kick: () => void
  /** Resolves once nothing is in flight or queued. */
  idle: () => Promise<void>
}

/** push should report its own errors; a throw is swallowed so the watch survives. */
export function createPushQueue(push: () => Promise<void>): PushQueue {
  let running: Promise<void> | null = null
  let pending = false

  function run(): void {
    running = (async () => {
      try {
        await push()
      } catch {
        // push reports its own failures; a failed push must not end the watch
      } finally {
        running = null
        if (pending) {
          pending = false
          run()
        }
      }
    })()
  }

  return {
    kick() {
      if (running) {
        pending = true
        return
      }
      run()
    },
    async idle() {
      while (running) await running.catch(() => undefined)
    },
  }
}
