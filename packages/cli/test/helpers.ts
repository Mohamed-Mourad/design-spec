// Integration-test helpers: run the built CLI in throwaway temp dirs.

import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const CLI = resolve(__dirname, '../dist/index.js')

export interface CliResult {
  code: number
  stdout: string
  stderr: string
}

/** Run the built CLI with `args` in `cwd`. Never throws on non-zero exit. */
export function runCli(args: string[], cwd: string, env: Record<string, string> = {}): Promise<CliResult> {
  return new Promise((resolvePromise) => {
    execFile(
      process.execPath,
      [CLI, ...args],
      { cwd, env: { ...process.env, NO_UPDATE_NOTIFIER: '1', ...env } },
      (error, stdout, stderr) => {
        const code = error && typeof (error as { code?: number }).code === 'number' ? (error as { code: number }).code : error ? 1 : 0
        resolvePromise({ code, stdout: String(stdout), stderr: String(stderr) })
      },
    )
  })
}

/** Make a fresh temp dir. Caller is responsible for cleanup via `cleanup`. */
export async function tmpProject(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'ds-cli-'))
}

export async function cleanup(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true })
}

/** Seed a minimal React + Tailwind project. */
export async function seedReactTailwind(dir: string): Promise<void> {
  await writeFile(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'acme-web', dependencies: { react: '^18.0.0', tailwindcss: '^3.4.0' } }, null, 2),
  )
  await writeFile(
    join(dir, 'tailwind.config.js'),
    'export default { theme: { extend: { colors: { brand: "#FF5733" } } } }\n',
  )
  await mkdir(join(dir, 'src'), { recursive: true })
}
