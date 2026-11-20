import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import * as repo from '../../db/repo'
import type { Space, Stack } from '../../db/schema'
import { PageHeader } from '../../app/ui'
import { buildSearchIndex, describeLocation, search } from './searchIndex'

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''

  const data = useLiveQuery(async () => {
    const [containers, items, spaces] = await Promise.all([repo.listContainers(), repo.listAllItems(), repo.listSpaces()])
    const stacks: Stack[] = (await Promise.all(spaces.map((s) => repo.listStacks(s.id)))).flat()
    const stackSizes = new Map<string, number>()
    for (const c of containers) if (c.stackId) stackSizes.set(c.stackId, (stackSizes.get(c.stackId) ?? 0) + 1)
    return {
      index: buildSearchIndex(containers, items),
      containers: new Map(containers.map((c) => [c.id, c])),
      stacks: new Map(stacks.map((s) => [s.id, s])),
      spaces: new Map<string, Space>(spaces.map((s) => [s.id, s])),
      stackSizes,
      itemCount: items.length,
    }
  })

  const hits = useMemo(() => (data ? search(data.index, q) : []), [data, q])

  return (
    <main className="page">
      <PageHeader title="Find something" />
      <input
        type="search"
        autoFocus
        placeholder={data?.itemCount ? `Search ${data.itemCount} items, boxes, rooms…` : 'Search items, boxes, rooms…'}
        value={q}
        onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })}
        aria-label="Search"
      />

      {data && q.trim() && hits.length === 0 && <p className="empty">No matches for “{q}”.</p>}
      {data && !q.trim() && (
        <p className="muted small" style={{ margin: 0 }}>Try an item (“waffle”), a tag (“fragile”), a room (“kitchen”) or a box code (“B-012”). Typos are fine.</p>
      )}

      <ul className="list">
        {data && hits.map((h) => {
          const c = data.containers.get(h.containerId)
          if (!c) return null
          const where = describeLocation(c, data.stacks, data.spaces, data.stackSizes)
          const stack = c.stackId ? data.stacks.get(c.stackId) : undefined
          return (
            <li key={h.id} className="list-row">
              <span className="swatch" style={{ background: c.color, width: 12, height: 44, minHeight: 0, border: 'none' }} />
              <Link className="grow" to={`/c/${c.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                <div className="title">{h.type === 'item' ? h.title : <><span className="code">{c.code}</span> {c.name}</>}</div>
                <div className="sub">
                  {h.type === 'item' && <><span className="code">{c.code}</span> {c.name} · </>}
                  {where}
                </div>
              </Link>
              {stack && (
                <Link className="btn btn-small" to={`/layout/${stack.spaceId}?stack=${stack.id}&highlight=${c.id}`}>Locate</Link>
              )}
            </li>
          )
        })}
      </ul>
    </main>
  )
}
