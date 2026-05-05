import { NextRequest, NextResponse } from 'next/server'
import { getSongVaultFiles, addSongVaultFile, deleteSongVaultFile, updateSongVaultFile, updateVaultFilesByFolderPath, deleteVaultFilesByFolderPath, getUserById } from '@/lib/storage'
import { logError, ErrorCode } from '@/lib/errorLogger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const songId = searchParams.get('songId')
    
    const files = getSongVaultFiles(songId || undefined)
    return NextResponse.json({ success: true, files })
  } catch (error: any) {
    console.error('Get song vault error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch vault files', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { songId, songName, artistName, artistId, fileName, fileType, fileUrl, googleDriveUrl, link, fileSize, uploadedBy, folderPath, isFolder, isUnreleased, userId } = body

    // Verify authentication and permissions server-side
    if (!userId) {
      logError({
        errorCode: ErrorCode.API_MISSING_PARAMS,
        type: 'Song Vault',
        message: 'User ID required for adding song vault file',
        endpoint: '/api/song-vault',
        method: 'POST',
        severity: 'medium',
      })
      return NextResponse.json({ error: 'User ID required', errorCode: ErrorCode.API_MISSING_PARAMS }, { status: 400 })
    }

    const user = getUserById(userId)
    if (!user) {
      logError({
        errorCode: ErrorCode.AUTH_USER_NOT_FOUND,
        type: 'Song Vault',
        message: `User not found for adding song vault file: ${userId}`,
        userId,
        endpoint: '/api/song-vault',
        method: 'POST',
        severity: 'high',
      })
      return NextResponse.json({ error: 'User not found', errorCode: ErrorCode.AUTH_USER_NOT_FOUND }, { status: 404 })
    }

    // Prevent artists from adding song vault files (verify server-side)
    if (user.role === 'artist') {
      logError({
        errorCode: ErrorCode.API_FORBIDDEN,
        type: 'Song Vault',
        message: `Artist attempted to add song vault file: ${fileName || 'unknown'}`,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        endpoint: '/api/song-vault',
        method: 'POST',
        details: { songId, fileName },
        severity: 'medium',
      })
      return NextResponse.json({ error: 'Artists cannot add song vault files', errorCode: ErrorCode.API_FORBIDDEN }, { status: 403 })
    }

    // For folders, only require fileName
    if (isFolder) {
      if (!fileName) {
        return NextResponse.json({ error: 'Folder name is required' }, { status: 400 })
      }
    } else {
      // For unreleased songs, require songName, artistName, and fileName
      if (isUnreleased) {
        if (!songName || !artistName || !fileName || !fileUrl) {
          return NextResponse.json({ error: 'Song name, artist name, file name, and file URL are required for unreleased songs' }, { status: 400 })
        }
      } else {
        // For catalog songs, require songId, fileName, and fileUrl
        if (!songId || !fileName || !fileUrl) {
          return NextResponse.json({ error: 'Song ID, file name, and file URL are required' }, { status: 400 })
        }
      }
    }

    const file = addSongVaultFile({
      songId: isUnreleased ? undefined : (songId || 'general'),
      songName: isUnreleased ? songName : undefined,
      artistName: isUnreleased ? artistName : undefined,
      artistId: isUnreleased ? (artistId || undefined) : undefined,
      fileName,
      fileType: fileType || (isFolder ? 'folder' : 'other'),
      fileUrl: isFolder ? undefined : fileUrl,
      googleDriveUrl: googleDriveUrl || undefined,
      link: link || undefined,
      fileSize: isFolder ? undefined : fileSize,
      folderPath: folderPath || undefined,
      isFolder: isFolder || false,
      uploadedBy: uploadedBy || 'Admin',
      isUnreleased: isUnreleased || false,
    })

    return NextResponse.json({ success: true, file })
  } catch (error: any) {
    console.error('Add song vault file error:', error)
    return NextResponse.json(
      { error: 'Failed to add file', details: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, updates, oldFolderPath, newFolderPath, songId, userId } = body

    // Verify authentication and permissions server-side
    if (!userId) {
      logError({
        errorCode: ErrorCode.API_MISSING_PARAMS,
        type: 'Song Vault',
        message: 'User ID required for modifying song vault file',
        endpoint: '/api/song-vault',
        method: 'PUT',
        severity: 'medium',
      })
      return NextResponse.json({ error: 'User ID required', errorCode: ErrorCode.API_MISSING_PARAMS }, { status: 400 })
    }

    const user = getUserById(userId)
    if (!user) {
      logError({
        errorCode: ErrorCode.AUTH_USER_NOT_FOUND,
        type: 'Song Vault',
        message: `User not found for modifying song vault file: ${userId}`,
        userId,
        endpoint: '/api/song-vault',
        method: 'PUT',
        severity: 'high',
      })
      return NextResponse.json({ error: 'User not found', errorCode: ErrorCode.AUTH_USER_NOT_FOUND }, { status: 404 })
    }

    // Prevent artists from modifying song vault files (verify server-side)
    if (user.role === 'artist') {
      logError({
        errorCode: ErrorCode.API_FORBIDDEN,
        type: 'Song Vault',
        message: `Artist attempted to modify song vault file: ${id || 'unknown'}`,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        endpoint: '/api/song-vault',
        method: 'PUT',
        details: { fileId: id },
        severity: 'medium',
      })
      return NextResponse.json({ error: 'Artists cannot modify song vault files', errorCode: ErrorCode.API_FORBIDDEN }, { status: 403 })
    }

    if (!id && !oldFolderPath) {
      return NextResponse.json({ error: 'File ID or folder path required' }, { status: 400 })
    }

    // Handle folder rename
    if (oldFolderPath && newFolderPath) {
      const updated = updateVaultFilesByFolderPath(oldFolderPath, newFolderPath, songId)
      return NextResponse.json({ success: true, updated })
    }

    // Handle single file update
    if (!id) {
      return NextResponse.json({ error: 'File ID required' }, { status: 400 })
    }

    const success = updateSongVaultFile(id, updates)

    if (!success) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Update song vault file error:', error)
    return NextResponse.json(
      { error: 'Failed to update file', details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const folderPath = searchParams.get('folderPath')
    const songId = searchParams.get('songId')
    const userRole = searchParams.get('userRole')

    // Prevent artists from deleting song vault files
    if (userRole === 'artist') {
      return NextResponse.json({ error: 'Artists cannot delete song vault files' }, { status: 403 })
    }

    // Handle folder deletion
    if (folderPath) {
      const deleted = deleteVaultFilesByFolderPath(folderPath, songId || undefined)
      return NextResponse.json({ success: true, deleted })
    }

    // Handle single file deletion
    if (!id) {
      return NextResponse.json({ error: 'File ID or folder path required' }, { status: 400 })
    }

    const success = deleteSongVaultFile(id)

    if (!success) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete song vault file error:', error)
    return NextResponse.json(
      { error: 'Failed to delete file', details: error.message },
      { status: 500 }
    )
  }
}
