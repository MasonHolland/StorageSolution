import type { Container, Space, Stack } from '../../db/schema'
import { fitText as fit, stackFootprint, stackTotalHeight, textColorFor, toWorld } from './layoutMath'

interface Props {
  space: Space
  stack: Stack
  boxes: Container[] // bottom first
  highlightId?: string
  onOpen: (containerId: string) => void
}

/** Front-on view of one stack: boxes drawn to scale, bottom to top, in their real colours. */
export function StackFrontView({ space, stack, boxes, highlightId, onOpen }: Props) {
  const fp = stackFootprint(stack, boxes)
  const world = toWorld(stack, boxes)
  const total = stackTotalHeight(boxes)
  const ceiling = space.heightCm
  const viewH = Math.max(ceiling, total) + 34
  const sideW = Math.max(fp.w + 80, 160)
  const left = (sideW - fp.w) / 2
  const floorY = viewH - 10
  const overHeight = total > ceiling

  return (
    <div className="canvas-wrap">
      <svg viewBox={`0 0 ${sideW} ${viewH}`} role="img" aria-label={`Front view of ${stack.label}`} style={{ maxHeight: '62vh' }}>
        {/* ceiling and floor */}
        <line x1={0} x2={sideW} y1={floorY - ceiling} y2={floorY - ceiling} stroke="var(--border)" strokeDasharray="6 4" />
        <text className="svg-muted" x={4} y={floorY - ceiling - 4}>ceiling {ceiling} cm</text>
        <rect x={0} y={floorY} width={sideW} height={10} fill="var(--surface-2)" />
        <line x1={0} x2={sideW} y1={floorY} y2={floorY} stroke="var(--text)" strokeWidth={1.5} />

        {boxes.map((c, i) => {
          const b = world[i]
          const x = left + (b.x - fp.x)
          const y = floorY - b.z - b.h
          const ink = textColorFor(c.color)
          const hl = c.id === highlightId
          const fontSize = Math.max(7, Math.min(14, b.h / 3, b.w / 5))
          return (
            <g key={c.id} onClick={() => onOpen(c.id)} style={{ cursor: 'pointer' }} role="button" aria-label={`${c.code} ${c.name}`}>
              <rect x={x} y={y} width={b.w} height={b.h} rx={1.5} fill={c.color}
                stroke={hl ? undefined : 'var(--stack-stroke)'} strokeWidth={hl ? undefined : 1.2} className={hl ? 'svg-highlight' : undefined} />
              {c.kind === 'box' && b.h > 18 && (
                <line x1={x} x2={x + b.w} y1={y + 6} y2={y + 6} stroke="rgb(0 0 0 / 15%)" pointerEvents="none" />
              )}
              {c.kind === 'drawerUnit' && [1, 2].map((k) => (
                <g key={k} pointerEvents="none">
                  <line x1={x} x2={x + b.w} y1={y + (b.h * k) / 3} y2={y + (b.h * k) / 3} stroke="rgb(0 0 0 / 30%)" />
                </g>
              ))}
              <text className="svg-label" x={x + b.w / 2} y={y + b.h / 2 + fontSize / 3} textAnchor="middle" fill={ink} style={{ fontSize }}>
                {fit(c.code + (c.fragile ? ' ⚠' : ''), b.w, fontSize)}
              </text>
              {b.h > 34 && c.name && (
                <text x={x + b.w / 2} y={y + b.h / 2 + fontSize / 3 + fontSize} textAnchor="middle" fill={ink}
                  style={{ fontSize: fontSize * 0.7, pointerEvents: 'none' }}>
                  {fit(c.name, b.w, fontSize * 0.7)}
                </text>
              )}
              {c.status === 'unpacked' && (
                <rect x={x} y={y} width={b.w} height={b.h} fill="var(--bg)" opacity={0.55} pointerEvents="none" />
              )}
            </g>
          )
        })}

        {boxes.length === 0 && (
          <text className="svg-muted" x={sideW / 2} y={floorY - 20} textAnchor="middle">Empty stack</text>
        )}
        <text className="svg-muted" x={sideW - 4} y={floorY - total - 4} textAnchor="end" fill={overHeight ? 'var(--danger)' : undefined}>
          {total} cm{overHeight ? ' (too tall!)' : ''}
        </text>
      </svg>
    </div>
  )
}

