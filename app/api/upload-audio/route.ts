import { NextRequest, NextResponse } from 'next/server'
import { mkdir } from 'fs/promises'
import path from 'path'
import { addCatalogItem, getUsers, getUserById } from '@/lib/storage'
import { logActivity } from '@/lib/activityLog'
import { notifySongSubmitted } from '@/lib/aiNotifications'
import { logError, ErrorCode } from '@/lib/errorLogger'
import { getUploadPath } from '@/lib/uploadConfig'
import { getReadableFileName } from '@/lib/fileNaming'
import { writeUploadToDisk } from '@/lib/writeUploadToDisk'

const UPLOAD_DIR = getUploadPath('audio')

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

    let formData: FormData
    try {
      // Check Content-Type to provide better error message
      const contentType = request.headers.get('content-type') || ''
      if (!contentType.includes('multipart/form-data') && !contentType.includes('form-data')) {
        logError({
          errorCode: ErrorCode.UPLOAD_INVALID_FORMAT,
          type: 'Audio Upload',
          message: `Invalid Content-Type for audio upload: ${contentType}`,
          endpoint: '/api/upload-audio',
          method: 'POST',
          details: { contentType },
          severity: 'medium',
        })
        return NextResponse.json(
          { error: 'Invalid request format', errorCode: ErrorCode.UPLOAD_INVALID_FORMAT, details: `Expected multipart/form-data, got: ${contentType || 'none'}` },
          { status: 400 }
        )
      }

      formData = await request.formData()
    } catch (formDataError: any) {
      const contentLength = request.headers.get('content-length')
      const sizeMB = contentLength ? (parseInt(contentLength) / 1024 / 1024).toFixed(2) : 'unknown'
      
      // Check if it's a size-related error from Next.js (mentions 10MB limit)
      const isNextJsSizeError = formDataError.message?.includes('10MB') || 
                                formDataError.message?.includes('body exceeded') ||
                                formDataError.message?.includes('exceeded')
      
      // Only show size error if Next.js is complaining about size OR file is actually over 100MB
      const isSizeError = isNextJsSizeError || (contentLength && parseInt(contentLength) > 100 * 1024 * 1024)
      
      const errorCode = isSizeError ? ErrorCode.UPLOAD_FILE_TOO_LARGE : ErrorCode.UPLOAD_PARSE_ERROR
      
      logError({
        errorCode,
        type: 'Audio Upload',
        message: `FormData parsing failed: ${formDataError.message}`,
        endpoint: '/api/upload-audio',
        method: 'POST',
        details: {
          errorName: formDataError.name,
          contentType: request.headers.get('content-type'),
          contentLength: contentLength ? `${sizeMB} MB` : 'unknown',
          isSizeError,
        },
        severity: isSizeError ? 'high' : 'medium',
      })
      
      return NextResponse.json(
        { 
          error: 'Failed to parse request',
          errorCode,
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
    const songName = (formData.get('songName') as string)?.trim() || ''
    const artistName = (formData.get('artistName') as string)?.trim() || ''
    const userId = (formData.get('userId') as string) || ''
    const releaseDate = (formData.get('releaseDate') as string)?.trim() || null

    // Get user info for logging
    const users = getUsers()
    const user = userId ? users.find(u => u.id === userId) : null

    // Prevent artists from uploading audio
    if (userId && user?.role === 'artist') {
      logError({
        errorCode: ErrorCode.UPLOAD_PERMISSION_DENIED,
        type: 'Audio Upload',
        message: `Artist attempted to upload audio file: ${file?.name || 'unknown'}`,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        endpoint: '/api/upload-audio',
        method: 'POST',
        details: { songName, artistName },
        severity: 'medium',
      })
      return NextResponse.json({ error: 'Artists cannot upload audio files', errorCode: ErrorCode.UPLOAD_PERMISSION_DENIED }, { status: 403 })
    }

    if (!file || !(file instanceof File)) {
      logError({
        errorCode: ErrorCode.UPLOAD_NO_FILE,
        type: 'Audio Upload',
        message: 'No valid file provided in audio upload request',
        userId: user?.id,
        userName: user?.name,
        userRole: user?.role,
        endpoint: '/api/upload-audio',
        method: 'POST',
        severity: 'medium',
      })
      return NextResponse.json({ error: 'No valid file provided', errorCode: ErrorCode.UPLOAD_NO_FILE }, { status: 400 })
    }

    // Validate file size
    if (file.size === 0) {
      logError({
        errorCode: ErrorCode.UPLOAD_INVALID_FORMAT,
        type: 'Audio Upload',
        message: 'Empty file uploaded',
        userId: user?.id,
        userName: user?.name,
        endpoint: '/api/upload-audio',
        method: 'POST',
        details: { fileName: file.name },
        severity: 'low',
      })
      return NextResponse.json({ error: 'File is empty', errorCode: ErrorCode.UPLOAD_INVALID_FORMAT }, { status: 400 })
    }

    if (!songName || !artistName || !userId) {
      logError({
        errorCode: ErrorCode.API_MISSING_PARAMS,
        type: 'Audio Upload',
        message: 'Missing required fields for audio upload',
        userId: user?.id,
        userName: user?.name,
        endpoint: '/api/upload-audio',
        method: 'POST',
        details: { hasSongName: !!songName, hasArtistName: !!artistName, hasUserId: !!userId },
        severity: 'medium',
      })
      return NextResponse.json({ error: 'Song name, artist name, and user ID are required', errorCode: ErrorCode.API_MISSING_PARAMS }, { status: 400 })
    }

    // Validate file type - accept any audio file
    const fileExtension = path.extname(file.name).toLowerCase()
    const isValidType = file.type.startsWith('audio/') || ['.mp3', '.wav', '.m4a', '.flac', '.aac', '.ogg'].includes(fileExtension)

    if (!isValidType && fileExtension) {
      // Only reject if we have an extension and it's clearly not audio
      const nonAudioExtensions = ['.txt', '.pdf', '.doc', '.jpg', '.png', '.gif']
      if (nonAudioExtensions.includes(fileExtension)) {
        logError({
          errorCode: ErrorCode.UPLOAD_INVALID_TYPE,
          type: 'Audio Upload',
          message: `Invalid file type uploaded: ${fileExtension}`,
          userId: user?.id,
          userName: user?.name,
          endpoint: '/api/upload-audio',
          method: 'POST',
          details: { fileName: file.name, fileType: file.type, fileExtension },
          severity: 'medium',
        })
        return NextResponse.json({ error: 'Please upload an audio file', errorCode: ErrorCode.UPLOAD_INVALID_TYPE }, { status: 400 })
      }
    }

    const extension = fileExtension || '.mp3'
    const fileName = getReadableFileName({
      artist: artistName,
      song: songName,
      extension,
      directory: UPLOAD_DIR,
    })
    const filePath = path.join(UPLOAD_DIR, fileName)

    try {
      await writeUploadToDisk(file, filePath)
    } catch (fileError: any) {
      logError({
        errorCode: ErrorCode.UPLOAD_SAVE_FAILED,
        type: 'Audio Upload',
        message: `Failed to save audio file: ${fileError.message}`,
        userId: user?.id,
        userName: user?.name,
        endpoint: '/api/upload-audio',
        method: 'POST',
        details: { fileName: file.name, fileSize: file.size, filePath },
        error: fileError as Error,
        severity: 'high',
      })
      return NextResponse.json(
        { error: 'Failed to process file', errorCode: ErrorCode.UPLOAD_SAVE_FAILED, details: fileError.message },
        { status: 500 }
      )
    }

    // Verify user exists
    if (!user) {
      logError({
        errorCode: ErrorCode.AUTH_USER_NOT_FOUND,
        type: 'Audio Upload',
        message: `User not found for audio upload: ${userId}`,
        userId,
        endpoint: '/api/upload-audio',
        method: 'POST',
        details: { songName, artistName },
        severity: 'high',
      })
      return NextResponse.json({ error: 'User not found', errorCode: ErrorCode.AUTH_USER_NOT_FOUND }, { status: 404 })
    }

    // Create file URL (using /api/files route)
    const fileUrl = `/api/files/audio/${fileName}`

    // Ensure submission is for the submitting artist
    const submittingUser = users.find(u => u.id === userId)
    const finalArtistName = submittingUser?.artistName || submittingUser?.name || artistName
    
    // Create pending catalog item (not approved yet)
    const catalogItem = addCatalogItem({
      song: songName,
      artist: finalArtistName,
      artistId: userId,
      artistIds: [userId],
      releaseType: 'single',
      releaseDateRequested: releaseDate || undefined,
      releaseApprovalStatus: 'pending',
      totalStreams: 0,
      distributor: undefined,
      manuallyAdded: true,
      fileUrl: fileUrl,
      fromCSV: false,
    })

    // Log activity
    logActivity({
      action: 'Audio File Uploaded',
      user: user.name,
      userId: userId,
      details: {
        songId: catalogItem.id,
        songName: songName,
        artist: artistName,
        fileName: fileName,
        fileSize: file.size,
        fileUrl: fileUrl,
        releaseDateRequested: releaseDate || undefined,
      },
      category: 'upload',
    })

    // Create release request notification for all admins
    const { addMessage } = await import('@/lib/storage')
    const adminUsers = users.filter(u => u.role === 'admin')
    
    // Send notification to all admins
    adminUsers.forEach(admin => {
      addMessage({
        from: userId,
        fromName: user.name,
        to: admin.id,
        toName: admin.name || 'Admin',
        subject: `Song Submission: ${songName}`,
        message: `${user.name} (${artistName}) submitted "${songName}" for review. Please review and approve/deny.`,
        songId: catalogItem.id,
      })
    })
    
    // Notify AI server of the change (will text admins) - non-blocking
    try {
      await notifySongSubmitted({
        songName,
        artistName: finalArtistName,
        userId,
        userName: user.name,
      })
    } catch (error) {
      console.error('[POST /api/upload-audio] Error notifying AI (non-critical):', error)
      // Continue - don't fail the request
    }

    return NextResponse.json({
      success: true,
      catalogItem: catalogItem,
      fileUrl: fileUrl,
      message: 'Audio file uploaded successfully. Waiting for admin approval.',
    })
  } catch (error: any) {
    logError({
      errorCode: ErrorCode.UPLOAD_SAVE_FAILED,
      type: 'Audio Upload',
      message: `Unexpected error during audio upload: ${error.message}`,
      endpoint: '/api/upload-audio',
      method: 'POST',
      error: error as Error,
      severity: 'critical',
    })
    return NextResponse.json(
      { error: 'Failed to upload audio file', errorCode: ErrorCode.UPLOAD_SAVE_FAILED, details: error.message },
      { status: 500 }
    )
  }
}

