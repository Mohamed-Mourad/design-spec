import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PublishProposalModal from '@/components/preview/PublishProposalModal.vue'
import EmbedCodeModal from '@/components/preview/EmbedCodeModal.vue'
import { defaultSchema } from '@/defaults/schema'
import type { DesignSystemSchema } from '@/types/schema'

const API = 'http://api.test'

function schemaNamed(name: string): DesignSystemSchema {
  const s = structuredClone(defaultSchema) as DesignSystemSchema
  s.name = name
  return s
}

/** Answer each request by URL+method, so one mock covers check-then-publish. */
function routeFetch(handlers: Record<string, { status: number; body: unknown }>) {
  return vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(url).replace(API, '')}`
    const match =
      handlers[key] ??
      Object.entries(handlers).find(([k]) => key.startsWith(k.split('?')[0]))?.[1] ??
      { status: 404, body: { error: 'not found' } }
    const hit = 'status' in match ? match : match
    return {
      ok: hit.status >= 200 && hit.status < 300,
      status: hit.status,
      text: async () => JSON.stringify(hit.body),
    } as Response
  })
}

const PUBLISHED = {
  slug: 'acme-ui',
  url: 'https://designspec.app/p/acme-ui',
  embed_url: 'https://designspec.app/embed/acme-ui',
  og_image_url: null,
  og_image_status: 'pending',
  created_at: '2026-08-23T10:00:00Z',
  updated_at: '2026-08-23T10:00:00Z',
}

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', API)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

/** Let the debounced availability check fire and settle. */
async function settleCheck() {
  await vi.advanceTimersByTimeAsync(350)
  await flushPromises()
}

describe('PublishProposalModal', () => {
  it('proposes a slug from the system name and confirms it is free', async () => {
    vi.stubGlobal(
      'fetch',
      routeFetch({
        'GET /api/v1/proposals/availability': {
          status: 200,
          body: { slug: 'acme-ui', available: true, reason: null },
        },
      }),
    )

    const wrapper = mount(PublishProposalModal, { props: { schema: schemaNamed('Acme UI') } })
    await settleCheck()

    expect((wrapper.get('[data-testid="slug-input"]').element as HTMLInputElement).value).toBe('acme-ui')
    expect(wrapper.get('[data-testid="slug-status"]').text()).toBe('Available')
    expect(wrapper.get('[data-testid="publish-submit"]').attributes('disabled')).toBeUndefined()
  })

  it('will not let a taken address be published', async () => {
    vi.stubGlobal(
      'fetch',
      routeFetch({
        'GET /api/v1/proposals/availability': {
          status: 200,
          body: { slug: 'acme-ui', available: false, reason: 'taken' },
        },
      }),
    )

    const wrapper = mount(PublishProposalModal, { props: { schema: schemaNamed('Acme UI') } })
    await settleCheck()

    expect(wrapper.get('[data-testid="slug-status"]').text()).toBe('Already taken')
    expect(wrapper.get('[data-testid="publish-submit"]').attributes('disabled')).toBeDefined()
  })

  it('explains a reserved address rather than just refusing it', async () => {
    vi.stubGlobal(
      'fetch',
      routeFetch({
        'GET /api/v1/proposals/availability': {
          status: 200,
          body: { slug: 'preview', available: false, reason: 'reserved' },
        },
      }),
    )

    const wrapper = mount(PublishProposalModal, { props: { schema: schemaNamed('Preview') } })
    await settleCheck()

    expect(wrapper.get('[data-testid="slug-status"]').text()).toContain('Reserved')
  })

  it('publishes and hands back the link to paste', async () => {
    vi.stubGlobal(
      'fetch',
      routeFetch({
        'GET /api/v1/proposals/availability': {
          status: 200,
          body: { slug: 'acme-ui', available: true, reason: null },
        },
        'POST /api/v1/proposals': { status: 201, body: PUBLISHED },
      }),
    )

    const wrapper = mount(PublishProposalModal, { props: { schema: schemaNamed('Acme UI') } })
    await settleCheck()
    await wrapper.get('[data-testid="publish-submit"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="published-url"]').text()).toBe('https://designspec.app/p/acme-ui')
    expect(wrapper.emitted('published')?.[0]?.[0]).toMatchObject({ slug: 'acme-ui' })
  })

  it('names Pro as the reason when the API refuses', async () => {
    vi.stubGlobal(
      'fetch',
      routeFetch({
        'GET /api/v1/proposals/availability': {
          status: 200,
          body: { slug: 'acme-ui', available: true, reason: null },
        },
        'POST /api/v1/proposals': { status: 403, body: { error: 'pro plan required' } },
      }),
    )

    const wrapper = mount(PublishProposalModal, { props: { schema: schemaNamed('Acme UI') } })
    await settleCheck()
    await wrapper.get('[data-testid="publish-submit"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="publish-error"]').text()).toContain('Pro')
    expect(wrapper.find('[data-testid="published-url"]').exists()).toBe(false)
  })

  it('says publishing needs an account when no API is configured', async () => {
    vi.stubEnv('VITE_API_URL', '')

    const wrapper = mount(PublishProposalModal, { props: { schema: schemaNamed('Acme UI') } })
    await settleCheck()

    expect(wrapper.text()).toContain('needs a Design Spec account')
    expect(wrapper.get('[data-testid="publish-submit"]').attributes('disabled')).toBeDefined()
  })
})

describe('EmbedCodeModal', () => {
  it('offers an iframe tag for a web page and a bare URL for Notion', async () => {
    const wrapper = mount(EmbedCodeModal, {
      props: { embedUrl: 'https://designspec.app/embed/acme-ui', allowIframe: true },
    })

    expect(wrapper.get('[data-testid="embed-snippet"]').text()).toContain(
      '<iframe src="https://designspec.app/embed/acme-ui"',
    )

    await wrapper.findAll('.ecm__tab')[1].trigger('click')
    // Notion builds the frame itself; pasting HTML there yields literal markup.
    expect(wrapper.get('[data-testid="embed-snippet"]').text()).toBe(
      'https://designspec.app/embed/acme-ui',
    )
  })

  it('offers no snippet at all when the author turned embedding off', () => {
    const wrapper = mount(EmbedCodeModal, {
      props: { embedUrl: 'https://designspec.app/embed/acme-ui', allowIframe: false },
    })

    expect(wrapper.find('[data-testid="embed-disabled"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="embed-snippet"]').exists()).toBe(false)
  })
})
