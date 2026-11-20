import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState, type FormEvent } from 'react'
import * as repo from '../../db/repo'
import type { Item } from '../../db/schema'
import { TrashIcon } from '../../app/icons'

/** Fast item entry: type a name, press Enter, keep typing. "3x mugs" or "mugs x3" sets quantity. */
export function parseQuickItem(text: string): { name: string; qty: number } | null {
  const t = text.trim()
  if (!t) return null
  const lead = /^(\d+)\s*[x×]?\s+(.+)$/i.exec(t)
  if (lead) return { name: lead[2].trim(), qty: Number(lead[1]) }
  const trail = /^(.+?)\s*[x×]\s*(\d+)$/i.exec(t)
  if (trail) return { name: trail[1].trim(), qty: Number(trail[2]) }
  return { name: t, qty: 1 }
}

export function ItemList({ containerId }: { containerId: string }) {
  const items = useLiveQuery(() => repo.listItems(containerId), [containerId])
  const frequent = useLiveQuery(() => repo.frequentItemNames(10))
  const [text, setText] = useState('')
  const input = useRef<HTMLInputElement>(null)

  async function add(raw: string) {
    const parsed = parseQuickItem(raw)
    if (!parsed) return
    // Clear first so the next entry isn't wiped when this save finishes.
    if (raw === text) setText('')
    input.current?.focus()
    await repo.addItem(containerId, parsed)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    void add(text)
  }

  const present = new Set(items?.map((i) => i.name.toLowerCase()))
  const suggestions = (frequent ?? []).filter((n) => !present.has(n.toLowerCase())).slice(0, 8)

  return (
    <div className="stack-v">
      <form className="quick-add" onSubmit={submit}>
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add item, e.g. 6 mugs"
          aria-label="New item"
          enterKeyHint="done"
        />
        <button className="btn-primary" type="submit" disabled={!text.trim()}>Add</button>
      </form>
      {suggestions.length > 0 && (
        <div className="chips" aria-label="Common items">
          {suggestions.map((n) => (
            <button key={n} type="button" className="chip" onClick={() => void add(n)}>+ {n}</button>
          ))}
        </div>
      )}
      {items && items.length > 0 ? (
        <div>
          {items.map((i) => <ItemRow key={i.id} item={i} />)}
        </div>
      ) : (
        <p className="muted small">No items yet. Add what's going in this box so you can search for it later.</p>
      )}
    </div>
  )
}

function ItemRow({ item }: { item: Item }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(item.name)
  const [tags, setTags] = useState(item.tags.join(', '))

  async function save() {
    await repo.updateItem(item.id, {
      name: name.trim() || item.name,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    })
    setEditing(false)
  }

  return (
    <div className="item-row">
      {editing ? (
        <div className="name stack-v" style={{ gap: 6 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Item name" autoFocus />
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags, comma separated" aria-label="Tags" />
          <div className="btn-row">
            <button className="btn-small btn-primary" onClick={() => void save()}>Save</button>
            <button className="btn-small" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="name btn-ghost" style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '4px 0' }} onClick={() => setEditing(true)}>
          <span>
            {item.name}
            {item.tags.length > 0 && <span className="muted small"> · {item.tags.join(', ')}</span>}
          </span>
        </button>
      )}
      <input
        className="qty"
        type="number"
        min={1}
        inputMode="numeric"
        aria-label={`Quantity of ${item.name}`}
        value={item.qty}
        onChange={(e) => void repo.updateItem(item.id, { qty: Math.max(1, Number(e.target.value) || 1) })}
      />
      <button className="btn-ghost btn-icon" aria-label={`Remove ${item.name}`} onClick={() => void repo.deleteItem(item.id)}>
        <TrashIcon width={18} height={18} />
      </button>
    </div>
  )
}
