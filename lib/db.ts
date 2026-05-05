import Database from 'better-sqlite3'
import path from 'path'
import { mkdirSync, existsSync } from 'fs'
import { getDataPath } from './uploadConfig'

const DB_DIR = getDataPath()
const DB_PATH = path.join(DB_DIR, 'catalog.db')

let db: Database.Database | null = null

function ensureDataDir() {
  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true })
  }
}

// Create catalog.db on first import so it's visible in data/
function ensureDbExists() {
  try {
    ensureDataDir()
    if (!existsSync(DB_PATH)) {
      const temp = new Database(DB_PATH)
      initSchema(temp)
      temp.close()
    }
  } catch {
    // Will be created on first getDb() call
  }
}
ensureDbExists()

export function getDb(): Database.Database {
  if (!db) {
    ensureDataDir()
    db = new Database(DB_PATH)
    initSchema(db)
  }
  return db
}

function initSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS change_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      changed_at TEXT NOT NULL,
      changed_by TEXT,
      changed_by_name TEXT,
      backup_path TEXT,
      details TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_change_log_entity ON change_log(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_change_log_changed_at ON change_log(changed_at);
  `)
}

export interface ChangeLogEntry {
  id?: number
  entity_type: string
  entity_id: string
  action: string
  changed_at: string
  changed_by?: string
  changed_by_name?: string
  backup_path?: string
  details?: string | Record<string, unknown>
}

export function logChange(entry: Omit<ChangeLogEntry, 'id' | 'changed_at'> & { changed_at?: string }) {
  const db = getDb()
  const changed_at = entry.changed_at || new Date().toISOString()
  const stmt = db.prepare(`
    INSERT INTO change_log (entity_type, entity_id, action, changed_at, changed_by, changed_by_name, backup_path, details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    entry.entity_type,
    entry.entity_id,
    entry.action,
    changed_at,
    entry.changed_by ?? null,
    entry.changed_by_name ?? null,
    entry.backup_path ?? null,
    entry.details != null ? (typeof entry.details === 'string' ? entry.details : JSON.stringify(entry.details)) : null
  )
}

export function getRecentChanges(limit = 50): ChangeLogEntry[] {
  const db = getDb()
  const rows = db.prepare(`
    SELECT id, entity_type, entity_id, action, changed_at, changed_by, changed_by_name, backup_path, details
    FROM change_log ORDER BY changed_at DESC LIMIT ?
  `).all(limit) as any[]
  return rows.map(r => ({
    ...r,
    details: r.details ? JSON.parse(r.details) : undefined,
  }))
}

export function getDbPath(): string {
  return DB_PATH
}
