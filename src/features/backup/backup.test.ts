// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/db'
import * as repo from '../../db/repo'
import { exportBackup, importBackup } from './backup'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

async function seed() {
  const space = await repo.createSpace({ name: 'Garage' })
  const stack = await repo.createStack(space.id, 0, 0)
  const box = await repo.createContainer({ name: 'Kitchen', color: '#3c6fb4' })
  await repo.addItem(box.id, { name: 'Waffle iron', tags: ['appliance'] })
  await repo.addPhoto(
    box.id,
    new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' }),
    new Blob([new Uint8Array([9])], { type: 'image/webp' }),
  )
  await repo.placeInStack(box.id, stack.id)
  return box
}

describe('backup', () => {
  it('round-trips all data and photos with replace', async () => {
    const box = await seed()
    const zip = await exportBackup()
    await Promise.all(db.tables.map((t) => t.clear()))
    const result = await importBackup(zip, 'replace')
    expect(result).toMatchObject({ containers: 1, items: 1, photos: 1 })
    const restored = await repo.getContainer(box.id)
    expect(restored).toMatchObject({ name: 'Kitchen', color: '#3c6fb4', status: 'stored', stackIndex: 0 })
    const [photo] = await repo.listPhotos(box.id)
    expect(new Uint8Array(await photo.blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
    expect(photo.blob.type).toBe('image/webp')
    expect((await repo.listItems(box.id))[0].tags).toEqual(['appliance'])
  })

  it('merge renames clashing codes instead of failing', async () => {
    await seed()
    const zip = await exportBackup()
    await Promise.all(db.tables.map((t) => t.clear()))
    await repo.createContainer({ name: 'Other device box' }) // also B-001, different id
    const result = await importBackup(zip, 'merge')
    expect(result.renamedCodes).toBe(1)
    const codes = (await db.containers.toArray()).map((c) => c.code).sort()
    expect(codes).toEqual(['B-001', 'B-002'])
  })

  it('rejects files that are not backups', async () => {
    await expect(importBackup(new Blob(['nope']), 'replace')).rejects.toThrow()
  })
})
