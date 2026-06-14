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

  it('ships the new default components and renders sidebar levels', () => {
    const store = useDesignSystemStore()
    for (const n of ['Dropdown', 'Radio', 'Navbar', 'Sidebar']) {
      expect(store.schema.componentBlueprints[n]).toBeTruthy()
    }
    const wrapper = mount(ComponentShowcase)
    // one-level (first variant) + multilevel both render; multilevel nests sub-items.
    expect(wrapper.find('[data-testid="preview-Sidebar"]').exists()).toBe(true)
    const multi = wrapper.get('[data-testid="preview-Sidebar-multilevel"]')
    expect(multi.text()).toContain('Profile')
    expect(wrapper.find('[data-testid="preview-Radio"]').text()).toContain('Option A')
  })

  it('clicking a component selects it for editing', async () => {
    const store = useDesignSystemStore()
    const wrapper = mount(ComponentShowcase)
    const alertGroup = wrapper.findAll('.showcase__group').find((g) => g.text().startsWith('Alert'))!
    await alertGroup.trigger('click')
    expect(store.selectedComponent).toBe('Alert')
    expect(store.activeEditorTab).toBe('components')
  })

  it('renders + styles separator, close, and action suggestions from token groups', () => {
    const store = useDesignSystemStore()
    store.setPath(['componentBlueprints', 'Alert', 'tokens', 'separator'], { borderColor: '{colors.status-info}', borderWidth: '2px' })
    store.setPath(['componentBlueprints', 'Alert', 'tokens', 'close'], { textColor: '{colors.status-error}', size: '20px' })
    store.setPath(['componentBlueprints', 'Alert', 'tokens', 'actions'], {
      cancelLabel: 'No',
      confirmLabel: 'Yes',
      rounded: '{rounded.full}',
      cancelBg: '{colors.status-warning}',
      confirmBg: '{colors.status-success}',
    })

    const wrapper = mount(ComponentShowcase)
    const el = wrapper.get('[data-testid="preview-Alert"]')

    // separator uses the edited border
    expect(el.find('hr').attributes('style')).toContain('var(--color-status-info)')
    // close uses the edited icon color
    expect(el.find('[aria-label="Close"]').attributes('style')).toContain('var(--color-status-error)')
    // action labels are editable
    expect(el.text()).toContain('No')
    expect(el.text()).toContain('Yes')
    // each action button has its own color
    const btns = el.findAll('.showcase__btn')
    expect(btns[0].attributes('style')).toContain('var(--color-status-warning)') // cancel
    expect(btns[1].attributes('style')).toContain('var(--color-status-success)') // confirm
  })

  it('Alert variants differ by status border color and render an icon + title', () => {
    const store = useDesignSystemStore()
    const wrapper = mount(ComponentShowcase)

    const info = wrapper.get('[data-testid="preview-Alert"]') // first variant = info
    const error = wrapper.get('[data-testid="preview-Alert-error"]')
    expect(info.attributes('style')).toContain('var(--color-status-info)')
    expect(error.attributes('style')).toContain('var(--color-status-error)')
    // each status also gets its own tinted background.
    expect(info.attributes('style')).toContain('var(--color-status-info-surface)')
    expect(error.attributes('style')).toContain('var(--color-status-error-surface)')

    // leading icon (svg) + a title (default content = title-message).
    expect(info.find('svg').exists()).toBe(true)
    expect(info.find('strong').text()).toBe('Information')
    void store
  })
})
