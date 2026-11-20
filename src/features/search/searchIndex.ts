import MiniSearch from 'minisearch'
import type { Container, Item, Space, Stack } from '../../db/schema'

export interface SearchDoc {
  id: string
  type: 'item' | 'container'
  containerId: string
  title: string
  tags: string
  category: string
  notes: string
  code: string
  containerName: string
  room: string
}

export function buildSearchIndex(containers: Container[], items: Item[]) {
  const byId = new Map(containers.map((c) => [c.id, c]))
  const docs: SearchDoc[] = []
  for (const c of containers) {
    docs.push({
      id: `c:${c.id}`,
      type: 'container',
      containerId: c.id,
      title: c.name || c.code,
      tags: '',
      category: '',
      notes: c.notes,
      code: c.code,
      containerName: c.name,
      room: c.originRoom ?? '',
    })
  }
  for (const i of items) {
    const c = byId.get(i.containerId)
    if (!c) continue
    docs.push({
      id: `i:${i.id}`,
      type: 'item',
      containerId: c.id,
      title: i.name,
      tags: i.tags.join(' '),
      category: i.category ?? '',
      notes: i.notes,
      code: c.code,
      containerName: c.name,
      room: c.originRoom ?? '',
    })
  }
  const index = new MiniSearch<SearchDoc>({
    fields: ['title', 'tags', 'category', 'notes', 'code', 'containerName', 'room'],
    storeFields: ['type', 'containerId', 'title', 'code', 'containerName', 'room'],
    searchOptions: {
      boost: { title: 3, code: 3, tags: 2, category: 1.5 },
      prefix: true,
      fuzzy: 0.2,
    },
  })
  index.addAll(docs)
  return index
}

export interface SearchHit {
  id: string
  type: 'item' | 'container'
  containerId: string
  title: string
  code: string
  containerName: string
  room: string
  score: number
}

export function search(index: MiniSearch<SearchDoc>, query: string, limit = 50): SearchHit[] {
  const q = query.trim()
  if (!q) return []
  return index.search(q).slice(0, limit) as unknown as SearchHit[]
}

/** "Garage › Stack 2 › 3rd from bottom", or "Not placed yet". */
export function describeLocation(
  c: Container | undefined,
  stacks: Map<string, Stack>,
  spaces: Map<string, Space>,
  stackSizes: Map<string, number>,
): string {
  if (!c) return ''
  if (c.parentId) return 'Inside a drawer unit'
  if (!c.stackId) return 'Not placed yet'
  const stack = stacks.get(c.stackId)
  if (!stack) return 'Not placed yet'
  const space = spaces.get(stack.spaceId)
  const pos = (c.stackIndex ?? 0) + 1
  const size = stackSizes.get(stack.id) ?? pos
  const where = size === 1 ? 'on its own' : pos === size ? 'top' : pos === 1 ? 'bottom' : `${ordinal(pos)} from bottom`
  return [space?.name, stack.label, where].filter(Boolean).join(' › ')
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
