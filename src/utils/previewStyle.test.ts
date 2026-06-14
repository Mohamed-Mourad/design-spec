import { describe, it, expect } from 'vitest'
import { refToVar, resolveComponentStyle } from '@/utils/previewStyle'
import { defaultSchema } from '@/defaults/schema'
import type { ComponentBlueprint, DesignSystemSchema } from '@/types/schema'

describe('refToVar', () => {
  it('maps token refs to preview CSS vars', () => {
    expect(refToVar('{colors.primary}')).toBe('var(--color-primary)')
    expect(refToVar('{spacing.lg}')).toBe('var(--spacing-lg)')
    expect(refToVar('{rounded.md}')).toBe('var(--rounded-md)')
    expect(refToVar('{shadows.sm}')).toBe('var(--shadow-sm)')
  })
  it('passes raw values through', () => {
    expect(refToVar('12px')).toBe('12px')
    expect(refToVar('#fff')).toBe('#fff')
  })
})

function buttonWith(responsive: ComponentBlueprint['responsive']): DesignSystemSchema {
  return {
    ...defaultSchema,
    componentBlueprints: {
      Button: { ...defaultSchema.componentBlueprints.Button, responsive },
    },
  }
}

describe('resolveComponentStyle', () => {
  it('uses base padding below the breakpoint and the override at/above it', () => {
    const schema = buttonWith({ md: { tokens: { paddingX: '{spacing.lg}' } } })
    const bp = schema.componentBlueprints.Button

    const mobile = resolveComponentStyle(schema, bp, 375)
    expect(mobile.style.paddingLeft).toBe('var(--spacing-md)') // base

    const tablet = resolveComponentStyle(schema, bp, 768)
    expect(tablet.style.paddingLeft).toBe('var(--spacing-lg)') // md override applied
  })

  it('marks a component hidden when an override sets visibleAt:false', () => {
    const schema = buttonWith({ md: { visibleAt: false } })
    const bp = schema.componentBlueprints.Button
    expect(resolveComponentStyle(schema, bp, 375).hidden).toBe(false)
    expect(resolveComponentStyle(schema, bp, 768).hidden).toBe(true)
  })
})
