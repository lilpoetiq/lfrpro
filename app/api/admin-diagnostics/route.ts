import { NextRequest, NextResponse } from 'next/server'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { readdir, stat } from 'fs/promises'
import path from 'path'
import { getCatalog, getUsers, getSongVaultFiles } from '@/lib/storage'
import { logActivity } from '@/lib/activityLog'
import { UPLOAD_BASE, getDataPath } from '@/lib/uploadConfig'

const DATA_DIR = getDataPath()
const UPLOAD_DIR = UPLOAD_BASE
const ERROR_LOG_FILE = path.join(DATA_DIR, 'error-log.json')

interface DiagnosticIssue {
  id: string
  type: 'error' | 'warning' | 'info'
  severity: 'critical' | 'high' | 'medium' | 'low'
  title: string
  description: string
  details: any
  timestamp: string
  autoFixable: boolean
  fixed?: boolean
  fixAttempted?: boolean
}

interface ErrorLog {
  errors: Array<{
    id: string
    timestamp: string
    type: string
    message: string
    details: any
    fixed: boolean
    fixAttempted: boolean
  }>
}

// Load error log
function loadErrorLog(): ErrorLog {
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
  try {
    writeFileSync(ERROR_LOG_FILE, JSON.stringify(log, null, 2))
  } catch (error) {
    console.error('Failed to save error log:', error)
  }
}

// Import error logger
import { logError, ErrorCode } from '@/lib/errorLogger'

// Check for file download issues
async function checkFileDownloadIssues(): Promise<DiagnosticIssue[]> {
  const issues: DiagnosticIssue[] = []
  const catalog = getCatalog()
  const vaultFiles = getSongVaultFiles()
  
  // Check catalog items with file URLs
  for (const item of catalog) {
    if (item.fileUrl) {
      try {
        // Extract path from fileUrl (e.g., /api/files/vault/file.mp3)
        let filePath = item.fileUrl
        if (filePath.startsWith('/api/files/')) {
          filePath = filePath.replace('/api/files/', '')
        }
        
        const fullPath = path.join(UPLOAD_DIR, ...filePath.split('/'))
        
        if (!existsSync(fullPath)) {
          issues.push({
            id: `file_missing_${item.id}`,
            type: 'error',
            severity: 'high',
            title: `File not found: ${item.song}`,
            description: `The file for "${item.song}" by ${item.artist} cannot be found at the expected location.`,
            details: {
              songId: item.id,
              song: item.song,
              artist: item.artist,
              expectedPath: fullPath,
              fileUrl: item.fileUrl,
            },
            timestamp: new Date().toISOString(),
            autoFixable: false,
          })
        }
      } catch (error: any) {
        issues.push({
          id: `file_check_error_${item.id}`,
          type: 'error',
          severity: 'medium',
          title: `File check error: ${item.song}`,
          description: `Error checking file for "${item.song}": ${error.message}`,
          details: {
            songId: item.id,
            song: item.song,
            error: error.message,
          },
          timestamp: new Date().toISOString(),
          autoFixable: false,
        })
      }
    }
  }
  
  // Check vault files
  for (const file of vaultFiles) {
    if (file.fileUrl && !file.googleDriveUrl) {
      try {
        let filePath = file.fileUrl
        if (filePath.startsWith('/api/files/')) {
          filePath = filePath.replace('/api/files/', '')
        }
        
        const fullPath = path.join(UPLOAD_DIR, ...filePath.split('/'))
        
        if (!existsSync(fullPath)) {
          issues.push({
            id: `vault_file_missing_${file.id}`,
            type: 'error',
            severity: 'high',
            title: `Vault file not found: ${file.fileName}`,
            description: `The vault file "${file.fileName}" cannot be found.`,
            details: {
              fileId: file.id,
              fileName: file.fileName,
              expectedPath: fullPath,
              fileUrl: file.fileUrl,
            },
            timestamp: new Date().toISOString(),
            autoFixable: false,
          })
        }
      } catch (error: any) {
        // Silent fail for vault files
      }
    }
  }
  
  return issues
}

// Check for data integrity issues
function checkDataIntegrity(): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = []
  const catalog = getCatalog()
  const users = getUsers()
  
  // Check for orphaned catalog items (artistId pointing to non-existent user)
  for (const item of catalog) {
    if (item.artistId && !users.find(u => u.id === item.artistId)) {
      issues.push({
        id: `orphaned_item_${item.id}`,
        type: 'warning',
        severity: 'medium',
        title: `Orphaned catalog item: ${item.song}`,
        description: `Catalog item "${item.song}" references a user that no longer exists.`,
        details: {
          songId: item.id,
          song: item.song,
          artistId: item.artistId,
        },
        timestamp: new Date().toISOString(),
        autoFixable: true,
      })
    }
  }
  
  // Check for duplicate songs
  const songMap = new Map<string, string[]>()
  catalog.forEach(item => {
    const key = `${item.song.toLowerCase()}_${item.artist.toLowerCase()}`
    if (!songMap.has(key)) {
      songMap.set(key, [])
    }
    songMap.get(key)!.push(item.id)
  })
  
  const songEntries = Array.from(songMap.entries()) as [string, string[]][]
  for (const [key, ids] of songEntries) {
    if (ids.length > 1) {
      const [song, artist] = key.split('_')
      issues.push({
        id: `duplicate_song_${ids[0]}`,
        type: 'warning',
        severity: 'low',
        title: `Duplicate song: ${song} by ${artist}`,
        description: `Found ${ids.length} duplicate entries for "${song}" by ${artist}.`,
        details: {
          songIds: ids,
          song,
          artist,
        },
        timestamp: new Date().toISOString(),
        autoFixable: true,
      })
    }
  }
  
  return issues
}

// Check for API/configuration issues
function checkConfigurationIssues(): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = []
  
  // Check OpenAI API key
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey || openaiKey.length < 20) {
    issues.push({
      id: 'openai_key_missing',
      type: 'error',
      severity: 'high',
      title: 'OpenAI API key missing or invalid',
      description: 'The OpenAI API key is missing or appears to be invalid. AI features may not work.',
      details: {
        hasKey: !!openaiKey,
        keyLength: openaiKey?.length || 0,
      },
      timestamp: new Date().toISOString(),
      autoFixable: false,
    })
  }
  
  // Check data directory exists
  if (!existsSync(DATA_DIR)) {
    issues.push({
      id: 'data_dir_missing',
      type: 'error',
      severity: 'critical',
      title: 'Data directory missing',
      description: 'The data directory does not exist. This will cause data storage failures.',
      details: {
        expectedPath: DATA_DIR,
      },
      timestamp: new Date().toISOString(),
      autoFixable: true,
    })
  }
  
  // Check upload directory exists
  if (!existsSync(UPLOAD_DIR)) {
    issues.push({
      id: 'upload_dir_missing',
      type: 'error',
      severity: 'high',
      title: 'Upload directory missing',
      description: 'The upload directory does not exist. File uploads will fail.',
      details: {
        expectedPath: UPLOAD_DIR,
      },
      timestamp: new Date().toISOString(),
      autoFixable: true,
    })
  }
  
  return issues
}

// Auto-fix issues
async function attemptAutoFix(issue: DiagnosticIssue): Promise<{ success: boolean; message: string }> {
  issue.fixAttempted = true
  
  // Fix missing directories
  if (issue.id === 'data_dir_missing') {
    try {
      mkdirSync(DATA_DIR, { recursive: true })
      return { success: true, message: 'Created data directory' }
    } catch (error: any) {
      return { success: false, message: `Failed to create directory: ${error.message}` }
    }
  }
  
  if (issue.id === 'upload_dir_missing') {
    try {
      mkdirSync(UPLOAD_DIR, { recursive: true })
      return { success: true, message: 'Created upload directory' }
    } catch (error: any) {
      return { success: false, message: `Failed to create directory: ${error.message}` }
    }
  }
  
  // Fix orphaned items (remove artistId)
  if (issue.id.startsWith('orphaned_item_')) {
    try {
      const { updateCatalogItem } = await import('@/lib/storage')
      const success = updateCatalogItem(issue.details.songId, {
        artistId: undefined,
      })
      if (success) {
        return { success: true, message: 'Removed invalid artistId reference' }
      }
      return { success: false, message: 'Failed to update catalog item' }
    } catch (error: any) {
      return { success: false, message: `Error: ${error.message}` }
    }
  }
  
  return { success: false, message: 'No auto-fix available for this issue' }
}

// GET - Run diagnostics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    // Verify admin access
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }
    
    const users = getUsers()
    const user = users.find(u => u.id === userId)
    
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    // Run all diagnostic checks
    const fileIssues = await checkFileDownloadIssues()
    const dataIssues = checkDataIntegrity()
    const configIssues = checkConfigurationIssues()
    
    const allIssues = [...fileIssues, ...dataIssues, ...configIssues]
    
    // Load error log
    const errorLog = loadErrorLog()
    const recentErrors = errorLog.errors
      .filter(e => !e.fixed)
      .slice(-50)
      .map(e => ({
        id: e.id,
        type: 'error',
        severity: 'high' as const,
        title: `${e.type} Error`,
        description: e.message,
        details: e.details,
        timestamp: e.timestamp,
        autoFixable: false,
        fixAttempted: e.fixAttempted,
      }))
    
    const allIssuesWithErrors = [...allIssues, ...recentErrors]
    
    // Count by severity
    const critical = allIssuesWithErrors.filter(i => i.severity === 'critical').length
    const high = allIssuesWithErrors.filter(i => i.severity === 'high').length
    const medium = allIssuesWithErrors.filter(i => i.severity === 'medium').length
    const low = allIssuesWithErrors.filter(i => i.severity === 'low').length
    
    return NextResponse.json({
      success: true,
      issues: allIssuesWithErrors,
      summary: {
        total: allIssuesWithErrors.length,
        critical,
        high,
        medium,
        low,
        autoFixable: allIssuesWithErrors.filter(i => i.autoFixable).length,
      },
    })
  } catch (error: any) {
    console.error('Diagnostics error:', error)
    logError({
      errorCode: ErrorCode.API_INTERNAL_ERROR,
      type: 'diagnostics',
      message: 'Failed to run diagnostics',
      details: { error: error.message, stack: error.stack }
    })
    return NextResponse.json(
      { error: 'Failed to run diagnostics', details: error.message },
      { status: 500 }
    )
  }
}

// POST - Attempt to fix an issue
export async function POST(request: NextRequest) {
  let issueId: string | undefined
  try {
    const body = await request.json()
    issueId = body.issueId
    const { userId } = body
    
    if (!userId || !issueId) {
      return NextResponse.json({ error: 'Issue ID and User ID required' }, { status: 400 })
    }
    
    // Verify admin access (admin role OR staff with permissions)
    const users = getUsers()
    const user = users.find(u => u.id === userId)
    
    const { hasAdminAccess } = require('@/lib/utils')
    if (!user || !hasAdminAccess(user)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    // Get current issues
    const fileIssues = await checkFileDownloadIssues()
    const dataIssues = checkDataIntegrity()
    const configIssues = checkConfigurationIssues()
    const allIssues = [...fileIssues, ...dataIssues, ...configIssues]
    
    const issue = allIssues.find(i => i.id === issueId)
    
    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }
    
    if (!issue.autoFixable) {
      return NextResponse.json({ error: 'This issue cannot be auto-fixed' }, { status: 400 })
    }
    
    const result = await attemptAutoFix(issue)
    
    if (result.success) {
      issue.fixed = true
      
      // Log activity
      logActivity({
        action: 'Auto-fixed diagnostic issue',
        user: user.name,
        userId: user.id,
        category: 'system',
        details: {
          issueId,
          issueTitle: issue.title,
          fixMessage: result.message,
        },
      })
      
      // Update error log if it's a logged error
      const errorLog = loadErrorLog()
      const errorEntry = errorLog.errors.find(e => e.id === issueId)
      if (errorEntry) {
        errorEntry.fixed = true
        errorEntry.fixAttempted = true
        saveErrorLog(errorLog)
      }
    }
    
    return NextResponse.json({
      success: result.success,
      message: result.message,
      issue: result.success ? issue : undefined,
    })
  } catch (error: any) {
    console.error('Auto-fix error:', error)
    logError({
      errorCode: ErrorCode.API_INTERNAL_ERROR,
      type: 'auto_fix',
      message: 'Failed to auto-fix issue',
      details: { issueId: issueId || 'unknown', error: error.message }
    })
    return NextResponse.json(
      { error: 'Failed to fix issue', details: error.message },
      { status: 500 }
    )
  }
}

// Export logError function for use in other routes
// logError is available internally but not exported (Next.js route restriction)

