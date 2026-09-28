import { describe, it, expect } from 'vitest'
import { projectSlug } from '@/utils/projectSlug'

// Same cases as packages/cli/src/sync/merge.test.ts — the two must agree.
describe('projectSlug', () => {
  it.each([
    ['Acme UI', 'acme-ui'],
    ['  Design  Spec!! ', 'design-spec'],
    ['Café Système', 'cafe-systeme'],
    ['a'.repeat(80), 'a'.repeat(64)],
  ])('%s → %s', (name, slug) => {
    expect(projectSlug(name)).toBe(slug)
  })
})
