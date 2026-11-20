import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Container } from '../db/schema'
import { STATUS_LABELS } from '../db/schema'
import { textColorFor } from '../features/layout/layoutMath'
import { BackIcon } from './icons'

export function PageHeader({ title, back, children }: { title: ReactNode; back?: boolean | string; children?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <header className="page-header">
      {back && (
        <button
          className="btn-ghost btn-icon"
          aria-label="Back"
          onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
        >
          <BackIcon width={22} height={22} />
        </button>
      )}
      <h1>{title}</h1>
      {children}
    </header>
  )
}

/** An object URL for a blob that is revoked when the blob changes or the component unmounts. */
export function useObjectUrl(blob: Blob | undefined): string | undefined {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : undefined), [blob])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  return url
}

export function StatusBadge({ c }: { c: Pick<Container, 'status' | 'fragile' | 'priority'> }) {
  return (
    <span className="chips" style={{ gap: 4 }}>
      <span className={`badge ${c.status}`}>{STATUS_LABELS[c.status]}</span>
      {c.fragile && <span className="badge fragile">Fragile</span>}
      {c.priority === 'open-first' && <span className="badge open-first">Open first</span>}
    </span>
  )
}

/** Small front-on drawing of a box in its own colour, used where there is no photo. */
export function BoxGlyph({ c, size = 56 }: { c: Pick<Container, 'color' | 'widthCm' | 'heightCm' | 'code' | 'kind'>; size?: number }) {
  const ratio = c.heightCm / Math.max(c.widthCm, 1)
  const w = ratio > 1 ? size / ratio : size
  const h = ratio > 1 ? size : size * ratio
  const x = (size - w) / 2
  const y = size - h
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="thumb" style={{ background: 'transparent' }} aria-hidden>
      <rect x={x} y={y} width={w} height={h} rx={3} fill={c.color} stroke="rgb(0 0 0 / 25%)" />
      {c.kind === 'box' && <line x1={x} x2={x + w} y1={y + Math.min(8, h / 4)} y2={y + Math.min(8, h / 4)} stroke="rgb(0 0 0 / 18%)" />}
      {c.kind === 'drawerUnit' &&
        [1, 2].map((i) => <line key={i} x1={x} x2={x + w} y1={y + (h * i) / 3} y2={y + (h * i) / 3} stroke="rgb(0 0 0 / 30%)" />)}
      <text x={size / 2} y={y + h / 2 + 4} textAnchor="middle" fontSize={10} fontWeight={700} fill={textColorFor(c.color)}>
        {c.code}
      </text>
    </svg>
  )
}

// ---------- toasts ----------

const ToastCtx = createContext<(msg: string) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const show = useCallback((m: string) => {
    setMsg(m)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMsg(null), 2600)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div className="toast" role="status">{msg}</div>}
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)
