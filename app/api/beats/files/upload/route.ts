import { NextRequest, NextResponse } from 'next/server'
import { mkdir } from 'fs/promises'
import path from 'path'
import { getUsers, getUserById } from '@/lib/storage'
import { addBeatFile } from '@/lib/storage'
import { logActivity } from '@/lib/activityLog'
import { logError, ErrorCode } from '@/lib/errorLogger'

import { getUploadPath } from '@/lib/uploadConfig'
import { writeUploadToDisk } from '@/lib/writeUploadToDisk'
const BEAT_FILES_DIR = getUploadPath('beat-files')

async function ensureUploadDir() {
  try {
    await mkdir(BEAT_FILES_DIR, { recursive: true })
  } catch (error) {
    // Directory might already exist
  }
}

/**
 * Upload a file for a beat (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    await ensureUploadDir()

    const formData = await request.formData()
    const file = formData.get('file') as File
    const beatId = formData.get('beatId') as string
    const fileType = formData.get('fileType') as string || 'other'
    const folderPath = formData.get('folderPath') as string || ''
    const userId = formData.get('userId') as string

    if (!file) {
      logError({
        errorCode: ErrorCode.UPLOAD_NO_FILE,
        type: 'Beat File Upload',
        message: 'No file provided in beat file upload request',
        userId,
        endpoint: '/api/beats/files/upload',
        method: 'POST',
        severity: 'medium',
      })
      return NextResponse.json({ error: 'No file provided', errorCode: ErrorCode.UPLOAD_NO_FILE }, { status: 400 })
    }

    if (!beatId || !userId) {
      logError({
        errorCode: ErrorCode.API_MISSING_PARAMS,
        type: 'Beat File Upload',
        message: 'Beat ID and User ID are required',
        userId,
        endpoint: '/api/beats/files/upload',
        method: 'POST',
        severity: 'medium',
      })
      return NextResponse.json(
        { error: 'Beat ID and User ID are required', errorCode: ErrorCode.API_MISSING_PARAMS },
        { status: 400 }
      )
    }

    // Verify authentication and permissions server-side
    const user = getUserById(userId)
    if (!user) {
      logError({
        errorCode: ErrorCode.AUTH_USER_NOT_FOUND,
        type: 'Beat File Upload',
        message: `User not found for beat file upload: ${userId}`,
        userId,
        endpoint: '/api/beats/files/upload',
        method: 'POST',
        severity: 'high',
      })
      return NextResponse.json({ error: 'User not found', errorCode: ErrorCode.AUTH_USER_NOT_FOUND }, { status: 404 })
    }

    // Only admins can upload beat files (verify server-side)
    if (user.role !== 'admin') {
      logError({
        errorCode: ErrorCode.UPLOAD_PERMISSION_DENIED,
        type: 'Beat File Upload',
        message: `Non-admin user attempted to upload beat file: ${file?.name || 'unknown'}`,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        endpoint: '/api/beats/files/upload',
        method: 'POST',
        details: { beatId },
        severity: 'high',
      })
      return NextResponse.json(
        { error: 'Access denied. Admin only.', errorCode: ErrorCode.UPLOAD_PERMISSION_DENIED },
        { status: 403 }
      )
    }

    // Create folder structure if folderPath is provided
    let finalDir = BEAT_FILES_DIR
    if (folderPath) {
      const sanitizedPath = folderPath.split('/').map(part => part.replace(/[^a-zA-Z0-9._-]/g, '_')).join('/')
      finalDir = path.join(BEAT_FILES_DIR, sanitizedPath)
      await mkdir(finalDir, { recursive: true })
    }

    const { getReadableFileName } = await import('@/lib/fileNaming')
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const extension = path.extname(originalName) || ''
    const baseName = path.basename(originalName, path.extname(originalName))
    const fileName = getReadableFileName({
      baseName: baseName || file.name,
      extension: extension || path.extname(file.name),
      directory: finalDir,
    })
    const filePath = path.join(finalDir, fileName)

    await writeUploadToDisk(file, filePath)

    // Create file URL
    const relativePath = path.relative(BEAT_FILES_DIR, filePath)
    const fileUrl = `/api/files/beat-files/${relativePath.split(path.sep).join('/')}`

    // Add to beat files
    const beatFile = addBeatFile({
      beatId,
      fileName: file.name,
      fileType: fileType as any,
      fileUrl,
      fileSize: file.size,
      folderPath: folderPath || undefined,
      uploadedBy: user.name,
    })

    // Log activity
    logActivity({
      action: 'Beat file uploaded',
      user: user.name,
      userId: userId,
      details: {
        beatId,
        fileName: file.name,
        fileType,
        fileSize: file.size,
      },
      category: 'beats',
    })

    return NextResponse.json({
      success: true,
      file: beatFile,
      fileUrl,
    })
  } catch (error: any) {
    console.error('[POST /api/beats/files/upload] Error:', error)
    return NextResponse.json(
      { error: 'Failed to upload beat file', details: error.message },
      { status: 500 }
    )
  }
}







