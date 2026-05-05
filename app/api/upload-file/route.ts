import { NextRequest, NextResponse } from 'next/server'
import { mkdir } from 'fs/promises'
import path from 'path'
import { getUsers, getUserById } from '@/lib/storage'
import { logError, ErrorCode } from '@/lib/errorLogger'
import { UPLOAD_BASE } from '@/lib/uploadConfig'
import { getReadableFileName } from '@/lib/fileNaming'
import { writeUploadToDisk } from '@/lib/writeUploadToDisk'

const UPLOAD_DIR = UPLOAD_BASE

// Configure route for handling large file uploads (up to 10GB)
export const runtime = 'nodejs'
export const maxDuration = 300 // Vercel Hobby cap 300s

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true })
  } catch (error) {
    // Directory might already exist
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureUploadDir()

    const formData = await request.formData()
    const file = formData.get('file') as File
    const category = formData.get('category') as string || 'general' // vault, catalog, etc.
    const folderPath = formData.get('folderPath') as string || '' // Optional folder path (e.g., "Logic Sessions/Song Name")
    const userId = formData.get('userId') as string || ''
    
    // Get user info for logging
    const user = userId ? getUserById(userId) : null

    // Prevent artists from uploading files (verify server-side)
    if (user?.role === 'artist') {
      logError({
        errorCode: ErrorCode.UPLOAD_PERMISSION_DENIED,
        type: 'File Upload',
        message: `Artist attempted to upload file: ${file?.name || 'unknown'}`,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        endpoint: '/api/upload-file',
        method: 'POST',
        details: { category, folderPath },
        severity: 'medium',
      })
      return NextResponse.json({ error: 'Artists cannot upload files', errorCode: ErrorCode.UPLOAD_PERMISSION_DENIED }, { status: 403 })
    }

    if (!file) {
      logError({
        errorCode: ErrorCode.UPLOAD_NO_FILE,
        type: 'File Upload',
        message: 'No file provided in upload request',
        userId: user?.id,
        userName: user?.name,
        endpoint: '/api/upload-file',
        method: 'POST',
        severity: 'medium',
      })
      return NextResponse.json({ error: 'No file provided', errorCode: ErrorCode.UPLOAD_NO_FILE }, { status: 400 })
    }

    // Create category subdirectory
    const categoryDir = path.join(UPLOAD_DIR, category)
    await mkdir(categoryDir, { recursive: true })

    // Create folder structure if folderPath is provided
    let finalDir = categoryDir
    let sanitizedPath = ''
    if (folderPath) {
      // Sanitize folder path
      sanitizedPath = folderPath.split('/').map(part => part.replace(/[^a-zA-Z0-9._-]/g, '_')).join('/')
      finalDir = path.join(categoryDir, sanitizedPath)
      await mkdir(finalDir, { recursive: true })
    }

    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const extension = path.extname(originalName) || ''
    const baseName = path.basename(originalName, path.extname(originalName))
    const fileName = getReadableFileName({
      baseName: baseName || file.name,
      extension: extension || path.extname(file.name),
      directory: finalDir,
    })
    const filePath = path.join(finalDir, fileName)

    try {
      await writeUploadToDisk(file, filePath)
    } catch (saveError: any) {
      logError({
        errorCode: ErrorCode.UPLOAD_SAVE_FAILED,
        type: 'File Upload',
        message: `Failed to save file: ${saveError.message}`,
        userId: user?.id,
        userName: user?.name,
        endpoint: '/api/upload-file',
        method: 'POST',
        details: { fileName: file.name, fileSize: file.size, filePath, category },
        error: saveError as Error,
        severity: 'high',
      })
      return NextResponse.json(
        { error: 'Failed to save file', errorCode: ErrorCode.UPLOAD_SAVE_FAILED, details: saveError.message },
        { status: 500 }
      )
    }

    // Return file info
    // Build file URL using sanitized path to match where file is actually saved
    const fileUrl = sanitizedPath
      ? `/api/files/${category}/${sanitizedPath.split('/').map(part => encodeURIComponent(part)).join('/')}/${fileName}`
      : `/api/files/${category}/${fileName}`
    
    return NextResponse.json({
      success: true,
      fileName: originalName,
      storedFileName: fileName,
      fileUrl,
      folderPath: folderPath || undefined,
      size: file.size,
      type: file.type,
    })
  } catch (error: any) {
    logError({
      errorCode: ErrorCode.UPLOAD_SAVE_FAILED,
      type: 'File Upload',
      message: `Unexpected error during file upload: ${error.message}`,
      endpoint: '/api/upload-file',
      method: 'POST',
      error: error as Error,
      severity: 'critical',
    })
    return NextResponse.json(
      { error: 'Failed to upload file', errorCode: ErrorCode.UPLOAD_SAVE_FAILED, details: error.message },
      { status: 500 }
    )
  }
}

