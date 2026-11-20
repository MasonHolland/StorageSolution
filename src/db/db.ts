import Dexie, { type EntityTable } from 'dexie'
import type { Container, Item, Photo, Setting, Space, Stack } from './schema'

export class StorageDB extends Dexie {
  spaces!: EntityTable<Space, 'id'>
  stacks!: EntityTable<Stack, 'id'>
  containers!: EntityTable<Container, 'id'>
  items!: EntityTable<Item, 'id'>
  photos!: EntityTable<Photo, 'id'>
  settings!: EntityTable<Setting, 'key'>

  constructor(name = 'storage-solution') {
    super(name)
    this.version(1).stores({
      spaces: 'id, name',
      stacks: 'id, spaceId',
      containers: 'id, &code, stackId, parentId, status, updatedAt',
      items: 'id, containerId, name',
      photos: 'id, containerId',
      settings: 'key',
    })
  }
}

export const db = new StorageDB()
