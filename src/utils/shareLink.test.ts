import { describe, it, expect } from 'vitest'
import { gzip } from 'pako'
import {
  decodeSchemaHash,
  encodeSchemaHash,
  shareLinkFor,
  ShareLinkTooLargeError,
  MAX_HASH_LENGTH,
} from '@/utils/shareLink'
import { defaultSchema } from '@/defaults/schema'
import type { DesignSystemSchema } from '@/types/schema'

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

describe('encodeSchemaHash / decodeSchemaHash', () => {
  it('round-trips a schema through the URL fragment', () => {
    const hash = encodeSchemaHash(defaultSchema)
    expect(decodeSchemaHash(hash)).toEqual(defaultSchema)
  })

  it('emits only URL-safe characters, so the link survives a paste', () => {
    expect(encodeSchemaHash(defaultSchema)).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('compresses — the fragment is a fraction of the raw JSON', () => {
    const hash = encodeSchemaHash(defaultSchema)
    expect(hash.length).toBeLessThan(JSON.stringify(defaultSchema).length / 2)
  })

  it('accepts a leading # so callers can pass location.hash straight in', () => {
    const hash = encodeSchemaHash(defaultSchema)
    expect(decodeSchemaHash(`#${hash}`)?.name).toBe(defaultSchema.name)
  })

  it('refuses to encode a system too large to paste into a link', () => {
    const huge = structuredClone(defaultSchema) as DesignSystemSchema
    // Random keys, because gzip would otherwise crush a repeated one to nothing.
    for (let i = 0; i < 40_000; i++) {
      huge.colors[`c${i}-${Math.random().toString(36).slice(2)}`] = '#abcdef'
    }
    expect(() => encodeSchemaHash(huge)).toThrow(ShareLinkTooLargeError)
  })

  it.each([
    ['empty', ''],
    ['not base64url', 'not base64!!'],
    ['not gzip', toBase64Url(new Uint8Array([1, 2, 3, 4]))],
    ['gzip of non-JSON', toBase64Url(gzip('definitely not json'))],
    ['gzip of a JSON non-object', toBase64Url(gzip('42'))],
    ['gzip of an object that is not a schema', toBase64Url(gzip('{"name":"x"}'))],
    ['over the length cap', 'A'.repeat(MAX_HASH_LENGTH + 1)],
  ])('returns null for a %s fragment instead of throwing', (_label, hash) => {
    expect(decodeSchemaHash(hash)).toBeNull()
  })

  it('rejects a gzip bomb rather than inflating it into the tab', () => {
    // ~8MB of zeros compresses to a few kB; the decoder must abort mid-stream.
    const bomb = toBase64Url(gzip(new Uint8Array(8 * 1024 * 1024)))
    expect(bomb.length).toBeLessThan(MAX_HASH_LENGTH)
    expect(decodeSchemaHash(bomb)).toBeNull()
  })
})

describe('shareLinkFor', () => {
  it('builds a /preview link whose fragment carries the whole system', () => {
    const url = shareLinkFor(defaultSchema, 'https://designspec.app')
    expect(url.startsWith('https://designspec.app/preview#')).toBe(true)
    expect(decodeSchemaHash(new URL(url).hash)?.name).toBe(defaultSchema.name)
  })
})
