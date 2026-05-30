// commands/hook.ts — pre-commit hook: validate, recompile if stale, auto-stage.
//
//   design-spec hook install   write a pre-commit hook (never clobbering one)
//   design-spec hook run       the logic the hook invokes (also testable directly)
//
// `run` blocks the commit (non-zero exit) only when the schema is invalid; when
// output is merely stale it recompiles and stages the result so the commit
// proceeds with current output. This keeps generated files honest without
// getting in the developer's way.

import type { Command } from 'commander'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { chmod } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { action } from '../run.js'
import { loadSchema, findProjectRoot } from '../project.js'
import { NotInitializedError, CliError, ExitCode } from '../errors.js'
import { emit, checkStale } from '../emit.js'
import { atomicWrite } from '@design-spec/compiler'
import { upsertBlock, BLOCK_START } from '../agentRules.js'
import * as ui from '../ui.js'

const exec = promisify(execFile)

function findGitDir(start: string): string | null {
  let dir = start
  for (;;) {
    const candidate = join(dir, '.git')
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

const HOOK_INVOCATION = [
  '#!/bin/sh',
  '# design-spec pre-commit hook',
  'npx --no-install design-spec hook run || {',
  '  echo "design-spec: commit blocked (see above)";',
  '  exit 1;',
  '}',
].join('\n')

async function installHook(cwd: string): Promise<{ path: string; action: 'created' | 'updated' }> {
  const gitDir = findGitDir(cwd)
  if (!gitDir) throw new CliError('Not a git repository.', { code: 'E_NO_GIT', exitCode: ExitCode.GENERIC, hint: 'Run "git init" first.' })
  const hookPath = join(gitDir, 'hooks', 'pre-commit')
  const existed = existsSync(hookPath)
  const current = existed ? await readFile(hookPath, 'utf8') : ''

  let next: string
  if (current.includes(BLOCK_START)) {
    next = upsertBlock(current, HOOK_INVOCATION)
  } else if (current.trim() === '') {
    next = `${HOOK_INVOCATION}\n`
  } else {
    // Existing developer hook — append our managed block, never clobber it.
    next = upsertBlock(current, HOOK_INVOCATION)
  }
  await atomicWrite(hookPath, next)
  await chmod(hookPath, 0o755).catch(() => {}) // best-effort on Windows
  return { path: hookPath, action: existed ? 'updated' : 'created' }
}

/** The hook body. Returns the output files staged (if any). Throws to block the commit. */
export async function runHook(cwd: string): Promise<{ staged: string[] }> {
  // Invalid schema (or none) blocks the commit.
  const { schema, root } = await loadSchema(cwd)

  const { current } = await checkStale(schema, root)
  if (current) return { staged: [] }

  const files = await emit(schema, root)
  // Stage the regenerated output so the commit includes current files.
  try {
    await exec('git', ['add', ...files], { cwd: root })
  } catch {
    // If staging fails (e.g. no git in PATH), still don't block — the files are written.
  }
  return { staged: files }
}

export function registerHook(program: Command): void {
  const hook = program.command('hook').description('manage the design-spec git pre-commit hook')

  hook
    .command('install')
    .description('install a pre-commit hook that keeps generated output current')
    .addHelpText('after', '\nExample:\n  $ design-spec hook install')
    .action(
      action(async () => {
        const cwd = process.cwd()
        if (!findProjectRoot(cwd)) throw new NotInitializedError(cwd)
        const result = await installHook(cwd)
        ui.json({ ok: true, ...result })
        ui.success(`Pre-commit hook ${result.action}: ${result.path}`)
      }),
    )

  hook
    .command('run')
    .description('run the pre-commit logic (invoked by the installed hook)')
    .action(
      action(async () => {
        const { staged } = await runHook(process.cwd())
        ui.json({ ok: true, staged })
        if (staged.length > 0) ui.success(`Recompiled and staged ${staged.length} file(s).`)
        else ui.success('Output up to date.')
      }),
    )
}
