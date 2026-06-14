// plan.ts — preview mode (`--plan`). The single write-interception point.
//
// Terraform-plan for design-spec: when plan mode is active, every file write is
// recorded (path + current content + would-be content) instead of performed, so
// run.ts can render the changes as a diff and exit having touched nothing.
//
// All project file writes funnel through `stageWrite` (emit, schema save, agent
// rules, fix, hook). Outside plan mode it's a thin pass-through to the compiler's
// atomic write helper — so the normal path is unchanged.

import { readFile } from 'node:fs/promises'
import { atomicWrite } from '@design-spec/compiler/node'

/** One staged file change captured during a plan run. */
export interface PlannedWrite {
  path: string
  /** Current on-disk content, or null if the file does not exist yet (a create). */
  before: string | null
  /** The content that would be written. */
  after: string
}

let session: PlannedWrite[] | null = null

/** Enter plan mode — writes are recorded, not performed. */
export function beginPlan(): void {
  session = []
}

/** True while a plan run is collecting changes. */
export function isPlanMode(): boolean {
  return session !== null
}

/**
 * Cancel plan mode for the current command (writes resume normally). Used by
 * long-running commands (`watch`, `serve`) where a one-shot preview makes no
 * sense — they must actually write / never return to a renderer.
 */
export function disablePlan(): void {
  session = null
}

/** Leave plan mode and return everything that was staged (deterministic by path). */
export function endPlan(): PlannedWrite[] {
  const records = session ?? []
  session = null
  return [...records].sort((a, b) => a.path.localeCompare(b.path))
}

/**
 * Write `content` to `path` — or, in plan mode, record the would-be change and
 * write nothing. Returns the path either way (for ergonomic logging).
 */
export async function stageWrite(path: string, content: string): Promise<string> {
  if (session === null) return atomicWrite(path, content)
  let before: string | null = null
  try {
    before = await readFile(path, 'utf8')
  } catch {
    before = null // new file
  }
  session.push({ path, before, after: content })
  return path
}
