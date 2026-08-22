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
