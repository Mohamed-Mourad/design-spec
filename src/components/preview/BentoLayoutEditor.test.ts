import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BentoLayoutEditor from '@/components/preview/BentoLayoutEditor.vue'
import { defaultBentoLayout } from '@/defaults/bento'
import type { BentoLayoutConfig } from '@/types/schema'

function editor(layout: BentoLayoutConfig = defaultBentoLayout()) {
  return mount(BentoLayoutEditor, { props: { layout } })
}

/** The layout carried by the component's most recent `update` emission. */
function lastEmit(wrapper: ReturnType<typeof editor>): BentoLayoutConfig {
  const emissions = wrapper.emitted('update')
  expect(emissions).toBeTruthy()
  return emissions![emissions!.length - 1][0] as BentoLayoutConfig
}

describe('BentoLayoutEditor', () => {
  it('emits up and never mutates the layout it was handed', async () => {
    const layout = defaultBentoLayout()
    const wrapper = editor(layout)

    await wrapper.get('[aria-label="Hide the Colors cell"]').trigger('click')

    expect(lastEmit(wrapper).cells.find((c) => c.id === 'colors')?.visible).toBe(false)
    // The prop object is untouched — the parent owns the write.
    expect(layout.cells.find((c) => c.id === 'colors')?.visible).toBe(true)
  })

  it('reorders a cell with the keyboard controls, not only by dragging', async () => {
    const wrapper = editor()
    const before = defaultBentoLayout().cells.map((c) => c.id)

    await wrapper.get('[aria-label="Move Colors up"]').trigger('click')

    const after = lastEmit(wrapper).cells.map((c) => c.id)
    expect(after[0]).toBe('colors')
    expect(after[1]).toBe(before[0])
    expect(after).toHaveLength(before.length)
  })

  it('cannot move the first cell up or the last one down', () => {
    const wrapper = editor()
    const cells = defaultBentoLayout().cells

    expect(
      wrapper.get(`[aria-label="Move ${'Identity'} up"]`).attributes('disabled'),
    ).toBeDefined()
    expect(wrapper.get('[aria-label="Move Motion down"]').attributes('disabled')).toBeDefined()
    expect(cells).toHaveLength(11)
  })

  it('reorders on drop, landing the dragged cell at the drop target', async () => {
    const wrapper = editor()
    const rows = wrapper.findAll('.ble__cell')
    const dataTransfer = { setData: () => {}, effectAllowed: '' }

    await rows[3].trigger('dragstart', { dataTransfer })
    await rows[0].trigger('dragover', { dataTransfer })
    await rows[0].trigger('drop')

    const order = lastEmit(wrapper).cells.map((c) => c.id)
    expect(order[0]).toBe('spacing')
    expect(order.slice(1, 4)).toEqual(['identity', 'colors', 'typography'])
  })

  it('toggles a cell between half and full width', async () => {
    const wrapper = editor()

    await wrapper.get('[aria-label="Spacing width"]').trigger('click')

    expect(lastEmit(wrapper).cells.find((c) => c.id === 'spacing')?.span).toBe(2)
  })

  it('stores a custom label, and clears it back to the default when emptied', async () => {
    const wrapper = editor()
    const input = wrapper.get('[aria-label="Label for the Motion cell"]')

    await input.setValue('Timing')
    await input.trigger('change')
    expect(lastEmit(wrapper).cells.find((c) => c.id === 'motion')?.customLabel).toBe('Timing')

    await input.setValue('   ')
    await input.trigger('change')
    expect(lastEmit(wrapper).cells.find((c) => c.id === 'motion')?.customLabel).toBeUndefined()
  })

  it('sets grid columns, theme and header visibility', async () => {
    const wrapper = editor()

    await wrapper.get('[aria-label="Grid columns"] button:first-child').trigger('click')
    expect(lastEmit(wrapper).gridColumns).toBe(2)

    await wrapper.get('[aria-label="Preview theme"] button:first-child').trigger('click')
    expect(lastEmit(wrapper).theme).toBe('light')

    const checks = wrapper.findAll('.ble__check input')
    await checks[0].setValue(false)
    expect(lastEmit(wrapper).showTitle).toBe(false)
  })

  it('completes a layout that was only partly configured', () => {
    const wrapper = editor({ cells: [{ id: 'motion', visible: true }] } as BentoLayoutConfig)

    // Every cell gets a row, with the configured one leading.
    expect(wrapper.findAll('.ble__cell')).toHaveLength(11)
    expect(wrapper.find('[data-testid="bento-cell-row-motion"]').exists()).toBe(true)
  })

  it('resets to the shipped layout', async () => {
    const wrapper = editor({ ...defaultBentoLayout(), gridColumns: 2, theme: 'light' })

    await wrapper.get('.ble__reset').trigger('click')

    expect(lastEmit(wrapper)).toEqual(defaultBentoLayout())
  })
})
