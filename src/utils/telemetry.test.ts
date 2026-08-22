import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// telemetry.ts reads VITE_API_URL + builds SESSION_ID at module load, so each
// test stubs the env and re-imports a fresh module.
describe('captureUserReport — report_kind tagging', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_API_URL', 'https://api.test')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('tags a behavior report and defaults its message', async () => {
    const beacon = vi.fn((_url: string, _body: string) => true)
    vi.stubGlobal('navigator', { sendBeacon: beacon })
    const { captureUserReport } = await import('./telemetry')

    captureUserReport('preview did not update after a radius change', null, { schemaName: 'X' }, 'behavior')

    expect(beacon).toHaveBeenCalledOnce()
    const [url, body] = beacon.mock.calls[0] as [string, string]
    expect(url).toContain('/telemetry/error')
    const payload = JSON.parse(body)
    expect(payload.report_kind).toBe('behavior')
    expect(payload.user_reported).toBe(true)
    expect(payload.message).toBe('User-reported behavior')
    expect(payload.user_message).toBe('preview did not update after a radius change')
    expect(payload.context.schemaName).toBe('X')
  })

  it('defaults to error kind and carries the error message', async () => {
    const beacon = vi.fn((_url: string, _body: string) => true)
    vi.stubGlobal('navigator', { sendBeacon: beacon })
    const { captureUserReport } = await import('./telemetry')

    captureUserReport('clicked save', new Error('save failed'))

    const payload = JSON.parse((beacon.mock.calls[0] as [string, string])[1])
    expect(payload.report_kind).toBe('error')
    expect(payload.message).toBe('save failed')
  })
})
