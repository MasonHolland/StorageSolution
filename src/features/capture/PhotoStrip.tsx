import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import * as repo from '../../db/repo'
import type { Photo } from '../../db/schema'
import { useObjectUrl } from '../../app/ui'
import { CloseIcon } from '../../app/icons'

export function PhotoStrip({ containerId }: { containerId: string }) {
  const photos = useLiveQuery(() => repo.listPhotos(containerId), [containerId])
  const [open, setOpen] = useState<Photo | null>(null)
  if (!photos?.length) return <p className="muted small">No photos yet.</p>
  return (
    <>
      <div className="photo-strip">
        {photos.map((p) => <Thumb key={p.id} photo={p} onOpen={() => setOpen(p)} />)}
      </div>
      {open && <Lightbox photo={open} onClose={() => setOpen(null)} />}
    </>
  )
}

function Thumb({ photo, onOpen }: { photo: Photo; onOpen: () => void }) {
  const url = useObjectUrl(photo.thumb)
  return (
    <figure>
      <img src={url} alt="Box photo" onClick={onOpen} />
      <button
        className="del"
        aria-label="Delete photo"
        onClick={() => { if (confirm('Delete this photo?')) void repo.deletePhoto(photo.id) }}
      >
        <CloseIcon width={14} height={14} />
      </button>
    </figure>
  )
}

function Lightbox({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  const url = useObjectUrl(photo.blob)
  return (
    <div className="lightbox" role="dialog" aria-label="Photo" onClick={onClose}>
      <img src={url} alt="Box photo, full size" />
    </div>
  )
}
