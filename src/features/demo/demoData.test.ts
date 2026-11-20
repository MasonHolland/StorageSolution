// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { db } from '../../db/db'
import * as repo from '../../db/repo'
import { fitsInSpace, overlaps, stackFootprint, stackTotalHeight, type Rect } from '../layout/layoutMath'
import { clearAllData, loadDemoData } from './demoData'

describe('demo data', () => {
  it('replaces existing data with a consistent household', async () => {
    await repo.createContainer({ name: 'Old box' })
    const result = await loadDemoData()

    const containers = await db.containers.toArray()
    expect(containers.some((c) => c.name === 'Old box')).toBe(false)
    expect(result.boxes).toBe(containers.length)
    expect(result.boxes).toBeGreaterThan(15)
    expect(result.items).toBeGreaterThan(60)

    // Codes are unique and sequential from B-001
    const codes = containers.map((c) => c.code).sort()
    expect(new Set(codes).size).toBe(codes.length)
    expect(codes[0]).toBe('B-001')

    // Every stack fits its space, doesn't overlap another, and is under the ceiling
    for (const space of await repo.listSpaces()) {
      const stacks = await repo.listStacks(space.id)
      const rects: Rect[] = []
      for (const s of stacks) {
        const boxes = await repo.listStackContainers(s.id)
        const fp = stackFootprint(s, boxes)
        expect(fitsInSpace(fp, space), `${s.label} fits ${space.name}`).toBe(true)
        expect(stackTotalHeight(boxes)).toBeLessThanOrEqual(space.heightCm)
        rects.push(fp)
      }
      rects.forEach((a, i) => rects.slice(i + 1).forEach((b) => expect(overlaps(a, b)).toBe(false)))
    }

    // Drawers sit inside the drawer unit, not in a stack
    const unit = containers.find((c) => c.kind === 'drawerUnit')!
    const drawers = await repo.listChildren(unit.id)
    expect(drawers).toHaveLength(3)
    expect(drawers.every((d) => !d.stackId && d.widthCm > 0)).toBe(true)

    // A mix of statuses, including boxes not placed yet
    expect((await repo.listUnplacedContainers()).length).toBe(2)
    expect(new Set(containers.map((c) => c.status))).toEqual(new Set(['packing', 'sealed', 'stored', 'unpacked']))
  })

  it('clears everything', async () => {
    await loadDemoData()
    await clearAllData()
    expect(await db.containers.count()).toBe(0)
    expect(await db.spaces.count()).toBe(0)
  })
})
