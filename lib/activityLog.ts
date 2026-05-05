import fs from 'fs'
import path from 'path'
import { getDataPath } from './uploadConfig'

const ACTIVITY_LOG_FILE = getDataPath('activityLog.json')

export interface ActivityLogEntry {
  id: string
  timestamp: string
  action: string
  user: string
  userId?: string
  details: Record<string, any>
  category: 'catalog' | 'upload' | 'analysis' | 'user' | 'task' | 'checklist' | 'vault' | 'system' | 'chat' | 'auth' | 'beats' | 'release' | 'error'
}

function ensureDataDir() {
  const dir = path.dirname(ACTIVITY_LOG_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function getActivityLog(): ActivityLogEntry[] {
  ensureDataDir()

  if (!fs.existsSync(ACTIVITY_LOG_FILE)) {
    return []
  }

  try {
    const content = fs.readFileSync(ACTIVITY_LOG_FILE, 'utf-8')
    return JSON.parse(content)
  } catch {
    return []
  }
}

export function logActivity(entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>): ActivityLogEntry {
  ensureDataDir()

  const logs = getActivityLog()

  const newEntry: ActivityLogEntry = {
    ...entry,
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
  }

  logs.unshift(newEntry) // Add to beginning

  // Keep only last 10,000 entries
  if (logs.length > 10000) {
    logs.splice(10000)
  }

  fs.writeFileSync(ACTIVITY_LOG_FILE, JSON.stringify(logs, null, 2))

  return newEntry
}

export function getActivityLogs(limit?: number, category?: ActivityLogEntry['category']): ActivityLogEntry[] {
  let logs = getActivityLog()

  if (category) {
    logs = logs.filter(log => log.category === category)
  }

  if (limit) {
    logs = logs.slice(0, limit)
  }

  return logs
}

export function clearActivityLog() {
  ensureDataDir()
  fs.writeFileSync(ACTIVITY_LOG_FILE, JSON.stringify([], null, 2))
}
