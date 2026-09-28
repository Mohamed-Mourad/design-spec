// sync/run.ts — the sync and push flows, shared by `sync`, `push` and
// `watch --sync`. Presentation-free: they return what happened and the
// commands render it.

import type { DesignSystemSchema } from '@design-spec/compiler'
import { loadSchema, saveSchema } from '../project.js'
import { emit } from '../emit.js'
import { isPlanMode } from '../plan.js'
import { validateSchema } from '../validate.js'
import { CliError, ExitCode } from '../errors.js'
import { SyncClient, type ProjectMeta } from './client.js'
import { resolveCredentials, rememberKey, maskKey, type Credentials } from './credentials.js'
import {
  mergeForPush,
  mergeForSync,
  projectSlug,
  sameSchema,
  type LayerChange,
  type PushMerge,
  type SyncMerge,
} from './merge.js'

export interface SyncOptions {
  key?: string
  project?: string
  force?: boolean
  /** Injected in tests; defaults to global fetch. */
  fetchImpl?: typeof fetch
}

export interface Session {
  creds: Credentials
  client: SyncClient
  project: string
  /** Set when a --key was remembered to the machine config this run. */
  rememberedAt: string | null
}

/** Resolve credentials + the project slug for a schema. */
export async function openSession(schema: DesignSystemSchema, opts: SyncOptions): Promise<Session> {
  const creds = await resolveCredentials(opts.key)
  const project = opts.project ?? projectSlug(schema.name)
  if (!/^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/.test(project)) {
    throw new CliError(`"${project}" is not a valid project name.`, {
      code: 'E_USAGE',
      exitCode: ExitCode.USAGE,
      hint: 'Use --project with lowercase letters, digits and hyphens (e.g. --project acme-ui).',
    })
  }
  return {
    creds,
    client: new SyncClient(creds.apiUrl, creds.key, opts.fetchImpl),
    project,
    rememberedAt: null,
  }
}

async function remember(session: Session): Promise<void> {
  // A dry run writes nothing — not even the machine config.
  if (isPlanMode()) return
  session.rememberedAt = await rememberKey(session.creds)
}

export interface SyncResult extends SyncMerge {
  project: string
  revision: number
  keyHint: string
  /** Output files compiled after the merge. */
  files: string[]
}

/**
 * `design-spec sync`: pull presentation (remote wins), keep export (local wins
 * unless --force), write + compile, report.
 */
export async function runSync(cwd: string, opts: SyncOptions): Promise<SyncResult & { session: Session }> {
  const { schema: local, path, root } = await loadSchema(cwd)
  const session = await openSession(local, opts)

  const remote = await session.client.getProject(session.project)
  if (!remote) {
    throw new CliError(`The dashboard has no project "${session.project}".`, {
      code: 'E_NO_REMOTE_PROJECT',
      exitCode: ExitCode.REMOTE,
      hint: 'Run "design-spec push" to create it, or pass --project to pick another.',
    })
  }
  await remember(session)

  const merge = mergeForSync(local, remote.schema_json, { force: opts.force })
  const issues = validateSchema(merge.schema)
  if (issues.length > 0) {
    const first = issues[0]
    throw new CliError(`The dashboard's config is invalid at ${first.path || '<root>'}: ${first.message}`, {
      code: 'E_REMOTE_INVALID',
      exitCode: ExitCode.INVALID_SCHEMA,
      hint: 'Nothing was written. Fix it in the dashboard, then sync again.',
    })
  }

  if (merge.changed) await saveSchema(path, merge.schema)
  const files = await emit(merge.schema, root)

  return {
    ...merge,
    project: session.project,
    revision: remote.revision,
    keyHint: maskKey(session.creds.key),
    files,
    session,
  }
}

export interface PushResult extends PushMerge {
  project: string
  /**
   * The revision written, or null on a dry run. When `unchanged`, the revision
   * the dashboard already had — nothing was written.
   */
  saved: ProjectMeta | null
  /** The dashboard already holds exactly this schema, so no PUT was sent. */
  unchanged: boolean
  keyHint: string
  rememberedAt: string | null
}

/**
 * `design-spec push`: send the local schema to the dashboard, keeping the
 * dashboard's presentation, guarded by the revision just read.
 */
export async function runPush(
  cwd: string,
  opts: SyncOptions & { dryRun?: boolean },
  session?: Session,
): Promise<PushResult> {
  const { schema: local } = await loadSchema(cwd)
  const s = session ?? (await openSession(local, opts))

  const remote = await s.client.getProject(s.project)
  const merge = mergeForPush(local, remote?.schema_json ?? null)
  const base = { project: s.project, keyHint: maskKey(s.creds.key) }

  // Nothing to send: a PUT would only bump the revision and make a designer's
  // open workspace look stale over no change at all.
  if (remote && sameSchema(merge.schema, remote.schema_json)) {
    const { schema_json: _schema, ...meta } = remote
    if (!opts.dryRun && !session) s.rememberedAt = await rememberKey(s.creds)
    return { ...merge, ...base, saved: meta, unchanged: true, rememberedAt: s.rememberedAt }
  }

  // A dry run reads (to show the real delta) but sends nothing and remembers
  // nothing.
  let saved: ProjectMeta | null = null
  if (!opts.dryRun) {
    saved = await s.client.putProject(s.project, merge.schema, remote?.revision ?? 0)
    if (!session) s.rememberedAt = await rememberKey(s.creds)
  }
  return { ...merge, ...base, saved, unchanged: false, rememberedAt: s.rememberedAt }
}

export interface PullResult {
  /** The dashboard revision this pull saw. */
  revision: number
  /** Presentation leaves written locally; empty when nothing changed. */
  presentation: LayerChange[]
}

/**
 * The periodic pull inside `watch --sync`: once the dashboard revision has
 * moved past `knownRevision`, take its presentation (remote wins) and write the
 * schema. Export and tokens stay local — this is `sync` without --force, and
 * without the compile: the write itself wakes the watcher, which recompiles.
 */
export async function runPull(cwd: string, session: Session, knownRevision: number): Promise<PullResult> {
  const remote = await session.client.getProject(session.project)
  if (!remote || remote.revision === knownRevision) {
    return { revision: remote?.revision ?? knownRevision, presentation: [] }
  }

  const { schema: local, path } = await loadSchema(cwd)
  const merge = mergeForSync(local, remote.schema_json)
  if (merge.presentation.length === 0) return { revision: remote.revision, presentation: [] }

  const issues = validateSchema(merge.schema)
  if (issues.length > 0) {
    const first = issues[0]
    throw new CliError(`The dashboard's config is invalid at ${first.path || '<root>'}: ${first.message}`, {
      code: 'E_REMOTE_INVALID',
      exitCode: ExitCode.INVALID_SCHEMA,
    })
  }
  await saveSchema(path, merge.schema)
  return { revision: remote.revision, presentation: merge.presentation }
}
