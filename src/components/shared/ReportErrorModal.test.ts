import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/utils/telemetry', () => ({ captureUserReport: vi.fn() }))

import ReportErrorModal from './ReportErrorModal.vue'
import { useErrorReport } from '@/composables/useErrorReport'
import { captureUserReport } from '@/utils/telemetry'

function mountModal() {
  // Stub Teleport so the modal markup stays inside the wrapper.
  return mount(ReportErrorModal, { global: { stubs: { teleport: true } } })
}

describe('ReportErrorModal — behavior mode', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    useErrorReport().closeReport()
  })

  it('shows behavior copy, requires a comment, and sends with kind=behavior', async () => {
    useErrorReport().openBehaviorReport([{ ts: 1, action: 'updateToken', args: [] }])
    const wrapper = mountModal()

    expect(wrapper.text()).toContain('Report unexpected behavior')

    // The comment IS the behavior report: clicking with an empty comment is a no-op.
    await wrapper.get('.modal__btn--submit').trigger('click')
    expect(captureUserReport).not.toHaveBeenCalled()

    const textarea = wrapper.get('.modal__textarea')
    await textarea.setValue('the preview did not refresh')
    expect((textarea.element as HTMLTextAreaElement).value).toBe('the preview did not refresh')

    await wrapper.get('.modal__btn--submit').trigger('click')
    expect(captureUserReport).toHaveBeenCalledWith(
      'the preview did not refresh',
      null,
      expect.objectContaining({ actionTrace: expect.any(Array) }),
      'behavior',
    )
  })

  it('error mode allows sending without a comment and tags kind=error', async () => {
    useErrorReport().openReport(new Error('boom'), [])
    const wrapper = mountModal()

    expect(wrapper.text()).toContain('Report a problem')
    const submit = wrapper.get('.modal__btn--submit')
    expect((submit.element as HTMLButtonElement).disabled).toBe(false)

    await submit.trigger('click')
    expect(captureUserReport).toHaveBeenCalledWith('', expect.any(Error), expect.any(Object), 'error')
  })
})
