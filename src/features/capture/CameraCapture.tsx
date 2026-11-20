import { useState, type ReactNode } from 'react'
import { compressPhoto } from '../../lib/imageCompress'
import { dominantColor } from '../../lib/dominantColor'
import { CameraIcon } from '../../app/icons'

export interface CapturedPhoto {
  blob: Blob
  thumb: Blob
  color: string | null
}

/** Processes a picked or captured image: compress, thumbnail, and sample its colour. */
export async function processPhoto(file: File): Promise<CapturedPhoto> {
  const { blob, thumb } = await compressPhoto(file)
  const color = await dominantColor(thumb).catch(() => null)
  return { blob, thumb, color }
}

/**
 * Opens the rear camera on phones (file picker on desktop). Uses a plain file input with
 * `capture`, which works in every mobile browser without camera permission prompts.
 */
export function CameraCapture({
  onCapture,
  children,
  multiple = true,
  className = 'btn',
}: {
  onCapture: (photo: CapturedPhoto) => void | Promise<void>
  children?: ReactNode
  multiple?: boolean
  className?: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handle(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    setError(null)
    try {
      for (const file of Array.from(files)) await onCapture(await processPhoto(file))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that photo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <label className={`capture-btn ${className}`} aria-busy={busy}>
        <CameraIcon width={20} height={20} />
        {busy ? 'Processing…' : (children ?? 'Take photo')}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple={multiple}
          disabled={busy}
          onChange={(e) => {
            void handle(e.target.files)
            e.target.value = ''
          }}
        />
      </label>
      {error && <p className="small" style={{ color: 'var(--danger)' }}>{error}</p>}
    </>
  )
}
