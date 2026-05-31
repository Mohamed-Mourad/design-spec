// config.ts — resolve the janitor's run configuration from the GitHub Actions
// environment. Pure: (env, eventPayload) => JanitorConfig. No I/O, so the
// runner and tests can construct a config directly.
//
// Inputs arrive as `INPUT_*` (Docker action convention); the rest come from the
// standard `GITHUB_*` runner vars. The Figma PAT invariant does not apply here,
// but the same no-secret-logging rule does: `token` is never logged.

export interface JanitorConfig {
  /** Absolute path to the checked-out repo (GITHUB_WORKSPACE or cwd). */
  root: string
  /** Schema file path relative to root. */
  schemaPath: string
  /** Source glob the scanner walks. */
  sourceGlob: string
  /** PR source branch to push back onto (never main/master — enforced downstream). */
  headRef: string | null
  /** "owner/repo". */
  repo: string | null
  /** PR number for the summary comment, or null when not a PR event. */
  prNumber: number | null
  /** GitHub token for pushing + commenting. Never logged. */
  token: string | null
  /** GitHub REST base, e.g. https://api.github.com. */
  apiUrl: string
  /** When true, remaining advisory (non-fixable) drift fails the check. The one
   *  sanctioned exception to always-exit-0 — opt-in by the consuming repo. */
  strict: boolean
  /** Bot commit identity. */
  botName: string
  botEmail: string
}

const DEFAULT_SCHEMA = 'design-spec.schema.json'
const DEFAULT_GLOB = '**/*.{ts,tsx,js,jsx,vue,css,scss,dart}'
export const BOT_NAME = 'design-spec-janitor[bot]'
export const BOT_EMAIL = 'design-spec-janitor[bot]@users.noreply.github.com'

function input(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const v = env[`INPUT_${name.toUpperCase().replace(/ /g, '_')}`]
  return v && v.trim() !== '' ? v.trim() : undefined
}

function asBool(v: string | undefined): boolean {
  return v === 'true' || v === '1' || v === 'yes'
}

/** Pull the PR number out of a `pull_request` event payload (best-effort). */
export function prNumberFromEvent(event: unknown): number | null {
  if (event && typeof event === 'object') {
    const pr = (event as { pull_request?: { number?: unknown } }).pull_request
    if (pr && typeof pr.number === 'number') return pr.number
  }
  return null
}

export function parseConfig(env: NodeJS.ProcessEnv, event: unknown = null): JanitorConfig {
  const repo = env.GITHUB_REPOSITORY ?? null
  // `head_ref` is only set on pull_request events — exactly when the janitor runs.
  const headRef = input(env, 'head-ref') ?? env.GITHUB_HEAD_REF ?? null
  const token = input(env, 'token') ?? env.GITHUB_TOKEN ?? null

  return {
    root: env.GITHUB_WORKSPACE ?? process.cwd(),
    schemaPath: input(env, 'schema') ?? DEFAULT_SCHEMA,
    sourceGlob: input(env, 'source-glob') ?? DEFAULT_GLOB,
    headRef,
    repo,
    prNumber: prNumberFromEvent(event),
    token,
    apiUrl: env.GITHUB_API_URL ?? 'https://api.github.com',
    strict: asBool(input(env, 'strict')),
    botName: BOT_NAME,
    botEmail: BOT_EMAIL,
  }
}
