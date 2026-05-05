import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import path from 'path'
import { logActivity } from './activityLog'
import { getDataPath } from './uploadConfig'

const DATA_DIR = getDataPath()
const ERROR_LOG_FILE = path.join(DATA_DIR, 'error-log.json')

// Error codes for different error types
export enum ErrorCode {
  // Upload errors (1000-1999)
  UPLOAD_NO_FILE = 'UPLOAD_1001',
  UPLOAD_INVALID_TYPE = 'UPLOAD_1002',
  UPLOAD_FILE_TOO_LARGE = 'UPLOAD_1003',
  UPLOAD_PARSE_ERROR = 'UPLOAD_1004',
  UPLOAD_SAVE_FAILED = 'UPLOAD_1005',
  UPLOAD_INVALID_FORMAT = 'UPLOAD_1006',
  UPLOAD_PERMISSION_DENIED = 'UPLOAD_1007',
  UPLOAD_CSV_EMPTY = 'UPLOAD_1008',
  UPLOAD_CSV_PARSE_ERROR = 'UPLOAD_1009',
  UPLOAD_AUDIO_CONVERSION_FAILED = 'UPLOAD_1010',
  
  // Authentication errors (2000-2999)
  AUTH_INVALID_CREDENTIALS = 'AUTH_2001',
  AUTH_USER_NOT_FOUND = 'AUTH_2002',
  AUTH_UNAUTHORIZED = 'AUTH_2003',
  AUTH_SESSION_EXPIRED = 'AUTH_2004',
  AUTH_INVALID_TOKEN = 'AUTH_2005',
  AUTH_RATE_LIMIT_EXCEEDED = 'AUTH_2006',
  
  // API errors (3000-3999)
  API_MISSING_PARAMS = 'API_3001',
  API_INVALID_INPUT = 'API_3002',
  API_NOT_FOUND = 'API_3003',
  API_FORBIDDEN = 'API_3004',
  API_INTERNAL_ERROR = 'API_3005',
  API_VALIDATION_ERROR = 'API_3006',
  
  // File errors (4000-4999)
  FILE_NOT_FOUND = 'FILE_4001',
  FILE_ACCESS_DENIED = 'FILE_4002',
  FILE_PATH_TRAVERSAL = 'FILE_4003',
  FILE_READ_ERROR = 'FILE_4004',
  
  // Database/Storage errors (5000-5999)
  STORAGE_READ_ERROR = 'STORAGE_5001',
  STORAGE_WRITE_ERROR = 'STORAGE_5002',
  STORAGE_CORRUPTED = 'STORAGE_5003',
  
  // External API errors (6000-6999)
  EXTERNAL_API_FAILED = 'EXTERNAL_6001',
  EXTERNAL_API_TIMEOUT = 'EXTERNAL_6002',
  EXTERNAL_API_INVALID_RESPONSE = 'EXTERNAL_6003',
  
  // Unknown errors (9000-9999)
  UNKNOWN_ERROR = 'UNKNOWN_9001',
}

export interface ErrorLogEntry {
  id: string
  timestamp: string
  errorCode: ErrorCode | string
  type: string
  message: string
  userId?: string
  userName?: string
  userRole?: string
  endpoint?: string
  method?: string
  details: Record<string, any>
  stack?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  resolved: boolean
  resolvedAt?: string
  resolvedBy?: string
  notes?: string
}

interface ErrorLog {
  errors: ErrorLogEntry[]
}

// Ensure data directory exists
function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}

// Load error log
function loadErrorLog(): ErrorLog {
  ensureDataDir()
  try {
    if (existsSync(ERROR_LOG_FILE)) {
      const content = readFileSync(ERROR_LOG_FILE, 'utf-8')
      return JSON.parse(content)
    }
  } catch (error) {
    console.error('Failed to load error log:', error)
  }
  return { errors: [] }
}

// Save error log
function saveErrorLog(log: ErrorLog) {
  ensureDataDir()
  try {
    writeFileSync(ERROR_LOG_FILE, JSON.stringify(log, null, 2))
  } catch (error) {
    console.error('Failed to save error log:', error)
  }
}

// Log an error with error code
export function logError(options: {
  errorCode: ErrorCode | string
  type: string
  message: string
  userId?: string
  userName?: string
  userRole?: string
  endpoint?: string
  method?: string
  details?: Record<string, any>
  error?: Error
  severity?: 'low' | 'medium' | 'high' | 'critical'
}): string {
  const log = loadErrorLog()
  const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  const entry: ErrorLogEntry = {
    id: errorId,
    timestamp: new Date().toISOString(),
    errorCode: options.errorCode,
    type: options.type,
    message: options.message,
    userId: options.userId,
    userName: options.userName,
    userRole: options.userRole,
    endpoint: options.endpoint,
    method: options.method,
    details: options.details || {},
    stack: options.error?.stack,
    severity: options.severity || 'medium',
    resolved: false,
  }
  
  // Add error details if provided
  if (options.error) {
    entry.details.errorName = options.error.name
    entry.details.errorMessage = options.error.message
  }
  
  log.errors.unshift(entry) // Add to beginning
  
  // Keep only last 5000 errors
  if (log.errors.length > 5000) {
    log.errors = log.errors.slice(0, 5000)
  }
  
  saveErrorLog(log)
  
  // Also create activity log entry for errors
  try {
    // Determine action message based on error type
    let actionMessage = `${options.type}: ${options.message}`
    
    // Special handling for upload errors
    if (options.errorCode.toString().startsWith('UPLOAD_')) {
      if (options.errorCode === ErrorCode.UPLOAD_SAVE_FAILED) {
        actionMessage = `Upload Failed: ${options.details?.fileName || options.message}`
      } else if (options.errorCode === ErrorCode.UPLOAD_FILE_TOO_LARGE) {
        actionMessage = `Upload Failed: File too large - ${options.details?.fileName || 'unknown file'}`
      } else if (options.errorCode === ErrorCode.UPLOAD_INVALID_FORMAT) {
        actionMessage = `Upload Failed: Invalid format - ${options.details?.fileName || 'unknown file'}`
      } else if (options.errorCode === ErrorCode.UPLOAD_PERMISSION_DENIED) {
        actionMessage = `Upload Denied: ${options.userName || 'User'} attempted to upload ${options.details?.fileName || 'file'}`
      } else {
        actionMessage = `Upload Error: ${options.message}`
      }
    }
    
    logActivity({
      action: actionMessage,
      user: options.userName || 'System',
      userId: options.userId,
      details: {
        errorCode: options.errorCode,
        errorType: options.type,
        severity: entry.severity,
        endpoint: options.endpoint,
        method: options.method,
        ...options.details,
      },
      category: 'error',
    })
  } catch (activityLogError) {
    // Don't fail if activity log fails - just log to console
    console.error('Failed to log error to activity log:', activityLogError)
  }
  
  // Also log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error(`[ERROR ${options.errorCode}]`, options.message, options.details)
  }
  
  return errorId
}

// Get error logs with filters
export function getErrorLogs(options?: {
  limit?: number
  errorCode?: string
  userId?: string
  severity?: string
  resolved?: boolean
  startDate?: string
  endDate?: string
}): ErrorLogEntry[] {
  let logs = loadErrorLog().errors
  
  if (options?.errorCode) {
    logs = logs.filter(log => log.errorCode === options.errorCode)
  }
  
  if (options?.userId) {
    logs = logs.filter(log => log.userId === options.userId)
  }
  
  if (options?.severity) {
    logs = logs.filter(log => log.severity === options.severity)
  }
  
  if (options?.resolved !== undefined) {
    logs = logs.filter(log => log.resolved === options.resolved)
  }
  
  if (options?.startDate) {
    logs = logs.filter(log => log.timestamp >= options.startDate!)
  }
  
  if (options?.endDate) {
    logs = logs.filter(log => log.timestamp <= options.endDate!)
  }
  
  if (options?.limit) {
    logs = logs.slice(0, options.limit)
  }
  
  return logs
}

// Mark error as resolved
export function resolveError(errorId: string, resolvedBy: string, notes?: string): boolean {
  const log = loadErrorLog()
  const error = log.errors.find(e => e.id === errorId)
  
  if (error) {
    error.resolved = true
    error.resolvedAt = new Date().toISOString()
    error.resolvedBy = resolvedBy
    if (notes) {
      error.notes = notes
    }
    saveErrorLog(log)
    return true
  }
  
  return false
}

// Get error statistics
export function getErrorStats(): {
  total: number
  bySeverity: Record<string, number>
  byErrorCode: Record<string, number>
  unresolved: number
  recent24h: number
} {
  const logs = loadErrorLog().errors
  const now = Date.now()
  const oneDayAgo = now - 24 * 60 * 60 * 1000
  
  const stats = {
    total: logs.length,
    bySeverity: {} as Record<string, number>,
    byErrorCode: {} as Record<string, number>,
    unresolved: 0,
    recent24h: 0,
  }
  
  logs.forEach(log => {
    // Count by severity
    stats.bySeverity[log.severity] = (stats.bySeverity[log.severity] || 0) + 1
    
    // Count by error code
    stats.byErrorCode[log.errorCode] = (stats.byErrorCode[log.errorCode] || 0) + 1
    
    // Count unresolved
    if (!log.resolved) {
      stats.unresolved++
    }
    
    // Count recent (24h)
    const logTime = new Date(log.timestamp).getTime()
    if (logTime > oneDayAgo) {
      stats.recent24h++
    }
  })
  
  return stats
}

// Clear old errors (older than specified days)
export function clearOldErrors(days: number = 90): number {
  const log = loadErrorLog()
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)
  
  const initialLength = log.errors.length
  log.errors = log.errors.filter(error => {
    const errorDate = new Date(error.timestamp)
    return errorDate > cutoffDate || error.severity === 'critical' // Keep critical errors
  })
  
  const removed = initialLength - log.errors.length
  saveErrorLog(log)
  return removed
}