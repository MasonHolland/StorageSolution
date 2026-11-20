import { describe, expect, it } from 'vitest'
import { dominantColorFromPixels } from './dominantColor'

const px = (rgb: [number, number, number], n: number) =>
  Array.from({ length: n }, () => [...rgb, 255]).flat()

describe('dominantColorFromPixels', () => {
  it('returns the majority colour', () => {
    const data = [...px([193, 154, 107], 70), ...px([60, 100, 180], 30)]
    expect(dominantColorFromPixels(data)).toBe('#c19a6b')
  })
  it('skips white background and black shadow', () => {
    const data = [...px([255, 255, 255], 60), ...px([5, 5, 5], 25), ...px([60, 111, 180], 15)]
    expect(dominantColorFromPixels(data)).toBe('#3c6fb4')
  })
  it('falls back to white when the box really is white', () => {
    expect(dominantColorFromPixels(px([245, 245, 245], 10))).toBe('#f5f5f5')
  })
  it('ignores transparent pixels and handles empty input', () => {
    expect(dominantColorFromPixels([10, 200, 10, 0])).toBeNull()
  })
})
