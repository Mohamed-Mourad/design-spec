import { describe, it, expect, afterEach } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { defaultSchema } from '@design-spec/compiler'
import { run, createGit, generatedFilenames, BOT_NAME, BOT_EMAIL, type JanitorConfig } from '../src/index.js'
import { setupFixture, pushCompeting, fakeGitHub, git, BRANCH, SCHEMA_FILE, type Fixture } from './helpers'

const PRIMARY = '#2563EB' // === defaultSchema.colors.primary → fixable (ΔE 0)
const FAR = '#FF00FF' // magenta, no token within tolerance → advisory

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

/** Tip commit of the bare remote: "author-name\n<full message>". */
async function remoteTip(remote: string): Promise<{ author: string; message: string }> {
  const r = await git(remote, ['log', '-1', '--pretty=format:%an%n%B', BRANCH])
  const [author = '', ...rest] = r.stdout.split('\n')
  return { author, message: rest.join('\n') }
}

let fx: Fixture
afterEach(async () => {
  if (fx) await fx.cleanup()
})

describe('janitor run loop', () => {
  it('auto-fixes a raw hex, commits as the bot with [skip ci], pushes, and exits 0', async () => {
    fx = await setupFixture({ 'src/theme.css': `.x { color: ${PRIMARY}; }\n` })
    const gh = fakeGitHub()

    const res = await run({ config: configFor(fx.work), git: createGit(fx.work), github: gh })

    expect(res.exitCode).toBe(0)
    expect(res.fixes).toBe(1)
    expect(res.pushed).toBe(true)
    expect(res.advisory).toBe(0)

    // Pushed onto the PR branch as the bot, with [skip ci] (loop-safety).
    const tip = await remoteTip(fx.remote)
    expect(tip.author).toBe(BOT_NAME)
    expect(tip.message).toContain('[skip ci]')
    expect(tip.message).toContain('style(tokens): replace 1 raw value with design tokens')

    // The raw hex was rewritten to the token ref in the pushed tree.
    const patched = await readFile(join(fx.work, 'src/theme.css'), 'utf8')
    expect(patched).toContain('var(--color-primary)')
    expect(patched).not.toContain(PRIMARY)

    // 🧹 summary comment created with a Was/Now/Token row.
    expect(gh.creates).toBe(1)
    expect(gh.comments[0].body).toContain('colors.primary')
    expect(gh.comments[0].body).toContain('var(--color-primary)')
  })

  it('never rewrites generated token-definition files', async () => {
    const generated = [...generatedFilenames(defaultSchema)]
    const cssDef = generated.find((f) => f.endsWith('.css')) ?? 'tokens.css'
    // The generated file legitimately contains the raw hex (it DEFINES the token).
    const defContent = `:root { --color-primary: ${PRIMARY}; }\n`
    fx = await setupFixture({ [cssDef]: defContent, 'src/theme.css': `.x { color: ${PRIMARY}; }\n` })
    const gh = fakeGitHub()

    const res = await run({ config: configFor(fx.work), git: createGit(fx.work), github: gh })

    expect(res.exitCode).toBe(0)
    // Only the real source file changed; the token-definition file is untouched
    // (its raw hex is left intact — it DEFINES the token, it isn't drift).
    const defAfter = await readFile(join(fx.work, cssDef), 'utf8')
    expect(defAfter.replace(/\r\n/g, '\n')).toBe(defContent)
    expect(defAfter).toContain(PRIMARY)
    expect(defAfter).not.toContain('var(--color-primary)')
    expect(await readFile(join(fx.work, 'src/theme.css'), 'utf8')).toContain('var(--color-primary)')
  })

  it('is loop-safe: skips a tip commit authored by the bot / carrying [skip ci]', async () => {
    fx = await setupFixture({ 'src/theme.css': `.x { color: ${PRIMARY}; }\n` })
    // Tip is a bot [skip ci] commit (as if a previous janitor run).
    await git(fx.work, [
      'commit',
      '--allow-empty',
      '--author',
      `${BOT_NAME} <${BOT_EMAIL}>`,
      '-m',
      'style(tokens): replace 1 raw value with design tokens [skip ci]',
    ])
    const before = (await git(fx.work, ['rev-parse', 'HEAD'])).stdout.trim()
    const gh = fakeGitHub()

    const res = await run({ config: configFor(fx.work), git: createGit(fx.work), github: gh })

    expect(res.exitCode).toBe(0)
    expect(res.skipped).toBe(true)
    expect(res.fixes).toBe(0)
    // No new commit was made.
    expect((await git(fx.work, ['rev-parse', 'HEAD'])).stdout.trim()).toBe(before)
    expect(gh.creates).toBe(0)
  })

  it('aborts clean on a concurrent push (force-with-lease rejected) and still exits 0', async () => {
    fx = await setupFixture({ 'src/theme.css': `.x { color: ${PRIMARY}; }\n` })
    // Someone pushes to the branch after our clone, before our push.
    await pushCompeting(fx.remote)
    const gh = fakeGitHub()

    const res = await run({ config: configFor(fx.work), git: createGit(fx.work), github: gh })

    expect(res.exitCode).toBe(0) // never blocks the build
    expect(res.leaseFailed).toBe(true)
    expect(res.pushed).toBe(false)

    // Branch is not corrupted: the remote tip is still the manual commit.
    const tip = await remoteTip(fx.remote)
    expect(tip.author).toBe('Other Dev')
    // The comment explains the abort.
    expect(gh.comments[0].body).toMatch(/concurrent push|branch moved/i)
  })

  it('refuses to push when the head ref is main/master (never writes to main)', async () => {
    fx = await setupFixture({ 'src/theme.css': `.x { color: ${PRIMARY}; }\n` })
    const gh = fakeGitHub()

    // Even with fixable drift, a protected head ref must never be pushed to.
    const res = await run({ config: configFor(fx.work, { headRef: 'main' }), git: createGit(fx.work), github: gh })

    expect(res.exitCode).toBe(0) // never blocks
    expect(res.pushed).toBe(false)
    // The seed tip is untouched on the protected branch.
    const tip = await remoteTip(fx.remote)
    expect(tip.author).toBe('Seed Dev')
  })

  it('leaves advisory (non-fixable) drift untouched and exits 0 by default', async () => {
    fx = await setupFixture({ 'src/theme.css': `.x { color: ${FAR}; }\n` })
    const gh = fakeGitHub()

    const res = await run({ config: configFor(fx.work), git: createGit(fx.work), github: gh })

    expect(res.exitCode).toBe(0)
    expect(res.fixes).toBe(0)
    expect(res.advisory).toBe(1)
    expect(gh.comments[0].body).toMatch(/Advisory/)
    // Nothing committed.
    const tip = await remoteTip(fx.remote)
    expect(tip.author).toBe('Seed Dev')
  })

  it('strict: true fails the check on advisory drift only — but still commits auto-fixes', async () => {
    // One fixable hex + one advisory hex in the same file.
    fx = await setupFixture({ 'src/theme.css': `.a { color: ${PRIMARY}; }\n.b { color: ${FAR}; }\n` })
    const gh = fakeGitHub()

    const res = await run({ config: configFor(fx.work, { strict: true }), git: createGit(fx.work), github: gh })

    expect(res.exitCode).toBe(1) // sanctioned strict failure on advisory
    expect(res.fixes).toBe(1)
    expect(res.advisory).toBe(1)
    expect(res.pushed).toBe(true) // auto-fix is still committed under strict

    const tip = await remoteTip(fx.remote)
    expect(tip.author).toBe(BOT_NAME)
    expect(tip.message).toContain('[skip ci]')
  })
})
