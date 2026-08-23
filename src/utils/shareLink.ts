// shareLink.ts — account-less sharing.
//
// The whole design system travels inside the URL fragment: JSON → gzip →
// base64url → `/preview#<hash>`. A fragment never leaves the browser (it is not
// sent with the HTTP request), so a free share needs no account, no database
// row, and leaks nothing to the server that hosts the SPA.
//
// Everything decoded here arrived from a stranger's link. It is parsed
// defensively, size-capped in both directions, and shape-checked before any
// component is handed it.

import { gzip, Inflate } from 'pako'
import type { DesignSystemSchema } from '@/types/schema'

/**
 * Browsers accept far longer URLs than this, but a link people paste into
 * Slack, a Notion page or an email client has to survive those too. Past the
 * cap the caller is told to publish a proposal instead of shortening silently.
 */
export const MAX_HASH_LENGTH = 24_000

/**
 * Ceiling on what a hash is allowed to inflate to. Gzip trivially compresses a
 * multi-gigabyte payload into a few kilobytes, so without a cap a crafted link
 * would exhaust the tab's memory before the parse ever ran.
 */
const MAX_DECODED_BYTES = 4 * 1024 * 1024

export class ShareLinkTooLargeError extends Error {
  constructor(readonly length: number) {
    super('This design system is too large to share as a link.')
    this.name = 'ShareLinkTooLargeError'
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  // Chunked: String.fromCharCode(...bytes) blows the argument limit around 100kB.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Standard base64 → the URL-safe alphabet, padding dropped. */
function toBase64Url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): string {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/')
  return b64 + '='.repeat((4 - (b64.length % 4)) % 4)
}

/** The compressed, URL-safe encoding of a schema. Throws when it won't fit. */
export function encodeSchemaHash(schema: DesignSystemSchema): string {
  const json = JSON.stringify(schema)
  const hash = toBase64Url(bytesToBase64(gzip(json)))
  if (hash.length > MAX_HASH_LENGTH) throw new ShareLinkTooLargeError(hash.length)
  return hash
}

/**
 * Enough of a schema to render: a name and the token groups the bento reads.
 * A hand-edited link that fails this is rejected rather than rendered as a
 * half-empty preview full of `undefined`.
 */
function looksLikeSchema(value: unknown): value is DesignSystemSchema {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Record<string, unknown>
  const isRecord = (v: unknown) => typeof v === 'object' && v !== null && !Array.isArray(v)
  return (
    typeof s.name === 'string' &&
    isRecord(s.colors) &&
    isRecord(s.typography) &&
    isRecord(s.spacing) &&
    isRecord(s.rounded) &&
    isRecord(s.shadows)
  )
}

/** Inflate with a hard ceiling on the output — a gzip bomb aborts mid-stream. */
function inflateCapped(bytes: Uint8Array): string | null {
  const inflate = new Inflate({ to: 'string' })
  let out = ''
  let overflowed = false
  inflate.onData = (chunk: unknown) => {
    if (overflowed) return
    out += chunk as string
    if (out.length > MAX_DECODED_BYTES) {
      overflowed = true
      out = ''
    }
  }
  inflate.push(bytes, true)
  if (overflowed || inflate.err) return null
  return out
}

/**
 * A shared schema, or `null` for anything that is not one — truncated in
 * transit, hand-edited, from a future version, or hostile. Never throws: a bad
 * link is a normal thing to receive, not an error the app should surface as a
 * crash.
 */
export function decodeSchemaHash(hash: string): DesignSystemSchema | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  if (!raw || raw.length > MAX_HASH_LENGTH) return null
  if (!/^[A-Za-z0-9_-]+$/.test(raw)) return null

  try {
    const json = inflateCapped(base64ToBytes(fromBase64Url(raw)))
    if (json === null) return null
    const parsed: unknown = JSON.parse(json)
    return looksLikeSchema(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** The full link to hand someone. `origin` defaults to the current page. */
export function shareLinkFor(schema: DesignSystemSchema, origin?: string): string {
  const base = origin ?? (typeof location === 'undefined' ? '' : location.origin)
  return `${base}/preview#${encodeSchemaHash(schema)}`
}
