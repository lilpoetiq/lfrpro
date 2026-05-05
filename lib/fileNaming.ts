import path from 'path'
import { existsSync } from 'fs'

/**
 * Sanitize string for use in filenames: keep alphanumeric, spaces → underscores
 */
function sanitizeForFilename(str: string): string {
  return (str || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'file'
}

/**
 * Generate readable filename: Artist_SongName.ext
 * On collision: Artist_SongName_YYYY-MM-DD_HHmmss.ext
 */
export function getReadableFileName(
  options: {
    artist?: string
    song?: string
    baseName?: string
    extension: string
    directory: string
  }
): string {
  const { artist, song, baseName, extension } = options
  const dir = options.directory

  const ext = extension.startsWith('.') ? extension : `.${extension}`

  let base: string
  if (baseName) {
    base = sanitizeForFilename(baseName)
  } else if (artist && song) {
    const a = sanitizeForFilename(artist)
    const s = sanitizeForFilename(song)
    base = a && s ? `${a}_${s}` : (s || a || 'file')
  } else if (song) {
    base = sanitizeForFilename(song)
  } else {
    base = 'file'
  }

  let fileName = `${base}${ext}`
  let filePath = path.join(dir, fileName)

  if (!existsSync(filePath)) {
    return fileName
  }

  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10)
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '')
  const suffix = `${dateStr}_${timeStr}`

  fileName = `${base}_${suffix}${ext}`
  filePath = path.join(dir, fileName)

  if (!existsSync(filePath)) {
    return fileName
  }

  const randomStr = Math.random().toString(36).substring(2, 6)
  fileName = `${base}_${suffix}_${randomStr}${ext}`
  return fileName
}
