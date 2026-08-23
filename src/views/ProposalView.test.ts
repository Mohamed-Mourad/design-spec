import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory, type Router } from 'vue-router'
import { createHead } from '@unhead/vue/client'
import ProposalView from '@/views/ProposalView.vue'
import EmbedView from '@/views/EmbedView.vue'
import { defaultSchema } from '@/defaults/schema'

// The two public routes. Both read a schema they did not author, from an API
// they reach without a session — so the tests drive `fetch` directly rather
// than a store.

const API = 'http://api.test'

function published(overrides: Record<string, unknown> = {}) {
  const schema = structuredClone(defaultSchema) as unknown as Record<string, unknown>
  schema.name = 'Acme System'
  schema.presentation = {
    ogImageStrategy: 'server-render',
    proposalBranding: { companyName: 'Acme', hideDesignSpecBranding: true },
    embedOptions: { allowIframe: true, showTokenValues: true, allowedOrigins: [] },
    ...(overrides.presentation as object | undefined),
  }
  return {
    slug: 'acme-system',
    url: 'https://designspec.app/p/acme-system',
    embed_url: 'https://designspec.app/embed/acme-system',
    og_image_url: 'https://api.test/api/v1/proposals/acme-system/og-image.png',
    og_image_status: 'ready',
    schema_json: schema,
    created_at: '2026-08-23T10:00:00Z',
    updated_at: '2026-08-23T10:00:00Z',
    ...overrides,
  }
}

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response)
}

let router: Router

async function mountAt(component: unknown, path: string) {
  router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/p/:slug', component: component as never },
      { path: '/embed/:slug', component: component as never },
    ],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(component as never, { global: { plugins: [router, createHead()] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', API)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ProposalView', () => {
  it('renders a published system for a reader with no session', async () => {
    const fetchMock = mockFetch(200, published())
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = await mountAt(ProposalView, '/p/acme-system')

    expect(wrapper.get('[data-testid="bento-preview"]').text()).toContain('Acme System')
    // Branding applies, and the attribution the author hid stays hidden.
    expect(wrapper.text()).toContain('Acme')
    expect(wrapper.text()).not.toContain('Made with Design Spec')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${API}/api/v1/proposals/acme-system`)
    // No Authorization header: a stranger following a link has no session, and
    // one they happen to have must not be spent here.
    expect(init).toBeUndefined()
  })

  it('says so plainly when nothing is published at the address', async () => {
    vi.stubGlobal('fetch', mockFetch(404, { error: 'not found' }))

    const wrapper = await mountAt(ProposalView, '/p/nobody-here')

    expect(wrapper.get('[data-testid="proposal-error"]').text()).toContain('nothing published')
    expect(wrapper.find('[data-testid="bento-preview"]').exists()).toBe(false)
  })

  it('refuses a payload that is not a design system', async () => {
    vi.stubGlobal('fetch', mockFetch(200, published({ schema_json: { nope: true } })))

    const wrapper = await mountAt(ProposalView, '/p/acme-system')

    expect(wrapper.find('[data-testid="proposal-error"]').exists()).toBe(true)
  })
})

describe('EmbedView', () => {
  it('renders the bento and signals the renderer once it has settled', async () => {
    vi.stubGlobal('fetch', mockFetch(200, published()))

    const wrapper = await mountAt(EmbedView, '/embed/acme-system')
    await flushPromises()

    expect(wrapper.get('[data-testid="bento-preview"]').text()).toContain('Acme System')
    expect(wrapper.get('[data-testid="embed-view"]').attributes('data-og-ready')).toBe('true')
  })

  it('refuses to render inside a frame the author did not allow', async () => {
    vi.stubGlobal('fetch', mockFetch(200, published()))
    vi.spyOn(window, 'top', 'get').mockReturnValue({} as Window)
    Object.defineProperty(document, 'referrer', {
      value: 'https://evil.example/page',
      configurable: true,
    })

    const wrapper = await mountAt(EmbedView, '/embed/acme-system')
    await flushPromises()

    expect(wrapper.find('[data-testid="embed-blocked"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="bento-preview"]').exists()).toBe(false)
    Object.defineProperty(document, 'referrer', { value: '', configurable: true })
  })

  it('refuses outright when embedding is turned off, whoever is framing', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(
        200,
        published({
          presentation: {
            embedOptions: {
              allowIframe: false,
              showTokenValues: true,
              allowedOrigins: ['https://acme.example'],
            },
          },
        }),
      ),
    )
    vi.spyOn(window, 'top', 'get').mockReturnValue({} as Window)
    Object.defineProperty(document, 'referrer', {
      value: 'https://acme.example/page',
      configurable: true,
    })

    const wrapper = await mountAt(EmbedView, '/embed/acme-system')
    await flushPromises()

    expect(wrapper.get('[data-testid="embed-blocked"]').text()).toContain('not available')
    Object.defineProperty(document, 'referrer', { value: '', configurable: true })
  })
})
