import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import * as repo from '../../db/repo'
import type { Container, ContainerKind, ContainerStatus, Priority } from '../../db/schema'
import { COLOR_PRESETS, KIND_LABELS, ROOMS, SIZE_PRESETS, STATUS_LABELS } from '../../db/schema'
import { BoxGlyph, PageHeader, useObjectUrl, useToast } from '../../app/ui'
import { CameraCapture, type CapturedPhoto } from '../capture/CameraCapture'

type Draft = Pick<
  Container,
  'name' | 'kind' | 'widthCm' | 'depthCm' | 'heightCm' | 'sizePreset' | 'color' | 'originRoom' |
  'status' | 'fragile' | 'priority' | 'notes' | 'parentId'
>

const EMPTY: Draft = {
  name: '', kind: 'box', widthCm: 45, depthCm: 45, heightCm: 40, sizePreset: 'medium',
  color: '#c19a6b', originRoom: undefined, status: 'packing', fragile: false, priority: 'normal',
  notes: '', parentId: undefined,
}

export function ContainerFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const existing = useLiveQuery(async () => (id ? ((await repo.getContainer(id)) ?? null) : null), [id])
  const drawerUnits = useLiveQuery(async () => (await repo.listContainers()).filter((c) => c.kind === 'drawerUnit' && c.id !== id), [id])
  const [draft, setDraft] = useState<Draft>(() => ({
    ...EMPTY,
    ...(params.get('parent') ? { kind: 'drawer', parentId: params.get('parent')!, widthCm: 38, depthCm: 45, heightCm: 20, sizePreset: undefined } : {}),
  }))
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null)
  const [loaded, setLoaded] = useState(!id)
  const photoUrl = useObjectUrl(photo?.thumb)

  useEffect(() => {
    if (id && existing && !loaded) {
      setDraft({ ...EMPTY, ...existing })
      setLoaded(true)
    }
  }, [id, existing, loaded])

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }))

  function applyPreset(presetId: string) {
    const p = SIZE_PRESETS.find((s) => s.id === presetId)
    if (!p) return
    setDraft((d) => ({
      ...d,
      sizePreset: p.id,
      widthCm: p.widthCm,
      depthCm: p.depthCm,
      heightCm: p.heightCm,
      kind: p.id === 'drawers' ? 'drawerUnit' : p.id === 'tote' ? 'bin' : d.kind === 'drawerUnit' || d.kind === 'bin' ? 'box' : d.kind,
      color: p.id === 'tote' && d.color === EMPTY.color ? '#2f3237' : d.color,
    }))
  }

  function onPhoto(p: CapturedPhoto) {
    setPhoto(p)
    if (p.color) set('color', p.color)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const data: Partial<Container> = { ...draft, name: draft.name.trim() }
    if (data.kind !== 'drawer') data.parentId = undefined
    if (id) {
      await repo.updateContainer(id, data)
      toast('Saved')
      navigate(`/c/${id}`, { replace: true })
    } else {
      const c = await repo.createContainer(data)
      if (photo) await repo.addPhoto(c.id, photo.blob, photo.thumb)
      toast(`Created ${c.code}`)
      navigate(`/c/${c.id}`, { replace: true })
    }
  }

  if (id && existing === null) return <main className="page"><PageHeader back title="Box not found" /></main>
  if (id && !loaded) return null

  const preview = { ...draft, code: existing?.code ?? 'NEW' }

  return (
    <main className="page">
      <PageHeader back title={id ? `Edit ${existing?.code ?? ''}` : 'New box'} />
      <form className="stack-v" onSubmit={submit}>
        {!id && (
          <section className="card stack-v">
            <div className="toolbar">
              {photoUrl ? <img className="thumb" src={photoUrl} alt="Box photo" /> : <BoxGlyph c={preview} />}
              <div className="grow small muted" style={{ flex: 1 }}>
                Snap the box (or its contents). The box colour is picked from the photo; you can add more photos later.
              </div>
            </div>
            <CameraCapture onCapture={onPhoto} multiple={false}>{photo ? 'Retake photo' : 'Take photo'}</CameraCapture>
          </section>
        )}

        <section className="card stack-v">
          <label className="field">
            <span>Name</span>
            <input value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Kitchen – pots & pans" autoFocus={!!id} />
          </label>

          <div className="field">
            <span className="small muted" style={{ fontWeight: 600 }}>Room it came from</span>
            <div className="chips">
              {ROOMS.map((r) => (
                <button type="button" key={r} className={`chip ${draft.originRoom === r ? 'selected' : ''}`}
                  onClick={() => set('originRoom', draft.originRoom === r ? undefined : r)}>{r}</button>
              ))}
            </div>
          </div>

          <div className="grid-2">
            <label className="field">
              <span>Type</span>
              <select value={draft.kind} onChange={(e) => set('kind', e.target.value as ContainerKind)}>
                {Object.entries(KIND_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Status</span>
              <select value={draft.status} onChange={(e) => set('status', e.target.value as ContainerStatus)}>
                {Object.entries(STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
          </div>

          {draft.kind === 'drawer' && (
            <label className="field">
              <span>Inside drawer unit</span>
              <select value={draft.parentId ?? ''} onChange={(e) => set('parentId', e.target.value || undefined)}>
                <option value="">None</option>
                {drawerUnits?.map((u) => <option key={u.id} value={u.id}>{u.code} {u.name}</option>)}
              </select>
            </label>
          )}
        </section>

        <section className="card stack-v">
          <h2>Size and colour</h2>
          <div className="chips">
            {SIZE_PRESETS.map((p) => (
              <button type="button" key={p.id} className={`chip ${draft.sizePreset === p.id ? 'selected' : ''}`} onClick={() => applyPreset(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="grid-3">
            {(['widthCm', 'depthCm', 'heightCm'] as const).map((k) => (
              <label className="field" key={k}>
                <span>{k === 'widthCm' ? 'Width' : k === 'depthCm' ? 'Depth' : 'Height'} (cm)</span>
                <input type="number" inputMode="numeric" min={1} max={500} required value={draft[k]}
                  onChange={(e) => setDraft((d) => ({ ...d, [k]: Number(e.target.value), sizePreset: undefined }))} />
              </label>
            ))}
          </div>
          <div className="swatches">
            {COLOR_PRESETS.map((p) => (
              <button type="button" key={p.color} title={p.label} aria-label={p.label}
                className={`swatch ${draft.color === p.color ? 'selected' : ''}`} style={{ background: p.color }}
                onClick={() => set('color', p.color)} />
            ))}
            <input type="color" aria-label="Custom colour" value={draft.color} onChange={(e) => set('color', e.target.value)} />
          </div>
        </section>

        <section className="card stack-v">
          <div className="grid-2">
            <label className="field">
              <span>Priority</span>
              <select value={draft.priority} onChange={(e) => set('priority', e.target.value as Priority)}>
                <option value="open-first">Open first</option>
                <option value="normal">Normal</option>
                <option value="deep-storage">Deep storage</option>
              </select>
            </label>
            <label className="check" style={{ alignSelf: 'end', minHeight: 44 }}>
              <input type="checkbox" checked={draft.fragile} onChange={(e) => set('fragile', e.target.checked)} />
              Fragile
            </label>
          </div>
          <label className="field">
            <span>Notes</span>
            <textarea value={draft.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Anything to remember about this box" />
          </label>
        </section>

        <button className="btn-primary btn-block" type="submit">{id ? 'Save changes' : 'Create box'}</button>
      </form>
    </main>
  )
}
