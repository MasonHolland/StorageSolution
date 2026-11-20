import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import * as repo from '../../db/repo'
import type { Container } from '../../db/schema'
import { BoxGlyph, PageHeader, useToast } from '../../app/ui'
import { DownIcon, EditIcon, PlusIcon, RotateIcon, TrashIcon, UpIcon } from '../../app/icons'
import { FloorPlanView, type StackWithBoxes } from './FloorPlanView'
import { StackFrontView } from './StackFrontView'
import { findFreeSpot, stackFootprint } from './layoutMath'
import { SpaceForm } from '../spaces/SpacesPage'

export function SpaceLayoutPage() {
  const { spaceId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [editing, setEditing] = useState(false)

  const data = useLiveQuery(async () => {
    const space = await repo.getSpace(spaceId)
    if (!space) return null
    const stacks = await repo.listStacks(spaceId)
    stacks.sort((a, b) => a.createdAt - b.createdAt)
    const withBoxes: StackWithBoxes[] = await Promise.all(
      stacks.map(async (stack) => ({ stack, boxes: await repo.listStackContainers(stack.id) })),
    )
    const unplaced = await repo.listUnplacedContainers()
    return { space, stacks: withBoxes, unplaced }
  }, [spaceId])

  const stackId = params.get('stack') ?? undefined
  const highlight = params.get('highlight') ?? undefined
  const view = stackId ? 'stack' : 'floor'

  if (data === undefined) return null
  if (data === null) return <main className="page"><PageHeader back="/layout" title="Space not found" /></main>
  const { space, stacks, unplaced } = data
  const current = stacks.find((s) => s.stack.id === stackId)

  const go = (next: { stack?: string; highlight?: string }) => {
    const p = new URLSearchParams()
    if (next.stack) p.set('stack', next.stack)
    if (next.highlight) p.set('highlight', next.highlight)
    setParams(p, { replace: true })
  }

  async function addStack() {
    const taken = stacks.map((s) => stackFootprint(s.stack, s.boxes))
    const spot = findFreeSpot(space, taken)
    const s = await repo.createStack(space.id, spot.x, spot.y)
    toast(`${s.label} added – drag it into place`)
  }

  async function deleteSpace() {
    if (!confirm(`Delete "${space.name}"? Boxes in it become "not placed"; nothing else is lost.`)) return
    await repo.deleteSpace(space.id)
    navigate('/layout', { replace: true })
  }

  return (
    <main className="page">
      <PageHeader back="/layout" title={space.name}>
        <button className="btn-ghost btn-icon" aria-label="Edit space" onClick={() => setEditing((e) => !e)}><EditIcon width={20} height={20} /></button>
      </PageHeader>

      {editing && (
        <>
          <SpaceForm space={space} onDone={() => setEditing(false)} />
          <button className="btn-danger" onClick={() => void deleteSpace()}><TrashIcon width={18} height={18} /> Delete space</button>
        </>
      )}

      <div className="view-tabs" role="tablist">
        <button role="tab" aria-selected={view === 'floor'} className={view === 'floor' ? 'active' : ''} onClick={() => go({})}>
          Floor plan
        </button>
        <button role="tab" aria-selected={view === 'stack'} className={view === 'stack' ? 'active' : ''}
          disabled={!stacks.length} onClick={() => go({ stack: current?.stack.id ?? stacks[0]?.stack.id })}>
          Stack front {current ? `· ${current.stack.label}` : ''}
        </button>
      </div>

      {view === 'floor' || !current ? (
        <>
          <FloorPlanView
            space={space}
            stacks={stacks}
            highlightStackId={highlight ? stacks.find((s) => s.boxes.some((b) => b.id === highlight))?.stack.id : undefined}
            onSelect={(id) => go({ stack: id })}
            onMove={(id, x, y) => void repo.updateStack(id, { xCm: x, yCm: y })}
          />
          <div className="btn-row">
            <button className="btn-primary" onClick={() => void addStack()}><PlusIcon width={18} height={18} /> Add stack</button>
          </div>
          <p className="muted small" style={{ margin: 0 }}>
            Drag stacks to where they sit. Tap one to see its boxes from the front. The thick line marks the door.
          </p>
          {stacks.length === 0 && (
            <div className="empty card">
              <h2>No stacks yet</h2>
              <p>A stack is a spot on the floor where boxes are piled up, or a shelf. Add one, then put boxes in it.</p>
            </div>
          )}
        </>
      ) : (
        <StackPanel
          entry={current}
          all={stacks}
          unplaced={unplaced}
          highlight={highlight}
          space={space}
          onNavigate={(id) => go({ stack: id })}
          onDeleted={() => go({})}
        />
      )}

      {unplaced.length > 0 && view === 'floor' && (
        <p className="small" style={{ margin: 0 }}>
          <Link to="/">{unplaced.length} box{unplaced.length === 1 ? ' isn’t' : 'es aren’t'} placed yet.</Link> Open a stack to add them.
        </p>
      )}
    </main>
  )
}

function StackPanel({
  entry, all, unplaced, highlight, space, onNavigate, onDeleted,
}: {
  entry: StackWithBoxes
  all: StackWithBoxes[]
  unplaced: Container[]
  highlight?: string
  space: Parameters<typeof StackFrontView>[0]['space']
  onNavigate: (id: string) => void
  onDeleted: () => void
}) {
  const navigate = useNavigate()
  const { stack, boxes } = entry
  const [label, setLabel] = useState(stack.label)
  const [labelFor, setLabelFor] = useState(stack.id)
  if (labelFor !== stack.id) {
    setLabelFor(stack.id)
    setLabel(stack.label)
  }
  const idx = all.findIndex((s) => s.stack.id === stack.id)

  async function move(id: string, delta: number) {
    const ids = boxes.map((b) => b.id)
    const i = ids.indexOf(id)
    const j = i + delta
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    await repo.reorderStack(stack.id, ids)
  }

  async function remove() {
    if (!confirm(`Delete ${stack.label}? Its ${boxes.length} boxes become "not placed".`)) return
    await repo.deleteStack(stack.id)
    onDeleted()
  }

  return (
    <>
      <div className="toolbar">
        <button className="btn-icon" aria-label="Previous stack" disabled={idx <= 0} onClick={() => onNavigate(all[idx - 1].stack.id)}>‹</button>
        <input aria-label="Stack name" value={label} onChange={(e) => setLabel(e.target.value)}
          onBlur={() => label.trim() && label !== stack.label && void repo.updateStack(stack.id, { label: label.trim() })} />
        <button className="btn-icon" aria-label="Next stack" disabled={idx >= all.length - 1} onClick={() => onNavigate(all[idx + 1].stack.id)}>›</button>
      </div>

      <StackFrontView space={space} stack={stack} boxes={boxes} highlightId={highlight} onOpen={(id) => navigate(`/c/${id}`)} />

      <section className="card stack-v">
        <h2 style={{ margin: 0 }}>Boxes, top to bottom</h2>
        {boxes.length === 0 && <p className="muted small" style={{ margin: 0 }}>Nothing here yet.</p>}
        <ul className="list">
          {[...boxes].reverse().map((c) => {
            const pos = boxes.indexOf(c)
            return (
              <li key={c.id} className="list-row" style={c.id === highlight ? { borderColor: 'var(--highlight)', borderWidth: 2 } : undefined}>
                <BoxGlyph c={c} size={40} />
                <Link className="grow" to={`/c/${c.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                  <div className="title"><span className="code">{c.code}</span> {c.name}</div>
                  <div className="sub">{c.heightCm} cm tall{c.fragile ? ' · fragile' : ''}</div>
                </Link>
                <button className="btn-icon btn-ghost" aria-label={`Move ${c.code} up`} disabled={pos === boxes.length - 1} onClick={() => void move(c.id, 1)}><UpIcon width={18} height={18} /></button>
                <button className="btn-icon btn-ghost" aria-label={`Move ${c.code} down`} disabled={pos === 0} onClick={() => void move(c.id, -1)}><DownIcon width={18} height={18} /></button>
                <button className="btn-icon btn-ghost" aria-label={`Take ${c.code} out`} onClick={() => void repo.removeFromStack(c.id)}><TrashIcon width={18} height={18} /></button>
              </li>
            )
          })}
        </ul>
        {unplaced.length > 0 && (
          <select aria-label="Add a box to this stack" value="" onChange={(e) => e.target.value && void repo.placeInStack(e.target.value, stack.id)}>
            <option value="">+ Put a box on top…</option>
            {unplaced.map((c) => <option key={c.id} value={c.id}>{c.code} {c.name}</option>)}
          </select>
        )}
      </section>

      <div className="btn-row">
        <button onClick={() => void repo.updateStack(stack.id, { rotation: stack.rotation === 90 ? 0 : 90 })}>
          <RotateIcon width={18} height={18} /> Rotate footprint
        </button>
        <button className="btn-danger" onClick={() => void remove()}><TrashIcon width={18} height={18} /> Delete stack</button>
      </div>
    </>
  )
}
