import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import * as repo from '../../db/repo'
import { PageHeader, useToast } from '../../app/ui'
import { requestPersistentStorage } from '../../lib/storage'
import { downloadBlob, exportBackup, importBackup, type ImportMode } from '../backup/backup'
import { SUGGESTERS } from '../suggest/suggester'

export function SettingsPage() {
  const toast = useToast()
  const settings = useLiveQuery(async () => ({
    prefix: await repo.getSetting('codePrefix', 'B'),
    suggester: await repo.getSetting('suggester', 'none'),
    lastBackupAt: await repo.getSetting<number>('lastBackupAt', 0),
  }))
  const [busy, setBusy] = useState(false)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [usage, setUsage] = useState<string>('')
  const [mode, setMode] = useState<ImportMode>('merge')

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => {})
    navigator.storage?.estimate?.().then((e) => {
      if (e.usage !== undefined) setUsage(`${(e.usage / 1024 / 1024).toFixed(1)} MB used`)
    }).catch(() => {})
  }, [])

  async function doExport() {
    setBusy(true)
    try {
      const blob = await exportBackup()
      downloadBlob(blob, `storage-backup-${new Date().toISOString().slice(0, 10)}.zip`)
      toast('Backup downloaded')
    } finally {
      setBusy(false)
    }
  }

  async function doImport(file: File | undefined) {
    if (!file) return
    if (mode === 'replace' && !confirm('Replace ALL data on this device with the backup?')) return
    setBusy(true)
    try {
      const r = await importBackup(file, mode)
      toast(`Imported ${r.containers} boxes, ${r.items} items, ${r.photos} photos${r.renamedCodes ? ` (${r.renamedCodes} codes renamed)` : ''}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  async function loadDemo() {
    if (!confirm('Replace ALL data on this device with demo data?')) return
    setBusy(true)
    try {
      const { loadDemoData } = await import('../demo/demoData')
      const r = await loadDemoData()
      toast(`Loaded ${r.boxes} boxes and ${r.items} items`)
    } finally {
      setBusy(false)
    }
  }

  async function clearAll() {
    if (!confirm('Delete ALL boxes, items, photos and spaces on this device? Download a backup first if you need it.')) return
    setBusy(true)
    try {
      const { clearAllData } = await import('../demo/demoData')
      await clearAllData()
      toast('All data cleared')
    } finally {
      setBusy(false)
    }
  }

  if (!settings) return null

  return (
    <main className="page">
      <PageHeader title="Settings" />

      <section className="card stack-v">
        <h2 style={{ margin: 0 }}>Backup</h2>
        <p className="small muted" style={{ margin: 0 }}>
          Everything is stored on this device only. Download a backup regularly and keep it somewhere safe (cloud drive, email to yourself).
          Import it on another phone to share your boxes.
        </p>
        <p className="small" style={{ margin: 0 }}>
          {settings.lastBackupAt ? `Last backup: ${new Date(settings.lastBackupAt).toLocaleString()}` : 'No backup yet.'}
          {usage && ` · ${usage}`}
        </p>
        <button className="btn-primary" disabled={busy} onClick={() => void doExport()}>Download backup (.zip)</button>
        <div className="grid-2">
          <select aria-label="Import mode" value={mode} onChange={(e) => setMode(e.target.value as ImportMode)}>
            <option value="merge">Merge with current data</option>
            <option value="replace">Replace current data</option>
          </select>
          <label className="btn capture-btn">
            Import backup…
            <input type="file" accept=".zip,application/zip" disabled={busy}
              onChange={(e) => { void doImport(e.target.files?.[0]); e.target.value = '' }} />
          </label>
        </div>
      </section>

      <section className="card stack-v">
        <h2 style={{ margin: 0 }}>Keep data safe</h2>
        <p className="small muted" style={{ margin: 0 }}>
          {persisted
            ? 'Persistent storage is on: the browser will not clear your data to free space.'
            : 'Browsers may clear data for sites that are not installed. Add this app to your home screen and turn on persistent storage.'}
        </p>
        {!persisted && (
          <button onClick={() => void requestPersistentStorage().then((ok) => { setPersisted(ok); toast(ok ? 'Persistent storage on' : 'The browser said no – install the app to your home screen and try again') })}>
            Turn on persistent storage
          </button>
        )}
      </section>

      <section className="card stack-v">
        <h2 style={{ margin: 0 }}>Box codes</h2>
        <label className="field">
          <span>Code prefix for new boxes</span>
          <input maxLength={4} value={settings.prefix}
            onChange={(e) => void repo.setSetting('codePrefix', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'B')} />
        </label>
        <p className="small muted" style={{ margin: 0 }}>New boxes are numbered {settings.prefix}-001, {settings.prefix}-002, …</p>
      </section>

      <section className="card stack-v">
        <h2 style={{ margin: 0 }}>Item suggestions from photos</h2>
        <select aria-label="Item suggester" value={settings.suggester} onChange={(e) => void repo.setSetting('suggester', e.target.value)}>
          {SUGGESTERS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <p className="small muted" style={{ margin: 0 }}>Automatic item recognition will be added here later. For now, items are typed in by hand.</p>
      </section>

      <section className="card stack-v">
        <h2 style={{ margin: 0 }}>Demo data</h2>
        <p className="small muted" style={{ margin: 0 }}>
          Fill the app with a sample household (two storage spaces, 21 boxes and drawers) to try things out. This replaces everything on this device.
        </p>
        <div className="btn-row">
          <button disabled={busy} onClick={() => void loadDemo()}>Load demo data</button>
          <button className="btn-danger" disabled={busy} onClick={() => void clearAll()}>Clear all data</button>
        </div>
      </section>
    </main>
  )
}
