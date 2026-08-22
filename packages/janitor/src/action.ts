#!/usr/bin/env node
// action.ts — the Docker action entrypoint.
//
// Builds the real git + GitHub client from the Actions environment, runs the
// janitor, and exits with the runner's code. Belt-and-suspenders: any throw
// that escapes the runner is still swallowed to exit 0 — the janitor must never
// block a merge. The only non-zero path is the runner's sanctioned strict-mode
// advisory failure.

import { readFileSync } from 'node:fs'
import { parseConfig } from './config.js'
import { createGit } from './checkout.js'
import { createGitHubClient, type GitHubClient } from './prComment.js'
import { run } from './runner.js'

function readEvent(path: string | undefined): unknown {
  if (!path) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

async function main(): Promise<number> {
  const config = parseConfig(process.env, readEvent(process.env.GITHUB_EVENT_PATH))

  let github: GitHubClient | null = null
  if (config.token && config.repo && config.prNumber != null) {
    github = createGitHubClient(config.apiUrl, config.repo, config.token)
  }

  const git = createGit(config.root)
  const result = await run({ config, git, github, log: console })
  return result.exitCode
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    // Should be unreachable (run() never rejects) — but never block a build.
    console.error(`janitor: unexpected top-level error (non-blocking): ${(e as Error).message}`)
    process.exit(0)
  })
