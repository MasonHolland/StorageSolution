import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import * as repo from '../../db/repo'

const WEEK = 7 * 24 * 60 * 60 * 1000

/** Nudges the user to back up when there is data and no backup in the last week. */
export function BackupReminder() {
  const state = useLiveQuery(async () => ({
    last: await repo.getSetting<number>('lastBackupAt', 0),
    boxes: (await repo.listContainers()).length,
  }))
  if (!state || state.boxes < 3 || Date.now() - state.last < WEEK) return null
  return (
    <div className="banner">
      <span className="grow">
        {state.last ? `Last backup ${new Date(state.last).toLocaleDateString()}.` : 'Not backed up yet.'} Your data lives only on this device.
      </span>
      <Link className="btn btn-small" to="/settings">Back up</Link>
    </div>
  )
}
