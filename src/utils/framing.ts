// framing.ts — who is allowed to put this page in an iframe.
//
// This is a *second* control, not the primary one. Framing is properly refused
// by a `frame-ancestors` header, which only the host serving the document can
// set — and a static host cannot vary it per proposal, because it does not know
// which proposal it is about to serve. So the page enforces the per-proposal
// half itself, and it is honest about being defeatable by anyone who can strip
// JavaScript. It is there to keep an embed pointed where its author meant it,
// not to protect a secret: everything on the page is public by construction.

export type FrameVerdict = 'top-level' | 'allowed' | 'blocked-by-policy' | 'blocked-by-origin'

/** True when this document is not the top-level one in its tab. */
export function isFramed(): boolean {
  try {
    return window.self !== window.top
  } catch {
    // A cross-origin parent throws on access, which is itself the answer.
    return true
  }
}

/**
 * The origin of the page doing the framing.
 *
 * `location.ancestorOrigins` is the direct answer where it exists; the referrer
 * is the fallback, and it can be absent under a strict referrer policy. Absent
 * is treated as unknown, not as allowed.
 */
export function framingOrigin(): string | null {
  const ancestors = (location as Location & { ancestorOrigins?: DOMStringList }).ancestorOrigins
  if (ancestors?.length) return ancestors[ancestors.length - 1]
  if (!document.referrer) return null
  try {
    return new URL(document.referrer).origin
  } catch {
    return null
  }
}

/**
 * Whether this page may render where it currently is.
 *
 * An empty allowlist is not a wildcard: it means only the app's own origin, so
 * an author who never named a site has not accidentally published to every
 * site. Naming origins is what opens it, one at a time.
 */
export function frameVerdict(options: {
  allowIframe: boolean
  allowedOrigins?: string[]
  ownOrigin?: string
}): FrameVerdict {
  if (!isFramed()) return 'top-level'
  if (!options.allowIframe) return 'blocked-by-policy'

  const own = options.ownOrigin ?? (typeof location === 'undefined' ? '' : location.origin)
  const allowed = new Set([own, ...(options.allowedOrigins ?? [])].map((o) => o.replace(/\/$/, '')))

  const parent = framingOrigin()
  if (!parent) return 'blocked-by-origin'
  return allowed.has(parent.replace(/\/$/, '')) ? 'allowed' : 'blocked-by-origin'
}
