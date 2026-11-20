/** Builds the next box code ("B-001", "B-002", ...) from the codes already in use. */
export function nextCode(existing: Iterable<string>, prefix = 'B'): string {
  const re = new RegExp(`^${escapeRegExp(prefix)}-(\\d+)$`, 'i')
  let max = 0
  for (const code of existing) {
    const m = re.exec(code)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function newId(): string {
  return crypto.randomUUID()
}
