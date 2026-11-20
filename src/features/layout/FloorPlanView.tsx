import { useRef, useState, type PointerEvent } from 'react'
import type { Container, Space, Stack } from '../../db/schema'
import { clampToSpace, overlaps, snap, stackFootprint, textColorFor, type Rect } from './layoutMath'

export interface StackWithBoxes {
  stack: Stack
  boxes: Container[] // bottom first
}

interface Props {
  space: Space
  stacks: StackWithBoxes[]
  selectedId?: string
  highlightStackId?: string
  onSelect: (stackId: string) => void
  onMove: (stackId: string, x: number, y: number) => void
}

const PAD = 24 // cm of margin around the space for labels

/**
 * Top-down plan of a space. Stacks are footprints drawn in their top box's colour.
 * Drag a stack to move it (snaps to 5 cm); tap it to select.
 */
export function FloorPlanView({ space, stacks, selectedId, highlightStackId, onSelect, onMove }: Props) {
  const svg = useRef<SVGSVGElement>(null)
  const drag = useRef<{ id: string; startX: number; startY: number; origin: Rect; moved: boolean } | null>(null)
  const [preview, setPreview] = useState<{ id: string; x: number; y: number } | null>(null)

  const rects = stacks.map(({ stack, boxes }) => {
    const fp = stackFootprint(stack, boxes)
    return preview?.id === stack.id ? { ...fp, x: preview.x, y: preview.y } : fp
  })

  function toSvg(e: PointerEvent) {
    const ctm = svg.current!.getScreenCTM()!.inverse()
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm)
    return { x: p.x, y: p.y }
  }

  function down(e: PointerEvent, id: string, rect: Rect) {
    e.stopPropagation()
    const p = toSvg(e)
    svg.current!.setPointerCapture(e.pointerId)
    drag.current = { id, startX: p.x, startY: p.y, origin: rect, moved: false }
  }

  function move(e: PointerEvent) {
    const d = drag.current
    if (!d) return
    const p = toSvg(e)
    const dx = p.x - d.startX
    const dy = p.y - d.startY
    if (!d.moved && Math.hypot(dx, dy) < 4) return
    d.moved = true
    const r = clampToSpace({ ...d.origin, x: snap(d.origin.x + dx), y: snap(d.origin.y + dy) }, space)
    setPreview({ id: d.id, x: r.x, y: r.y })
  }

  function up() {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (d.moved && preview) onMove(d.id, preview.x, preview.y)
    else onSelect(d.id)
    setPreview(null)
  }

  const gridStep = 50
  const gridLines = []
  for (let x = gridStep; x < space.widthCm; x += gridStep) gridLines.push(<line key={`x${x}`} className="svg-grid" x1={x} x2={x} y1={0} y2={space.depthCm} />)
  for (let y = gridStep; y < space.depthCm; y += gridStep) gridLines.push(<line key={`y${y}`} className="svg-grid" x1={0} x2={space.widthCm} y1={y} y2={y} />)

  const fontScale = Math.max(space.widthCm, space.depthCm) / 300

  return (
    <div className="canvas-wrap">
      <svg
        ref={svg}
        viewBox={`${-PAD} ${-PAD} ${space.widthCm + PAD * 2} ${space.depthCm + PAD * 2}`}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => { drag.current = null; setPreview(null) }}
        role="img"
        aria-label={`Floor plan of ${space.name}`}
        style={{ maxHeight: '62vh' }}
      >
        <rect className="svg-floor" x={0} y={0} width={space.widthCm} height={space.depthCm} />
        {gridLines}
        <rect className="svg-wall" x={0} y={0} width={space.widthCm} height={space.depthCm} />
        {/* door side is the front (bottom edge) */}
        <line x1={space.widthCm * 0.3} x2={space.widthCm * 0.7} y1={space.depthCm} y2={space.depthCm} stroke="var(--accent)" strokeWidth={5} />
        <text className="svg-muted" x={space.widthCm / 2} y={space.depthCm + 16 * fontScale} textAnchor="middle" style={{ fontSize: 10 * fontScale }}>
          door / front · {space.widthCm} cm
        </text>
        <text className="svg-muted" x={-8 * fontScale} y={space.depthCm / 2} textAnchor="middle" style={{ fontSize: 10 * fontScale }}
          transform={`rotate(-90 ${-8 * fontScale} ${space.depthCm / 2})`}>
          {space.depthCm} cm
        </text>

        {stacks.map(({ stack, boxes }, i) => {
          const r = rects[i]
          const top = boxes[boxes.length - 1]
          const fill = top?.color ?? 'transparent'
          const clash = rects.some((o, j) => j !== i && overlaps(r, o))
          const selected = stack.id === selectedId
          const highlighted = stack.id === highlightStackId
          return (
            <g key={stack.id} onPointerDown={(e) => down(e, stack.id, r)} style={{ cursor: 'grab' }}
              role="button" aria-label={`${stack.label}, ${boxes.length} boxes`}>
              <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={2} fill={top ? fill : undefined}
                className={[
                  top ? 'svg-stack' : 'svg-stack-empty',
                  clash && 'svg-clash',
                  selected && 'svg-selected',
                  highlighted && 'svg-highlight',
                ].filter(Boolean).join(' ')} />
              {boxes.length > 1 && boxes.slice(0, -1).map((_, k) => (
                <rect key={k} x={r.x + 3 + k * 3} y={r.y + 3 + k * 3} width={Math.max(0, r.w - 6 - k * 6)} height={Math.max(0, r.h - 6 - k * 6)}
                  fill="none" stroke={textColorFor(fill)} strokeOpacity={0.35} pointerEvents="none" />
              ))}
              <text className="svg-label" x={r.x + r.w / 2} y={r.y + r.h / 2 - 2} textAnchor="middle"
                fill={top ? textColorFor(top.color) : 'var(--muted)'} style={{ fontSize: 11 * Math.min(1.6, fontScale) }}>
                {stack.label.replace(/^Stack /, 'S')}
              </text>
              <text className="svg-label" x={r.x + r.w / 2} y={r.y + r.h / 2 + 11 * Math.min(1.6, fontScale)} textAnchor="middle"
                fill={top ? textColorFor(top.color) : 'var(--muted)'} style={{ fontSize: 9 * Math.min(1.6, fontScale), fontWeight: 400 }}>
                {boxes.length} box{boxes.length === 1 ? '' : 'es'}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
