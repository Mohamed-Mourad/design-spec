import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BentoPreview from '@/components/preview/bento/BentoPreview.vue'
import { defaultBentoLayout, resolveBentoLayout, BENTO_CELL_IDS } from '@/defaults/bento'
import { defaultSchema } from '@/defaults/schema'
import type { BentoLayoutConfig, DesignSystemSchema } from '@/types/schema'

function schemaWith(patch: Partial<DesignSystemSchema> = {}): DesignSystemSchema {
  return { ...structuredClone(defaultSchema), ...patch }
}

const cellIds = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('[data-bento-cell]').map((c) => c.attributes('data-bento-cell'))

describe('resolveBentoLayout', () => {
  it('completes a partial stored layout with the cells it never configured', () => {
    const stored = { cells: [{ id: 'colors', visible: false }], gridColumns: 3 } as BentoLayoutConfig
    const layout = resolveBentoLayout(stored)

    expect(layout.cells).toHaveLength(BENTO_CELL_IDS.length)
    // The author's own entry wins, and leads — the rest fall in behind it.
    expect(layout.cells[0]).toEqual({ id: 'colors', visible: false })
    expect(layout.gridColumns).toBe(3)
    expect(layout.theme).toBe(defaultBentoLayout().theme)
  })

  it('drops a cell id the schema no longer knows about', () => {
    const stored = {
      ...defaultBentoLayout(),
      cells: [{ id: 'retired-cell', visible: true }],
    } as unknown as BentoLayoutConfig

    expect(resolveBentoLayout(stored).cells.map((c) => c.id)).not.toContain('retired-cell')
  })
})

describe('BentoPreview', () => {
  it('renders every default cell from the schema alone', () => {
    const wrapper = mount(BentoPreview, { props: { schema: schemaWith() } })

    expect(cellIds(wrapper)).toEqual([...BENTO_CELL_IDS])
    expect(wrapper.get('[data-testid="bento-preview"]').text()).toContain(defaultSchema.name)
  })

  it('is presentational — the layout prop, not the store, decides what shows', () => {
    const layout: BentoLayoutConfig = {
      ...defaultBentoLayout(),
      cells: [
        { id: 'identity', visible: true, span: 2 },
        { id: 'colors', visible: false },
        { id: 'motion', visible: true, customLabel: 'Timing' },
      ],
      gridColumns: 2,
    }
    const wrapper = mount(BentoPreview, { props: { schema: schemaWith(), layout } })

    // Hidden cells are absent, not merely dimmed; unconfigured ones still append.
    expect(cellIds(wrapper)).not.toContain('colors')
    expect(cellIds(wrapper).slice(0, 2)).toEqual(['identity', 'motion'])
    expect(wrapper.text()).toContain('Timing')
    expect(wrapper.get('[data-testid="bento-preview"]').attributes('style')).toContain(
      '--bento-columns: 2',
    )
  })

  it('paints the schema tokens as CSS custom properties so cells resolve refs', () => {
    const schema = schemaWith()
    schema.colors.primary = '#123456'
    const style = mount(BentoPreview, { props: { schema } })
      .get('[data-testid="bento-preview"]')
      .attributes('style')

    expect(style).toContain('--color-primary: #123456')
    expect(style).toContain('--spacing-md')
  })

  it('swaps in dark-mode color overrides when the layout theme is dark', () => {
    const schema = schemaWith()
    schema.darkMode.colors.primary = '#000fff'
    const layout = { ...defaultBentoLayout(), theme: 'dark' as const }

    const style = mount(BentoPreview, { props: { schema, layout } })
      .get('[data-testid="bento-preview"]')
      .attributes('style')

    expect(style).toContain('--color-primary: #000fff')
  })

  it('applies proposal branding and can drop the Design Spec footer', () => {
    const wrapper = mount(BentoPreview, {
      props: {
        schema: schemaWith(),
        branding: {
          companyName: 'Acme',
          accentColor: '#ff0000',
          hideDesignSpecBranding: true,
        },
      },
    })

    expect(wrapper.text()).toContain('Acme')
    expect(wrapper.text()).not.toContain('Made with Design Spec')
    expect(wrapper.get('[data-testid="bento-preview"]').attributes('style')).toContain(
      '--bento-accent: #ff0000',
    )
  })

  it('reads the layout off schema.presentation when no prop overrides it', () => {
    const schema = schemaWith()
    schema.presentation = {
      ogImageStrategy: 'client-canvas',
      bentoLayout: { ...defaultBentoLayout(), cells: [{ id: 'typography', visible: true }] },
    }

    expect(cellIds(mount(BentoPreview, { props: { schema } }))[0]).toBe('typography')
  })
})
