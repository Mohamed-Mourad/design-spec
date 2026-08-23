// The Figma REST client — the only module that puts the PAT on the wire, and it
// only ever puts it on a wire that goes to api.figma.com.
//
// Calling Figma from the browser is the whole design (architecture-plan.md §15):
// the token stays in this tab, the Design Spec API never sees it, and revoking
// it in Figma revokes it here with no server state to clean up. The cost is
// CORS — Figma allows browser origins on these endpoints, which is why this is
// possible at all.
//
// No error message here ever interpolates the token, and nothing here logs.

import { mapFigmaStyles, mapFigmaVariables, emptyImport, type FigmaImport } from './map'
import type {
  FigmaFileMeta,
  FigmaNode,
  FigmaNodesResponse,
  FigmaStyleMeta,
  FigmaStylesResponse,
  FigmaVariablesResponse,
} from './types'

const FIGMA_API = 'https://api.figma.com/v1'

/** Node ids are sent in one query string; Figma rejects an over-long URL. */
const NODE_BATCH = 100

export class FigmaError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'FigmaError'
  }
}

/**
 * Turn a Figma failure into something the designer can act on. The status codes
 * mean specific things on this API and a generic "request failed" would hide
 * the one piece of information that matters: whose problem it is.
 */
function figmaError(status: number, fallback: string): FigmaError {
  switch (status) {
    case 401:
    case 403:
      return new FigmaError(
        status,
        'Figma refused that token. Check it has file read access and has not expired.',
      )
    case 404:
      return new FigmaError(status, 'Figma has no file at that link, or this token cannot see it.')
    case 429:
      return new FigmaError(status, 'Figma is rate-limiting this token. Wait a minute and retry.')
    default:
      return new FigmaError(status, fallback)
  }
}

async function figmaGet<T>(path: string, pat: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${FIGMA_API}${path}`, { headers: { 'X-Figma-Token': pat } })
  } catch {
    throw new FigmaError(0, 'Could not reach Figma from this browser.')
  }
  if (!res.ok) {
    throw figmaError(res.status, `Figma returned ${res.status}.`)
  }
  return (await res.json()) as T
}

/** `GET /v1/files/{key}?depth=1` — name and version, without the document. */
export function fetchFileMeta(fileKey: string, pat: string): Promise<FigmaFileMeta> {
  return figmaGet<FigmaFileMeta>(`/files/${encodeURIComponent(fileKey)}?depth=1`, pat)
}

export async function fetchStyles(fileKey: string, pat: string): Promise<FigmaStyleMeta[]> {
  const res = await figmaGet<FigmaStylesResponse>(`/files/${encodeURIComponent(fileKey)}/styles`, pat)
  return res.meta?.styles ?? []
}

/**
 * Read the nodes the styles point at. Batched because the ids travel in the
 * query string: a system with three hundred published styles would otherwise
 * build a URL no server accepts.
 */
export async function fetchStyleNodes(
  fileKey: string,
  nodeIds: string[],
  pat: string,
): Promise<Record<string, FigmaNode | undefined>> {
  const out: Record<string, FigmaNode | undefined> = {}
  for (let i = 0; i < nodeIds.length; i += NODE_BATCH) {
    const batch = nodeIds.slice(i, i + NODE_BATCH)
    const res = await figmaGet<FigmaNodesResponse>(
      `/files/${encodeURIComponent(fileKey)}/nodes?ids=${batch.map(encodeURIComponent).join(',')}`,
      pat,
    )
    for (const [id, entry] of Object.entries(res.nodes ?? {})) {
      if (entry?.document) out[id] = entry.document
    }
  }
  return out
}

/**
 * `GET /v1/files/{key}/variables/local`. Figma serves this only to Professional
 * plans and above, so a 403 here is a plan boundary rather than a bad token —
 * the caller decides whether that is worth surfacing.
 */
export function fetchLocalVariables(fileKey: string, pat: string): Promise<FigmaVariablesResponse> {
  return figmaGet<FigmaVariablesResponse>(
    `/files/${encodeURIComponent(fileKey)}/variables/local`,
    pat,
  )
}

export interface FigmaImportOptions {
  /** Read variables and modes as well as styles. Pro. */
  includeVariables?: boolean
}

export interface FigmaImportResult {
  file: FigmaFileMeta
  imported: FigmaImport
}

/**
 * The whole read: file metadata, published styles and their nodes, and — when
 * asked for — local variables.
 *
 * A variables failure never fails the import. Styles are the Free baseline and
 * they are already in hand by then; losing the Pro half of a read to a Figma
 * plan restriction should leave the designer with the tokens that did arrive
 * plus a note saying what did not.
 */
export async function importFromFigma(
  fileKey: string,
  pat: string,
  options: FigmaImportOptions = {},
): Promise<FigmaImportResult> {
  const file = await fetchFileMeta(fileKey, pat)
  const styles = await fetchStyles(fileKey, pat)
  const nodes = await fetchStyleNodes(
    fileKey,
    styles.map((s) => s.node_id),
    pat,
  )

  const imported = mapFigmaStyles(styles, nodes, emptyImport())

  if (options.includeVariables) {
    try {
      const res = await fetchLocalVariables(fileKey, pat)
      mapFigmaVariables(res.meta?.variables ?? {}, res.meta?.variableCollections ?? {}, imported)
    } catch (e) {
      imported.notes.push({
        kind: 'skipped',
        source: 'Variables',
        reason:
          e instanceof FigmaError && (e.status === 403 || e.status === 404)
            ? 'this Figma plan does not expose the Variables API — styles were imported'
            : 'the variables could not be read — styles were imported',
      })
    }
  }

  return { file, imported }
}
