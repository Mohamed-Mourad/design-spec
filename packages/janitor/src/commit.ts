// commit.ts — stage the janitor's rewrites, commit them as the bot, and push
// back onto the PR branch.
//
// Invariants enforced here:
//   - Commit message carries [skip ci] and is authored design-spec-janitor[bot]
//     → the next run's loop-safety check skips it (no janitor-vs-janitor loop).
//   - Push uses --force-with-lease against HEAD:<headRef>. A concurrent manual
//     push moves the remote ref, the lease fails, and we ABORT CLEAN — the
//     branch is never corrupted and the run still exits 0.
//   - The push target is the PR source branch only; main/master is never a
//     remote write target (the headRef on a pull_request event is the topic
//     branch by construction).

import { configureBotIdentity, type Git } from './checkout.js'

export interface CommitOutcome {
  committed: boolean
  pushed: boolean
  /** True when --force-with-lease was rejected by a concurrent push. */
  leaseFailed: boolean
  /** True when the push was refused because the target was main/master. */
  refusedProtectedRef?: boolean
}

/** No remote write ever targets main/master — invariant guard. */
export function isProtectedRef(ref: string): boolean {
  const name = ref.replace(/^refs\/heads\//, '').toLowerCase()
  return name === 'main' || name === 'master'
}

/** `style(tokens): replace N raw values with design tokens [skip ci]` */
export function commitMessage(count: number): string {
  const noun = count === 1 ? 'value' : 'values'
  return `style(tokens): replace ${count} raw ${noun} with design tokens [skip ci]`
}

export interface CommitParams {
  count: number
  headRef: string
  botName: string
  botEmail: string
}

/**
 * Stage all changes, commit as the bot, and push with --force-with-lease.
 * Returns a structured outcome; never throws — a lease failure is reported, not
 * raised, so the runner can abort clean and exit 0.
 */
export async function commitAndPush(git: Git, p: CommitParams): Promise<CommitOutcome> {
  // Hard invariant: never write to main/master, no matter what head ref we were
  // handed. (A pull_request head ref is the topic branch by construction, but we
  // refuse defensively rather than trust the caller.)
  if (isProtectedRef(p.headRef)) {
    return { committed: false, pushed: false, leaseFailed: false, refusedProtectedRef: true }
  }

  await configureBotIdentity(git, p.botName, p.botEmail)

  const add = await git.run(['add', '-A'])
  if (add.code !== 0) return { committed: false, pushed: false, leaseFailed: false }

  // Nothing staged (e.g. fixes were a no-op) → don't create an empty commit.
  const staged = await git.run(['diff', '--cached', '--quiet'])
  if (staged.code === 0) return { committed: false, pushed: false, leaseFailed: false }

  const author = `${p.botName} <${p.botEmail}>`
  const commit = await git.run(['commit', '--author', author, '-m', commitMessage(p.count)])
  if (commit.code !== 0) return { committed: false, pushed: false, leaseFailed: false }

  // PR branches only — push to the topic branch, never main/master.
  const push = await git.run(['push', 'origin', `HEAD:${p.headRef}`, '--force-with-lease'])
  if (push.code !== 0) {
    const leaseFailed = /stale info|force-with-lease|rejected|fetch first|non-fast-forward/i.test(push.stderr)
    return { committed: true, pushed: false, leaseFailed }
  }

  return { committed: true, pushed: true, leaseFailed: false }
}
