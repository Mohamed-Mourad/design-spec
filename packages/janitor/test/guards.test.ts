// guards.test.ts — the three promises the janitor makes about its exit code and
// its pushes, each against a real fixture repo with a bare remote:
//
//   strict       opt-in: advisory drift fails the check; fixes are committed anyway
//   lease        a concurrent push aborts the run clean, and that is never a failure
//   loop guard   a [skip ci] or bot-authored tip is never acted on
//
// The last block drives the built entrypoint (dist/action.js) the way the
// Docker action does, because the exit code that matters is the process's.

import { describe, it, expect, afterEach } from 'vitest'
import { execFile } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { run, createGit, BOT_NAME, BOT_EMAIL, MARKER, type JanitorConfig } from '../src/index.js'
import { setupFixture, pushCompeting, fakeGitHub, git, BRANCH, SCHEMA_FILE, type Fixture } from './helpers'

const PRIMARY = '#3B6EF5' // === defaultSchema.colors.primary → fixable
const FAR = '#FF00FF' // no token within tolerance → advisory
const FIXABLE = `.a { color: ${PRIMARY}; }\n`
const ADVISORY = `.b { color: ${FAR}; }\n`
const HUMAN = 'Dev <dev@example.com>'

function configFor(work: string, opts: Partial<JanitorConfig> = {}): JanitorConfig {
  return {
    root: work,
    schemaPath: SCHEMA_FILE,
    sourceGlob: '**/*.{ts,tsx,js,jsx,vue,css,scss,dart}',
    headRef: BRANCH,
    repo: 'acme/app',
    prNumber: 1,
    token: 'x',
    apiUrl: 'https://api.github.com',
    strict: false,
    botName: BOT_NAME,
    botEmail: BOT_EMAIL,
    ...opts,
  }
}

async function remoteLog(remote: string): Promise<{ author: string; subject: string }[]> {
  const r = await git(remote, ['log', '--pretty=format:%an%x09%s', BRANCH])
  return r.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [author, subject] = line.split('\t')
      return { author, subject }
    })
}

/** A file's content at the remote branch tip. */
async function remoteFile(remote: string, path: string): Promise<string> {
  return (await git(remote, ['show', `${BRANCH}:${path}`])).stdout
}

let fx: Fixture
afterEach(async () => {
  if (fx) await fx.cleanup()
})

describe('strict: true', () => {
  it('fails on advisory drift, and the fix it could make is on the branch all the same', async () => {
    fx = await setupFixture({ 'src/a.css': FIXABLE, 'src/b.css': ADVISORY })
    const gh = fakeGitHub()

    const res = await run({ config: configFor(fx.work, { strict: true }), git: createGit(fx.work), github: gh })

    expect(res).toMatchObject({ exitCode: 1, fixes: 1, advisory: 1, pushed: true, leaseFailed: false })
    // The fix landed on the remote; the advisory value was left exactly as written.
    expect(await remoteFile(fx.remote, 'src/a.css')).toContain('var(--color-primary)')
    expect(await remoteFile(fx.remote, 'src/b.css')).toContain(FAR)
    const log = await remoteLog(fx.remote)
    expect(log[0].author).toBe(BOT_NAME)
    expect(log[0].subject).toMatch(/\[skip ci\]$/)
    // The comment reports both halves.
    expect(gh.comments[0].body).toContain('Replaced **1** raw value')
    expect(gh.comments[0].body).toMatch(/Advisory — 1 value/)
  })

  it('passes when everything it found was fixable', async () => {
    fx = await setupFixture({ 'src/a.css': FIXABLE })
    const res = await run({ config: configFor(fx.work, { strict: true }), git: createGit(fx.work), github: fakeGitHub() })
    expect(res).toMatchObject({ exitCode: 0, fixes: 1, advisory: 0, pushed: true })
  })

  it('passes on a clean tree', async () => {
    fx = await setupFixture({ 'src/a.css': '.a { color: var(--color-primary); }\n' })
    const res = await run({ config: configFor(fx.work, { strict: true }), git: createGit(fx.work), github: fakeGitHub() })
    expect(res).toMatchObject({ exitCode: 0, fixes: 0, advisory: 0, pushed: false })
  })

  it('fails on advisory drift alone, without inventing a commit', async () => {
    fx = await setupFixture({ 'src/b.css': ADVISORY })
    const res = await run({ config: configFor(fx.work, { strict: true }), git: createGit(fx.work), github: fakeGitHub() })
    expect(res).toMatchObject({ exitCode: 1, fixes: 0, advisory: 1, pushed: false })
    expect((await remoteLog(fx.remote)).map((c) => c.author)).toEqual(['Seed Dev'])
  })

  it('is opt-in: the same tree exits 0 without it', async () => {
    fx = await setupFixture({ 'src/a.css': FIXABLE, 'src/b.css': ADVISORY })
    const res = await run({ config: configFor(fx.work), git: createGit(fx.work), github: fakeGitHub() })
    expect(res).toMatchObject({ exitCode: 0, fixes: 1, advisory: 1, pushed: true })
  })
})

describe('a concurrent push (force-with-lease rejected)', () => {
  it('aborts with the manual commit intact on the remote, and exits 0', async () => {
    fx = await setupFixture({ 'src/a.css': FIXABLE })
    await pushCompeting(fx.remote)
    const gh = fakeGitHub()

    const res = await run({ config: configFor(fx.work), git: createGit(fx.work), github: gh })

    expect(res).toMatchObject({ exitCode: 0, pushed: false, leaseFailed: true })
    // Nothing of the janitor's reached the remote: the history is seed + manual
    // push, the manual file is there, and the drift is still unfixed upstream.
    expect(await remoteLog(fx.remote)).toEqual([
      { author: 'Other Dev', subject: 'feat: concurrent manual change' },
      { author: 'Seed Dev', subject: 'chore: seed project' },
    ])
    expect(await remoteFile(fx.remote, 'CONCURRENT.txt')).toBe('manual push\n')
    expect(await remoteFile(fx.remote, 'src/a.css')).toContain(PRIMARY)
    // The comment says the fix was not applied rather than claiming it was.
    expect(gh.comments[0].body).toMatch(/\*\*not\*\* applied/)
  })

  it('exits 0 even under strict with advisory drift: an aborted run never fails a build', async () => {
    fx = await setupFixture({ 'src/a.css': FIXABLE, 'src/b.css': ADVISORY })
    await pushCompeting(fx.remote)

    const res = await run({ config: configFor(fx.work, { strict: true }), git: createGit(fx.work), github: fakeGitHub() })

    expect(res).toMatchObject({ exitCode: 0, advisory: 1, pushed: false, leaseFailed: true })
    expect((await remoteLog(fx.remote))[0].author).toBe('Other Dev')
  })

  it('a re-run on the settled branch applies the fix on top of the manual commit', async () => {
    fx = await setupFixture({ 'src/a.css': FIXABLE })
    await pushCompeting(fx.remote)
    const first = await run({ config: configFor(fx.work), git: createGit(fx.work), github: fakeGitHub() })
    expect(first.leaseFailed).toBe(true)

    // The next CI run checks the moved branch out fresh.
    await git(fx.work, ['fetch', 'origin'])
    await git(fx.work, ['reset', '--hard', `origin/${BRANCH}`])
    const second = await run({ config: configFor(fx.work), git: createGit(fx.work), github: fakeGitHub() })

    expect(second).toMatchObject({ exitCode: 0, fixes: 1, pushed: true, leaseFailed: false })
    expect((await remoteLog(fx.remote)).map((c) => c.author)).toEqual([BOT_NAME, 'Other Dev', 'Seed Dev'])
    expect(await remoteFile(fx.remote, 'CONCURRENT.txt')).toBe('manual push\n')
  })
})

describe('loop guard', () => {
  /** Put an empty commit on the tip with the given author and subject. */
  async function tip(author: string, subject: string): Promise<string> {
    await git(fx.work, ['commit', '--allow-empty', '--author', author, '-m', subject])
    return (await git(fx.work, ['rev-parse', 'HEAD'])).stdout.trim()
  }

  it.each([
    ['[skip ci] from a human', HUMAN,'docs: tweak readme [skip ci]'],
    ['[SKIP CI] in any case', HUMAN,'docs: tweak readme [SKIP CI]'],
    ['[skip ci] in the body', HUMAN,'docs: tweak readme\n\nnothing to build [skip ci]'],
    ['the bot as author, with no marker', `${BOT_NAME} <${BOT_EMAIL}>`, 'style(tokens): replace 1 raw value with design tokens'],
  ])('skips a tip commit with %s', async (_name, author, subject) => {
    fx = await setupFixture({ 'src/a.css': FIXABLE })
    const before = await tip(author, subject)
    const gh = fakeGitHub()

    const res = await run({ config: configFor(fx.work, { strict: true }), git: createGit(fx.work), github: gh })

    expect(res).toMatchObject({ exitCode: 0, skipped: true, fixes: 0, pushed: false })
    expect((await git(fx.work, ['rev-parse', 'HEAD'])).stdout.trim()).toBe(before)
    expect(await readFile(join(fx.work, 'src/a.css'), 'utf8')).toContain(PRIMARY) // not even rewritten locally
    expect((await remoteLog(fx.remote)).map((c) => c.author)).toEqual(['Seed Dev'])
    expect(gh.creates + gh.updates).toBe(0)
  })

  it('does not skip an ordinary commit that only mentions skipping', async () => {
    fx = await setupFixture({ 'src/a.css': FIXABLE })
    await tip(HUMAN,'docs: explain when to skip ci')
    const res = await run({ config: configFor(fx.work), git: createGit(fx.work), github: fakeGitHub() })
    expect(res).toMatchObject({ skipped: false, fixes: 1, pushed: true })
  })

  it("stops at its own push: the run its commit triggers does nothing", async () => {
    fx = await setupFixture({ 'src/a.css': FIXABLE, 'src/b.css': ADVISORY })
    const gh = fakeGitHub()

    const first = await run({ config: configFor(fx.work), git: createGit(fx.work), github: gh })
    expect(first).toMatchObject({ fixes: 1, pushed: true })
    const afterFirst = await remoteLog(fx.remote)

    // CI fires again on the janitor's own push.
    const second = await run({ config: configFor(fx.work), git: createGit(fx.work), github: gh })

    expect(second).toMatchObject({ exitCode: 0, skipped: true, fixes: 0, pushed: false })
    expect(await remoteLog(fx.remote)).toEqual(afterFirst) // exactly one bot commit, ever
    expect(afterFirst.filter((c) => c.author === BOT_NAME)).toHaveLength(1)
    expect(gh.creates).toBe(1) // and one comment, not one per run
    expect(gh.updates).toBe(0)
  })

  it('acts again once a human pushes on top, updating its one comment in place', async () => {
    fx = await setupFixture({ 'src/a.css': FIXABLE })
    const gh = fakeGitHub()
    await run({ config: configFor(fx.work), git: createGit(fx.work), github: gh })

    await writeFile(join(fx.work, 'src/c.css'), `.c { background: ${PRIMARY}; }\n`)
    await git(fx.work, ['add', '-A'])
    // The janitor left its own identity in this clone; a person's commit is theirs.
    await git(fx.work, ['commit', '--author', HUMAN, '-m', 'feat: add c'])
    await git(fx.work, ['push', 'origin', `HEAD:${BRANCH}`])

    const res = await run({ config: configFor(fx.work), git: createGit(fx.work), github: gh })

    expect(res).toMatchObject({ skipped: false, fixes: 1, pushed: true })
    expect((await remoteLog(fx.remote)).map((c) => c.author)).toEqual([BOT_NAME, 'Dev', BOT_NAME, 'Seed Dev'])
    expect(gh.creates).toBe(1)
    expect(gh.updates).toBe(1)
    expect(gh.comments).toHaveLength(1)
    expect(gh.comments[0].body.startsWith(MARKER)).toBe(true)
  })
})

describe('the action entrypoint (dist/action.js)', () => {
  const ACTION = resolve(__dirname, '../dist/action.js')

  /** Run the built action as the Docker image does: config from the environment. */
  function action(workspace: string, env: Record<string, string> = {}): Promise<{ code: number; output: string }> {
    const base: Record<string, string> = {}
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined && !k.startsWith('GITHUB_') && !k.startsWith('INPUT_')) base[k] = v
    }
    return new Promise((done) => {
      execFile(
        process.execPath,
        [ACTION],
        { cwd: workspace, env: { ...base, GITHUB_WORKSPACE: workspace, GITHUB_HEAD_REF: BRANCH, ...env } },
        (error, stdout, stderr) => {
          const code = error && typeof (error as { code?: number }).code === 'number' ? (error as { code: number }).code : error ? 1 : 0
          done({ code, output: String(stdout) + String(stderr) })
        },
      )
    })
  }

  it('exits 0 with advisory drift by default, and 1 only with INPUT_STRICT=true', async () => {
    fx = await setupFixture({ 'src/a.css': FIXABLE, 'src/b.css': ADVISORY })

    const lenient = await action(fx.work)
    expect(lenient.code).toBe(0)
    expect(await remoteFile(fx.remote, 'src/a.css')).toContain('var(--color-primary)') // the fix was pushed

    // A human pushes more advisory drift, so the next run is not loop-guarded.
    await writeFile(join(fx.work, 'src/d.css'), `.d { color: ${FAR}; }\n`)
    await git(fx.work, ['add', '-A'])
    await git(fx.work, ['commit', '--author', HUMAN, '-m', 'feat: add d'])
    await git(fx.work, ['push', 'origin', `HEAD:${BRANCH}`])

    const strict = await action(fx.work, { INPUT_STRICT: 'true' })
    expect(strict.code).toBe(1)
    expect(strict.output).toMatch(/strict mode: 2 advisory item\(s\)/)
  })

  it('exits 0 on a lost lease, strict or not', async () => {
    fx = await setupFixture({ 'src/a.css': FIXABLE, 'src/b.css': ADVISORY })
    await pushCompeting(fx.remote)

    const res = await action(fx.work, { INPUT_STRICT: 'true' })

    expect(res.code).toBe(0)
    expect(res.output).toMatch(/aborting clean/)
    expect((await remoteLog(fx.remote))[0].author).toBe('Other Dev')
  })

  it.each([
    ['a schema that is not JSON', async (work: string) => writeFile(join(work, SCHEMA_FILE), '{ not json')],
    ['a schema that is the wrong shape', async (work: string) => writeFile(join(work, SCHEMA_FILE), '[1, 2, 3]')],
    ['a source glob that matches nothing', async () => undefined, { 'INPUT_SOURCE-GLOB': 'nowhere/**/*.zzz' }],
    ['no PR head ref to push to', async () => undefined, { GITHUB_HEAD_REF: '' }],
  ] as [string, (work: string) => Promise<unknown>, Record<string, string>?][])(
    'never blocks the build: exits 0 with %s, even under strict',
    async (_name, breakIt, env = {}) => {
      fx = await setupFixture({ 'src/a.css': FIXABLE })
      await breakIt(fx.work)
      const res = await action(fx.work, { INPUT_STRICT: 'true', ...env })
      expect(res.code).toBe(0)
    },
  )

  it('never prints the token', async () => {
    const TOKEN = 'ghs_' + 'S3cr3tT0k3n'.repeat(3)
    fx = await setupFixture({ 'src/a.css': FIXABLE, 'src/b.css': ADVISORY })
    const res = await action(fx.work, { INPUT_TOKEN: TOKEN, GITHUB_REPOSITORY: 'acme/app', INPUT_STRICT: 'true' })
    expect(res.output).not.toContain(TOKEN)
  })
})
