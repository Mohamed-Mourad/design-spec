// @vitest-environment node
//
// The unscoped npm package `design-spec` belongs to an unrelated third party,
// so `npx design-spec …` runs their binary — and a sync line would hand it an
// API key. Our CLI is `@design-spec/cli`. This walks every user-facing surface
// and fails on any instruction that would resolve to the wrong package.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const ROOTS = ['src', 'README.md', 'packages/cli/src', 'packages/cli/README.md', 'e2e']
const TEXT = /\.(ts|vue|md|js)$/
const SELF = relative(ROOT, __filename).split(sep).join('/')

// `npx design-spec` not followed by more of a package name (so the scoped
// `npx @design-spec/cli` and a `design-spec-foo` package don't trip it), and any
// pin of the unscoped name.
const BAD = [/npx design-spec(?![\w/-])/, /(?<![@\w/-])design-spec@latest/]

function walk(path: string): string[] {
  const stat = statSync(path)
  if (stat.isFile()) return TEXT.test(path) ? [path] : []
  return readdirSync(path)
    .filter((name) => name !== 'node_modules' && name !== 'dist')
    .flatMap((name) => walk(join(path, name)))
}

describe('npx package name guard', () => {
  it('never tells anyone to run the unscoped design-spec package', () => {
    const hits: string[] = []
    for (const file of ROOTS.flatMap((r) => walk(join(ROOT, r)))) {
      const rel = relative(ROOT, file).split(sep).join('/')
      if (rel === SELF) continue
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (BAD.some((re) => re.test(line))) hits.push(`${rel}:${i + 1}: ${line.trim()}`)
        })
    }
    expect(hits).toEqual([])
  })

  it('catches the patterns it exists to catch', () => {
    const bad = ['npx design-spec init', 'npx design-spec', '`npx design-spec sync --key x`', 'npx design-spec@latest init']
    const ok = ['npx @design-spec/cli init', 'design-spec init', 'npx --no-install design-spec hook run']
    for (const line of bad) expect(BAD.some((re) => re.test(line)), line).toBe(true)
    for (const line of ok) expect(BAD.some((re) => re.test(line)), line).toBe(false)
  })
})
