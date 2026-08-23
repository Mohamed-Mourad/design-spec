import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useFigmaStore } from '@/stores/useFigmaStore'
import { useDesignSystemStore } from '@/stores/useDesignSystemStore'
import { setSession } from '@/utils/api'
import { figmaPat } from '@/utils/figma/pat'
import { defaultSchema } from '@/defaults/schema'

// The Figma import flow with the network stubbed at `fetch`.
//
// The behaviour that matters most here is not the mapping — that has its own
// suite — but the boundary: every request carrying the PAT goes to
// api.figma.com and nowhere else, and no request to the Design Spec API carries
// it in any form. Those two assertions are the security invariant in test form.

const API = 'https://api.test'
const FILE_URL = 'https://www.figma.com/design/abc123DEF456/Acme'
const PAT = 'figd_secret-token-value'

interface Route {
  status: number
  body: unknown
}

let calls: { url: string; init?: RequestInit }[] = []

function stubFetch(routes: Record<string, Route>) {
  calls = []
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    const match = Object.keys(routes).find((suffix) => url.includes(suffix))
    if (!match) return new Response('{"error":"unrouted"}', { status: 404 })
    return new Response(JSON.stringify(routes[match].body), {
      status: routes[match].status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

const FILE_META = { name: 'Acme', version: '900', lastModified: '2026-08-01T00:00:00Z' }

const STYLES = {
  meta: {
    styles: [
      { key: 's1', node_id: '1:1', style_type: 'FILL', name: 'Brand/Primary' },
      { key: 's2', node_id: '2:2', style_type: 'TEXT', name: 'Body/MD' },
    ],
  },
}

const NODES = {
  nodes: {
    '1:1': { document: { id: '1:1', fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.9 } }] } },
    '2:2': {
      document: { id: '2:2', style: { fontFamily: 'Inter', fontSize: 16, lineHeightPx: 24 } },
    },
  },
}

const VARIABLES = {
  meta: {
    variables: {
      v1: {
        id: 'v1',
        name: 'Surface',
        variableCollectionId: 'c1',
        resolvedType: 'COLOR',
        valuesByMode: { light: { r: 1, g: 1, b: 1 }, dark: { r: 0, g: 0, b: 0 } },
      },
    },
    variableCollections: {
      c1: {
        id: 'c1',
        name: 'Core',
        defaultModeId: 'light',
        modes: [
          { modeId: 'light', name: 'Light' },
          { modeId: 'dark', name: 'Dark' },
        ],
      },
    },
  },
}

/** Every route a full Pro read touches. */
function figmaRoutes(over: Record<string, Route> = {}): Record<string, Route> {
  return {
    '/variables/local': { status: 200, body: VARIABLES },
    '/styles': { status: 200, body: STYLES },
    '/nodes?ids=': { status: 200, body: NODES },
    '?depth=1': { status: 200, body: FILE_META },
    ...over,
  }
}

function proRoutes(over: Record<string, Route> = {}): Record<string, Route> {
  return {
    '/billing/entitlement': {
      status: 200,
      body: {
        org: 'octocat',
        plan: 'pro_team',
        status: 'active',
        hosted_janitor: true,
        seats: 3,
        seats_used: 1,
      },
    },
    ...figmaRoutes(over),
  }
}

function signIn() {
  setSession('jwt-token', 'octocat')
}

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', API)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('useFigmaStore — the token', () => {
  it('keeps the PAT in localStorage under the agreed key', () => {
    const figma = useFigmaStore()
    figma.rememberPat(PAT)
    expect(localStorage.getItem('dsa-figma-pat')).toBe(PAT)
    expect(figmaPat()).toBe(PAT)
  })

  it('forgetting clears it from storage', () => {
    const figma = useFigmaStore()
    figma.rememberPat(PAT)
    figma.forgetPat()
    expect(localStorage.getItem('dsa-figma-pat')).toBeNull()
    expect(figma.hasPat).toBe(false)
  })

  it('never sends the PAT to the Design Spec API', async () => {
    stubFetch(proRoutes())
    signIn()
    const figma = useFigmaStore()
    figma.rememberPat(PAT)
    figma.fileInput = FILE_URL
    await figma.init()
    await figma.runImport()

    const ours = calls.filter((c) => c.url.startsWith(API))
    expect(ours.length).toBeGreaterThan(0)
    for (const call of ours) {
      const headers = (call.init?.headers ?? {}) as Record<string, string>
      expect(Object.keys(headers)).not.toContain('X-Figma-Token')
      expect(JSON.stringify(call)).not.toContain(PAT)
    }
  })

  it('sends the PAT only to api.figma.com, as X-Figma-Token', async () => {
    stubFetch(proRoutes())
    signIn()
    const figma = useFigmaStore()
    figma.rememberPat(PAT)
    figma.fileInput = FILE_URL
    await figma.init()
    await figma.runImport()

    const carrying = calls.filter((c) =>
      Object.entries((c.init?.headers ?? {}) as Record<string, string>).some(
        ([, v]) => v === PAT,
      ),
    )
    expect(carrying.length).toBeGreaterThan(0)
    for (const call of carrying) {
      expect(call.url.startsWith('https://api.figma.com/v1/')).toBe(true)
    }
  })
})

describe('useFigmaStore — reading a file', () => {
  it('needs a token and a resolvable file link before it can read', () => {
    const figma = useFigmaStore()
    expect(figma.canImport).toBe(false)
    figma.rememberPat(PAT)
    figma.fileInput = 'not a figma link'
    expect(figma.fileKey).toBeNull()
    expect(figma.canImport).toBe(false)
    figma.fileInput = FILE_URL
    expect(figma.canImport).toBe(true)
  })

  it('reads styles only on the free plan', async () => {
    stubFetch(figmaRoutes())
    const figma = useFigmaStore()
    figma.rememberPat(PAT)
    figma.fileInput = FILE_URL
    await figma.init()
    const result = await figma.runImport()

    expect(figma.isPro).toBe(false)
    expect(result?.colors).toEqual({ 'brand-primary': '#3366E6' })
    expect(result?.counts.variables).toBe(0)
    expect(calls.some((c) => c.url.includes('/variables/local'))).toBe(false)
  })

  it('reads variables and a dark mode on Pro', async () => {
    stubFetch(proRoutes())
    signIn()
    const figma = useFigmaStore()
    figma.rememberPat(PAT)
    figma.fileInput = FILE_URL
    await figma.init()
    const result = await figma.runImport()

    expect(figma.isPro).toBe(true)
    expect(result?.colors.surface).toBe('#FFFFFF')
    expect(result?.darkColors.surface).toBe('#000000')
  })

  it('keeps the styles when a Pro file has no Variables API', async () => {
    stubFetch(proRoutes({ '/variables/local': { status: 403, body: { err: 'no' } } }))
    signIn()
    const figma = useFigmaStore()
    figma.rememberPat(PAT)
    figma.fileInput = FILE_URL
    await figma.init()
    const result = await figma.runImport()

    expect(figma.error).toBeNull()
    expect(result?.colors['brand-primary']).toBe('#3366E6')
    expect(result?.notes[result.notes.length - 1]?.reason).toContain('does not expose the Variables API')
  })

  it('says whose problem a rejected token is, without echoing it', async () => {
    stubFetch(figmaRoutes({ '?depth=1': { status: 403, body: {} } }))
    const figma = useFigmaStore()
    figma.rememberPat(PAT)
    figma.fileInput = FILE_URL
    await figma.runImport()

    expect(figma.error).toContain('Figma refused that token')
    expect(figma.error).not.toContain(PAT)
    expect(figma.imported).toBeNull()
  })

  it('reports an unknown file separately from a bad token', async () => {
    stubFetch(figmaRoutes({ '?depth=1': { status: 404, body: {} } }))
    const figma = useFigmaStore()
    figma.rememberPat(PAT)
    figma.fileInput = FILE_URL
    await figma.runImport()
    expect(figma.error).toContain('no file at that link')
  })

  it('treats a build with no API as free rather than failing the check', async () => {
    vi.stubEnv('VITE_API_URL', '')
    stubFetch(figmaRoutes())
    const figma = useFigmaStore()
    await figma.init()
    expect(figma.isPro).toBe(false)
    expect(figma.error).toBeNull()
  })
})

describe('useFigmaStore — applying to a workspace', () => {
  async function readFile() {
    stubFetch(figmaRoutes())
    const figma = useFigmaStore()
    figma.rememberPat(PAT)
    figma.fileInput = FILE_URL
    await figma.init()
    await figma.runImport()
    return figma
  }

  it('merges into the active workspace and remembers the file', async () => {
    const design = useDesignSystemStore()
    const figma = await readFile()

    expect(figma.applyToWorkspace()).toBe(true)
    expect(design.schema.colors['brand-primary']).toBe('#3366E6')
    // merge keeps what was already there
    expect(design.schema.colors.primary).toBe(defaultSchema.colors.primary)
    expect(figma.link).toMatchObject({ fileKey: 'abc123DEF456', fileName: 'Acme', version: '900' })
  })

  it('replace swaps the groups the file populated and leaves the rest', async () => {
    const design = useDesignSystemStore()
    const figma = await readFile()
    figma.mergeMode = 'replace'
    figma.applyToWorkspace()

    expect(design.schema.colors).toEqual({ 'brand-primary': '#3366E6' })
    expect(design.schema.shadows).toEqual(defaultSchema.shadows)
  })

  it('is one undo step', async () => {
    const design = useDesignSystemStore()
    const figma = await readFile()
    figma.applyToWorkspace()
    expect(design.canUndo).toBe(true)
    design.undo()
    expect(design.schema.colors['brand-primary']).toBeUndefined()
  })

  it('does not link a file that was read but never applied', async () => {
    const figma = await readFile()
    expect(figma.link).toBeNull()
  })

  it('unlinking keeps the tokens and stops following the file', async () => {
    const design = useDesignSystemStore()
    const figma = await readFile()
    figma.applyToWorkspace()
    figma.unlink()
    expect(figma.link).toBeNull()
    expect(design.schema.colors['brand-primary']).toBe('#3366E6')
  })

  it('never writes the PAT into the schema', async () => {
    const design = useDesignSystemStore()
    const figma = await readFile()
    figma.applyToWorkspace()
    expect(JSON.stringify(design.schema)).not.toContain(PAT)
  })
})

describe('useFigmaStore — following a linked file', () => {
  async function linkPro(over: Record<string, Route> = {}) {
    stubFetch(proRoutes(over))
    signIn()
    const figma = useFigmaStore()
    figma.rememberPat(PAT)
    figma.fileInput = FILE_URL
    await figma.init()
    await figma.runImport()
    figma.applyToWorkspace()
    return figma
  }

  it('raises a badge when the file version moves', async () => {
    const figma = await linkPro()
    stubFetch(figmaRoutes({ '?depth=1': { status: 200, body: { ...FILE_META, version: '901' } } }))

    expect(await figma.checkForChange()).toBe(true)
    expect(figma.changeAvailable).toBe(true)
    expect(figma.remoteVersion).toBe('901')
  })

  it('stays quiet while the file is unchanged', async () => {
    const figma = await linkPro()
    expect(await figma.checkForChange()).toBe(false)
    expect(figma.changeAvailable).toBe(false)
  })

  it('never applies a change on its own', async () => {
    const design = useDesignSystemStore()
    const figma = await linkPro()
    const before = JSON.stringify(design.schema)
    stubFetch(figmaRoutes({ '?depth=1': { status: 200, body: { ...FILE_META, version: '901' } } }))

    await figma.checkForChange()
    expect(JSON.stringify(design.schema)).toBe(before)
  })

  it('acknowledging follows the new version without importing it', async () => {
    const figma = await linkPro()
    stubFetch(figmaRoutes({ '?depth=1': { status: 200, body: { ...FILE_META, version: '901' } } }))
    await figma.checkForChange()

    figma.acknowledgeChange()
    expect(figma.changeAvailable).toBe(false)
    expect(figma.link?.version).toBe('901')
    expect(await figma.checkForChange()).toBe(false)
  })

  it('applying a fresh read clears the badge', async () => {
    const figma = await linkPro()
    stubFetch(figmaRoutes({ '?depth=1': { status: 200, body: { ...FILE_META, version: '901' } } }))
    await figma.checkForChange()
    expect(figma.changeAvailable).toBe(true)

    await figma.runImport()
    figma.applyToWorkspace()
    expect(figma.changeAvailable).toBe(false)
    expect(figma.link?.version).toBe('901')
  })

  it('a failed poll is silent — no error banner from a background check', async () => {
    const figma = await linkPro()
    stubFetch(figmaRoutes({ '?depth=1': { status: 429, body: {} } }))

    expect(await figma.checkForChange()).toBe(false)
    expect(figma.error).toBeNull()
  })

  it('only watches on Pro, with a token and a linked file', async () => {
    const figma = await linkPro()
    expect(figma.canWatch).toBe(true)
    figma.forgetPat()
    expect(figma.canWatch).toBe(false)
  })

  it('does not watch a free workspace', async () => {
    stubFetch(figmaRoutes())
    const figma = useFigmaStore()
    figma.rememberPat(PAT)
    figma.fileInput = FILE_URL
    await figma.init()
    await figma.runImport()
    figma.applyToWorkspace()
    expect(figma.canWatch).toBe(false)
  })

  it('polls on a timer while the workspace is open and stops on request', async () => {
    vi.useFakeTimers()
    try {
      stubFetch(proRoutes())
      signIn()
      const figma = useFigmaStore()
      figma.rememberPat(PAT)
      figma.fileInput = FILE_URL
      await figma.init()
      await figma.runImport()
      figma.applyToWorkspace()

      stubFetch(figmaRoutes({ '?depth=1': { status: 200, body: { ...FILE_META, version: '902' } } }))
      figma.startWatching()
      await vi.advanceTimersByTimeAsync(60_000)
      const polled = calls.filter((c) => c.url.includes('depth=1')).length
      expect(polled).toBeGreaterThanOrEqual(2)

      figma.stopWatching()
      await vi.advanceTimersByTimeAsync(180_000)
      expect(calls.filter((c) => c.url.includes('depth=1')).length).toBe(polled)
    } finally {
      vi.useRealTimers()
    }
  })

  it('stops watching a file the token can no longer read', async () => {
    vi.useFakeTimers()
    try {
      stubFetch(proRoutes())
      signIn()
      const figma = useFigmaStore()
      figma.rememberPat(PAT)
      figma.fileInput = FILE_URL
      await figma.init()
      await figma.runImport()
      figma.applyToWorkspace()

      stubFetch(figmaRoutes({ '?depth=1': { status: 403, body: {} } }))
      figma.startWatching()
      await vi.advanceTimersByTimeAsync(0)
      const after = calls.filter((c) => c.url.includes('depth=1')).length
      await vi.advanceTimersByTimeAsync(180_000)
      expect(calls.filter((c) => c.url.includes('depth=1')).length).toBe(after)
    } finally {
      vi.useRealTimers()
    }
  })
})
