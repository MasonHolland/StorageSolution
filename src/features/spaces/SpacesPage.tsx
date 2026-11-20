import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as repo from '../../db/repo'
import type { Space } from '../../db/schema'
import { PageHeader } from '../../app/ui'
import { PlusIcon } from '../../app/icons'

const SPACE_PRESETS = [
  { label: '5×5 ft unit', widthCm: 152, depthCm: 152, heightCm: 240 },
  { label: '5×10 ft unit', widthCm: 152, depthCm: 305, heightCm: 240 },
  { label: '10×10 ft unit', widthCm: 305, depthCm: 305, heightCm: 240 },
  { label: '10×20 ft unit', widthCm: 305, depthCm: 610, heightCm: 240 },
  { label: 'Single garage', widthCm: 300, depthCm: 550, heightCm: 230 },
  { label: 'Closet', widthCm: 120, depthCm: 60, heightCm: 240 },
]

export function SpacesPage() {
  const spaces = useLiveQuery(repo.listSpaces)
  const counts = useLiveQuery(async () => {
    const all = await repo.listContainers()
    const stacks = new Map<string, string>()
    for (const s of spaces ?? []) for (const st of await repo.listStacks(s.id)) stacks.set(st.id, s.id)
    const m = new Map<string, number>()
    for (const c of all) {
      const sp = c.stackId ? stacks.get(c.stackId) : undefined
      if (sp) m.set(sp, (m.get(sp) ?? 0) + 1)
    }
    return m
  }, [spaces])
  const [adding, setAdding] = useState(false)

  if (!spaces) return null
  return (
    <main className="page">
      <PageHeader title="Storage spaces">
        {!adding && spaces.length > 0 && (
          <button className="btn-small" onClick={() => setAdding(true)}><PlusIcon width={16} height={16} /> Space</button>
        )}
      </PageHeader>

      {(adding || spaces.length === 0) && <SpaceForm onDone={() => setAdding(false)} first={spaces.length === 0} />}

      <ul className="list">
        {spaces.map((s) => (
          <li key={s.id}>
            <Link className="list-row" to={`/layout/${s.id}`}>
              <SpaceGlyph s={s} />
              <div className="grow">
                <div className="title">{s.name}</div>
                <div className="sub">
                  {(s.widthCm / 100).toFixed(1)} × {(s.depthCm / 100).toFixed(1)} m · {counts?.get(s.id) ?? 0} boxes
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}

function SpaceGlyph({ s }: { s: Space }) {
  const k = 48 / Math.max(s.widthCm, s.depthCm)
  return (
    <svg width={56} height={56} viewBox="0 0 56 56" className="thumb" aria-hidden>
      <rect x={(56 - s.widthCm * k) / 2} y={(56 - s.depthCm * k) / 2} width={s.widthCm * k} height={s.depthCm * k}
        fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth={2} />
    </svg>
  )
}

export function SpaceForm({ space, onDone, first }: { space?: Space; onDone: () => void; first?: boolean }) {
  const navigate = useNavigate()
  const [name, setName] = useState(space?.name ?? '')
  const [dims, setDims] = useState({
    widthCm: space?.widthCm ?? 305,
    depthCm: space?.depthCm ?? 305,
    heightCm: space?.heightCm ?? 240,
  })

  async function submit(e: FormEvent) {
    e.preventDefault()
    const data = { name: name.trim() || 'Storage unit', ...dims }
    if (space) {
      await repo.updateSpace(space.id, data)
      onDone()
    } else {
      const s = await repo.createSpace(data)
      onDone()
      navigate(`/layout/${s.id}`)
    }
  }

  return (
    <form className="card stack-v" onSubmit={submit}>
      <h2 style={{ margin: 0 }}>{space ? 'Edit space' : first ? 'Set up your first storage space' : 'New storage space'}</h2>
      {first && <p className="muted small" style={{ margin: 0 }}>A space is wherever boxes end up: a storage unit, garage, loft or the new house's spare room.</p>}
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Unit 214, Garage" />
      </label>
      <div className="chips">
        {SPACE_PRESETS.map((p) => (
          <button type="button" key={p.label} className="chip" onClick={() => setDims({ widthCm: p.widthCm, depthCm: p.depthCm, heightCm: p.heightCm })}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid-3">
        {(['widthCm', 'depthCm', 'heightCm'] as const).map((k) => (
          <label className="field" key={k}>
            <span>{k === 'widthCm' ? 'Width' : k === 'depthCm' ? 'Depth' : 'Height'} (cm)</span>
            <input type="number" inputMode="numeric" min={30} max={5000} required value={dims[k]}
              onChange={(e) => setDims((d) => ({ ...d, [k]: Number(e.target.value) }))} />
          </label>
        ))}
      </div>
      <p className="muted small" style={{ margin: 0 }}>Width runs along the door wall; depth goes back from the door.</p>
      <div className="btn-row">
        <button className="btn-primary" type="submit">{space ? 'Save' : 'Create space'}</button>
        {!first && <button type="button" onClick={onDone}>Cancel</button>}
      </div>
    </form>
  )
}
