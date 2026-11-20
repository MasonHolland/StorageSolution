import { describe, expect, it } from 'vitest'
import type { Container, Item, Space, Stack } from '../../db/schema'
import { buildSearchIndex, describeLocation, search } from './searchIndex'

const c = (id: string, code: string, name: string, room?: string) =>
  ({ id, code, name, originRoom: room, notes: '' }) as Container
const i = (id: string, containerId: string, name: string, tags: string[] = []) =>
  ({ id, containerId, name, tags, notes: '' }) as unknown as Item

describe('search', () => {
  const index = buildSearchIndex(
    [c('1', 'B-001', 'Kitchen stuff', 'Kitchen'), c('2', 'B-002', 'Books')],
    [i('a', '1', 'Waffle iron', ['appliance']), i('b', '2', 'Atlas'), i('c', '1', 'Wine glasses', ['fragile'])],
  )
  it('finds items by prefix and typo', () => {
    expect(search(index, 'waff')[0]).toMatchObject({ type: 'item', title: 'Waffle iron', code: 'B-001' })
    expect(search(index, 'wafle')[0].title).toBe('Waffle iron')
  })
  it('finds by tag, code and room', () => {
    expect(search(index, 'fragile')[0].title).toBe('Wine glasses')
    expect(search(index, 'B-002').some((h) => h.containerId === '2')).toBe(true)
    expect(search(index, 'kitchen').every((h) => h.containerId === '1')).toBe(true)
  })
  it('returns nothing for blank queries', () => expect(search(index, '  ')).toEqual([]))

  it('describes a location', () => {
    const stack = { id: 's', spaceId: 'sp', label: 'Stack 2' } as Stack
    const space = { id: 'sp', name: 'Garage' } as Space
    const box = { stackId: 's', stackIndex: 1 } as Container
    expect(describeLocation(box, new Map([['s', stack]]), new Map([['sp', space]]), new Map([['s', 4]])))
      .toBe('Garage › Stack 2 › 2nd from bottom')
    expect(describeLocation({} as Container, new Map(), new Map(), new Map())).toBe('Not placed yet')
  })
})
