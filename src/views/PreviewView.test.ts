import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createHead } from '@unhead/vue/client'
import PreviewView from '@/views/PreviewView.vue'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import { encodeSchemaHash } from '@/utils/shareLink'
import { defaultSchema } from '@/defaults/schema'
import type { DesignSystemSchema } from '@/types/schema'

function router() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/preview', component: PreviewView },
      { path: '/workspace', component: { template: '<div />' } },
    ],
  })
}

async function mountPreview() {
  const wrapper = mount(PreviewView, { global: { plugins: [router(), createHead()] } })
  await flushPromises()
  return wrapper
}

function shared(): DesignSystemSchema {
  const s = structuredClone(defaultSchema) as DesignSystemSchema
  s.name = 'Borrowed System'
  s.colors.primary = '#ff00ff'
  return s
}

beforeEach(() => {
  window.location.hash = ''
  vi.restoreAllMocks()
})

describe('PreviewView', () => {
  it('renders the active workspace when the URL carries no fragment', async () => {
    const store = useDesignSystemStore()
    store.updateMeta({ name: 'My Own System' })

    const wrapper = await mountPreview()

    expect(wrapper.get('[data-testid="bento-preview"]').text()).toContain('My Own System')
    expect(wrapper.find('[data-testid="open-in-workspace"]').exists()).toBe(false)
  })

  it('renders a system carried in by the fragment, with no account and no API', async () => {
    const incoming = shared()
    window.location.hash = `#${encodeSchemaHash(incoming)}`

    const wrapper = await mountPreview()

    expect(wrapper.get('[data-testid="bento-preview"]').text()).toContain('Borrowed System')
    expect(wrapper.get('[data-testid="bento-preview"]').attributes('style')).toContain('#ff00ff')
    expect(wrapper.find('[data-testid="bad-share-link"]').exists()).toBe(false)
  })

  it('falls back to the viewer own workspace when the fragment is damaged', async () => {
    const store = useDesignSystemStore()
    store.updateMeta({ name: 'My Own System' })
    window.location.hash = '#not-a-real-hash'

    const wrapper = await mountPreview()

    expect(wrapper.find('[data-testid="bad-share-link"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="bento-preview"]').text()).toContain('My Own System')
  })

  it('copies a shared system into a new workspace, never over the open one', async () => {
    const store = useDesignSystemStore()
    store.updateMeta({ name: 'My Own System' })
    const before = store.workspaces.length
    window.location.hash = `#${encodeSchemaHash(shared())}`

    const wrapper = await mountPreview()
    await wrapper.get('[data-testid="open-in-workspace"]').trigger('click')

    expect(store.workspaces).toHaveLength(before + 1)
    expect(store.schema.name).toBe('Borrowed System')
    // The workspace that was open still holds what it held.
    const previous = store.workspaces.find((w) => w.id !== store.activeWorkspaceId)
    expect(previous).toBeDefined()
  })

  it('writes layout edits through to schema.presentation', async () => {
    const store = useDesignSystemStore()
    const wrapper = await mountPreview()

    await wrapper.get('[data-testid="customize-bento"]').trigger('click')
    await wrapper.get('[aria-label="Hide the Colors cell"]').trigger('click')

    const cells = store.schema.presentation?.bentoLayout?.cells ?? []
    expect(cells.find((c) => c.id === 'colors')?.visible).toBe(false)
    // The cell it hid is gone from the rendered bento, not merely dimmed.
    expect(wrapper.findAll('[data-bento-cell="colors"]')).toHaveLength(0)
  })

  it('does not offer to customize someone else shared system', async () => {
    window.location.hash = `#${encodeSchemaHash(shared())}`

    const wrapper = await mountPreview()

    expect(wrapper.find('[data-testid="customize-bento"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="bento-layout-editor"]').exists()).toBe(false)
  })

  it('offers the share affordance on both the own and the shared view', async () => {
    expect((await mountPreview()).find('[data-testid="share-link"]').exists()).toBe(true)

    window.location.hash = `#${encodeSchemaHash(shared())}`
    expect((await mountPreview()).find('[data-testid="share-link"]').exists()).toBe(true)
  })
})
