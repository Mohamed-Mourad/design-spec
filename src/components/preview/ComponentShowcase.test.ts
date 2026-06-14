import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ComponentShowcase from '@/components/preview/ComponentShowcase.vue'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'

describe('ComponentShowcase — responsive preview', () => {
  it('reflects a Button tablet padding override at the 768px viewport', () => {
    const store = useDesignSystemStore()
    store.setPath(['componentBlueprints', 'Button', 'responsive', 'md', 'tokens', 'paddingX'], '{spacing.lg}')

    store.setViewport('mobile')
    let wrapper = mount(ComponentShowcase)
    expect(wrapper.get('[data-testid="preview-Button"]').attributes('style')).toContain('var(--spacing-md)')

    store.setViewport('tablet')
    wrapper = mount(ComponentShowcase)
    expect(wrapper.get('[data-testid="preview-Button"]').attributes('style')).toContain('var(--spacing-lg)')
  })

  it('renders every Button variant with its own overrides', () => {
    const store = useDesignSystemStore()
    const wrapper = mount(ComponentShowcase)
    // primary (first) + the three variant overrides each get an element.
    expect(wrapper.find('[data-testid="preview-Button"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="preview-Button-secondary"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="preview-Button-destructive"]').exists()).toBe(true)
    // secondary overrides the background to the raised surface.
    expect(wrapper.get('[data-testid="preview-Button-secondary"]').attributes('style')).toContain(
      'var(--color-surface-raised)',
    )
    // destructive overrides to the error color.
    expect(wrapper.get('[data-testid="preview-Button-destructive"]').attributes('style')).toContain(
      'var(--color-status-error)',
    )
    void store
  })

  it('Alert variants differ by status border color and render an icon + title', () => {
    const store = useDesignSystemStore()
    const wrapper = mount(ComponentShowcase)

    const info = wrapper.get('[data-testid="preview-Alert"]') // first variant = info
    const error = wrapper.get('[data-testid="preview-Alert-error"]')
    expect(info.attributes('style')).toContain('var(--color-status-info)')
    expect(error.attributes('style')).toContain('var(--color-status-error)')

    // leading icon (svg) + a title (default content = title-message).
    expect(info.find('svg').exists()).toBe(true)
    expect(info.find('strong').text()).toBe('Information')
    void store
  })
})
