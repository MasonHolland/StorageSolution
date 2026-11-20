import JSZip from 'jszip'
import { db } from '../../db/db'
import type { Container, Item, Setting, Space, Stack } from '../../db/schema'
import { nextCode } from '../../lib/codes'

export const BACKUP_VERSION = 1

interface PhotoMeta {
  id: string
  containerId: string
  createdAt: number
  type: string
  thumbType: string
}

interface BackupData {
  app: 'storage-solution'
  version: number
  exportedAt: number
  spaces: Space[]
  stacks: Stack[]
  containers: Container[]
  items: Item[]
  settings: Setting[]
  photos: PhotoMeta[]
}

/** Zips every record plus the photo files: data.json + photos/<id>.webp + photos/<id>.thumb.webp. */
export async function exportBackup(): Promise<Blob> {
  const zip = new JSZip()
  const photos = await db.photos.toArray()
  const data: BackupData = {
    app: 'storage-solution',
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    spaces: await db.spaces.toArray(),
    stacks: await db.stacks.toArray(),
    containers: await db.containers.toArray(),
    items: await db.items.toArray(),
    settings: (await db.settings.toArray()).filter((s) => s.key !== 'lastBackupAt'),
    photos: photos.map((p) => ({
      id: p.id,
      containerId: p.containerId,
      createdAt: p.createdAt,
      type: p.blob.type,
      thumbType: p.thumb.type,
    })),
  }
  zip.file('data.json', JSON.stringify(data, null, 2))
  const folder = zip.folder('photos')!
  for (const p of photos) {
    folder.file(`${p.id}.img`, await p.blob.arrayBuffer())
    folder.file(`${p.id}.thumb.img`, await p.thumb.arrayBuffer())
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' })
  await db.settings.put({ key: 'lastBackupAt', value: data.exportedAt })
  return blob
}

export type ImportMode = 'replace' | 'merge'

export interface ImportResult {
  containers: number
  items: number
  photos: number
  renamedCodes: number
}

/**
 * Restores a backup. "replace" wipes current data first. "merge" keeps current data;
 * records with the same id are overwritten, and clashing box codes get a new code.
 */
export async function importBackup(file: Blob, mode: ImportMode): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const json = await zip.file('data.json')?.async('string')
  if (!json) throw new Error('Not a StorageSolution backup: data.json is missing.')
  const data = JSON.parse(json) as BackupData
  if (data.app !== 'storage-solution') throw new Error('Not a StorageSolution backup.')
  if (data.version > BACKUP_VERSION) throw new Error('This backup was made by a newer version of the app.')

  const photos = await Promise.all(
    data.photos.map(async (m) => {
      const blob = await zip.file(`photos/${m.id}.img`)?.async('uint8array')
      const thumb = await zip.file(`photos/${m.id}.thumb.img`)?.async('uint8array')
      if (!blob || !thumb) return null
      return {
        id: m.id,
        containerId: m.containerId,
        createdAt: m.createdAt,
        blob: new Blob([blob as BlobPart], { type: m.type }),
        thumb: new Blob([thumb as BlobPart], { type: m.thumbType }),
      }
    }),
  )
  const validPhotos = photos.filter((p) => p !== null)

  let renamedCodes = 0
  await db.transaction('rw', [db.spaces, db.stacks, db.containers, db.items, db.photos, db.settings], async () => {
    let containers = data.containers
    if (mode === 'replace') {
      await Promise.all([
        db.spaces.clear(), db.stacks.clear(), db.containers.clear(),
        db.items.clear(), db.photos.clear(), db.settings.clear(),
      ])
    } else {
      const existing = await db.containers.toArray()
      const codeOwner = new Map(existing.map((c) => [c.code.toUpperCase(), c.id]))
      const used = new Set(existing.map((c) => c.code))
      containers = containers.map((c) => {
        const owner = codeOwner.get(c.code.toUpperCase())
        if (owner && owner !== c.id) {
          renamedCodes++
          const prefix = c.code.split('-')[0] || 'B'
          const code = nextCode([...used, ...data.containers.map((x) => x.code)], prefix)
          used.add(code)
          return { ...c, code }
        }
        return c
      })
    }
    await db.spaces.bulkPut(data.spaces)
    await db.stacks.bulkPut(data.stacks)
    await db.containers.bulkPut(containers)
    await db.items.bulkPut(data.items)
    await db.photos.bulkPut(validPhotos)
    if (mode === 'replace') await db.settings.bulkPut(data.settings)
  })

  return {
    containers: data.containers.length,
    items: data.items.length,
    photos: validPhotos.length,
    renamedCodes,
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

