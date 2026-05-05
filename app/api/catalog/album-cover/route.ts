import { NextRequest, NextResponse } from 'next/server'
import { mkdir, stat, unlink } from 'fs/promises'
import path from 'path'
import {
  getCatalog,
  updateCatalogItem,
  addSongVaultFile,
  getUserById,
  getSongVaultFiles,
  deleteSongVaultFile,
  type CatalogItem,
} from '@/lib/storage'
import { logError, ErrorCode } from '@/lib/errorLogger'
import { getUploadPath, UPLOAD_BASE } from '@/lib/uploadConfig'
import { getReadableFileName } from '@/lib/fileNaming'
import { writeUploadToDisk } from '@/lib/writeUploadToDisk'
import { transcodeMotionCoverForWeb } from '@/lib/motionCoverTranscode'

const UPLOAD_DIR = getUploadPath('album-covers')
/** Below this size, reuse the uploaded file as preview (no ffmpeg). */
const SMALL_MOTION_COVER_BYTES = 4 * 1024 * 1024

// Configure route for handling large file uploads (videos can be up to 10GB)
export const runtime = 'nodejs'
export const maxDuration = 600 // 10 minutes for very large video uploads (up to 10GB)

async function ensureUploadDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true })
  } catch (error) {
    // Directory might already exist
  }
}

async function removePreviousMotionCoverPreviewFile(previewUrl: string | undefined) {
  if (!previewUrl?.includes('/album-covers/')) return
  const rawName = previewUrl.split('/').pop()
  if (!rawName || !rawName.includes('_lfr_web')) return
  await unlink(path.join(UPLOAD_DIR, decodeURIComponent(rawName))).catch(() => {})
}

function isWithinUploadRoot(absFile: string): boolean {
  const root = path.resolve(UPLOAD_BASE)
  const file = path.resolve(absFile)
  return file === root || file.startsWith(root + path.sep)
}

/** Map `/api/files/...` to absolute path under UPLOAD_BASE. */
function absolutePathFromFilesUrl(filesUrl: string): string | null {
  const prefix = '/api/files/'
  if (!filesUrl.startsWith(prefix)) return null
  const rel = filesUrl.slice(prefix.length)
  const segments = rel.split('/').filter(Boolean).map((s) => {
    try {
      return decodeURIComponent(s)
    } catch {
      return s
    }
  })
  if (segments.some((s) => s === '..' || s === '.')) return null
  const abs = path.join(UPLOAD_BASE, ...segments)
  if (!isWithinUploadRoot(abs)) return null
  return abs
}

async function safeUnlinkFilesUrl(filesUrl: string | undefined) {
  if (!filesUrl?.trim()) return
  const abs = absolutePathFromFilesUrl(filesUrl.trim())
  if (!abs) return
  await unlink(abs).catch(() => {})
}

function removeVaultEntriesMatchingUrl(songId: string, fileUrl: string) {
  const normalized = fileUrl.trim()
  const ids = getSongVaultFiles(songId)
    .filter((f) => f.fileUrl?.trim() === normalized)
    .map((f) => f.id)
  for (const id of ids) {
    deleteSongVaultFile(id)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const songId = body.songId as string
    const userId = body.userId as string
    const target = body.target as string

    if (!userId) {
      return NextResponse.json({ error: 'User ID required', errorCode: ErrorCode.API_MISSING_PARAMS }, { status: 400 })
    }
    if (!songId) {
      return NextResponse.json({ error: 'Song ID is required' }, { status: 400 })
    }
    if (target !== 'album' && target !== 'motion') {
      return NextResponse.json({ error: 'target must be "album" or "motion"' }, { status: 400 })
    }

    const user = getUserById(userId)
    if (!user) {
      return NextResponse.json({ error: 'User not found', errorCode: ErrorCode.AUTH_USER_NOT_FOUND }, { status: 404 })
    }
    if (user.role === 'artist') {
      return NextResponse.json({ error: 'Artists cannot delete covers', errorCode: ErrorCode.UPLOAD_PERMISSION_DENIED }, { status: 403 })
    }

    const catalog = getCatalog()
    const item = catalog.find((i) => i.id === songId)
    if (!item) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 })
    }

    if (target === 'album') {
      if (!item.albumCover?.trim()) {
        return NextResponse.json({ error: 'No still cover to remove' }, { status: 400 })
      }
      const coverUrl = item.albumCover.trim()
      await safeUnlinkFilesUrl(coverUrl)
      removeVaultEntriesMatchingUrl(songId, coverUrl)
      if (!updateCatalogItem(songId, { albumCover: '' })) {
        return NextResponse.json({ error: 'Failed to update catalog' }, { status: 500 })
      }
      return NextResponse.json({ success: true, message: 'Still cover removed' })
    }

    if (!item.motionCover?.trim()) {
      return NextResponse.json({ error: 'No motion cover to remove' }, { status: 400 })
    }
    const master = item.motionCover.trim()
    const preview = item.motionCoverPreview?.trim()
    if (preview && preview !== master) {
      await safeUnlinkFilesUrl(preview)
    }
    await safeUnlinkFilesUrl(master)
    removeVaultEntriesMatchingUrl(songId, master)
    if (!updateCatalogItem(songId, { motionCover: '', motionCoverPreview: '' })) {
      return NextResponse.json({ error: 'Failed to update catalog' }, { status: 500 })
    }
    return NextResponse.json({ success: true, message: 'Motion cover removed' })
  } catch (error: any) {
    console.error('[Album Cover Delete] Error:', error)
    return NextResponse.json(
      { error: 'Failed to delete cover', details: error.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureUploadDir()

    const formData = await request.formData()
    const file = formData.get('file') as File
    const songId = formData.get('songId') as string
    const userId = formData.get('userId') as string || ''
    const isMotionCoverParam = formData.get('isMotionCover')
    const archivePreviousParam = formData.get('archivePrevious')
    const archivePrevious =
      archivePreviousParam === 'true' || String(archivePreviousParam) === 'true'
    
    console.log('[Album Cover Upload] Request received:', {
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      songId,
      userId,
      isMotionCover: isMotionCoverParam,
    })

    // Verify authentication and permissions server-side
    if (!userId) {
      logError({
        errorCode: ErrorCode.API_MISSING_PARAMS,
        type: 'Album Cover Upload',
        message: 'User ID required for album cover upload',
        endpoint: '/api/catalog/album-cover',
        method: 'POST',
        severity: 'medium',
      })
      return NextResponse.json({ error: 'User ID required', errorCode: ErrorCode.API_MISSING_PARAMS }, { status: 400 })
    }

    const user = getUserById(userId)
    if (!user) {
      logError({
        errorCode: ErrorCode.AUTH_USER_NOT_FOUND,
        type: 'Album Cover Upload',
        message: `User not found for album cover upload: ${userId}`,
        userId,
        endpoint: '/api/catalog/album-cover',
        method: 'POST',
        severity: 'high',
      })
      return NextResponse.json({ error: 'User not found', errorCode: ErrorCode.AUTH_USER_NOT_FOUND }, { status: 404 })
    }

    // Prevent artists from uploading album covers (verify server-side)
    if (user.role === 'artist') {
      logError({
        errorCode: ErrorCode.UPLOAD_PERMISSION_DENIED,
        type: 'Album Cover Upload',
        message: `Artist attempted to upload album cover: ${file?.name || 'unknown'}`,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        endpoint: '/api/catalog/album-cover',
        method: 'POST',
        details: { songId },
        severity: 'medium',
      })
      return NextResponse.json({ error: 'Artists cannot upload album covers', errorCode: ErrorCode.UPLOAD_PERMISSION_DENIED }, { status: 403 })
    }

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!songId) {
      return NextResponse.json({ error: 'Song ID is required' }, { status: 400 })
    }

    // Validate file type - support both images and videos for motion covers
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
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
    const isValidImage = allowedImageTypes.includes(fileTypeLower) || ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(fileExtension)
    const isValidVideo =
      allowedVideoTypes.includes(fileTypeLower) ||
      ['.mp4', '.webm', '.mov', '.avi', '.mpeg', '.m4v', '.mkv'].includes(fileExtension) ||
      fileTypeLower.startsWith('video/')
    const isMotionCover = isMotionCoverParam === 'true' || String(isMotionCoverParam) === 'true'

    console.log('[Album Cover Upload] File validation:', {
      fileExtension,
      fileType: file.type,
      isValidImage,
      isValidVideo,
      isMotionCover,
    })

    if (!isValidImage && !isValidVideo) {
      console.error('[Album Cover Upload] Invalid file type:', { fileType: file.type, fileExtension })
      return NextResponse.json({ 
        error: 'Only image files (JPG, PNG, WebP, GIF) or video files (MP4, WebM, MOV, AVI) are allowed',
        details: `File type: ${file.type}, Extension: ${fileExtension}`
      }, { status: 400 })
    }

    // If it's a video, it must be marked as motion cover
    if (isValidVideo && !isMotionCover) {
      console.error('[Album Cover Upload] Video file uploaded without motion cover flag')
      return NextResponse.json({ 
        error: 'Video files must be uploaded as motion covers. Please check the "Upload as Motion Cover" checkbox.',
        details: 'Video file detected but isMotionCover flag is not set'
      }, { status: 400 })
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

    const replacingMotion = isMotionCover && isValidVideo && !!item.motionCover?.trim()
    const keepOldMotionFilesOnDisk = archivePrevious && replacingMotion
    if (isMotionCover && isValidVideo && !keepOldMotionFilesOnDisk) {
      await removePreviousMotionCoverPreviewFile(item.motionCoverPreview)
    }

    console.log('[Album Cover Upload] Starting streaming write:', { filePath, fileSize: file.size })
    try {
      await writeUploadToDisk(file, filePath)
      console.log('[Album Cover Upload] File written successfully')
    } catch (writeError: any) {
      console.error('[Album Cover Upload] File write error:', writeError)
      return NextResponse.json({ 
        error: 'Failed to save file', 
        details: writeError.message || 'File write operation failed. The file may be too large or there may be insufficient disk space.'
      }, { status: 500 })
    }

    let fileStats: Awaited<ReturnType<typeof stat>>
    try {
      fileStats = await stat(filePath)
    } catch (statErr) {
      console.error('[Album Cover Upload] stat after write:', statErr)
      return NextResponse.json({ error: 'Failed to verify saved file' }, { status: 500 })
    }

    // Create file URL
    const fileUrl = `/api/files/album-covers/${fileName}`

    const COVER_ARCHIVE_MAX = 25
    const updates: Partial<CatalogItem> = {}

    if (archivePrevious) {
      if (replacingMotion) {
        const prev = Array.isArray(item.coverArchive) ? [...item.coverArchive] : []
        prev.unshift({
          id: `ca_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          kind: 'motion',
          masterUrl: item.motionCover!.trim(),
          previewUrl:
            item.motionCoverPreview?.trim() &&
            item.motionCoverPreview.trim() !== item.motionCover!.trim()
              ? item.motionCoverPreview.trim()
              : undefined,
          replacedAt: new Date().toISOString(),
        })
        updates.coverArchive = prev.slice(0, COVER_ARCHIVE_MAX)
      } else if (!isMotionCover && isValidImage && item.albumCover?.trim()) {
        const prev = Array.isArray(item.coverArchive) ? [...item.coverArchive] : []
        prev.unshift({
          id: `ca_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          kind: 'still',
          masterUrl: item.albumCover.trim(),
          replacedAt: new Date().toISOString(),
        })
        updates.coverArchive = prev.slice(0, COVER_ARCHIVE_MAX)
      }
    }

    if (isMotionCover && isValidVideo) {
      updates.motionCover = fileUrl
      if (fileStats.size <= SMALL_MOTION_COVER_BYTES) {
        updates.motionCoverPreview = fileUrl
      } else {
        updates.motionCoverPreview = ''
      }
    } else {
      updates.albumCover = fileUrl
    }
    
    const success = updateCatalogItem(songId, updates)

    if (!success) {
      return NextResponse.json({ error: 'Failed to update catalog item' }, { status: 500 })
    }

    if (isMotionCover && isValidVideo && fileStats.size > SMALL_MOTION_COVER_BYTES) {
      const previewBase = `${path.basename(fileName, path.extname(fileName))}_lfr_web.mp4`
      const previewPath = path.join(UPLOAD_DIR, previewBase)
      void (async () => {
        const ok = await transcodeMotionCoverForWeb(filePath, previewPath)
        if (!ok) {
          console.warn('[Album Cover Upload] motionCoverPreview transcode skipped or failed; in-app playback uses master until ffmpeg succeeds')
          return
        }
        const previewUrl = `/api/files/album-covers/${previewBase}`
        updateCatalogItem(songId, { motionCoverPreview: previewUrl })
      })()
    }

    // Add to song vault
    try {
      const uploadedBy = formData.get('uploadedBy') as string || 'Admin'
      
      addSongVaultFile({
        songId: songId,
        fileName: fileName,
        fileType: 'other', // Album cover
        fileUrl: fileUrl,
        fileSize: fileStats.size,
        uploadedBy: uploadedBy,
        isFolder: false,
      })
    } catch (vaultError) {
      // Log error but don't fail the upload
      console.error('Failed to add album cover to song vault:', vaultError)
    }

    return NextResponse.json({
      success: true,
      fileUrl: fileUrl,
      message: isMotionCover ? 'Motion cover uploaded successfully!' : 'Album cover uploaded successfully!',
    })
  } catch (error: any) {
    console.error('[Album Cover Upload] Error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    })
    return NextResponse.json(
      { 
        error: 'Failed to upload album cover', 
        details: error.message || 'An unexpected error occurred during upload. Please try again.',
        success: false
      },
      { status: 500 }
    )
  }
}
