import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ComponentShowcase from '@/components/preview/ComponentShowcase.vue'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'

const at = (viewport: 'mobile' | 'tablet' | 'desktop') => {
  useDesignSystemStore().setViewport(viewport)
  return mount(ComponentShowcase, { attachTo: document.body })
}

describe('Accordion preview', () => {
  it('toggles aria-expanded on buttons that control labelled regions; single mode keeps one open', async () => {
    const w = at('desktop')
    const acc = w.get('[data-testid="preview-Accordion"]')
    const triggers = acc.findAll('button[aria-controls]')
    expect(triggers).toHaveLength(3)
    expect(triggers[0].attributes('aria-expanded')).toBe('true')
    const region = acc.get(`#${triggers[0].attributes('aria-controls')}`)
    expect(region.attributes('role')).toBe('region')
    expect(region.attributes('aria-labelledby')).toBe(triggers[0].attributes('id'))

    await triggers[1].trigger('click')
    expect(triggers[1].attributes('aria-expanded')).toBe('true')
    expect(triggers[0].attributes('aria-expanded')).toBe('false')
    w.unmount()
  })

  it('multiple mode leaves earlier sections open', async () => {
    useDesignSystemStore().setPath(['componentBlueprints', 'Accordion', 'props', 'type', 'default'], 'multiple')
    const w = at('desktop')
    const triggers = w.get('[data-testid="preview-Accordion"]').findAll('button[aria-controls]')
    await triggers[1].trigger('click')
    expect(triggers[0].attributes('aria-expanded')).toBe('true')
    expect(triggers[1].attributes('aria-expanded')).toBe('true')
    w.unmount()
  })

  it('styles trigger, content and divider from their token groups', () => {
    const store = useDesignSystemStore()
    store.setPath(['componentBlueprints', 'Accordion', 'tokens', 'trigger', 'textColor'], '{colors.status-info}')
    const w = at('desktop')
    const acc = w.get('[data-testid="preview-Accordion"]')
    expect(acc.attributes('style')).toContain('var(--color-surface-border)')
    expect(acc.get('button[aria-controls]').attributes('style')).toContain('var(--color-status-info)')
    expect(acc.findAll('.acc__item')[1].attributes('style')).toContain('border-top')
    w.unmount()
  })
})

describe('Drawer preview', () => {
  it('is a labelled dialog styled from tokens, with a tokenized overlay', () => {
    const w = at('desktop')
    const panel = w.get('[data-testid="preview-Drawer"]')
    expect(panel.attributes('role')).toBe('dialog')
    expect(w.get(`#${panel.attributes('aria-labelledby')}`).text()).toBe('Filters')
    expect(panel.attributes('style')).toContain('var(--color-surface-default)')
    expect(panel.attributes('style')).toContain('width: 320px')
    expect(panel.classes()).toContain('dr__panel--right')
    const overlay = w.get('[data-testid="drawer-overlay"]')
    expect(overlay.attributes('style')).toContain('var(--color-on-surface)')
    expect(overlay.attributes('style')).toContain('opacity: 0.6')
    w.unmount()
  })

  it('closes on Escape and returns focus to the trigger; reopening focuses the dialog', async () => {
    const w = at('desktop')
    await w.get('[data-testid="preview-Drawer"]').trigger('keydown', { key: 'Escape' })
    await nextTick()
    expect(w.find('[data-testid="preview-Drawer"]').exists()).toBe(false)
    const trigger = w.get('[data-testid="drawer-trigger"]')
    expect(document.activeElement).toBe(trigger.element)
    expect(trigger.attributes('aria-expanded')).toBe('false')

    await trigger.trigger('click')
    await nextTick()
    expect(document.activeElement).toBe(w.get('[data-testid="preview-Drawer"]').element)
    await w.get('[data-testid="drawer-overlay"]').trigger('click')
    expect(w.find('[data-testid="preview-Drawer"]').exists()).toBe(false)
    w.unmount()
  })

  it('becomes a full-width bottom sheet below md', () => {
    const w = at('mobile')
    const panel = w.get('[data-testid="preview-Drawer"]')
    expect(panel.classes()).toContain('dr__panel--bottom')
    expect(panel.attributes('style')).not.toContain('width: 320px')
    expect(panel.attributes('style')).toContain('var(--rounded-xl) var(--rounded-xl) 0 0')
    w.unmount()
  })
})
