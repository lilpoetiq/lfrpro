/**
 * Find catalog cover URLs that point to missing files; optionally match files
 * on disk (by artist/song in filename) and update catalog, or clear broken URLs.
 *
 * Usage:
 *   npx tsx scripts/repair-missing-covers.ts           # dry-run (default)
 *   npx tsx scripts/repair-missing-covers.ts --fix     # apply updates
 *   npx tsx scripts/repair-missing-covers.ts --fix --clear-unmatched
 *        # clear albumCover/motionCover when no file on disk matches
 *
 * Uses DATA_DIR / UPLOAD_BASE from the same env as the Next app.
 */

import { existsSync, readdirSync } from 'fs'
import path from 'path'
import { getCatalog, updateCatalogItem, type CatalogItem } from '../lib/storage'
import { UPLOAD_BASE } from '../lib/uploadConfig'

const COVER_DIR = path.join(UPLOAD_BASE, 'album-covers')

function slug(s: string): string {
  return (s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9._-]/g, '')
}

function absoluteFromFilesUrl(filesUrl: string): string | null {
  if (!filesUrl.startsWith('/api/files/')) return null
  const rel = filesUrl.slice('/api/files/'.length)
  const segs = rel.split('/').filter(Boolean).map((s) => {
    try {
      return decodeURIComponent(s)
    } catch {
      return s
    }
  })
  if (segs.some((x) => x === '..' || x === '.')) return null
  const abs = path.join(UPLOAD_BASE, ...segs)
  const root = path.resolve(UPLOAD_BASE)
  const file = path.resolve(abs)
  if (file !== root && !file.startsWith(root + path.sep)) return null
  return abs
}

function fileExistsForUrl(filesUrl: string | undefined): boolean {
  if (!filesUrl?.trim()) return false
  const abs = absoluteFromFilesUrl(filesUrl.trim())
  return abs ? existsSync(abs) : false
}

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i
const VIDEO_EXT = /\.(mp4|webm|mov|avi|mpe?g|m4v|mkv)$/i

function listCoverFiles(): string[] {
  if (!existsSync(COVER_DIR)) return []
  return readdirSync(COVER_DIR, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name)
}

function guessCoverUrl(item: CatalogItem, kind: 'still' | 'motion'): string | null {
  const files = listCoverFiles()
  const a = slug(item.artist)
  const s = slug(item.song)
  const isVideo = kind === 'motion'
  const extOk = (f: string) => (isVideo ? VIDEO_EXT.test(f) : IMAGE_EXT.test(f))

  const score = (fname: string): number => {
    const f = fname.toLowerCase()
    let n = 0
    if (a.length >= 2 && f.includes(a)) n += 2
    if (s.length >= 2 && f.includes(s)) n += 2
    if (s.length >= 2 && f.includes(s.replace(/_/g, ''))) n += 1
    return n
  }

  const candidates = files
    .filter(extOk)
    .map((f) => ({ f, sc: score(f) }))
    .filter((x) => x.sc >= 2)
    .sort((x, y) => y.sc - x.sc)

  if (candidates.length === 0) return null
  return `/api/files/album-covers/${candidates[0].f}`
}

function repairItem(
  item: CatalogItem,
  dryRun: boolean,
  clearUnmatched: boolean
): { id: string; song: string; artist: string; actions: string[] } | null {
  const actions: string[] = []
  const updates: Partial<CatalogItem> = {}

  if (item.albumCover?.trim() && !fileExistsForUrl(item.albumCover)) {
    actions.push(`Still cover missing on disk: ${item.albumCover}`)
    const guess = guessCoverUrl(item, 'still')
    if (guess) {
      actions.push(`  → match candidate: ${guess}`)
      updates.albumCover = guess
    } else if (clearUnmatched) {
      actions.push('  → clearing albumCover (no match)')
      updates.albumCover = ''
    }
  }

  if (item.motionCover?.trim() && !fileExistsForUrl(item.motionCover)) {
    actions.push(`Motion cover missing on disk: ${item.motionCover}`)
    const guess = guessCoverUrl(item, 'motion')
    if (guess) {
      actions.push(`  → match candidate: ${guess}`)
      updates.motionCover = guess
    } else if (clearUnmatched) {
      actions.push('  → clearing motionCover + motionCoverPreview (no match)')
      updates.motionCover = ''
      updates.motionCoverPreview = ''
    }
  }

  if (item.motionCoverPreview?.trim() && item.motionCoverPreview !== item.motionCover) {
    if (!fileExistsForUrl(item.motionCoverPreview)) {
      actions.push(`Motion preview missing on disk: ${item.motionCoverPreview}`)
      if (clearUnmatched) {
        actions.push('  → clearing motionCoverPreview')
        updates.motionCoverPreview = ''
      }
    }
  }

  if (actions.length === 0) return null

  if (Object.keys(updates).length > 0) {
    if (!dryRun) {
      const ok = updateCatalogItem(item.id, updates)
      if (!ok) actions.push('ERROR: updateCatalogItem failed')
      else actions.push('  ✓ Catalog updated')
    } else {
      actions.push('  (dry-run: no write)')
    }
  }

  return { id: item.id, song: item.song, artist: item.artist, actions }
}

const args = process.argv.slice(2)
const fix = args.includes('--fix')
const clearUnmatched = args.includes('--clear-unmatched')

console.log('UPLOAD_BASE:', UPLOAD_BASE)
console.log('album-covers:', COVER_DIR, existsSync(COVER_DIR) ? '' : '(missing)')
console.log('Mode:', fix ? (clearUnmatched ? 'FIX + clear unmatched' : 'FIX') : 'DRY-RUN')
console.log('')

const catalog = getCatalog()
const report: Array<{ id: string; song: string; artist: string; actions: string[] }> = []

for (const item of catalog) {
  const row = repairItem(item, !fix, clearUnmatched)
  if (row) report.push(row)
}

if (report.length === 0) {
  console.log('No missing cover files detected in catalog (or nothing to do).')
} else {
  console.log(`Items with cover path issues: ${report.length}\n`)
  for (const r of report) {
    console.log(`${r.song} — ${r.artist} (${r.id})`)
    for (const line of r.actions) console.log(line)
    console.log('')
  }
}
