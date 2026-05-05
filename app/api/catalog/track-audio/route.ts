import { NextRequest, NextResponse } from 'next/server'
import { mkdir, stat } from 'fs/promises'
import path from 'path'
import { getCatalog, updateCatalogItem, addSongVaultFile, getUserById } from '@/lib/storage'
import { getUserFromRequest } from '@/lib/auth'
import { logError, ErrorCode } from '@/lib/errorLogger'
import { getUploadPath } from '@/lib/uploadConfig'
import { getReadableFileName } from '@/lib/fileNaming'
import { writeUploadToDisk } from '@/lib/writeUploadToDisk'

const UPLOAD_DIR = getUploadPath('track-audio')

async function ensureUploadDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true })
  } catch (error) {
    // Directory might already exist
  }
}

// Configure route for handling large file uploads (up to 10GB)
export const runtime = 'nodejs'
export const maxDuration = 600 // 10 minutes for very large file uploads (up to 10GB)

export async function POST(request: NextRequest) {
  try {
    await ensureUploadDir()

    // Parse FormData with error handling
    let formData: FormData
    try {
      // Check Content-Type to provide better error message
      const contentType = request.headers.get('content-type') || ''
      if (!contentType.includes('multipart/form-data') && !contentType.includes('form-data')) {
        console.error('[TRACK AUDIO] Invalid Content-Type:', contentType)
        return NextResponse.json(
          { error: 'Invalid request format', details: `Expected multipart/form-data, got: ${contentType || 'none'}` },
          { status: 400 }
        )
      }

      formData = await request.formData()
    } catch (formDataError: any) {
      const contentLength = request.headers.get('content-length')
      const sizeMB = contentLength ? (parseInt(contentLength) / 1024 / 1024).toFixed(2) : 'unknown'
      
      console.error('[TRACK AUDIO] FormData parsing failed:', {
        message: formDataError.message,
        name: formDataError.name,
        contentType: request.headers.get('content-type'),
        contentLength: contentLength ? `${sizeMB} MB` : 'unknown',
      })
      
      // Check if it's a size-related error from Next.js (mentions 10MB limit)
      const isNextJsSizeError = formDataError.message?.includes('10MB') || 
                                formDataError.message?.includes('body exceeded') ||
                                formDataError.message?.includes('exceeded')
      
      // Only show size error if Next.js is complaining about size OR file is actually over 100MB
      const isSizeError = isNextJsSizeError || (contentLength && parseInt(contentLength) > 100 * 1024 * 1024)
      
      return NextResponse.json(
        { 
          error: 'Failed to parse request', 
          details: isSizeError
            ? isNextJsSizeError
              ? `File size limit issue (${sizeMB} MB). The server is configured for 100MB but may need a restart. Please try again or contact support if the issue persists.`
              : `File too large (${sizeMB} MB). Maximum size is 100MB. Please try a smaller file or compress your audio file.`
            : formDataError.message || 'Invalid FormData format. Please ensure the file is properly selected and try again.',
        },
        { status: 400 }
      )
    }

    // Extract form fields
    const fileEntry = formData.get('file')
    const file = fileEntry instanceof File ? fileEntry : null
    const albumId = (formData.get('albumId') as string) || ''
    const trackId = (formData.get('trackId') as string) || ''
    const userId = (formData.get('userId') as string) || ''
    const uploadedBy = (formData.get('uploadedBy') as string) || 'Admin'

    // Verify authentication and permissions server-side
    if (!userId) {
      logError({
        errorCode: ErrorCode.API_MISSING_PARAMS,
        type: 'Track Audio Upload',
        message: 'User ID required for track audio upload',
        endpoint: '/api/catalog/track-audio',
        method: 'POST',
        severity: 'medium',
      })
      return NextResponse.json({ error: 'User ID required', errorCode: ErrorCode.API_MISSING_PARAMS }, { status: 400 })
    }

    const user = getUserById(userId)
    if (!user) {
      logError({
        errorCode: ErrorCode.AUTH_USER_NOT_FOUND,
        type: 'Track Audio Upload',
        message: `User not found for track audio upload: ${userId}`,
        userId,
        endpoint: '/api/catalog/track-audio',
        method: 'POST',
        severity: 'high',
      })
      return NextResponse.json({ error: 'User not found', errorCode: ErrorCode.AUTH_USER_NOT_FOUND }, { status: 404 })
    }

    // Prevent artists from uploading track audio (verify server-side)
    if (user.role === 'artist') {
      logError({
        errorCode: ErrorCode.UPLOAD_PERMISSION_DENIED,
        type: 'Track Audio Upload',
        message: `Artist attempted to upload track audio: ${file?.name || 'unknown'}`,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        endpoint: '/api/catalog/track-audio',
        method: 'POST',
        details: { albumId, trackId },
        severity: 'medium',
      })
      return NextResponse.json({ error: 'Artists cannot upload track audio', errorCode: ErrorCode.UPLOAD_PERMISSION_DENIED }, { status: 403 })
    }

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No valid file provided' }, { status: 400 })
    }

    // Validate file size
    if (file.size === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 })
    }

    if (!albumId || !trackId) {
      return NextResponse.json({ error: 'Album ID and Track ID are required' }, { status: 400 })
    }

    // Accept any audio file - no strict validation
    const fileExtension = path.extname(file.name).toLowerCase()
    const isValidType = file.type.startsWith('audio/') || ['.mp3', '.wav', '.m4a', '.flac', '.aac', '.ogg'].includes(fileExtension)

    if (!isValidType && fileExtension) {
      // Only reject if we have an extension and it's clearly not audio
      const nonAudioExtensions = ['.txt', '.pdf', '.doc', '.jpg', '.png', '.gif']
      if (nonAudioExtensions.includes(fileExtension)) {
        return NextResponse.json({ error: 'Please upload an audio file' }, { status: 400 })
      }
    }

    // Get the album/EP/single from catalog
    const catalog = getCatalog()
    const album = catalog.find(item => item.id === albumId)

    if (!album) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    // For singles, ensure songs array exists
    if (album.releaseType === 'single' && (!album.songs || album.songs.length === 0)) {
      // Create a songs array with one entry for singles
      const singleSong = {
        id: album.id || `track_${Date.now()}`,
        song: album.song,
        isrc: album.isrc,
        streams: album.totalStreams,
      }
      album.songs = [singleSong]
    }

    if (!album.songs || album.songs.length === 0) {
      return NextResponse.json({ error: 'No tracks found in this release' }, { status: 400 })
    }

    const track = album.songs.find(s => s.id === trackId)
    if (!track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 })
    }

    const extension = fileExtension || '.mp3'
    const fileName = getReadableFileName({
      artist: album.artist,
      song: track.song,
      extension,
      directory: UPLOAD_DIR,
    })
    const filePath = path.join(UPLOAD_DIR, fileName)

    try {
      await writeUploadToDisk(file, filePath)
    } catch (fileError: any) {
      console.error('[TRACK AUDIO] File processing error:', fileError.message)
      return NextResponse.json(
        { error: 'Failed to process file', details: fileError.message },
        { status: 500 }
      )
    }

    // Create file URL
    const fileUrl = `/api/files/track-audio/${fileName}`

    // Update the track with audio URL
    const updatedSongs = album.songs.map(s => 
      s.id === trackId ? { ...s, audioUrl: fileUrl } : s
    )

    // Update the catalog item
    const success = updateCatalogItem(albumId, {
      songs: updatedSongs
    })

    if (!success) {
      return NextResponse.json({ error: 'Failed to update catalog item' }, { status: 500 })
    }

    // Add to song vault
    try {
      const fileStats = await stat(filePath)
      
      // Determine file type based on extension
      const ext = extension.toLowerCase()
      let fileType = 'other'
      if (ext === '.wav' || ext === '.aiff') {
        fileType = 'master'
      } else if (['.mp3', '.m4a', '.aac'].includes(ext)) {
        fileType = 'bounced'
      } else if (ext === '.flac') {
        fileType = 'master'
      }
      
      addSongVaultFile({
        songId: albumId,
        fileName: fileName,
        fileType: fileType,
        fileUrl: fileUrl,
        fileSize: fileStats.size,
        uploadedBy: uploadedBy,
        isFolder: false,
      })
    } catch (vaultError) {
      // Log error but don't fail the upload
      console.error('Failed to add track audio to song vault:', vaultError)
    }

    return NextResponse.json({
      success: true,
      fileUrl: fileUrl,
      message: 'Audio file uploaded successfully',
    })
  } catch (error: any) {
    console.error('Track audio upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload audio file', details: error.message },
      { status: 500 }
    )
  }
}


