// Integration-test helpers: spin up real git repos in throwaway temp dirs with
// a bare "remote" so the janitor's push / force-with-lease paths are exercised
// against actual git, plus an in-memory fake GitHub client (no network).

import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { defaultSchema } from '@design-spec/compiler'
import type { GitHubClient, IssueComment } from '../src/index.js'

export interface GitRun {
  code: number
  stdout: string
  stderr: string
}

/** Run git in `cwd`; never throws on non-zero (caller inspects code). */
export function git(cwd: string, args: string[]): Promise<GitRun> {
  return new Promise((resolve) => {
    execFile('git', args, { cwd, maxBuffer: 32 * 1024 * 1024 }, (error, stdout, stderr) => {
      const code = error && typeof (error as { code?: number }).code === 'number' ? (error as { code: number }).code : error ? 1 : 0
      resolve({ code, stdout: String(stdout), stderr: String(stderr) })
    })
  })
}

async function tmp(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix))
}

async function configure(dir: string, name = 'Seed Dev', email = 'seed@example.com'): Promise<void> {
  await git(dir, ['config', 'user.name', name])
  await git(dir, ['config', 'user.email', email])
}

export const BRANCH = 'feature/topic'
export const SCHEMA_FILE = 'design-spec.schema.json'

export interface Fixture {
  remote: string
  work: string
  branch: string
  cleanup(): Promise<void>
}

/**
 * Create a bare remote + a working clone on `BRANCH`, seeded with the schema and
 * the given source files (rel → contents). The working clone is what the janitor
 * operates on; `remote` lets tests inspect pushed commits or move the ref.
 */
export async function setupFixture(files: Record<string, string>, schema: unknown = defaultSchema): Promise<Fixture> {
  const remote = await tmp('ds-jan-remote-')
  await git(remote, ['init', '--bare'])

  const seed = await tmp('ds-jan-seed-')
  await git(seed, ['init'])
  await configure(seed)
  await git(seed, ['checkout', '-b', BRANCH])
  await git(seed, ['remote', 'add', 'origin', remote])

  await writeFile(join(seed, SCHEMA_FILE), JSON.stringify(schema, null, 2) + '\n')
  for (const [rel, content] of Object.entries(files)) {
    const path = join(seed, rel)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, content)
  }
  await git(seed, ['add', '-A'])
  await git(seed, ['commit', '-m', 'chore: seed project'])
  await git(seed, ['push', '-u', 'origin', BRANCH])

  const work = await tmp('ds-jan-work-')
  await rm(work, { recursive: true, force: true })
  await git(dirname(work), ['clone', remote, work])
  await git(work, ['checkout', BRANCH])
  await configure(work) // committer identity for the janitor's bot commits

  return {
    remote,
    work,
    branch: BRANCH,
    async cleanup() {
      await rm(remote, { recursive: true, force: true })
      await rm(seed, { recursive: true, force: true })
      await rm(work, { recursive: true, force: true })
    },
  }
}

/** Push a competing commit straight to the remote, moving `BRANCH` (simulates a
 *  concurrent manual push that should defeat --force-with-lease). */
export async function pushCompeting(remote: string): Promise<void> {
  const other = await tmp('ds-jan-other-')
  await rm(other, { recursive: true, force: true })
  await git(dirname(other), ['clone', remote, other])
  await git(other, ['checkout', BRANCH])
  await configure(other, 'Other Dev', 'other@example.com')
  await writeFile(join(other, 'CONCURRENT.txt'), 'manual push\n')
  await git(other, ['add', '-A'])
  await git(other, ['commit', '-m', 'feat: concurrent manual change'])
  await git(other, ['push', 'origin', BRANCH])
  await rm(other, { recursive: true, force: true })
}

/** In-memory GitHub client: records create/update calls for assertions. */
export function fakeGitHub(): GitHubClient & { comments: IssueComment[]; updates: number; creates: number } {
  const state = {
    comments: [] as IssueComment[],
    updates: 0,
    creates: 0,
    async listComments() {
      return state.comments
    },
    async createComment(_pr: number, body: string) {
      state.creates++
      state.comments.push({ id: state.comments.length + 1, body })
    },
    async updateComment(id: number, body: string) {
      state.updates++
      const c = state.comments.find((x) => x.id === id)
      if (c) c.body = body
    },
  }
  return state
}
