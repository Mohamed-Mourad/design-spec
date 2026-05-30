// branding.ts — build the splash content shared by the bare invocation and the
// init/watch/serve commands, so the launch design is identical everywhere.

import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { findSchema } from './project.js'
import type { SplashInfo } from './ui.js'

const require = createRequire(import.meta.url)
const pkg = require('../package.json') as { version: string }

const HINTS = 'design-spec --help for all commands · init · watch · serve'

/** Splash content for a command: caller supplies the boxed headline + status. */
export function splashContext(cwd: string, opts: { tip: string; status: string; hints?: string }): SplashInfo {
  return { version: pkg.version, cwd, tip: opts.tip, status: opts.status, hints: opts.hints ?? HINTS }
}

/** Splash content for a bare invocation — contextual on whether a schema exists. */
export function bareSplash(cwd: string): SplashInfo {
  const schemaPath = findSchema(cwd)
  if (schemaPath) {
    let name = 'Your design system'
    try {
      name = (JSON.parse(readFileSync(schemaPath, 'utf8')) as { name?: string }).name ?? name
    } catch {
      /* best-effort */
    }
    return splashContext(cwd, {
      tip: `${name} is set up. Run \`design-spec watch\` to recompile on save, or \`design-spec serve\` to feed your AI agent.`,
      status: 'Schema detected — run `design-spec status` for details.',
    })
  }
  return splashContext(cwd, {
    tip: 'Run `design-spec init` to detect your stack and generate your design system. Works best with context.',
    status: 'No design-spec.schema.json here yet.',
  })
}
