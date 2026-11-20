import { useLiveQuery } from 'dexie-react-hooks'
import QRCode from 'qrcode'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import * as repo from '../../db/repo'
import type { Container } from '../../db/schema'
import { PageHeader } from '../../app/ui'
import { PrintIcon } from '../../app/icons'

/** The URL a label's QR code points at. Any phone camera can open it; the app routes it to the box. */
export function labelUrl(c: Pick<Container, 'id'>): string {
  const base = window.location.href.split('#')[0]
  return `${base}#/c/${c.id}`
}

export function LabelsPage() {
  const [params] = useSearchParams()
  const containers = useLiveQuery(repo.listContainers)
  const preselected = params.get('ids')?.split(',').filter(Boolean)
  const [selected, setSelected] = useState<Set<string> | null>(null)

  const sorted = useMemo(() => [...(containers ?? [])].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })), [containers])
  const chosen = selected ?? new Set(preselected ?? sorted.map((c) => c.id))
  const toPrint = sorted.filter((c) => chosen.has(c.id))

  const toggle = (id: string) => {
    const next = new Set(chosen)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  if (!containers) return null

  return (
    <main className="page">
      <PageHeader back title="Print labels">
        <button className="btn-primary btn-small" disabled={!toPrint.length} onClick={() => window.print()}>
          <PrintIcon width={18} height={18} /> Print {toPrint.length}
        </button>
      </PageHeader>

      <section className="card stack-v no-print">
        <p className="small muted" style={{ margin: 0 }}>
          Tape a label to two sides of each box. Scanning it with any phone camera opens the box in this app (on a device that has your data).
        </p>
        <div className="btn-row">
          <button className="btn-small" onClick={() => setSelected(new Set(sorted.map((c) => c.id)))}>All</button>
          <button className="btn-small" onClick={() => setSelected(new Set())}>None</button>
          <button className="btn-small" onClick={() => setSelected(new Set(sorted.filter((c) => c.status === 'packing' || c.status === 'sealed').map((c) => c.id)))}>Not yet stored</button>
        </div>
        <div className="chips">
          {sorted.map((c) => (
            <button key={c.id} className={`chip ${chosen.has(c.id) ? 'selected' : ''}`} onClick={() => toggle(c.id)}>
              {c.code}
            </button>
          ))}
        </div>
      </section>

      <div className="label-sheet">
        {toPrint.map((c) => <Label key={c.id} c={c} />)}
      </div>
    </main>
  )
}

function Label({ c }: { c: Container }) {
  const [src, setSrc] = useState<string>()
  useEffect(() => {
    let live = true
    QRCode.toDataURL(labelUrl(c), { margin: 1, width: 240, errorCorrectionLevel: 'M' }).then((url) => live && setSrc(url))
    return () => { live = false }
  }, [c])
  const flags = [c.fragile && 'Fragile', c.priority === 'open-first' && 'Open first'].filter(Boolean).join(' · ')
  return (
    <div className="label">
      {src ? <img src={src} alt={`QR code for ${c.code}`} /> : <div style={{ width: 96, height: 96 }} />}
      <div style={{ minWidth: 0 }}>
        <div className="code">{c.code}</div>
        {c.name && <div style={{ fontWeight: 600 }}>{c.name}</div>}
        {c.originRoom && <div className="meta">Room: {c.originRoom}</div>}
        {flags && <div className="flags">{flags}</div>}
      </div>
    </div>
  )
}
