import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ReportLauncher from './ReportLauncher.vue'
import { useErrorReport } from '@/composables/useErrorReport'

describe('ReportLauncher', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => useErrorReport().closeReport())

  it('opens the report modal in behavior mode (no error) on click', async () => {
    const wrapper = mount(ReportLauncher)
    await wrapper.get('button').trigger('click')

    const r = useErrorReport()
    expect(r.isOpen.value).toBe(true)
    expect(r.capturedKind.value).toBe('behavior')
    expect(r.capturedError.value).toBeNull()
  })

  it('is labelled for assistive tech', () => {
    const wrapper = mount(ReportLauncher)
    expect(wrapper.get('button').attributes('aria-label')).toBe('Report unexpected behavior')
  })
})
