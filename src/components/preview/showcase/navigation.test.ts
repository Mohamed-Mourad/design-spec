import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ComponentShowcase from '@/components/preview/ComponentShowcase.vue'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'

const at = (viewport: 'mobile' | 'tablet' | 'desktop') => {
  useDesignSystemStore().setViewport(viewport)
  return mount(ComponentShowcase, { attachTo: document.body })
}

describe('Navbar preview', () => {
  it('collapses links behind a menu toggle below md and shows them inline at md+', async () => {
    const mobile = at('mobile')
    const nav = mobile.get('[data-testid="preview-Navbar"]')
    const toggle = nav.get('[data-testid="navbar-menu-toggle"]')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(nav.find('.nb__links').exists()).toBe(false)
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    const menu = nav.get(`#${toggle.attributes('aria-controls')}`)
    expect(menu.isVisible()).toBe(true)
    expect(menu.get('[aria-current="page"]').text()).toBe('Home')
    mobile.unmount()

    const tablet = at('tablet')
    const bar = tablet.get('[data-testid="preview-Navbar"]')
    expect(bar.find('[data-testid="navbar-menu-toggle"]').exists()).toBe(false)
    expect(bar.get('.nb__links').text()).toContain('Pricing')
    tablet.unmount()
  })

  it('moves the collapse point when the responsive override moves', () => {
    const store = useDesignSystemStore()
    const md = store.schema.componentBlueprints.Navbar.responsive!.md
    store.setPath(['componentBlueprints', 'Navbar', 'responsive'], { lg: md })
    const w = at('tablet') // 768 < lg (1024) → still collapsed
    expect(w.find('[data-testid="navbar-menu-toggle"]').exists()).toBe(true)
    w.unmount()
  })

  it('repaints the active link from its token group', () => {
    const store = useDesignSystemStore()
    store.setPath(['componentBlueprints', 'Navbar', 'tokens', 'linkActive', 'textColor'], '{colors.status-success}')
    const w = at('desktop')
    expect(w.get('[data-testid="preview-Navbar"] [aria-current="page"]').attributes('style')).toContain('var(--color-status-success)')
    w.unmount()
  })
})

describe('Sidebar preview', () => {
  it('is an icon rail below md with labels kept for screen readers, expanded at md+', async () => {
    const mobile = at('mobile')
    const rail = mobile.get('[data-testid="preview-Sidebar"]')
    expect(rail.attributes('style')).toContain('width: 56px')
    expect(rail.get('[data-testid="sidebar-collapse-toggle"]').attributes('aria-expanded')).toBe('false')
    expect(rail.find('.sr-only').text()).toBe('Dashboard')
    mobile.unmount()

    const desktop = at('desktop')
    const side = desktop.get('[data-testid="preview-Sidebar"]')
    expect(side.attributes('style')).toContain('width: 220px')
    const toggle = side.get('[data-testid="sidebar-collapse-toggle"]')
    await toggle.trigger('click')
    expect(side.attributes('style')).toContain('width: 56px')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    desktop.unmount()
  })

  it('toggles the nested group with aria-expanded and marks the active item', async () => {
    const w = at('desktop')
    const multi = w.get('[data-testid="preview-Sidebar-multilevel"]')
    const group = multi.get('button.showcase__side-group')
    expect(group.attributes('aria-expanded')).toBe('true')
    const sub = multi.get(`#${group.attributes('aria-controls')}`)
    expect(sub.isVisible()).toBe(true)
    await group.trigger('click')
    expect(group.attributes('aria-expanded')).toBe('false')
    expect(sub.isVisible()).toBe(false)
    expect(multi.get('[aria-current="page"]').attributes('style')).toContain('var(--color-primary)')
    w.unmount()
  })
})

describe('Tabs preview', () => {
  it('wires tablist / tab / tabpanel and moves selection with the arrow keys', async () => {
    const w = at('desktop')
    const list = w.get('[data-testid="preview-Tabs"]')
    expect(list.attributes('role')).toBe('tablist')
    const tabs = list.findAll('[role="tab"]')
    expect(tabs).toHaveLength(3)
    expect(tabs[0].attributes('aria-selected')).toBe('true')
    expect(tabs[1].attributes('tabindex')).toBe('-1')
    const panel = w.get(`#${tabs[0].attributes('aria-controls')}`)
    expect(panel.attributes('role')).toBe('tabpanel')

    await list.trigger('keydown', { key: 'ArrowRight' })
    expect(tabs[1].attributes('aria-selected')).toBe('true')
    expect(panel.attributes('aria-labelledby')).toBe(tabs[1].attributes('id'))
    await list.trigger('keydown', { key: 'End' })
    expect(tabs[2].attributes('aria-selected')).toBe('true')
    w.unmount()
  })

  it('renders each variant from its tokens (line indicator, pill + contained active)', () => {
    const w = at('desktop')
    const line = w.get('[data-testid="preview-Tabs"]')
    expect(line.attributes('style')).toContain('border-bottom: 1px solid var(--color-surface-border)')
    expect(line.get('.tabs__indicator').attributes('style')).toContain('var(--color-primary)')
    const pill = w.get('[data-testid="preview-Tabs-pill"] [aria-selected="true"]')
    expect(pill.attributes('style')).toContain('var(--color-on-primary)')
    const contained = w.get('[data-testid="preview-Tabs-contained"]')
    expect(contained.attributes('style')).toContain('var(--color-surface-raised)')
    w.unmount()
  })

  it('honors vertical orientation only from md up', () => {
    const store = useDesignSystemStore()
    store.setPath(['componentBlueprints', 'Tabs', 'props', 'orientation', 'default'], 'vertical')
    const mobile = at('mobile')
    expect(mobile.get('[data-testid="preview-Tabs"]').attributes('aria-orientation')).toBe('horizontal')
    mobile.unmount()
    const desktop = at('desktop')
    expect(desktop.get('[data-testid="preview-Tabs"]').attributes('aria-orientation')).toBe('vertical')
    desktop.unmount()
  })
})

describe('Breadcrumbs preview', () => {
  it('is a labelled nav whose last crumb is aria-current, with the tokenized separator', () => {
    const w = at('desktop')
    const nav = w.get('[data-testid="preview-Breadcrumbs"]')
    expect(nav.element.tagName).toBe('NAV')
    expect(nav.attributes('aria-label')).toBe('Breadcrumb')
    expect(nav.get('[aria-current="page"]').text()).toBe('Tokens')
    expect(nav.findAll('a')).toHaveLength(3)
    expect(nav.get('.bc__sep').attributes('style')).toContain('var(--color-on-surface-subtle)')
    w.unmount()
  })

  it('collapses the middle crumbs to an ellipsis below md', async () => {
    const w = at('mobile')
    const nav = w.get('[data-testid="preview-Breadcrumbs"]')
    expect(nav.text()).not.toContain('Projects')
    await nav.get('.bc__more').trigger('click')
    expect(nav.text()).toContain('Projects')
    w.unmount()
  })
})

describe('Pagination preview', () => {
  it('numbers pages around the current one and marks it aria-current', async () => {
    const w = at('desktop')
    const nav = w.get('[data-testid="preview-Pagination"]')
    expect(nav.attributes('aria-label')).toBe('Pagination')
    const current = nav.get('[aria-current="page"]')
    expect(current.text()).toBe('3')
    expect(current.attributes('style')).toContain('var(--color-primary)')
    await nav.get('[aria-label="Next page"]').trigger('click')
    expect(nav.get('[aria-current="page"]').text()).toBe('4')
    expect(nav.text()).toContain('10')
    w.unmount()
  })

  it('shows prev / next around "Page x of y" below md', () => {
    const w = at('mobile')
    const nav = w.get('[data-testid="preview-Pagination"]')
    expect(nav.find('[aria-current="page"]').exists()).toBe(false)
    expect(nav.text()).toContain('Page 3 of 10')
    w.unmount()
  })
})
