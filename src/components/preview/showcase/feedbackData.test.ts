import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ComponentShowcase from '@/components/preview/ComponentShowcase.vue'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'

const at = (viewport: 'mobile' | 'tablet' | 'desktop') => {
  useDesignSystemStore().setViewport(viewport)
  return mount(ComponentShowcase, { attachTo: document.body })
}

describe('Progress preview', () => {
  it('determinate exposes aria-valuenow; indeterminate omits it', () => {
    const w = at('desktop')
    const det = w.get('[data-testid="preview-Progress"]')
    expect(det.attributes('role')).toBe('progressbar')
    expect(det.attributes('aria-valuenow')).toBe('40')
    expect(det.attributes('aria-valuemax')).toBe('100')
    expect(det.get('.pr__fill').attributes('style')).toContain('width: 40%')
    expect(det.get('.pr__fill').attributes('style')).toContain('var(--color-primary)')
    const ind = w.get('[data-testid="preview-Progress-indeterminate"]')
    expect(ind.attributes('role')).toBe('progressbar')
    expect(ind.attributes('aria-valuenow')).toBeUndefined()
    expect(ind.attributes('aria-label')).toBeTruthy()
    w.unmount()
  })

  it('repaints the fill on a token edit', () => {
    useDesignSystemStore().setPath(['componentBlueprints', 'Progress', 'tokens', 'fill', 'backgroundColor'], '{colors.status-success}')
    const w = at('desktop')
    expect(w.get('[data-testid="preview-Progress"] .pr__fill').attributes('style')).toContain('var(--color-status-success)')
    w.unmount()
  })
})

describe('Empty / Error state previews', () => {
  it('EmptyState renders icon, title, description and action from tokens + prop defaults', () => {
    useDesignSystemStore().setPath(['componentBlueprints', 'EmptyState', 'props', 'title', 'default'], 'Nothing here')
    const w = at('tablet')
    const es = w.get('[data-testid="preview-EmptyState"]')
    expect(es.get('h4').text()).toBe('Nothing here')
    expect(es.get('h4').attributes('style')).toContain('var(--color-on-surface)')
    expect(es.get('button').attributes('style')).toContain('var(--color-primary)')
    expect(es.attributes('style')).toContain('var(--spacing-2xl)') // md padding override
    w.unmount()
  })

  it('ErrorState renders 404 / 500 / 403 with per-variant surfaces', () => {
    const w = at('desktop')
    expect(w.get('[data-testid="preview-ErrorState"]').text()).toContain('404')
    const server = w.get('[data-testid="preview-ErrorState-server-error"]')
    expect(server.text()).toContain('500')
    expect(server.attributes('style')).toContain('var(--color-status-error-surface)')
    expect(w.get('[data-testid="preview-ErrorState-forbidden"]').text()).toContain('403')
    w.unmount()
  })
})

describe('Table preview', () => {
  it('sorts from header buttons with aria-sort and selects rows', async () => {
    const w = at('desktop')
    const t = w.get('[data-testid="preview-Table"]')
    const nameTh = t.findAll('th[scope="col"]').find((th) => th.text().startsWith('Name'))!
    expect(nameTh.attributes('aria-sort')).toBe('ascending')
    expect(t.findAll('tbody tr')[0].text()).toContain('Ada Lovelace')
    await nameTh.get('button').trigger('click')
    expect(nameTh.attributes('aria-sort')).toBe('descending')
    expect(t.findAll('tbody tr')[0].text()).toContain('Grace Hopper')

    const selected = t.get('tbody tr[aria-selected="true"]')
    expect(selected.attributes('style')).toContain('var(--color-status-info-surface)')
    await t.get('input[aria-label="Select all rows"]').trigger('change')
    expect(t.findAll('tbody tr[aria-selected="true"]')).toHaveLength(3)
    expect(t.get('thead').attributes('style')).toContain('var(--color-surface-raised)')
    w.unmount()
  })

  it('stacks rows into label / value cards below md', () => {
    const w = at('mobile')
    const t = w.get('[data-testid="preview-Table"]')
    expect(t.find('table').exists()).toBe(false)
    expect(t.findAll('.tbl__card')).toHaveLength(3)
    expect(t.get('dt').text()).toBe('Name')
    w.unmount()
  })
})
