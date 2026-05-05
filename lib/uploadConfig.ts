import fs from 'fs'
import path from 'path'

/**
 * Strip quotes from env var values (handles cases where dotenv includes them)
 */
function stripQuotes(value: string | undefined): string | undefined {
  if (!value) return value
  return value.replace(/^["']|["']$/g, '')
}

let _projectRoot: string | null = null

/**
 * App root (directory with this package.json / Next config). Next dev can use a cwd
 * that is not the repo root; uploads and `/api/files` fallbacks need this anchor.
 */
export function getProjectRoot(): string {
  if (_projectRoot) return _projectRoot
  let dir = process.cwd()
  for (let i = 0; i < 12; i++) {
    const pkg = path.join(dir, 'package.json')
    if (fs.existsSync(pkg)) {
      const hasNext =
        fs.existsSync(path.join(dir, 'next.config.ts')) ||
        fs.existsSync(path.join(dir, 'next.config.mjs')) ||
        fs.existsSync(path.join(dir, 'next.config.js'))
      if (hasNext) {
        _projectRoot = dir
        return _projectRoot
      }
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  _projectRoot = process.cwd()
  return _projectRoot
}

const rawUpload = stripQuotes(process.env.UPLOAD_DIR)

/**
 * Central upload directory - all files (album covers, beats, track audio, etc.) use this base.
 * Relative UPLOAD_DIR is resolved from the project root, not whatever cwd Next picked.
 * Default: project root (album-covers, beats, track-audio, etc. live here).
 */
export const UPLOAD_BASE = rawUpload
  ? path.isAbsolute(rawUpload)
    ? rawUpload
    : path.resolve(getProjectRoot(), rawUpload)
  : getProjectRoot()

const rawData = stripQuotes(process.env.DATA_DIR)

/**
 * Data directory - catalog.db, backups, JSON files.
 * Relative DATA_DIR is resolved from project root.
 * Default: ./data (inside project folder)
 */
export const DATA_BASE = rawData
  ? path.isAbsolute(rawData)
    ? rawData
    : path.resolve(getProjectRoot(), rawData)
  : path.join(getProjectRoot(), 'data')

/** Resolve path for a category (e.g. album-covers, beats, track-audio) */
export function getUploadPath(...segments: string[]): string {
  return path.join(UPLOAD_BASE, ...segments)
}

/** Resolve path in data dir (e.g. backups, catalog.db, checklists) */
export function getDataPath(...segments: string[]): string {
  return path.join(DATA_BASE, ...segments)
}
