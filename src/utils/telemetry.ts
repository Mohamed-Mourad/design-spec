const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
const IS_DEV = import.meta.env.DEV

const SESSION_ID = (() => {
  const KEY = 'dsa-sid'
  let id = sessionStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(KEY, id)
  }
  return id
})()

// The ingestion endpoints live under the versioned API base like every other
// route; see design-spec-backend/docs/telemetry-contract.md.
const BASE = '/api/v1/telemetry'

function post(path: string, body: unknown): void {
  if (!API_URL) {
    if (IS_DEV) console.debug('[telemetry]', path, body)
    return
  }
  const data = JSON.stringify(body)
  // sendBeacon survives page unload; falls back to fetch with keepalive
  if (navigator.sendBeacon) {
    navigator.sendBeacon(`${API_URL}${path}`, data)
  } else {
    fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: data,
      keepalive: true,
    }).catch(() => {})
  }
}

export function captureError(error: Error, context?: Record<string, unknown>): void {
  post(`${BASE}/error`, {
    message: error.message,
    stack: error.stack,
    context,
    session_id: SESSION_ID,
    url: location.pathname,
    ts: Date.now(),
  })
}

/**
 * Which kind of user report this is:
 * - `error`    — the user elaborated on a crash the ErrorBoundary caught.
 * - `behavior` — the user proactively flagged weird/unexpected behavior that did
 *                NOT throw (errors are already captured automatically). The typed
 *                comment is the signal; the action trace gives it context.
 */
export type ReportKind = 'error' | 'behavior'

export function captureUserReport(
  userMessage: string,
  error: Error | null,
  context?: Record<string, unknown>,
  kind: ReportKind = 'error',
): void {
  // Same telemetry stream as automatic errors; `report_kind` lets the backend
  // separate proactive behavior reports from post-crash reports.
  post(`${BASE}/error`, {
    message: error?.message ?? (kind === 'behavior' ? 'User-reported behavior' : 'User-reported issue'),
    stack: error?.stack ?? null,
    user_message: userMessage,
    user_reported: true,
    report_kind: kind,
    context,
    session_id: SESSION_ID,
    url: location.pathname,
    ts: Date.now(),
  })
}

export function trackEvent(event: string, properties?: Record<string, unknown>): void {
  post(`${BASE}/event`, {
    event,
    properties,
    session_id: SESSION_ID,
    ts: Date.now(),
  })
}
