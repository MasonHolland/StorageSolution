// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import * as repo from './repo'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('repo', () => {
  it('creates containers with sequential codes', async () => {
    const a = await repo.createContainer({ name: 'Kitchen 1' })
    const b = await repo.createContainer()
    expect(a.code).toBe('B-001')
    expect(b.code).toBe('B-002')
    await repo.setSetting('codePrefix', 'K')
    expect((await repo.createContainer()).code).toBe('K-001')
  })

  it('adds, updates and lists items', async () => {
    const c = await repo.createContainer()
    await repo.addItem(c.id, { name: 'Waffle iron' })
    const mugs = await repo.addItem(c.id, { name: 'Mugs', qty: 6 })
    await repo.updateItem(mugs.id, { qty: 4 })
    const items = await repo.listItems(c.id)
    expect(items.map((i) => [i.name, i.qty])).toEqual([['Waffle iron', 1], ['Mugs', 4]])
  })

  it('deleting a container removes its items and photos', async () => {
    const c = await repo.createContainer()
    await repo.addItem(c.id, { name: 'Plates' })
    await repo.addPhoto(c.id, new Blob(['x']), new Blob(['y']))
    await repo.deleteContainer(c.id)
    expect(await db.items.count()).toBe(0)
    expect(await db.photos.count()).toBe(0)
  })

  it('places, reorders and removes boxes in a stack', async () => {
    const space = await repo.createSpace({ name: 'Unit 12' })
    const stack = await repo.createStack(space.id, 0, 0)
    const a = await repo.createContainer()
    const b = await repo.createContainer()
    const c = await repo.createContainer()
    await repo.placeInStack(a.id, stack.id)
    await repo.placeInStack(b.id, stack.id)
    await repo.placeInStack(c.id, stack.id, 0)
    const order = async () => (await repo.listStackContainers(stack.id)).map((x) => x.id)
    expect(await order()).toEqual([c.id, a.id, b.id])
    expect((await repo.getContainer(a.id))?.status).toBe('stored')

    await repo.reorderStack(stack.id, [b.id, c.id, a.id])
    expect(await order()).toEqual([b.id, c.id, a.id])

    await repo.removeFromStack(c.id)
    expect(await order()).toEqual([b.id, a.id])
    expect((await repo.listStackContainers(stack.id)).map((x) => x.stackIndex)).toEqual([0, 1])
    expect((await repo.getContainer(c.id))?.stackId).toBeUndefined()
    expect(await repo.listUnplacedContainers()).toHaveLength(1)
  })

  it('moving a box between stacks compacts the old one', async () => {
    const space = await repo.createSpace()
    const s1 = await repo.createStack(space.id, 0, 0)
    const s2 = await repo.createStack(space.id, 50, 0)
    const a = await repo.createContainer()
    const b = await repo.createContainer()
    await repo.placeInStack(a.id, s1.id)
    await repo.placeInStack(b.id, s1.id)
    await repo.placeInStack(a.id, s2.id)
    expect((await repo.listStackContainers(s1.id)).map((x) => [x.id, x.stackIndex])).toEqual([[b.id, 0]])
  })

  it('deleting a space unplaces its boxes', async () => {
    const space = await repo.createSpace()
    const stack = await repo.createStack(space.id, 0, 0)
    const a = await repo.createContainer()
    await repo.placeInStack(a.id, stack.id)
    await repo.deleteSpace(space.id)
    expect(await db.stacks.count()).toBe(0)
    expect((await repo.getContainer(a.id))?.stackId).toBeUndefined()
  })

  it('finds a container by code, case-insensitively', async () => {
    const a = await repo.createContainer()
    expect((await repo.getContainerByCode('b-001'))?.id).toBe(a.id)
  })
})
