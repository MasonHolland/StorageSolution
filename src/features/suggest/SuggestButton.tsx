import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import * as repo from '../../db/repo'
import { getSuggester } from './suggester'
import { useToast } from '../../app/ui'

/** Hidden until a real suggester is configured in Settings. */
export function SuggestButton({ containerId }: { containerId: string }) {
  const suggesterId = useLiveQuery(() => repo.getSetting<string>('suggester', 'none'))
  const suggester = getSuggester(suggesterId)
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  if (!suggester.available) return null

  async function run() {
    setBusy(true)
    try {
      const [photo] = (await repo.listPhotos(containerId)).slice(-1)
      if (!photo) return toast('Take a photo first')
      const found = await suggester.suggest(photo.blob)
      for (const s of found) await repo.addItem(containerId, { name: s.name, category: s.category })
      toast(found.length ? `Added ${found.length} suggested items` : 'No items recognised')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button className="btn-small" disabled={busy} onClick={() => void run()}>
      {busy ? 'Looking…' : 'Suggest items'}
    </button>
  )
}
