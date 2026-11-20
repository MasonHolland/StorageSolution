import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import QrScanner from 'qr-scanner'
import * as repo from '../../db/repo'
import { PageHeader } from '../../app/ui'

/** Pulls a box id or code out of whatever the QR contained (a label URL, a bare id or a code). */
export function parseScan(text: string): { id?: string; code?: string } {
  const t = text.trim()
  const m = /#\/c\/([\w-]+)/.exec(t)
  if (m) return { id: m[1] }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) return { id: t }
  return { code: t }
}

export function ScanPage() {
  const navigate = useNavigate()
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const handled = useRef(false)

  async function open(text: string) {
    const { id, code } = parseScan(text)
    const c = id ? await repo.getContainer(id) : code ? await repo.getContainerByCode(code) : undefined
    if (c) {
      handled.current = true
      navigate(`/c/${c.id}`)
    } else {
      setError(`No box “${code ?? id}” on this device.`)
      handled.current = false
    }
  }

  useEffect(() => {
    if (!video.current) return
    const scanner = new QrScanner(
      video.current,
      (result) => {
        if (handled.current) return
        handled.current = true
        void open(result.data)
      },
      { preferredCamera: 'environment', highlightScanRegion: true, returnDetailedScanResult: true },
    )
    scanner.start().catch(() => setError('Camera unavailable. Allow camera access, or type the box code below.'))
    return () => {
      scanner.stop()
      scanner.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function submit(e: FormEvent) {
    e.preventDefault()
    if (code.trim()) void open(code)
  }

  return (
    <main className="page">
      <PageHeader title="Scan a label" />
      <div className="scanner">
        <video ref={video} muted playsInline />
      </div>
      {error && <p className="small" style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>}
      <form className="quick-add" onSubmit={submit}>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Or type a code, e.g. B-014" aria-label="Box code" />
        <button className="btn-primary" type="submit">Open</button>
      </form>
    </main>
  )
}
