// Pure geometry helpers. Positions are calculated here, never stored, so the
// 2D views now and a 3D view later read exactly the same numbers.
import type { Container, Space, Stack } from '../../db/schema'

export interface Box3 {
  x: number
  y: number
  z: number
  w: number
  d: number
  h: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

type Sized = Pick<Container, 'widthCm' | 'depthCm' | 'heightCm'>

/** Sorts bottom first by stackIndex. */
export function sortStack<T extends Pick<Container, 'stackIndex'>>(containers: T[]): T[] {
  return [...containers].sort((a, b) => (a.stackIndex ?? 0) - (b.stackIndex ?? 0))
}

/** Height off the floor of each container in a stack (input bottom first). */
export function stackHeights(containers: Pick<Container, 'heightCm'>[]): number[] {
  const out: number[] = []
  let z = 0
  for (const c of containers) {
    out.push(z)
    z += c.heightCm
  }
  return out
}

export function stackTotalHeight(containers: Pick<Container, 'heightCm'>[]): number {
  return containers.reduce((sum, c) => sum + c.heightCm, 0)
}

/** Footprint of a stack: as wide and deep as its largest container. Empty stacks get a default. */
export function stackFootprint(stack: Pick<Stack, 'xCm' | 'yCm' | 'rotation'>, containers: Sized[]): Rect {
  const w = containers.length ? Math.max(...containers.map((c) => c.widthCm)) : 45
  const d = containers.length ? Math.max(...containers.map((c) => c.depthCm)) : 45
  const [rw, rd] = stack.rotation === 90 ? [d, w] : [w, d]
  return { x: stack.xCm, y: stack.yCm, w: rw, h: rd }
}

/**
 * World-space boxes for a stack (input bottom first). Smaller boxes are centred
 * on the footprint. Rotation swaps width and depth.
 */
export function toWorld(stack: Pick<Stack, 'xCm' | 'yCm' | 'rotation'>, containers: Sized[]): Box3[] {
  const fp = stackFootprint(stack, containers)
  const zs = stackHeights(containers)
  return containers.map((c, i) => {
    const [w, d] = stack.rotation === 90 ? [c.depthCm, c.widthCm] : [c.widthCm, c.depthCm]
    return { x: fp.x + (fp.w - w) / 2, y: fp.y + (fp.h - d) / 2, z: zs[i], w, d, h: c.heightCm }
  })
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

export function fitsInSpace(rect: Rect, space: Pick<Space, 'widthCm' | 'depthCm'>): boolean {
  return rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= space.widthCm && rect.y + rect.h <= space.depthCm
}

export function snap(value: number, grid = 5): number {
  return Math.round(value / grid) * grid
}

/** Keeps a footprint inside the space. */
export function clampToSpace(rect: Rect, space: Pick<Space, 'widthCm' | 'depthCm'>): Rect {
  return {
    ...rect,
    x: Math.max(0, Math.min(rect.x, space.widthCm - rect.w)),
    y: Math.max(0, Math.min(rect.y, space.depthCm - rect.h)),
  }
}

/** Finds a free floor spot for a new stack by scanning a grid; falls back to the origin. */
export function findFreeSpot(
  space: Pick<Space, 'widthCm' | 'depthCm'>,
  taken: Rect[],
  size = { w: 45, h: 45 },
  step = 10,
): { x: number; y: number } {
  for (let y = 0; y + size.h <= space.depthCm; y += step) {
    for (let x = 0; x + size.w <= space.widthCm; x += step) {
      const r = { x, y, ...size }
      if (!taken.some((t) => overlaps(r, t))) return { x, y }
    }
  }
  return { x: 0, y: 0 }
}

/** Readable text colour (dark or light) for a fill colour. */
export function textColorFor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return '#1d1d1d'
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55 ? '#1d1d1d' : '#ffffff'
}

/** Shortens text with an ellipsis so it roughly fits a width, assuming ~0.6em per character. */
export function fitText(text: string, width: number, fontSize: number): string {
  const max = Math.max(3, Math.floor((width - 6) / (fontSize * 0.6)))
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}
