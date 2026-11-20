import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import * as repo from '../../db/repo'
import type { Container, ContainerStatus } from '../../db/schema'
import { KIND_LABELS, STATUS_LABELS } from '../../db/schema'
import { BoxGlyph, PageHeader, StatusBadge, useToast } from '../../app/ui'
import { EditIcon, PlusIcon, PrintIcon, TrashIcon } from '../../app/icons'
import { CameraCapture } from '../capture/CameraCapture'
import { PhotoStrip } from '../capture/PhotoStrip'
import { ItemList } from '../items/ItemList'
import { describeLocation } from '../search/searchIndex'
import { findFreeSpot, stackFootprint } from '../layout/layoutMath'
import { SuggestButton } from '../suggest/SuggestButton'

export function ContainerDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const c = useLiveQuery(async () => (await repo.getContainer(id)) ?? null, [id])

  if (c === undefined) return null
  if (c === null) {
    return (
      <main className="page">
        <PageHeader back="/" title="Box not found" />
        <p className="muted">This box isn't on this device. If it was logged on another phone, import that phone's backup in Settings.</p>
      </main>
    )
  }

  async function remove() {
    if (!c || !confirm(`Delete ${c.code} and everything logged in it? This can't be undone.`)) return
    await repo.deleteContainer(c.id)
    toast(`Deleted ${c.code}`)
    navigate('/', { replace: true })
  }

  return (
    <main className="page">
      <PageHeader back="/" title={<><span className="code">{c.code}</span> {c.name}</>}>
        <Link className="btn btn-icon btn-ghost" to={`/c/${c.id}/edit`} aria-label="Edit box"><EditIcon width={20} height={20} /></Link>
      </PageHeader>

      <section className="card stack-v">
        <div className="toolbar" style={{ alignItems: 'flex-start' }}>
          <BoxGlyph c={c} size={64} />
          <div style={{ flex: 1 }} className="stack-v">
            <StatusBadge c={c} />
            <div className="small muted">
              {KIND_LABELS[c.kind]} · {c.widthCm}×{c.depthCm}×{c.heightCm} cm{c.originRoom ? ` · from ${c.originRoom}` : ''}
            </div>
          </div>
        </div>
        <StatusPicker c={c} />
        {c.notes && <p className="small" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{c.notes}</p>}
      </section>

      <section className="card stack-v">
        <div className="toolbar">
          <h2 style={{ flex: 1, margin: 0 }}>Photos</h2>
          <SuggestButton containerId={c.id} />
          <CameraCapture className="btn btn-small" onCapture={async (p) => {
            await repo.addPhoto(c.id, p.blob, p.thumb)
            toast('Photo added')
          }}>Add</CameraCapture>
        </div>
        <PhotoStrip containerId={c.id} />
      </section>

      <section className="card stack-v">
        <h2 style={{ margin: 0 }}>Items</h2>
        <ItemList containerId={c.id} />
      </section>

      {c.kind === 'drawerUnit' && <Drawers unit={c} />}

      <LocationCard c={c} />

      <div className="btn-row">
        <Link className="btn" to={`/labels?ids=${c.id}`}><PrintIcon width={18} height={18} /> Print label</Link>
        <button className="btn-danger" onClick={() => void remove()}><TrashIcon width={18} height={18} /> Delete box</button>
      </div>
    </main>
  )
}

function StatusPicker({ c }: { c: Container }) {
  return (
    <div className="view-tabs" role="group" aria-label="Status">
      {(Object.keys(STATUS_LABELS) as ContainerStatus[]).map((s) => (
        <button key={s} className={c.status === s ? 'active' : ''} aria-pressed={c.status === s}
          onClick={() => void repo.updateContainer(c.id, { status: s })}>
          {STATUS_LABELS[s]}
        </button>
      ))}
    </div>
  )
}

function Drawers({ unit }: { unit: Container }) {
  const drawers = useLiveQuery(() => repo.listChildren(unit.id), [unit.id])
  return (
    <section className="card stack-v">
      <div className="toolbar">
        <h2 style={{ flex: 1, margin: 0 }}>Drawers</h2>
        <Link className="btn btn-small" to={`/c/new?parent=${unit.id}`}><PlusIcon width={16} height={16} /> Add drawer</Link>
      </div>
      {drawers?.length ? (
        <ul className="list">
          {drawers.map((d) => (
            <li key={d.id}>
              <Link className="list-row" to={`/c/${d.id}`}>
                <BoxGlyph c={d} size={40} />
                <div className="grow"><div className="title"><span className="code">{d.code}</span> {d.name}</div></div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">Log each drawer separately so its contents can be searched.</p>
      )}
    </section>
  )
}

function LocationCard({ c }: { c: Container }) {
  const toast = useToast()
  const data = useLiveQuery(async () => {
    const spaces = await repo.listSpaces()
    const stacksBySpace = new Map(await Promise.all(spaces.map(async (s) => [s.id, await repo.listStacks(s.id)] as const)))
    const stack = c.stackId ? await repo.getStack(c.stackId) : undefined
    const stackSize = stack ? (await repo.listStackContainers(stack.id)).length : 0
    const parent = c.parentId ? await repo.getContainer(c.parentId) : undefined
    return { spaces, stacksBySpace, stack, stackSize, parent }
  }, [c.stackId, c.stackIndex, c.parentId])
  const [spaceId, setSpaceId] = useState('')
  const [stackId, setStackId] = useState('')

  if (!data) return null
  const { spaces, stacksBySpace, stack, stackSize, parent } = data

  if (parent) {
    return (
      <section className="card">
        <h2>Location</h2>
        <p style={{ margin: 0 }}>Inside <Link to={`/c/${parent.id}`}><span className="code">{parent.code}</span> {parent.name}</Link></p>
      </section>
    )
  }

  if (stack) {
    const space = spaces.find((s) => s.id === stack.spaceId)
    const text = describeLocation(c, new Map([[stack.id, stack]]), new Map(space ? [[space.id, space]] : []), new Map([[stack.id, stackSize]]))
    return (
      <section className="card stack-v">
        <h2 style={{ margin: 0 }}>Location</h2>
        <p style={{ margin: 0 }}>{text}</p>
        <div className="btn-row">
          <Link className="btn btn-primary" to={`/layout/${stack.spaceId}?stack=${stack.id}&highlight=${c.id}`}>Show in layout</Link>
          <button onClick={() => void repo.removeFromStack(c.id).then(() => toast('Removed from stack'))}>Take out of stack</button>
        </div>
      </section>
    )
  }

  const chosenSpace = spaceId || spaces[0]?.id || ''
  const stacks = stacksBySpace.get(chosenSpace) ?? []

  async function place() {
    let target = stackId
    if (!target || !stacks.some((s) => s.id === target)) {
      const space = spaces.find((s) => s.id === chosenSpace)!
      const taken = await Promise.all(stacks.map(async (s) => stackFootprint(s, await repo.listStackContainers(s.id))))
      const spot = findFreeSpot(space, taken, { w: c.widthCm, h: c.depthCm })
      target = (await repo.createStack(chosenSpace, spot.x, spot.y)).id
    }
    await repo.placeInStack(c.id, target)
    toast('Placed')
  }

  return (
    <section className="card stack-v">
      <h2 style={{ margin: 0 }}>Location</h2>
      {spaces.length === 0 ? (
        <>
          <p className="muted small" style={{ margin: 0 }}>Not placed yet. Set up a storage space (a unit, garage or room) to record where boxes go.</p>
          <Link className="btn" to="/layout">Set up a storage space</Link>
        </>
      ) : (
        <>
          <p className="muted small" style={{ margin: 0 }}>Not placed yet. Put it on top of a stack:</p>
          <div className="grid-2">
            <select aria-label="Space" value={chosenSpace} onChange={(e) => { setSpaceId(e.target.value); setStackId('') }}>
              {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select aria-label="Stack" value={stackId} onChange={(e) => setStackId(e.target.value)}>
              <option value="">New stack</option>
              {stacks.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <button className="btn-primary" onClick={() => void place()}>Place box</button>
        </>
      )}
    </section>
  )
}
