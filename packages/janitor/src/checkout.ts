// checkout.ts — the thin git layer + loop-safety read.
//
// `createGit` wraps `git` in the checked-out workspace (never throws on a
// non-zero exit; the caller inspects `code`). `headCommitMeta` reads the tip
// commit so the runner can skip pushes the janitor itself authored — the
// loop-safety invariant ([skip ci] + bot-author skip). No commits or pushes
// happen here; those live in commit.ts.

import { execFile } from 'node:child_process'

export interface GitResult {
  code: number
  stdout: string
  stderr: string
}

export interface Git {
  /** Run `git <args>` in the workspace. Resolves with the exit code captured. */
  run(args: string[]): Promise<GitResult>
}

/** A real git bound to `cwd`. */
export function createGit(cwd: string): Git {
  return {
    run(args) {
      return new Promise<GitResult>((resolve) => {
        execFile('git', args, { cwd, maxBuffer: 32 * 1024 * 1024 }, (error, stdout, stderr) => {
          const code = error && typeof (error as { code?: number }).code === 'number' ? (error as { code: number }).code : error ? 1 : 0
          resolve({ code, stdout: String(stdout), stderr: String(stderr) })
        })
      })
    },
  }
}

export interface HeadMeta {
  authorName: string
  message: string
  /** Tip commit was authored by the janitor bot. */
  isBot: boolean
  /** Tip commit message carries [skip ci]. */
  skipCi: boolean
}

/**
 * Read the tip commit's author + subject for loop-safety. Returns null when the
 * branch has no commits (unborn) — the runner treats that as "nothing to skip".
 */
export async function headCommitMeta(git: Git, botName: string): Promise<HeadMeta | null> {
  const r = await git.run(['log', '-1', '--pretty=format:%an%n%B'])
  if (r.code !== 0) return null
  const [authorName = '', ...rest] = r.stdout.split('\n')
  const message = rest.join('\n')
  return {
    authorName,
    message,
    isBot: authorName === botName,
    skipCi: /\[skip ci\]/i.test(message),
  }
}

/** Configure the bot identity for commits made in this run. */
export async function configureBotIdentity(git: Git, name: string, email: string): Promise<void> {
  await git.run(['config', 'user.name', name])
  await git.run(['config', 'user.email', email])
}
