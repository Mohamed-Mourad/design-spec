import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TokenStateChip from '@/components/shared/TokenStateChip.vue'
import TokenStateRow from '@/components/shared/TokenStateRow.vue'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import { defaultSchema } from '@/defaults/schema'

// The Verify/Review affordance. Two properties matter: it never blocks the
// editor it sits beside, and it disappears once a human has looked.

describe('TokenStateChip', () => {
  it('renders nothing for a token with no import provenance', () => {
    const wrapper = mount(TokenStateChip, { props: { state: null } })
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('labels an inferred token Verify', () => {
    const wrapper = mount(TokenStateChip, { props: { state: 'inferred', labelled: true } })
    expect(wrapper.text()).toBe('Verify')
    expect(wrapper.find('button').classes()).toContain('chip--inferred')
  })

  it('labels a defaulted token Review', () => {
    const wrapper = mount(TokenStateChip, { props: { state: 'defaulted', labelled: true } })
    expect(wrapper.text()).toBe('Review')
    expect(wrapper.find('button').classes()).toContain('chip--defaulted')
  })

  it('marks an extracted token without asking for anything', () => {
    const wrapper = mount(TokenStateChip, { props: { state: 'extracted', labelled: true } })
    expect(wrapper.text()).toBe('Extracted')
  })

  it('pairs colour with an icon, so state never rests on colour alone', () => {
    const inferred = mount(TokenStateChip, { props: { state: 'inferred' } })
    const defaulted = mount(TokenStateChip, { props: { state: 'defaulted' } })
    expect(inferred.find('svg').exists()).toBe(true)
    expect(defaulted.find('svg').exists()).toBe(true)
    expect(inferred.html()).not.toBe(defaulted.html())
  })

  it('carries an accessible name describing what to do', () => {
    const wrapper = mount(TokenStateChip, { props: { state: 'inferred' } })
    expect(wrapper.find('button').attributes('aria-label')).toMatch(/^Verify: /)
  })

  it('emits confirm when clicked', async () => {
    const wrapper = mount(TokenStateChip, { props: { state: 'inferred' } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })
})

describe('TokenStateRow', () => {
  function importWorkspace() {
    const store = useDesignSystemStore()
    store.applyImport(structuredClone(defaultSchema), {
      repoFullName: 'octocat/hello-world',
      branch: 'main',
      commitSha: 'abc1234',
      importSessionId: 'sess-1',
      signals: [],
      usedFallback: false,
      unparseableLayers: [],
      states: { colors: { primary: 'extracted', surface: 'inferred', muted: 'defaulted' } },
      scannedAt: 0,
    })
    return store
  }

  it('renders no chip in a workspace that was never imported', () => {
    const wrapper = mount(TokenStateRow, {
      props: { group: 'colors', tokenKey: 'primary' },
      slots: { default: '<input class="editor" />' },
    })
    expect(wrapper.find('.editor').exists()).toBe(true)
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('shows the chip for an imported token and keeps the editor alongside it', () => {
    importWorkspace()
    const wrapper = mount(TokenStateRow, {
      props: { group: 'colors', tokenKey: 'surface' },
      slots: { default: '<input class="editor" />' },
    })
    expect(wrapper.find('.editor').exists()).toBe(true)
    expect(wrapper.find('button').classes()).toContain('chip--inferred')
  })

  it('clears the flag when the chip is clicked', async () => {
    const store = importWorkspace()
    const wrapper = mount(TokenStateRow, {
      props: { group: 'colors', tokenKey: 'surface' },
      slots: { default: '<input class="editor" />' },
    })

    await wrapper.find('button').trigger('click')
    expect(store.tokenStateFor('colors', 'surface')).toBeNull()
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
