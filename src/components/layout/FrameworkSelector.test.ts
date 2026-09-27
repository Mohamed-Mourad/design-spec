import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FrameworkSelector from '@/components/layout/FrameworkSelector.vue'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'

describe('FrameworkSelector — Flutter stack', () => {
  it('adds Flutter as its own stack and only then offers the Dart naming choice', async () => {
    const store = useDesignSystemStore()
    const wrapper = mount(FrameworkSelector)
    expect(wrapper.find('select[aria-label="Flutter naming convention"]').exists()).toBe(false)

    await wrapper.get('button[aria-label="Flutter"]').trigger('click')
    expect(store.schema.export.frameworks).toContain('flutter')
    expect(wrapper.get('button[aria-label="Flutter"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('select[aria-label="Flutter naming convention"]').exists()).toBe(true)
  })

  it('writes the chosen naming convention to the export config', async () => {
    const store = useDesignSystemStore()
    store.updateFrameworks(['flutter'])
    const wrapper = mount(FrameworkSelector)
    await wrapper.get('select[aria-label="Flutter naming convention"]').setValue('snake_const')
    expect(store.schema.export.flutterNaming).toBe('snake_const')
  })

  it('never removes the last remaining stack', async () => {
    const store = useDesignSystemStore()
    store.updateFrameworks(['flutter'])
    const wrapper = mount(FrameworkSelector)
    await wrapper.get('button[aria-label="Flutter"]').trigger('click')
    expect(store.schema.export.frameworks).toEqual(['flutter'])
  })
})
