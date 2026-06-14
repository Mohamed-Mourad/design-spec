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
})
