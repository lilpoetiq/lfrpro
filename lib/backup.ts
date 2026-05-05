import { writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs'
import path from 'path'
import { getDataPath } from './uploadConfig'

const BACKUPS_DIR = getDataPath('backups')

function ensureBackupsDir() {
  if (!existsSync(BACKUPS_DIR)) {
    mkdirSync(BACKUPS_DIR, { recursive: true })
  }
}

/**
 * Create a timestamped backup filename
 */
function backupFilename(prefix: string, ext = 'json'): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '')
  return `${prefix}_${date}_${time}.${ext}`
}

/**
 * Backup catalog or other JSON to backups/ folder
 */
export function backupToJson(
  data: unknown,
  prefix: string,
  label?: string
): string {
  ensureBackupsDir()
  const filename = backupFilename(prefix)
  const filePath = path.join(BACKUPS_DIR, filename)
  const payload = label
    ? { _label: label, _backedUpAt: new Date().toISOString(), data }
    : data
  writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8')
  return filePath
}

/**
 * Create readable checklist filename: checklist_all-in-my-head-by-omar-hernandez.json
 */
export function checklistSlug(song: string, artist: string): string {
  const slug = `${song} by ${artist}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || 'unknown'
}

/**
 * Get checklist file path - readable name in data/
 */
export function getChecklistPath(songId: string, song?: string, artist?: string): string {
  const base = getDataPath()
  if (song && artist) {
    const slug = checklistSlug(song, artist)
    return path.join(base, `checklist_${slug}.json`)
  }
  return path.join(base, `checklist_${songId}.json`)
}
