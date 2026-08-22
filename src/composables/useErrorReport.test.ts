import { describe, it, expect, beforeEach } from 'vitest'
import { useErrorReport } from './useErrorReport'

describe('useErrorReport', () => {
  beforeEach(() => useErrorReport().closeReport())

  it('openBehaviorReport opens in behavior mode with no error + the trace', () => {
    const r = useErrorReport()
    r.openBehaviorReport([{ ts: 1, action: 'updateToken', args: ['colors', 'primary'] }])
    expect(r.isOpen.value).toBe(true)
    expect(r.capturedError.value).toBeNull()
    expect(r.capturedKind.value).toBe('behavior')
    expect(r.capturedTrace.value).toHaveLength(1)
  })

  it('openReport opens in error mode with the error attached', () => {
    const r = useErrorReport()
    r.openReport(new Error('boom'), [])
    expect(r.capturedKind.value).toBe('error')
    expect(r.capturedError.value?.message).toBe('boom')
  })

  it('closeReport resets to error-kind defaults', () => {
    const r = useErrorReport()
    r.openBehaviorReport([{ ts: 1, action: 'x', args: [] }])
    r.closeReport()
    expect(r.isOpen.value).toBe(false)
    expect(r.capturedKind.value).toBe('error')
    expect(r.capturedError.value).toBeNull()
    expect(r.capturedTrace.value).toHaveLength(0)
  })
})
