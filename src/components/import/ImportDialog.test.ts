import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ImportDialog from '@/components/import/ImportDialog.vue'
import ImportBadge from '@/components/import/ImportBadge.vue'
import ImportReport from '@/components/import/ImportReport.vue'
import RetrofitPushButton from '@/components/import/RetrofitPushButton.vue'
import SettingsView from '@/views/SettingsView.vue'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import { defaultSchema } from '@/defaults/schema'
import { createHead } from '@unhead/vue/client'
import type { ImportExtraction } from '@design-spec/compiler'

// Mount smoke tests.
//
// These exist because a component can type-check and still fail to render: an
// icon package's type declarations were broader than its runtime exports, so an
// import of a non-existent named export passed `vue-tsc` and blew up the whole
// app in the browser. Mounting every new view is the cheap guard against that
// entire class of bug.

// SettingsView sets a document title, so it needs an unhead context; RouterLink
// needs a stub because there is no router in a component test.
const settingsMountOptions = () => ({
  global: {
    plugins: [createHead()],
    stubs: { RouterLink: { template: '<a><slot /></a>' } },
  },
})

const EXTRACTION: ImportExtraction = {
  schema: structuredClone(defaultSchema) as never,
  states: { colors: { primary: 'extracted', surface: 'inferred', muted: 'defaulted' } },
  summary: { extracted: 1, inferred: 1, defaulted: 1 },
  signals: [
    { kind: 'parsed', source: 'tailwind.config.ts', message: 'read 3 colors statically' },
    { kind: 'skipped', source: 'tailwind.config.ts', message: '`theme.extend.colors....preset` cannot be evaluated' },
    { kind: 'fallback', source: 'dist/app.css', message: 'read 12 resolved custom properties' },
  ],
  detection: { frameworks: ['react-tailwind'], signals: [], hasTailwind: true },
  usedFallback: true,
  unparseableLayers: ['theme.extend.colors....preset'],
}

describe('import components mount', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', '')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('renders the import dialog', () => {
    const wrapper = mount(ImportDialog)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Import from GitHub')
  })

  it('tells the user plainly when cloud import is not enabled', () => {
    const wrapper = mount(ImportDialog)
    expect(wrapper.text()).toContain("Cloud import isn't enabled in this build")
    expect(wrapper.text()).toContain('npx design-spec init')
  })

  it('renders the settings view', () => {
    const wrapper = mount(SettingsView, settingsMountOptions())
    expect(wrapper.text()).toContain('Settings')
    expect(wrapper.text()).toContain('GitHub')
  })

  it('renders the retrofit push button', () => {
    const wrapper = mount(RetrofitPushButton)
    expect(wrapper.text()).toContain('Push as pull request')
  })

  it('renders nothing in the header until a workspace has been imported', () => {
    const wrapper = mount(ImportBadge)
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('renders the header badge with a pending count once imported', () => {
    const store = useDesignSystemStore()
    store.applyImport(structuredClone(defaultSchema), {
      repoFullName: 'acme/storefront',
      branch: 'main',
      commitSha: 'abc1234',
      importSessionId: 'sess-1',
      signals: EXTRACTION.signals,
      usedFallback: true,
      unparseableLayers: EXTRACTION.unparseableLayers,
      states: EXTRACTION.states,
      scannedAt: 0,
    })

    const wrapper = mount(ImportBadge)
    expect(wrapper.text()).toContain('acme/storefront')
    expect(wrapper.text()).toContain('2 to check')
  })
})

describe('ImportReport', () => {
  const mountReport = () =>
    mount(ImportReport, {
      props: {
        extraction: EXTRACTION,
        repoFullName: 'acme/storefront',
        branch: 'main',
        filesFetched: 3,
        durationMs: 1800,
        skipped: ['src/huge.css (over 512 KiB)'],
      },
    })

  it('reports all three provenance tallies', () => {
    const text = mountReport().text()
    expect(text).toContain('Extracted')
    expect(text).toContain('Verify')
    expect(text).toContain('Review')
  })

  it('explains the fallback instead of blocking on it — no dead end', () => {
    const text = mountReport().text()
    expect(text).toContain('could not be read without running your build')
    expect(text).toContain('compiled CSS was read instead')
    // Framed as a result, not a failure.
    expect(mountReport().find('[role="alert"]').exists()).toBe(false)
    expect(text).not.toMatch(/failed|error|unsupported/i)
  })

  it('names the specific layers it could not evaluate', () => {
    expect(mountReport().text()).toContain('theme.extend.colors....preset')
  })

  it('lists what was skipped', () => {
    expect(mountReport().text()).toContain('src/huge.css (over 512 KiB)')
  })
})
