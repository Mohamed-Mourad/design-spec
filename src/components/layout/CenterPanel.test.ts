import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CenterPanel from '@/components/layout/CenterPanel.vue'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'

describe('CenterPanel — dark-mode preview', () => {
  it('injects light surface by default and the dark override when toggled', () => {
    const store = useDesignSystemStore()
    const light = store.schema.colors['surface-page']
    const dark = store.schema.darkMode.colors['surface-page']
    expect(dark).toBeTruthy()
    expect(dark).not.toBe(light)

    const wrapper = mount(CenterPanel)
    const frame = () => wrapper.get('[data-testid="preview-frame"]').attributes('style') ?? ''
    expect(frame()).toContain(`--color-surface-page: ${light}`)

    store.togglePreviewDark()
    return wrapper.vm.$nextTick().then(() => {
      expect(frame()).toContain(`--color-surface-page: ${dark}`)
    })
  })
})
