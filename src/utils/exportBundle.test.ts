import { describe, it, expect } from 'vitest'
import { bundleFiles, bundleName, packBundle, serializeSchema, SCHEMA_FILENAME } from '@/utils/exportBundle'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import { defaultSchema } from '@/defaults/schema'

// The ZIP is the Free tier's whole deliverable, so what it contains is a
// contract: the committed schema in the CLI's canonical form, plus every file
// the compiler emits, at their real (possibly nested) paths.

describe('exportBundle', () => {
  it('leads with the schema, then every compiled output', () => {
    const store = useDesignSystemStore()
    const files = bundleFiles(store.schema, store.outputFiles)

    expect(files[0].filename).toBe(SCHEMA_FILENAME)
    expect(files.map((f) => f.filename)).toContain('DESIGN.md')
    expect(files.map((f) => f.filename)).toContain('SKILL.md')
    expect(files.length).toBe(store.outputFiles.length + 1)
  })

  it('serializes the schema in the CLI canonical form', () => {
    const out = serializeSchema(defaultSchema)
    expect(out.endsWith('\n')).toBe(true)
    expect(out).toContain('\n  "version"') // 2-space indent
    expect(JSON.parse(out)).toEqual(defaultSchema)
  })

  it('names the archive after the design system', () => {
    expect(bundleName('Clean Professional')).toBe('clean-professional.zip')
    expect(bundleName('Acme  Storefront!')).toBe('acme-storefront.zip')
    expect(bundleName('   ')).toBe('design-spec.zip')
  })

  it('packs a readable archive containing the whole bundle', async () => {
    const store = useDesignSystemStore()
    const zip = packBundle(store.schema, store.outputFiles)

    const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir)
    expect(names).toContain(SCHEMA_FILENAME)
    expect(names).toContain('DESIGN.md')
    expect(names).toContain('SKILL.md')
    expect(names).toContain('tailwind.config.js')
    expect(names).toContain('tokens.css')
    // Nested component outputs keep their paths.
    expect(names.some((n) => n.startsWith('components/'))).toBe(true)

    const schemaText = await zip.file(SCHEMA_FILENAME)!.async('string')
    expect(JSON.parse(schemaText).name).toBe(store.schema.name)
  })

  it('exports the imported system, not the baseline preset', async () => {
    const store = useDesignSystemStore()
    const imported = structuredClone(defaultSchema)
    imported.name = 'Acme Storefront'
    imported.colors.brand = '#C8813D'
    store.applyImport(imported, {
      repoFullName: 'acme/storefront',
      branch: 'main',
      commitSha: 'abc1234',
      importSessionId: 'sess-1',
      signals: [],
      usedFallback: false,
      unparseableLayers: [],
      states: { colors: { brand: 'extracted' } },
      scannedAt: 0,
    })

    const zip = packBundle(store.schema, store.outputFiles)
    const tokens = await zip.file('tokens.css')!.async('string')
    expect(tokens).toContain('#C8813D')
    const design = await zip.file('DESIGN.md')!.async('string')
    expect(design).toContain('Acme Storefront')
  })
})
