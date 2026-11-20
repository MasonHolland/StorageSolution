import { describe, expect, it } from 'vitest'
import {
  clampToSpace, findFreeSpot, fitsInSpace, fitText, overlaps, snap,
  stackFootprint, stackHeights, textColorFor, toWorld,
} from './layoutMath'

const box = (w: number, d: number, h: number) => ({ widthCm: w, depthCm: d, heightCm: h })

describe('layoutMath', () => {
  it('stacks heights bottom first', () => {
    expect(stackHeights([box(1, 1, 40), box(1, 1, 30), box(1, 1, 20)])).toEqual([0, 40, 70])
  })
  it('footprint is the widest/deepest box, swapped when rotated', () => {
    const boxes = [box(60, 40, 10), box(45, 50, 10)]
    expect(stackFootprint({ xCm: 10, yCm: 20, rotation: 0 }, boxes)).toEqual({ x: 10, y: 20, w: 60, h: 50 })
    expect(stackFootprint({ xCm: 10, yCm: 20, rotation: 90 }, boxes)).toEqual({ x: 10, y: 20, w: 50, h: 60 })
  })
  it('toWorld centres smaller boxes on the footprint', () => {
    const [a, b] = toWorld({ xCm: 0, yCm: 0, rotation: 0 }, [box(60, 40, 30), box(40, 40, 20)])
    expect(a).toEqual({ x: 0, y: 0, z: 0, w: 60, d: 40, h: 30 })
    expect(b).toEqual({ x: 10, y: 0, z: 30, w: 40, d: 40, h: 20 })
  })
  it('overlap and fit checks', () => {
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true)
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(false)
    expect(fitsInSpace({ x: 0, y: 0, w: 100, h: 100 }, { widthCm: 100, depthCm: 100 })).toBe(true)
    expect(fitsInSpace({ x: 1, y: 0, w: 100, h: 100 }, { widthCm: 100, depthCm: 100 })).toBe(false)
  })
  it('clamps and snaps', () => {
    expect(clampToSpace({ x: 90, y: -5, w: 20, h: 20 }, { widthCm: 100, depthCm: 100 }))
      .toEqual({ x: 80, y: 0, w: 20, h: 20 })
    expect(snap(12)).toBe(10)
    expect(snap(13)).toBe(15)
  })
  it('finds a free spot next to taken ones', () => {
    expect(findFreeSpot({ widthCm: 200, depthCm: 100 }, [{ x: 0, y: 0, w: 45, h: 45 }])).toEqual({ x: 50, y: 0 })
  })
  it('shortens labels that are too wide', () => {
    expect(fitText('Back middle', 200, 10)).toBe('Back middle')
    expect(fitText('Front left', 30, 10)).toBe('Fro…')
  })
  it('chooses readable text colour', () => {
    expect(textColorFor('#2f3237')).toBe('#ffffff')
    expect(textColorFor('#f1efe9')).toBe('#1d1d1d')
  })
})
