import { describe, it, expect } from 'vitest'
import { defaultSchema, type DesignSystemSchema } from '@design-spec/compiler'
import { diffLayer, mergeForPush, mergeForSync, projectSlug, sameSchema } from './merge.js'

// The §20 layer policy, pinned without any I/O:
//   presentation → remote wins (removal too)
//   export       → local wins unless --force
//   tokens       → local is canonical; a pull reports, never applies

function schema(patch: (s: DesignSystemSchema) => void = () => {}): DesignSystemSchema {
  const s = structuredClone(defaultSchema)
  patch(s)
  return s
}

const remotePresentation: DesignSystemSchema['presentation'] = {
  ogImageStrategy: 'server-render',
  proposalBranding: { companyName: 'Acme', accentColor: '#FF0066' },
}

describe('mergeForSync', () => {
  it('takes remote presentation, keeps local export, leaves tokens alone', () => {
    const local = schema((s) => {
      s.presentation = { ogImageStrategy: 'client-canvas' }
      s.export.cssVariablePrefix = 'ds-'
    })
    const remote = schema((s) => {
      s.presentation = remotePresentation
      s.export.cssVariablePrefix = 'web-'
      s.colors.primary = '#000001'
    })

    const m = mergeForSync(local, remote)

    expect(m.schema.presentation).toEqual(remotePresentation)
    expect(m.schema.export.cssVariablePrefix).toBe('ds-')
    expect(m.schema.colors.primary).toBe(local.colors.primary)
    expect(m.exportTaken).toBe(false)
    expect(m.exportDiff).toEqual([{ path: 'export.cssVariablePrefix', old: '"ds-"', new: '"web-"' }])
    expect(m.tokensNotPulled.changes.map((c) => c.path)).toEqual(['colors.primary'])
    expect(m.presentation.map((c) => c.path)).toEqual([
      'presentation.ogImageStrategy',
      'presentation.proposalBranding.accentColor',
      'presentation.proposalBranding.companyName',
    ])
    expect(m.changed).toBe(true)
  })

  it('--force also takes the remote export', () => {
    const local = schema((s) => (s.export.cssVariablePrefix = 'ds-'))
    const remote = schema((s) => (s.export.cssVariablePrefix = 'web-'))
    const m = mergeForSync(local, remote, { force: true })
    expect(m.schema.export.cssVariablePrefix).toBe('web-')
    expect(m.exportTaken).toBe(true)
    expect(m.changed).toBe(true)
  })

  it('remote wins on removal: a presentation the dashboard dropped is dropped locally', () => {
    const local = schema((s) => (s.presentation = remotePresentation))
    const remote = schema((s) => delete s.presentation)
    const m = mergeForSync(local, remote)
    expect(m.schema.presentation).toBeUndefined()
    expect('presentation' in m.schema).toBe(false)
    expect(m.changed).toBe(true)
  })

  it('is a no-op when presentation already matches and export is kept', () => {
    const local = schema((s) => (s.presentation = remotePresentation))
    const remote = schema((s) => {
      s.presentation = structuredClone(remotePresentation)
      s.export.frameworks = ['flutter']
    })
    const m = mergeForSync(local, remote)
    expect(m.changed).toBe(false)
    expect(m.schema.export.frameworks).toEqual(local.export.frameworks)
  })

  it('does not mutate its inputs', () => {
    const local = schema()
    const remote = schema((s) => (s.presentation = remotePresentation))
    const before = JSON.stringify(local)
    const m = mergeForSync(local, remote, { force: true })
    expect(JSON.stringify(local)).toBe(before)
    m.schema.presentation!.ogImageStrategy = 'client-canvas'
    expect(remote.presentation!.ogImageStrategy).toBe('server-render')
  })
})

describe('mergeForPush', () => {
  it('sends local tokens and export but keeps the dashboard presentation', () => {
    const local = schema((s) => {
      s.colors.primary = '#123456'
      s.export.cssVariablePrefix = 'ds-'
      s.presentation = { ogImageStrategy: 'client-canvas' }
    })
    const remote = schema((s) => (s.presentation = remotePresentation))

    const m = mergeForPush(local, remote)

    expect(m.created).toBe(false)
    expect(m.schema.presentation).toEqual(remotePresentation)
    expect(m.schema.colors.primary).toBe('#123456')
    expect(m.schema.export.cssVariablePrefix).toBe('ds-')
    expect(m.tokens.changes).toEqual([{ path: 'colors.primary', old: remote.colors.primary, new: '#123456' }])
    expect(m.exportDiff.map((c) => c.path)).toEqual(['export.cssVariablePrefix'])
    expect(m.presentationKept.length).toBeGreaterThan(0)
  })

  it('keeps an absent dashboard presentation absent', () => {
    const local = schema((s) => (s.presentation = remotePresentation))
    const remote = schema((s) => delete s.presentation)
    expect(mergeForPush(local, remote).schema.presentation).toBeUndefined()
  })

  it('seeds a new project from the local schema, presentation included', () => {
    const local = schema((s) => (s.presentation = remotePresentation))
    const m = mergeForPush(local, null)
    expect(m.created).toBe(true)
    expect(m.schema).toEqual(local)
    expect(m.schema).not.toBe(local)
  })
})

describe('diffLayer', () => {
  it('reports adds, removes and changes by leaf path, arrays as leaves', () => {
    expect(diffLayer({ a: 1, b: [1, 2], c: { d: 'x' } }, { a: 2, b: [1, 2], e: true }, 'p')).toEqual([
      { path: 'p.a', old: '1', new: '2' },
      { path: 'p.c.d', old: '"x"' },
      { path: 'p.e', new: 'true' },
    ])
  })
})

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

describe('sameSchema', () => {
  it('ignores key order at every depth', () => {
    const reorder = (v: unknown): unknown =>
      Array.isArray(v)
        ? v.map(reorder)
        : v && typeof v === 'object'
          ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reorder(x)]))
          : v
    expect(sameSchema(schema(), reorder(schema()))).toBe(true)
  })

  it('ignores undefined fields, which never reach the wire', () => {
    expect(sameSchema(schema(), { ...schema(), presentation: undefined })).toBe(true)
  })

  it('sees a changed leaf, an added key and a reordered array', () => {
    expect(sameSchema(schema(), schema((s) => (s.colors.primary = '#000001')))).toBe(false)
    expect(sameSchema(schema(), schema((s) => (s.presentation = remotePresentation)))).toBe(false)
    expect(sameSchema(schema(), schema((s) => s.export.frameworks.reverse()))).toBe(
      schema().export.frameworks.length < 2,
    )
  })

  it('a push merge of a pulled schema equals the remote', () => {
    const remote = schema((s) => (s.presentation = remotePresentation))
    const pulled = mergeForSync(schema(), remote).schema
    expect(sameSchema(mergeForPush(pulled, remote).schema, remote)).toBe(true)
  })
})
