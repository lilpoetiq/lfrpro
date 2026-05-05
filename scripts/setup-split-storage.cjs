#!/usr/bin/env node
/**
 * One-time setup: DATA_DIR on internal Mac disk, UPLOAD_DIR on external volume (when available).
 * Creates folders, copies from project if destinations look empty, writes/merges .env.local
 *
 * Usage:
 *   node scripts/setup-split-storage.cjs
 *   node scripts/setup-split-storage.cjs --dry-run
 *   node scripts/setup-split-storage.cjs --force
 *   node scripts/setup-split-storage.cjs --env-only
 *
 * Override defaults:
 *   LFR_DATA_DIR=/path/to/data LFR_UPLOAD_DIR=/path node scripts/setup-split-storage.cjs
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

const UPLOAD_FOLDERS = [
  'album-covers',
  'audio',
  'beat-files',
  'beats',
  'catalog',
  'instagram-screenshots',
  'spotify-screenshots',
  'track-audio',
  'music-videos',
]

function hasExternalLilDrive() {
  const p = '/Volumes/lil drive'
  try {
    return fs.existsSync(p) && fs.statSync(p).isDirectory()
  } catch {
    return false
  }
}

function resolveDefaults() {
  const home = os.homedir()
  const dataDir =
    process.env.LFR_DATA_DIR || path.join(home, 'LFR-assets', 'data')
  let uploadDir = process.env.LFR_UPLOAD_DIR
  if (!uploadDir) {
    if (hasExternalLilDrive()) {
      uploadDir = path.join('/Volumes/lil drive', 'LFR-assets')
    } else {
      uploadDir = path.join(home, 'LFR-assets', 'media')
    }
  }
  return { dataDir, uploadDir }
}

function isDirEmptyOrAlmost(dir) {
  if (!fs.existsSync(dir)) return true
  const names = fs.readdirSync(dir).filter((n) => n !== '.DS_Store')
  return names.length === 0
}

function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true })
}

function copyTree(src, dest, dry) {
  if (!fs.existsSync(src)) return { skipped: true, reason: 'no source' }
  if (!isDirEmptyOrAlmost(dest) && !global.FORCE) {
    return { skipped: true, reason: 'destination not empty (use --force to overwrite merge)' }
  }
  if (dry) {
    return { would: `copy ${src} -> ${dest}` }
  }
  mkdirp(path.dirname(dest))
  fs.cpSync(src, dest, { recursive: true, force: !!global.FORCE })
  return { copied: true }
}

function writeEnvLocal(projectRoot, dataDir, uploadDir) {
  const p = path.join(projectRoot, '.env.local')
  const header = [
    '# Merged by: npm run setup:split',
    '# DATA_DIR = Mac (JSON, SQLite) | UPLOAD_DIR = big files (covers, audio, beats, … on external when available)',
  ]
  const core = [
    `DATA_DIR=${quoteIfNeeded(dataDir)}`,
    `UPLOAD_DIR=${quoteIfNeeded(uploadDir)}`,
  ]
  const keep = new Set()
  const tail = []
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim()
      if (!t) continue
      if (t.startsWith('#') && t.includes('Merged by: npm run setup:split')) continue
      if (t.startsWith('#') && t.includes('DATA_DIR = Mac')) continue
      const eq = t.indexOf('=')
      if (eq === -1) {
        if (t.startsWith('#')) tail.push(line)
        continue
      }
      const k = t.slice(0, eq).trim()
      if (k === 'DATA_DIR' || k === 'UPLOAD_DIR') continue
      if (keep.has(k)) continue
      keep.add(k)
      tail.push(line)
    }
  }
  const out = [...header, ...core, ...tail, ''].join('\n')
  if (DRY) {
    console.log('--- .env.local (preview) ---\n' + out)
    return
  }
  if (fs.existsSync(p)) {
    fs.copyFileSync(p, `${p}.backup.${Date.now()}`)
  }
  fs.writeFileSync(p, out, 'utf8')
  console.log('Wrote', p, '(old file saved as .env.local.backup.* if present)')
}

function quoteIfNeeded(s) {
  if (/[\s#"'\\]/.test(s)) {
    return JSON.stringify(s)
  }
  return s
}

let DRY = false
let ENV_ONLY = false
global.FORCE = false

for (const a of process.argv.slice(2)) {
  if (a === '--dry-run') DRY = true
  if (a === '--force') global.FORCE = true
  if (a === '--env-only') ENV_ONLY = true
}

const projectRoot = path.join(__dirname, '..')
const { dataDir, uploadDir } = resolveDefaults()

console.log('LFR split storage setup')
console.log('  DATA_DIR  (JSON, DB):  ', dataDir)
console.log('  UPLOAD_DIR (files):   ', uploadDir)
console.log('  External “lil drive” detected:', hasExternalLilDrive())
if (DRY) console.log('  (dry run — no files written except preview)\n')

if (!DRY) {
  mkdirp(dataDir)
  mkdirp(uploadDir)
}

// Write .env.local first so `npm run dev` works even if large folder copies are still in progress
writeEnvLocal(projectRoot, dataDir, uploadDir)
console.log('')

if (ENV_ONLY) {
  console.log('(--env-only: skipped copying files)\n')
  process.exit(0)
}

// Copy ./data
const srcData = path.join(projectRoot, 'data')
if (fs.existsSync(srcData)) {
  console.log('Copying data/ (JSON, DB)…')
}
const r1 = copyTree(srcData, dataDir, DRY)
console.log('data/:', r1)

// Copy upload folders
for (const name of UPLOAD_FOLDERS) {
  const src = path.join(projectRoot, name)
  const dest = path.join(uploadDir, name)
  if (!fs.existsSync(src)) continue
  console.log('Copying', name + '/…')
  const r = copyTree(src, dest, DRY)
  if (r.copied) console.log('copied', name + '/')
  else if (r.would) console.log(name + '/:', r.would)
  else if (r.skipped) console.log(name + '/:', r.reason)
}

console.log('\nNext: `npm run paths`  then  `npm run dev`')
