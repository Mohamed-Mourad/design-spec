import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createHead } from '@unhead/vue/client'
import SettingsView from '@/views/SettingsView.vue'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'

// §17: the three configuration layers as three tabs, remembered in the URL.
// No API is configured here, so the Integrations cards render their offline
// state and nothing reaches the network.

async function mountAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/settings', component: SettingsView },
      { path: '/workspace', component: { template: '<div />' } },
      { path: '/preview', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  const w = mount(SettingsView, { global: { plugins: [router, createHead()] }, attachTo: document.body })
  await flushPromises()
  return { w, router }
}

describe('SettingsView tabs', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('opens on Integrations by default, with the existing cards', async () => {
    const { w } = await mountAt('/settings')
    expect(w.find('[data-testid="settings-tab-integrations"]').attributes('aria-selected')).toBe('true')
    expect(w.text()).toContain('GitHub')
    expect(w.text()).toContain('Local CLI')
    expect(w.find('[data-testid="export-settings"]').exists()).toBe(false)
    expect(w.text()).not.toContain('still to come')
  })

  it('an unknown tab falls back to Integrations', async () => {
    const { w } = await mountAt('/settings?tab=billing')
    expect(w.find('[data-testid="settings-tab-integrations"]').attributes('aria-selected')).toBe('true')
  })

  it('reads the tab from the URL and writes it back on click', async () => {
    const { w, router } = await mountAt('/settings?tab=presentation')
    expect(w.find('[data-testid="presentation-settings"]').exists()).toBe(true)
    expect(w.find('[data-testid="edit-layout"]').attributes('href')).toBe('/preview?panel=layout')

    await w.find('[data-testid="settings-tab-export"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.tab).toBe('export')
    expect(w.find('[data-testid="export-settings"]').exists()).toBe(true)
    expect(w.find('[data-testid="export-sync-note"]').text()).toContain('design-spec sync --force')
  })

  it('arrow keys move between tabs', async () => {
    const { w, router } = await mountAt('/settings?tab=export')
    await w.find('[role="tablist"]').trigger('keydown', { key: 'ArrowRight' })
    await flushPromises()
    expect(router.currentRoute.value.query.tab).toBe('presentation')
    await w.find('[role="tablist"]').trigger('keydown', { key: 'ArrowLeft' })
    await flushPromises()
    await w.find('[role="tablist"]').trigger('keydown', { key: 'ArrowLeft' })
    await flushPromises()
    // Wraps from the first tab to the last.
    expect(router.currentRoute.value.query.tab).toBe('integrations')
  })

  it('the Export tab edits the active workspace export config', async () => {
    const { w } = await mountAt('/settings?tab=export')
    const store = useDesignSystemStore()

    const prefix = w.find('[data-testid="export-css-prefix"]')
    await prefix.setValue('acme-')
    await prefix.trigger('change')
    expect(store.schema.export.cssVariablePrefix).toBe('acme-')
    expect(w.text()).toContain('--acme-color-primary')

    await w.find('[data-testid="export-font-source"]').setValue('custom')
    expect(store.schema.export.fontSource).toBe('custom')
    const url = w.find('[data-testid="export-font-url"]')
    await url.setValue('https://fonts.example.com/a.css')
    await url.trigger('change')
    expect(store.schema.export.fontSourceUrl).toBe('https://fonts.example.com/a.css')

    // The last remaining stack can't be switched off.
    for (const id of ['react-css', 'vue-tailwind', 'vue-css', 'flutter']) {
      const box = w.find(`[data-testid="export-stack-${id}"]`)
      if ((box.element as HTMLInputElement).checked) await box.setValue(false)
    }
    const only = store.schema.export.frameworks
    expect(only).toHaveLength(1)
    expect((w.find(`[data-testid="export-stack-${only[0]}"]`).element as HTMLInputElement).disabled).toBe(true)

    await w.find('[data-testid="export-stack-flutter"]').setValue(true)
    expect(store.schema.export.frameworks).toContain('flutter')
    await w.find('[data-testid="export-flutter-naming"]').setValue('raw')
    expect(store.schema.export.flutterNaming).toBe('raw')
  })
})
