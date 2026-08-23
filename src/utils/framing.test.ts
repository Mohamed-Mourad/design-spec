import { describe, it, expect, afterEach, vi } from 'vitest'
import { frameVerdict } from '@/utils/framing'

/** Pretend this document is framed by `parent` (null = no ancestor known). */
function framedBy(parent: string | null) {
  vi.spyOn(window, 'top', 'get').mockReturnValue({} as Window)
  Object.defineProperty(document, 'referrer', {
    value: parent ? `${parent}/some/page` : '',
    configurable: true,
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  Object.defineProperty(document, 'referrer', { value: '', configurable: true })
})

describe('frameVerdict', () => {
  it('does not police a page that is not framed at all', () => {
    expect(frameVerdict({ allowIframe: false })).toBe('top-level')
  })

  it('refuses framing outright when the author turned embedding off', () => {
    framedBy('https://acme.example')
    expect(
      frameVerdict({ allowIframe: false, allowedOrigins: ['https://acme.example'] }),
    ).toBe('blocked-by-policy')
  })

  it('allows an origin the author named', () => {
    framedBy('https://www.notion.so')
    expect(
      frameVerdict({
        allowIframe: true,
        allowedOrigins: ['https://www.notion.so'],
        ownOrigin: 'https://designspec.app',
      }),
    ).toBe('allowed')
  })

  it('always allows the app own origin, so a same-site preview keeps working', () => {
    framedBy('https://designspec.app')
    expect(
      frameVerdict({ allowIframe: true, ownOrigin: 'https://designspec.app' }),
    ).toBe('allowed')
  })

  it('treats an empty allowlist as own-origin-only, never as every site', () => {
    framedBy('https://anyone.example')
    expect(
      frameVerdict({ allowIframe: true, allowedOrigins: [], ownOrigin: 'https://designspec.app' }),
    ).toBe('blocked-by-origin')
  })

  it('blocks an origin the author never named', () => {
    framedBy('https://evil.example')
    expect(
      frameVerdict({
        allowIframe: true,
        allowedOrigins: ['https://www.notion.so'],
        ownOrigin: 'https://designspec.app',
      }),
    ).toBe('blocked-by-origin')
  })

  it('treats an unknown framing origin as not allowed, rather than assuming', () => {
    framedBy(null)
    expect(
      frameVerdict({ allowIframe: true, allowedOrigins: ['https://www.notion.so'] }),
    ).toBe('blocked-by-origin')
  })

  it('ignores a trailing slash on either side of the comparison', () => {
    framedBy('https://acme.example')
    expect(
      frameVerdict({
        allowIframe: true,
        allowedOrigins: ['https://acme.example/'],
        ownOrigin: 'https://designspec.app',
      }),
    ).toBe('allowed')
  })
})
