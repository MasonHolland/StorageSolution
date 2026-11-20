// The data access layer. UI code reads and writes through these functions only,
// so a sync backend can later replace or wrap Dexie without touching components.
import { db } from './db'
import type { Container, Item, Photo, Space, Stack } from './schema'
import { newId, nextCode } from '../lib/codes'

const now = () => Date.now()

// ---------- settings ----------

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key)
  return row === undefined ? fallback : (row.value as T)
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value })
}

// ---------- containers ----------

export type NewContainer = Partial<Omit<Container, 'id' | 'code' | 'createdAt' | 'updatedAt'>> & {
  code?: string
}

export async function createContainer(input: NewContainer = {}): Promise<Container> {
  return db.transaction('rw', db.containers, db.settings, async () => {
    const prefix = await getSetting('codePrefix', 'B')
    const codes = (await db.containers.toArray()).map((c) => c.code)
    const t = now()
    const container: Container = {
      name: '',
      kind: 'box',
      widthCm: 45,
      depthCm: 45,
      heightCm: 40,
      sizePreset: 'medium',
      color: '#c19a6b',
      status: 'packing',
      fragile: false,
      priority: 'normal',
      notes: '',
      ...input,
      id: newId(),
      code: input.code ?? nextCode(codes, prefix),
      createdAt: t,
      updatedAt: t,
    }
    await db.containers.add(container)
    return container
  })
}

export async function updateContainer(id: string, changes: Partial<Container>): Promise<void> {
  const { id: _ignored, ...rest } = changes
  await db.containers.update(id, { ...rest, updatedAt: now() })
}

export async function deleteContainer(id: string): Promise<void> {
  await db.transaction('rw', [db.containers, db.items, db.photos], async () => {
    const c = await db.containers.get(id)
    await db.items.where('containerId').equals(id).delete()
    await db.photos.where('containerId').equals(id).delete()
    // Drawers inside a deleted unit become loose containers.
    await db.containers.where('parentId').equals(id).modify({ parentId: undefined })
    await db.containers.delete(id)
    if (c?.stackId) await compactStack(c.stackId)
  })
}

export function getContainer(id: string) {
  return db.containers.get(id)
}

export function getContainerByCode(code: string) {
  return db.containers.where('code').equalsIgnoreCase(code).first()
}

export function listContainers() {
  return db.containers.orderBy('updatedAt').reverse().toArray()
}

export function listUnplacedContainers() {
  return db.containers.filter((c) => !c.stackId && !c.parentId).toArray()
}

export function listChildren(parentId: string) {
  return db.containers.where('parentId').equals(parentId).toArray()
}

// ---------- items ----------

export async function addItem(
  containerId: string,
  input: Partial<Omit<Item, 'id' | 'containerId' | 'createdAt'>> & { name: string },
): Promise<Item> {
  const item: Item = { qty: 1, tags: [], notes: '', ...input, id: newId(), containerId, createdAt: now() }
  await db.transaction('rw', db.items, db.containers, async () => {
    await db.items.add(item)
    await db.containers.update(containerId, { updatedAt: now() })
  })
  return item
}

export async function updateItem(id: string, changes: Partial<Item>): Promise<void> {
  const { id: _ignored, ...rest } = changes
  await db.items.update(id, rest)
}

export async function deleteItem(id: string): Promise<void> {
  await db.items.delete(id)
}

export function listItems(containerId: string) {
  return db.items.where('containerId').equals(containerId).sortBy('createdAt')
}

export function listAllItems() {
  return db.items.toArray()
}

/** Item names used most often, for quick-add chips. */
export async function frequentItemNames(limit = 12): Promise<string[]> {
  const counts = new Map<string, number>()
  await db.items.each((i) => {
    const key = i.name.trim()
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
  })
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([n]) => n)
}

// ---------- photos ----------

export async function addPhoto(containerId: string, blob: Blob, thumb: Blob): Promise<Photo> {
  const photo: Photo = { id: newId(), containerId, blob, thumb, createdAt: now() }
  await db.photos.add(photo)
  await db.containers.update(containerId, { updatedAt: now() })
  return photo
}

export async function deletePhoto(id: string): Promise<void> {
  await db.transaction('rw', db.photos, db.items, async () => {
    await db.items.filter((i) => i.photoId === id).modify({ photoId: undefined })
    await db.photos.delete(id)
  })
}

export function listPhotos(containerId: string) {
  return db.photos.where('containerId').equals(containerId).sortBy('createdAt')
}

/** First photo of every container, keyed by container id, for list thumbnails. */
export async function coverPhotos(): Promise<Map<string, Photo>> {
  const map = new Map<string, Photo>()
  const all = await db.photos.orderBy('id').toArray()
  all.sort((a, b) => a.createdAt - b.createdAt)
  for (const p of all) if (!map.has(p.containerId)) map.set(p.containerId, p)
  return map
}

// ---------- spaces ----------

export async function createSpace(input: Partial<Omit<Space, 'id' | 'createdAt'>> = {}): Promise<Space> {
  const space: Space = {
    name: 'Storage unit',
    widthCm: 300,
    depthCm: 300,
    heightCm: 250,
    notes: '',
    ...input,
    id: newId(),
    createdAt: now(),
  }
  await db.spaces.add(space)
  return space
}

export async function updateSpace(id: string, changes: Partial<Space>): Promise<void> {
  const { id: _ignored, ...rest } = changes
  await db.spaces.update(id, rest)
}

export async function deleteSpace(id: string): Promise<void> {
  await db.transaction('rw', db.spaces, db.stacks, db.containers, async () => {
    const stackIds = (await db.stacks.where('spaceId').equals(id).toArray()).map((s) => s.id)
    if (stackIds.length) {
      await db.containers
        .where('stackId')
        .anyOf(stackIds)
        .modify({ stackId: undefined, stackIndex: undefined, updatedAt: now() })
    }
    await db.stacks.bulkDelete(stackIds)
    await db.spaces.delete(id)
  })
}

export function listSpaces() {
  return db.spaces.orderBy('name').toArray()
}

export function getSpace(id: string) {
  return db.spaces.get(id)
}

// ---------- stacks ----------

export async function createStack(spaceId: string, xCm: number, yCm: number): Promise<Stack> {
  const count = await db.stacks.where('spaceId').equals(spaceId).count()
  const stack: Stack = {
    id: newId(),
    spaceId,
    label: `Stack ${count + 1}`,
    xCm,
    yCm,
    rotation: 0,
    createdAt: now(),
  }
  await db.stacks.add(stack)
  return stack
}

export async function updateStack(id: string, changes: Partial<Stack>): Promise<void> {
  const { id: _ignored, ...rest } = changes
  await db.stacks.update(id, rest)
}

export async function deleteStack(id: string): Promise<void> {
  await db.transaction('rw', db.stacks, db.containers, async () => {
    await db.containers
      .where('stackId')
      .equals(id)
      .modify({ stackId: undefined, stackIndex: undefined, updatedAt: now() })
    await db.stacks.delete(id)
  })
}

export function listStacks(spaceId: string) {
  return db.stacks.where('spaceId').equals(spaceId).toArray()
}

export function getStack(id: string) {
  return db.stacks.get(id)
}

/** Containers in a stack, bottom first. */
export async function listStackContainers(stackId: string): Promise<Container[]> {
  const list = await db.containers.where('stackId').equals(stackId).toArray()
  return list.sort((a, b) => (a.stackIndex ?? 0) - (b.stackIndex ?? 0))
}

/** Puts a container in a stack at `index` (default: on top), shifting the others. */
export async function placeInStack(containerId: string, stackId: string, index?: number): Promise<void> {
  await db.transaction('rw', db.containers, async () => {
    const c = await db.containers.get(containerId)
    if (!c) throw new Error(`Container ${containerId} not found`)
    const previousStack = c.stackId
    const others = (await listStackContainers(stackId)).filter((x) => x.id !== containerId)
    const at = index === undefined ? others.length : Math.max(0, Math.min(index, others.length))
    others.splice(at, 0, c)
    await writeOrder(stackId, others.map((x) => x.id))
    await db.containers.update(containerId, {
      status: c.status === 'packing' || c.status === 'sealed' ? 'stored' : c.status,
    })
    if (previousStack && previousStack !== stackId) await compactStack(previousStack)
  })
}

export async function removeFromStack(containerId: string): Promise<void> {
  await db.transaction('rw', db.containers, async () => {
    const c = await db.containers.get(containerId)
    if (!c?.stackId) return
    await db.containers.update(containerId, { stackId: undefined, stackIndex: undefined, updatedAt: now() })
    await compactStack(c.stackId)
  })
}

/** Rewrites a stack's order; `orderedIds` is bottom first. */
export async function reorderStack(stackId: string, orderedIds: string[]): Promise<void> {
  await db.transaction('rw', db.containers, () => writeOrder(stackId, orderedIds))
}

async function writeOrder(stackId: string, orderedIds: string[]) {
  const t = now()
  await Promise.all(
    orderedIds.map((id, i) => db.containers.update(id, { stackId, stackIndex: i, updatedAt: t })),
  )
}

async function compactStack(stackId: string) {
  const list = await listStackContainers(stackId)
  await writeOrder(stackId, list.map((c) => c.id))
}

/** Where a container sits: its stack, the stack's space, and its position from the bottom. */
export async function locateContainer(id: string) {
  const c = await db.containers.get(id)
  if (!c?.stackId) return { container: c, stack: undefined, space: undefined }
  const stack = await db.stacks.get(c.stackId)
  const space = stack ? await db.spaces.get(stack.spaceId) : undefined
  return { container: c, stack, space }
}
