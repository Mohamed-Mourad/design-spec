import { describe, it, expect } from 'vitest'
import { matchStatus, statusVariantTokens } from '@/utils/statusMatch'

describe('matchStatus', () => {
  it('maps status names and synonyms', () => {
    expect(matchStatus('error')).toBe('error')
    expect(matchStatus('Danger')).toBe('error')
    expect(matchStatus('destructive')).toBe('error')
    expect(matchStatus('caution')).toBe('warning')
    expect(matchStatus('ok')).toBe('success')
    expect(matchStatus('successful')).toBe('success')
    expect(matchStatus('information')).toBe('info')
  })
  it('returns null for non-status names', () => {
    expect(matchStatus('primary')).toBeNull()
    expect(matchStatus('ghost')).toBeNull()
    expect(matchStatus('')).toBeNull()
  })
  it('builds surface-bg + status-border tokens', () => {
    expect(statusVariantTokens('error')).toEqual({
      backgroundColor: '{colors.status-error-surface}',
      borderColor: '{colors.status-error}',
    })
  })
})
