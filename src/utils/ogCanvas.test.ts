import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderOgImage, OG_WIDTH, OG_HEIGHT } from '@/utils/ogCanvas'
import { defaultSchema } from '@/defaults/schema'

/** A recording 2D context — jsdom ships no canvas implementation of its own. */
function fakeContext() {
  return {
    calls: [] as string[],
    fillStyle: '',
    font: '',
    fillRect: vi.fn(),
    fillText: vi.fn(),
    measureText: (t: string) => ({ width: t.length * 10 }),
  }
}

function stubCanvas(ctx: unknown | null, toDataURL = () => 'data:image/png;base64,AAA') {
  const canvas = { width: 0, height: 0, getContext: () => ctx, toDataURL }
  return vi
    .spyOn(document, 'createElement')
    .mockImplementation(() => canvas as unknown as HTMLElement)
}

afterEach(() => vi.restoreAllMocks())

describe('renderOgImage', () => {
  it('draws the card at the social aspect ratio and returns a PNG data URL', async () => {
    const ctx = fakeContext()
    stubCanvas(ctx)

    const url = await renderOgImage(defaultSchema)

    expect(url).toMatch(/^data:image\/png/)
    // Full-bleed background plus the accent rule, before any swatch is drawn.
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, OG_WIDTH, OG_HEIGHT)
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, OG_WIDTH, 10)
    const drawn = ctx.fillText.mock.calls.map((c) => c[0])
    expect(drawn).toContain(defaultSchema.name)
    expect(drawn).toContain('Made with Design Spec')
  })

  it('waits for web fonts before drawing, or the card renders in the fallback face', async () => {
    const ctx = fakeContext()
    stubCanvas(ctx)
    let resolved = false
    const ready = Promise.resolve().then(() => {
      resolved = true
    })
    Object.defineProperty(document, 'fonts', { value: { ready }, configurable: true })

    await renderOgImage(defaultSchema)

    expect(resolved).toBe(true)
  })

  it('honors branding — company name in, Design Spec attribution out', async () => {
    const ctx = fakeContext()
    stubCanvas(ctx)

    await renderOgImage(defaultSchema, {
      branding: { companyName: 'Acme', hideDesignSpecBranding: true },
    })

    const drawn = ctx.fillText.mock.calls.map((c) => c[0])
    expect(drawn).toContain('ACME')
    expect(drawn).not.toContain('Made with Design Spec')
  })

  it('returns null instead of a broken tag when no 2D context exists', async () => {
    stubCanvas(null)
    expect(await renderOgImage(defaultSchema)).toBeNull()
  })

  it('returns null when the canvas refuses to export', async () => {
    stubCanvas(fakeContext(), () => {
      throw new Error('tainted canvas')
    })
    expect(await renderOgImage(defaultSchema)).toBeNull()
  })
})
