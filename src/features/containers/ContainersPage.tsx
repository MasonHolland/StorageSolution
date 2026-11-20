import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import * as repo from '../../db/repo'
import type { Container, ContainerStatus } from '../../db/schema'
import { STATUS_LABELS } from '../../db/schema'
import { BoxGlyph, PageHeader, StatusBadge, useObjectUrl } from '../../app/ui'
import { PlusIcon, PrintIcon } from '../../app/icons'
import { BackupReminder } from '../backup/BackupReminder'

type Filter = 'all' | 'unplaced' | ContainerStatus

export function ContainersPage() {
  const containers = useLiveQuery(repo.listContainers)
  const covers = useLiveQuery(repo.coverPhotos)
  const itemCounts = useLiveQuery(async () => {
    const counts = new Map<string, number>()
    for (const i of await repo.listAllItems()) counts.set(i.containerId, (counts.get(i.containerId) ?? 0) + 1)
    return counts
  })
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (containers ?? []).filter((c) => {
      if (filter === 'unplaced' && (c.stackId || c.parentId)) return false
      if (filter !== 'all' && filter !== 'unplaced' && c.status !== filter) return false
      if (!needle) return true
      return [c.code, c.name, c.originRoom ?? ''].some((s) => s.toLowerCase().includes(needle))
    })
  }, [containers, filter, q])

  if (!containers) return null

  const filters: Filter[] = ['all', 'unplaced', 'packing', 'sealed', 'stored', 'unpacked']

  return (
    <main className="page" style={{ paddingBottom: 88 }}>
      <PageHeader title="Boxes">
        {containers.length > 0 && (
          <Link className="btn btn-small" to="/labels">
            <PrintIcon width={18} height={18} /> Labels
          </Link>
        )}
      </PageHeader>

      <BackupReminder />

      {containers.length === 0 ? (
        <div className="empty card">
          <h2>No boxes yet</h2>
          <p>Add a box, snap a photo of what goes in it, and list the items. You can place it in a storage space later.</p>
          <div className="btn-row" style={{ justifyContent: 'center' }}>
            <Link className="btn btn-primary" to="/c/new">
              <PlusIcon width={18} height={18} /> Add your first box
            </Link>
            <button onClick={() => void import('../demo/demoData').then((m) => m.loadDemoData())}>
              Explore with demo data
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="toolbar">
            <input type="search" placeholder="Filter by code, name or room" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="chips" role="group" aria-label="Filter boxes">
            {filters.map((f) => (
              <button key={f} className={`chip ${filter === f ? 'selected' : ''}`} onClick={() => setFilter(f)}>
                {f === 'all' ? `All (${containers.length})` : f === 'unplaced' ? 'Not placed' : STATUS_LABELS[f]}
              </button>
            ))}
          </div>
          <ul className="list">
            {shown.map((c) => (
              <li key={c.id}>
                <ContainerRow c={c} cover={covers?.get(c.id)?.thumb} items={itemCounts?.get(c.id) ?? 0} />
              </li>
            ))}
            {shown.length === 0 && <li className="empty">Nothing matches.</li>}
          </ul>
        </>
      )}

      <Link className="btn btn-primary fab" to="/c/new" aria-label="New box">
        <PlusIcon width={20} height={20} /> New box
      </Link>
    </main>
  )
}

function ContainerRow({ c, cover, items }: { c: Container; cover?: Blob; items: number }) {
  const url = useObjectUrl(cover)
  return (
    <Link className="list-row" to={`/c/${c.id}`}>
      {url ? <img className="thumb" src={url} alt="" /> : <BoxGlyph c={c} />}
      <div className="grow">
        <div className="title">
          <span className="code">{c.code}</span> {c.name}
        </div>
        <div className="sub">
          {items} item{items === 1 ? '' : 's'}
          {c.originRoom ? ` · ${c.originRoom}` : ''}
          {!c.stackId && !c.parentId ? ' · not placed' : ''}
        </div>
      </div>
      <StatusBadge c={c} />
    </Link>
  )
}
