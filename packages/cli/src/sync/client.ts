// sync/client.ts — the dashboard API, as the CLI speaks it.
//
// Contract: design-spec-backend/docs/sync-contract.md. Two calls — read a
// project, write a project — both authenticated with a developer API key as
// `Authorization: Bearer ds_live_…`. Nothing here talks to git: a push lands in
// the dashboard's database and stops there. A read can be conditional on a
// revision already held, which is how a poll costs the dashboard nothing.
//
// The key is a secret. It is attached to the request header and nowhere else:
// never in a URL, an error message, a log line, or --json output.

import type { DesignSystemSchema } from '@design-spec/compiler'
import { CliError, ExitCode } from '../errors.js'

export interface ProjectMeta {
  project: string
  name: string
  revision: number
  updated_by: 'cli' | 'web'
  created_at: string
  updated_at: string
}

export interface RemoteProject extends ProjectMeta {
  schema_json: DesignSystemSchema
}

/** A conditional read found the project still at the revision asked about. */
export const UNCHANGED = Symbol('unchanged')

type Fetch = typeof fetch

export class SyncClient {
  constructor(
    private readonly baseUrl: string,
    private readonly key: string,
    private readonly fetchImpl: Fetch = fetch,
  ) {}

  /** Read a project; null when the dashboard has none by that slug. */
  async getProject(project: string): Promise<RemoteProject | null> {
    const res = await this.request('GET', project)
    if (res.status === 404) return null
    return (await this.parse(res)) as RemoteProject
  }

  /**
   * Read a project only if it has moved past `knownRevision`: the dashboard
   * answers 304 (UNCHANGED) while it has not, and does not count that as a sync.
   */
  async getProjectIfChanged(project: string, knownRevision: number): Promise<RemoteProject | null | typeof UNCHANGED> {
    const res = await this.request('GET', project, undefined, { 'If-None-Match': `"rev-${knownRevision}"` })
    if (res.status === 304) return UNCHANGED
    if (res.status === 404) return null
    return (await this.parse(res)) as RemoteProject
  }

  /** Write a project, guarded by the revision it was read at (0 = must not exist). */
  async putProject(project: string, schema: DesignSystemSchema, baseRevision: number): Promise<ProjectMeta> {
    const res = await this.request('PUT', project, { schema_json: schema, base_revision: baseRevision })
    return (await this.parse(res)) as ProjectMeta
  }

  private async request(
    method: 'GET' | 'PUT',
    project: string,
    body?: unknown,
    extraHeaders: Record<string, string> = {},
  ): Promise<Response> {
    const url = `${this.baseUrl}/api/v1/projects/${encodeURIComponent(project)}`
    try {
      return await this.fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.key}`,
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...extraHeaders,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      })
    } catch (e) {
      throw new CliError(`Could not reach the dashboard at ${this.baseUrl}.`, {
        code: 'E_REMOTE_UNREACHABLE',
        exitCode: ExitCode.REMOTE,
        hint: 'Check your connection, or set DESIGN_SPEC_API_URL if you use a self-hosted API.',
        cause: e,
      })
    }
  }

  private async parse(res: Response): Promise<unknown> {
    const text = await res.text()
    let payload: unknown = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = null
    }
    if (res.ok) return payload
    throw remoteError(res.status, (payload as { error?: string } | null)?.error)
  }
}

/** Map an API status to an actionable CLI error. Never echoes the key. */
export function remoteError(status: number, message?: string): CliError {
  const said = message ? `: ${message}` : ''
  switch (status) {
    case 401:
      return new CliError('The dashboard rejected your API key.', {
        code: 'E_AUTH',
        exitCode: ExitCode.AUTH,
        hint: 'Generate a new key in Settings → Developer, then set DESIGN_SPEC_API_KEY or pass it once with --key.',
      })
    case 403:
      return new CliError(`The dashboard refused this${said}.`, {
        code: 'E_FORBIDDEN',
        exitCode: ExitCode.REMOTE,
        hint: message?.includes('pro plan')
          ? 'Free accounts sync one project. Upgrade to Pro for unlimited, or push to the project you already have (--project).'
          : undefined,
      })
    case 409:
      return new CliError('The dashboard project changed while this ran.', {
        code: 'E_CONFLICT',
        exitCode: ExitCode.REMOTE,
        hint: 'Someone saved it in between. Run the command again — it re-reads first.',
      })
    case 413:
      return new CliError('The schema is too large for the dashboard (2 MiB max).', {
        code: 'E_TOO_LARGE',
        exitCode: ExitCode.REMOTE,
      })
    case 429:
      return new CliError('Too many sync requests.', {
        code: 'E_RATE_LIMITED',
        exitCode: ExitCode.REMOTE,
        hint: 'Wait a minute and try again.',
      })
    default:
      return new CliError(`The dashboard API failed (${status})${said}.`, {
        code: 'E_REMOTE',
        exitCode: ExitCode.REMOTE,
      })
  }
}
