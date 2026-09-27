import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BlueprintEditor from '@/components/editors/BlueprintEditor.vue'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'

describe('BlueprintEditor', () => {
  it('auto-applies status colors when a variant is named after a status', async () => {
    const store = useDesignSystemStore()
    const wrapper = mount(BlueprintEditor, { props: { name: 'Button' } })

    await wrapper.findAll('.be__subtab').find((b) => b.text() === 'Variants')!.trigger('click')
    const addRow = wrapper.findAll('.be__add').find((d) => d.find('input').attributes('placeholder') === 'add variants')!
    await addRow.get('input').setValue('danger')
    await addRow.get('button').trigger('click')

    const tokens = store.schema.componentBlueprints.Button.tokens.danger
    expect(tokens.backgroundColor).toBe('{colors.status-error-surface}')
    expect(tokens.borderColor).toBe('{colors.status-error}')
  })

  it('does not seed tokens for a non-status variant', async () => {
    const store = useDesignSystemStore()
    const wrapper = mount(BlueprintEditor, { props: { name: 'Button' } })

    await wrapper.findAll('.be__subtab').find((b) => b.text() === 'Variants')!.trigger('click')
    const addRow = wrapper.findAll('.be__add').find((d) => d.find('input').attributes('placeholder') === 'add variants')!
    await addRow.get('input').setValue('fancy')
    await addRow.get('button').trigger('click')

    expect(store.schema.componentBlueprints.Button.variants).toContain('fancy')
    expect(store.schema.componentBlueprints.Button.tokens.fancy).toBeUndefined()
  })
})

describe('BlueprintEditor — Tier 2 blueprints', () => {
  const tab = async (wrapper: ReturnType<typeof mount>, name: string) =>
    wrapper.findAll('.be__subtab').find((b) => b.text() === name)!.trigger('click')

  it('edits a compound-part token group (Tabs indicator)', async () => {
    const store = useDesignSystemStore()
    const wrapper = mount(BlueprintEditor, { props: { name: 'Tabs' } })
    const heads = wrapper.findAll('.be__list-head').map((h) => h.text())
    for (const part of ['tab', 'tabActive', 'indicator', 'panel']) expect(heads).toContain(`${part} (part)`)

    const indicator = wrapper.findAll('.be__list-head').find((h) => h.text() === 'indicator (part)')!
    const editor = indicator.element.nextElementSibling as HTMLElement
    const height = [...editor.querySelectorAll('input')].find((i) => i.getAttribute('aria-label') === 'height')!
    height.value = '4px'
    height.dispatchEvent(new Event('change'))
    expect(store.schema.componentBlueprints.Tabs.tokens.indicator.height).toBe('4px')
  })

  it('edits a prop default the preview renders from (Drawer side, Pagination page)', async () => {
    const store = useDesignSystemStore()
    const drawer = mount(BlueprintEditor, { props: { name: 'Drawer' } })
    await tab(drawer, 'Props')
    await drawer.get('select[aria-label="side default"]').setValue('left')
    expect(store.schema.componentBlueprints.Drawer.props.side.default).toBe('left')

    const pager = mount(BlueprintEditor, { props: { name: 'Pagination' } })
    await tab(pager, 'Props')
    const page = pager.get('input[aria-label="page default"]')
    await page.setValue('7')
    await page.trigger('change')
    expect(store.schema.componentBlueprints.Pagination.props.page.default).toBe(7)
  })

  it('moves the Navbar collapse point by editing its responsive layout note', async () => {
    const store = useDesignSystemStore()
    const wrapper = mount(BlueprintEditor, { props: { name: 'Navbar' } })
    await tab(wrapper, 'Responsive')
    await wrapper.get('[data-testid="responsive-bp-select"]').setValue('md')
    const note = wrapper.get('[data-testid="responsive-layout-note"]')
    expect((note.element as HTMLInputElement).value).toContain('inline')
    await note.setValue('')
    await note.trigger('change')
    expect(store.schema.componentBlueprints.Navbar.responsive?.md?.layout).toBeUndefined()

    await wrapper.get('[data-testid="responsive-bp-select"]').setValue('lg')
    const lgNote = wrapper.get('[data-testid="responsive-layout-note"]')
    await lgNote.setValue('Links inline')
    await lgNote.trigger('change')
    expect(store.schema.componentBlueprints.Navbar.responsive?.lg?.layout).toBe('Links inline')
  })
})
