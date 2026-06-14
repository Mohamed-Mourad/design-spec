import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PreviewInspector from '@/components/preview/PreviewInspector.vue'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'

describe('PreviewInspector', () => {
  it('enabling a suggestion creates its editable token group', async () => {
    const store = useDesignSystemStore()
    store.selectComponent('Alert')
    const wrapper = mount(PreviewInspector)

    const sep = wrapper.findAll('.insp__sugg').find((l) => l.text().includes('Separator'))!
    await sep.get('input[type="checkbox"]').setValue(true)

    // group created on the blueprint → editable sub-section renders.
    expect(store.schema.componentBlueprints.Alert.tokens.separator).toBeTruthy()
    expect(wrapper.find('.insp__sub').exists()).toBe(true)
  })

  it('alert icon controls set align and add a vertical separator', async () => {
    const store = useDesignSystemStore()
    store.selectComponent('Alert')
    const wrapper = mount(PreviewInspector)

    const selects = wrapper.findAll('.insp__field select')
    await selects[1].setValue('center') // [0] placement, [1] vertical align
    expect(store.schema.componentBlueprints.Alert.tokens.icon.align).toBe('center')

    const vsep = wrapper.findAll('.insp__sugg').find((l) => l.text().includes('Vertical separator'))!
    await vsep.get('input[type="checkbox"]').setValue(true)
    expect(store.schema.componentBlueprints.Alert.tokens.iconSep).toBeTruthy()
  })

  it('resets a component to its shipped default', async () => {
    const store = useDesignSystemStore()
    store.setPath(['componentBlueprints', 'Alert', 'tokens', 'success', 'backgroundColor'], '#123456')
    store.selectComponent('Alert')
    const wrapper = mount(PreviewInspector)

    await wrapper.get('[aria-label="Reset to default"]').trigger('click')
    expect(store.schema.componentBlueprints.Alert.tokens.success.backgroundColor).toBe('{colors.status-success-surface}')
  })

  it('action labels are editable', async () => {
    const store = useDesignSystemStore()
    store.selectComponent('Card')
    store.setPath(['componentBlueprints', 'Card', 'tokens', 'actions'], { cancelLabel: 'Cancel', confirmLabel: 'Confirm' })
    const wrapper = mount(PreviewInspector)

    const input = wrapper.findAll('.insp__field input')[0]
    await input.setValue('Back')
    await input.trigger('change')
    expect(store.schema.componentBlueprints.Card.tokens.actions.cancelLabel).toBe('Back')
  })
})
