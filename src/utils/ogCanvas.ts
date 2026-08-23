// ogCanvas.ts — the free tier's social card.
//
// Pro proposals get a server-rendered screenshot of the real bento. Without an
// account there is no server to ask, so the card is drawn in the browser on a
// canvas and handed to `og:image` as a data URL. It is deliberately a summary —
// wordmark, description, palette — not a scaled-down bento: at 1200×630 the
// cells are unreadable anyway, and a canvas cannot reproduce them faithfully.

import type { DesignSystemSchema, WebPresentationConfig } from '@/types/schema'
import { readableInk } from '@/utils/colorUtils'

export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

interface OgOptions {
  branding?: WebPresentationConfig['proposalBranding']
}

/** Truncate to fit `maxWidth`, appending an ellipsis when it had to cut. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let cut = text
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1)
  }
  return `${cut}…`
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate
      continue
    }
    if (line) lines.push(line)
    line = word
    if (lines.length === maxLines) break
  }
  if (line && lines.length < maxLines) lines.push(line)
  return lines.map((l, i) => (i === maxLines - 1 ? fitText(ctx, l, maxWidth) : l))
}

/**
 * Draw the card and return it as a PNG data URL, or `null` where no 2D context
 * is available (jsdom, a locked-down browser). Callers fall back to the static
 * social image rather than shipping a broken `og:image`.
 */
export async function renderOgImage(
  schema: DesignSystemSchema,
  { branding }: OgOptions = {},
): Promise<string | null> {
  if (typeof document === 'undefined') return null

  // Web fonts load asynchronously; drawing before they resolve silently renders
  // the whole card in the fallback serif.
  try {
    await document.fonts?.ready
  } catch {
    /* no font loading API — draw with whatever is available */
  }

  const canvas = document.createElement('canvas')
  canvas.width = OG_WIDTH
  canvas.height = OG_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const accent = branding?.accentColor ?? schema.colors.primary ?? '#c8813d'
  const bg = '#0f0e0c'
  const fg = '#f0ede6'
  const muted = '#9b9690'

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, OG_WIDTH, OG_HEIGHT)

  // Accent rule along the top edge — the one piece of the system's own color
  // that reads at thumbnail size in a social feed.
  ctx.fillStyle = accent
  ctx.fillRect(0, 0, OG_WIDTH, 10)

  const left = 88
  const maxWidth = OG_WIDTH - left * 2

  if (branding?.companyName) {
    ctx.fillStyle = muted
    ctx.font = '600 22px "DM Sans", system-ui, sans-serif'
    ctx.fillText(fitText(ctx, branding.companyName.toUpperCase(), maxWidth), left, 150)
  }

  ctx.fillStyle = fg
  ctx.font = '400 82px "DM Serif Display", Georgia, serif'
  ctx.fillText(fitText(ctx, schema.name, maxWidth), left, 250)

  if (schema.description) {
    ctx.fillStyle = muted
    ctx.font = '400 30px "DM Sans", system-ui, sans-serif'
    wrapLines(ctx, schema.description, maxWidth, 2).forEach((line, i) => {
      ctx.fillText(line, left, 312 + i * 44)
    })
  }

  // Palette strip — up to ten swatches, each captioned with its own hex.
  const swatches = Object.entries(schema.colors).slice(0, 10)
  if (swatches.length) {
    const gap = 14
    const size = Math.min(96, (maxWidth - gap * (swatches.length - 1)) / swatches.length)
    const top = OG_HEIGHT - 200
    swatches.forEach(([, value], i) => {
      const x = left + i * (size + gap)
      ctx.fillStyle = value
      ctx.fillRect(x, top, size, size)
      ctx.fillStyle = readableInk(value)
      ctx.font = '400 13px "DM Mono", monospace'
      ctx.fillText(fitText(ctx, value.toUpperCase(), size - 12), x + 8, top + size - 12)
    })
  }

  if (!branding?.hideDesignSpecBranding) {
    ctx.fillStyle = muted
    ctx.font = '400 20px "DM Sans", system-ui, sans-serif'
    ctx.fillText('Made with Design Spec', left, OG_HEIGHT - 56)
  }

  try {
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}
