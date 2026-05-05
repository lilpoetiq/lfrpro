import { NextRequest, NextResponse } from 'next/server'
import { mkdir, stat } from 'fs/promises'
import path from 'path'
import { getCatalog, updateCatalogItem, addSongVaultFile, getUserById } from '@/lib/storage'
import { logError, ErrorCode } from '@/lib/errorLogger'
import { getUploadPath } from '@/lib/uploadConfig'
import { getReadableFileName } from '@/lib/fileNaming'
import { writeUploadToDisk } from '@/lib/writeUploadToDisk'

const UPLOAD_DIR = getUploadPath('music-videos')

// Configure route for handling large file uploads (videos can be up to 10GB)
export const runtime = 'nodejs'
export const maxDuration = 300 // Vercel Hobby cap 300s

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
    const songId = formData.get('songId') as string
    const userId = formData.get('userId') as string || ''

    // Verify authentication and permissions server-side
    if (!userId) {
      logError({
        errorCode: ErrorCode.API_MISSING_PARAMS,
        type: 'Music Video Upload',
        message: 'User ID required for music video upload',
        endpoint: '/api/catalog/music-video',
        method: 'POST',
        severity: 'medium',
      })
      return NextResponse.json({ error: 'User ID required', errorCode: ErrorCode.API_MISSING_PARAMS }, { status: 400 })
    }

    const user = getUserById(userId)
    if (!user) {
      logError({
        errorCode: ErrorCode.AUTH_USER_NOT_FOUND,
        type: 'Music Video Upload',
        message: `User not found for music video upload: ${userId}`,
        userId,
        endpoint: '/api/catalog/music-video',
        method: 'POST',
        severity: 'high',
      })
      return NextResponse.json({ error: 'User not found', errorCode: ErrorCode.AUTH_USER_NOT_FOUND }, { status: 404 })
    }

    // Prevent artists from uploading music videos (verify server-side)
    if (user.role === 'artist') {
      logError({
        errorCode: ErrorCode.UPLOAD_PERMISSION_DENIED,
        type: 'Music Video Upload',
        message: `Artist attempted to upload music video: ${file?.name || 'unknown'}`,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        endpoint: '/api/catalog/music-video',
        method: 'POST',
        details: { songId },
        severity: 'medium',
      })
      return NextResponse.json({ error: 'Artists cannot upload music videos', errorCode: ErrorCode.UPLOAD_PERMISSION_DENIED }, { status: 403 })
    }

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!songId) {
      return NextResponse.json({ error: 'Song ID is required' }, { status: 400 })
    }

    // Validate file type - only video files
    const allowedVideoTypes = [
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'video/x-msvideo',
      'video/mpeg',
      'video/x-m4v',
    ]
    const fileTypeLower = (file.type || '').toLowerCase()
    const fileExtension = path.extname(file.name).toLowerCase()
    const isValidVideo =
      allowedVideoTypes.includes(fileTypeLower) ||
      ['.mp4', '.webm', '.mov', '.avi', '.mpeg', '.m4v', '.mkv'].includes(fileExtension) ||
      fileTypeLower.startsWith('video/')

    if (!isValidVideo) {
      return NextResponse.json({ error: 'Only video files (MP4, WebM, MOV, AVI) are allowed' }, { status: 400 })
    }

    // Get the catalog item
    const catalog = getCatalog()
    const item = catalog.find(i => i.id === songId)

    if (!item) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 })
    }

    const extension = fileExtension || path.extname(file.name)
    const fileName = getReadableFileName({
      artist: item.artist,
      song: item.song,
      extension,
      directory: UPLOAD_DIR,
    })
    const filePath = path.join(UPLOAD_DIR, fileName)

    await writeUploadToDisk(file, filePath)

    // Create file URL
    const fileUrl = `/api/files/music-videos/${fileName}`

    // Update the catalog item
    const success = updateCatalogItem(songId, {
      musicVideo: fileUrl
    })

    if (!success) {
      return NextResponse.json({ error: 'Failed to update catalog item' }, { status: 500 })
    }

    // Add to song vault
    try {
      const fileStats = await stat(filePath)
      const uploadedBy = formData.get('uploadedBy') as string || 'Admin'
      
      addSongVaultFile({
        songId: songId,
        fileName: fileName,
        fileType: 'music_video',
        fileUrl: fileUrl,
        fileSize: fileStats.size,
        uploadedBy: uploadedBy,
        isFolder: false,
      })
    } catch (vaultError) {
      // Log error but don't fail the upload
      console.error('Failed to add music video to song vault:', vaultError)
    }

    return NextResponse.json({
      success: true,
      fileUrl: fileUrl,
      message: 'Music video uploaded successfully',
    })
  } catch (error: any) {
    console.error('Music video upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload music video', details: error.message },
      { status: 500 }
    )
  }
}
