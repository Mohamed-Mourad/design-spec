import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ColorPicker from '@/components/editors/ColorPicker.vue'

describe('ColorPicker', () => {
  it('emits the color when a hex is typed/pasted into the field', async () => {
    const wrapper = mount(ColorPicker, { props: { modelValue: '#000000' } })
    const hex = wrapper.get('input[aria-label="Hex value"]')
    await hex.setValue('#3b6ef5')
    const emits = wrapper.emitted('update:modelValue')
    expect(emits).toBeTruthy()
    expect(emits![emits!.length - 1]).toEqual(['#3b6ef5'])
  })

  it('emits an alpha hex when opacity is reduced', async () => {
    const wrapper = mount(ColorPicker, { props: { modelValue: '#ff0000' } })
    const op = wrapper.get('input[aria-label="Opacity percent"]')
    ;(op.element as HTMLInputElement).value = '50'
    await op.trigger('change')
    const all = wrapper.emitted('update:modelValue')!
    const last = all[all.length - 1][0] as string
    expect(last.toLowerCase()).toMatch(/^#ff0000(7f|80)$/)
  })
})
