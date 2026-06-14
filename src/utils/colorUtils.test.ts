import { describe, it, expect } from 'vitest'
import { hexToRgba, rgbaToHex, rgbToHsv, hsvToRgb } from '@/utils/colorUtils'

describe('color math', () => {
  it('parses hex (incl. alpha) and round-trips', () => {
    expect(hexToRgba('#3B6EF5')).toEqual({ r: 0x3b, g: 0x6e, b: 0xf5, a: 1 })
    expect(rgbaToHex({ r: 0x3b, g: 0x6e, b: 0xf5, a: 1 })).toBe('#3b6ef5')
    // alpha emits the 8th/9th hex pair only when < 1
    expect(rgbaToHex({ r: 255, g: 0, b: 0, a: 0.5 })).toBe('#ff0000' + '80')
    expect(hexToRgba('#ff000080').a).toBeCloseTo(0.5, 1)
  })

  it('hex → hsv → rgb is stable for pure red', () => {
    const hsv = rgbToHsv(hexToRgba('#ff0000'))
    expect(hsv.h).toBe(0)
    expect(hsv.s).toBe(1)
    expect(hsv.v).toBe(1)
    const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v)
    expect(rgbaToHex({ ...rgb, a: 1 })).toBe('#ff0000')
  })

  it('round-trips an arbitrary color through hsv', () => {
    const hex = '#2c7a4b'
    const hsv = rgbToHsv(hexToRgba(hex))
    expect(rgbaToHex({ ...hsvToRgb(hsv.h, hsv.s, hsv.v), a: 1 })).toBe(hex)
  })
})
