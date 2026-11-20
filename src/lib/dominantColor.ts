/**
 * Picks the most common colour in RGBA pixel data, skipping near-white,
 * near-black and transparent pixels (backgrounds, shadows, glare).
 * Colours are bucketed to 4 bits per channel, then the bucket's mean is returned.
 */
export function dominantColorFromPixels(data: Uint8ClampedArray | number[]): string | null {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>()
  const fallback = new Map<number, { n: number; r: number; g: number; b: number }>()
  for (let i = 0; i + 3 < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]
    if (a < 128) continue
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const extreme = max < 35 || min > 235
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const target = extreme ? fallback : buckets
    const e = target.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
    e.n++
    e.r += r
    e.g += g
    e.b += b
    target.set(key, e)
  }
  const pick = buckets.size ? buckets : fallback
  let best: { n: number; r: number; g: number; b: number } | undefined
  for (const e of pick.values()) if (!best || e.n > best.n) best = e
  if (!best) return null
  return toHex(best.r / best.n, best.g / best.n, best.b / best.n)
}

export function toHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
}

/** Dominant colour of an image blob, measured from the centre 60% to avoid the background. */
export async function dominantColor(blob: Blob): Promise<string | null> {
  const bitmap = await createImageBitmap(blob)
  const size = 64
  const canvas: OffscreenCanvas | HTMLCanvasElement =
    typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(size, size) : Object.assign(document.createElement('canvas'), { width: size, height: size })
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null
  if (!ctx) return null
  const sx = bitmap.width * 0.2
  const sy = bitmap.height * 0.2
  ctx.drawImage(bitmap, sx, sy, bitmap.width * 0.6, bitmap.height * 0.6, 0, 0, size, size)
  bitmap.close()
  return dominantColorFromPixels(ctx.getImageData(0, 0, size, size).data)
}
