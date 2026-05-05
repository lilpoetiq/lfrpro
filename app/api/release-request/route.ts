import { NextRequest, NextResponse } from 'next/server'
import { mkdir } from 'fs/promises'
import path from 'path'
import { addCatalogItem, getUsers, addMessage, getCatalog } from '@/lib/storage'
import { logActivity } from '@/lib/activityLog'
import { formatLocalDateString, parseLocalDate } from '@/lib/utils'
import { notifySongSubmitted } from '@/lib/aiNotifications'
import { UPLOAD_BASE, getUploadPath } from '@/lib/uploadConfig'
import { getReadableFileName } from '@/lib/fileNaming'
import { writeUploadToDisk } from '@/lib/writeUploadToDisk'

const UPLOAD_DIR = UPLOAD_BASE
const AUDIO_DIR = getUploadPath('audio')
const COVER_DIR = getUploadPath('album-covers')

async function ensureUploadDirs() {
  await mkdir(AUDIO_DIR, { recursive: true })
  await mkdir(COVER_DIR, { recursive: true })
}

// Configure route for handling file uploads
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for large file uploads

export async function POST(request: NextRequest) {
  try {
    await ensureUploadDirs()

    // Parse FormData with comprehensive error handling
    let formData: FormData
    try {
      const contentType = request.headers.get('content-type') || ''
      const contentLength = request.headers.get('content-length')
      
      // Log request info for debugging
      console.log('[RELEASE REQUEST] Parsing FormData:', {
        contentType,
        contentLength: contentLength ? `${(parseInt(contentLength) / 1024 / 1024).toFixed(2)} MB` : 'unknown',
      })

      formData = await request.formData()
      
      // Verify formData was parsed
      if (!formData) {
        return NextResponse.json(
          { error: 'Failed to parse request', details: 'FormData is empty or invalid' },
          { status: 400 }
        )
      }
    } catch (formDataError: any) {
      const contentLength = request.headers.get('content-length')
      const sizeMB = contentLength ? (parseInt(contentLength) / 1024 / 1024).toFixed(2) : 'unknown'
      
      console.error('[RELEASE REQUEST] FormData parsing failed:', {
        message: formDataError.message,
        name: formDataError.name,
        stack: formDataError.stack?.substring(0, 500),
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
          error: 'Failed to parse request body', 
          details: isSizeError 
            ? isNextJsSizeError
              ? `File size limit issue (${sizeMB} MB). The server is configured for 100MB but may need a restart. Please try again or contact support if the issue persists.`
              : `File too large (${sizeMB} MB). Maximum size is 100MB. Please try a smaller file or compress your audio file.`
            : formDataError.message || 'Invalid FormData format. Please ensure all files are properly selected and try again.',
        },
        { status: 400 }
      )
    }
    // Extract form fields
    const songName = (formData.get('songName') as string)?.trim() || ''
    const releaseDate = (formData.get('releaseDate') as string) || ''
    const releaseType = (formData.get('releaseType') as string) || 'single'
    const genre = (formData.get('genre') as string)?.trim() || ''
    const collaborators = (formData.get('collaborators') as string)?.trim() || ''
    const description = (formData.get('description') as string)?.trim() || ''
    const promoIdeas = (formData.get('promoIdeas') as string)?.trim() || ''
    const instagramHandle = (formData.get('instagramHandle') as string)?.trim() || ''
    const twitterHandle = (formData.get('twitterHandle') as string)?.trim() || ''
    const tiktokHandle = (formData.get('tiktokHandle') as string)?.trim() || ''
    const hasCover = formData.get('hasCover') === 'true'
    const userId = (formData.get('userId') as string) || ''
    const artistName = (formData.get('artistName') as string) || ''
    
    // Extract files - check if they're actually File objects
    const masterFileEntry = formData.get('master')
    const masterFile = masterFileEntry instanceof File ? masterFileEntry : null
    
    const coverFileEntry = formData.get('cover')
    const coverFile = coverFileEntry instanceof File ? coverFileEntry : null
    
    // Get songs for albums/EPs
    const songsJson = formData.get('songs') as string
    let songs: Array<{ name: string }> = []
    if (songsJson) {
      try {
        songs = JSON.parse(songsJson)
      } catch (e) {
        console.error('Failed to parse songs JSON:', e)
      }
    }

    // Validation
    if (!songName || !songName.trim()) {
      return NextResponse.json({ error: 'Song name is required' }, { status: 400 })
    }

    if (!releaseDate) {
      return NextResponse.json({ error: 'Release date is required' }, { status: 400 })
    }

    // Validate 3 days minimum
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const requestDate = new Date(releaseDate)
    requestDate.setHours(0, 0, 0, 0)
    const daysDiff = Math.ceil((requestDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (daysDiff < 3) {
      return NextResponse.json(
        { error: 'Release date must be at least 3 days in advance', daysUntil: daysDiff },
        { status: 400 }
      )
    }

    // Date overlap check removed - multiple releases can be scheduled on the same date

    // Validate files based on release type
    if (releaseType === 'single') {
      if (!masterFile || masterFile.size === 0) {
        return NextResponse.json({ error: 'Master audio file is required and must not be empty' }, { status: 400 })
      }
    } else {
      // Album or EP - validate songs
      if (!songs || songs.length === 0) {
        return NextResponse.json({ error: 'At least one song is required for albums/EPs' }, { status: 400 })
      }
      
      // Check that all song masters are provided
      for (let i = 0; i < songs.length; i++) {
        const songMasterEntry = formData.get(`songMaster_${i}`)
        const songMaster = songMasterEntry instanceof File ? songMasterEntry : null
        if (!songMaster || songMaster.size === 0) {
          return NextResponse.json({ error: `Master file is required for song: ${songs[i].name || `Song ${i + 1}`}` }, { status: 400 })
        }
      }
    }

    if (hasCover && !coverFile) {
      return NextResponse.json({ error: 'Cover image is required when "has cover" is selected' }, { status: 400 })
    }

    // Get user info
    const users = getUsers()
    const user = users.find(u => u.id === userId)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    let masterFileUrl: string | undefined = undefined
    let masterFileName: string | undefined = undefined
    let albumSongs: Array<{ id: string; song: string; audioUrl?: string }> = []
    
    try {
      if (releaseType === 'single') {
        if (masterFile) {
          const masterExtension = path.extname(masterFile.name) || '.mp3'
          masterFileName = getReadableFileName({
            artist: artistName,
            song: songName,
            extension: masterExtension,
            directory: AUDIO_DIR,
          })
          const masterFilePath = path.join(AUDIO_DIR, masterFileName)
          await writeUploadToDisk(masterFile, masterFilePath)
          masterFileUrl = `/api/files/audio/${masterFileName}`
        }
      } else {
        for (let i = 0; i < songs.length; i++) {
          const songMasterEntry = formData.get(`songMaster_${i}`)
          const songMaster = songMasterEntry instanceof File ? songMasterEntry : null
          if (songMaster && songMaster.size > 0) {
            const songExtension = path.extname(songMaster.name) || '.mp3'
            const songFileName = getReadableFileName({
              artist: artistName,
              song: songs[i].name,
              extension: songExtension,
              directory: AUDIO_DIR,
            })
            const songFilePath = path.join(AUDIO_DIR, songFileName)
            await writeUploadToDisk(songMaster, songFilePath)
            
            albumSongs.push({
              id: `song_${i}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              song: songs[i].name,
              audioUrl: `/api/files/audio/${songFileName}`,
            })
          }
        }
      }
    } catch (fileError: any) {
      console.error('[RELEASE REQUEST] File save error:', fileError)
      throw new Error(`Failed to save audio file: ${fileError.message}`)
    }

    let coverFileUrl: string | undefined = undefined
    if (coverFile) {
      try {
        const coverExtension = path.extname(coverFile.name) || '.jpg'
        const coverFileName = getReadableFileName({
          artist: artistName,
          song: songName || 'cover',
          extension: coverExtension,
          directory: COVER_DIR,
        })
        const coverFilePath = path.join(COVER_DIR, coverFileName)
        await writeUploadToDisk(coverFile, coverFilePath)
        coverFileUrl = `/api/files/album-covers/${coverFileName}`
      } catch (coverError: any) {
        console.error('[RELEASE REQUEST] Cover save error:', coverError)
        // Don't fail the whole request if cover fails, just log it
      }
    }

    // Build artist name - use artistName (display name) if available, otherwise use name
    // This ensures "555wick" is used instead of "zion johnson"
    let finalArtistName = user.artistName || artistName || user.name
    if (collaborators && collaborators.trim()) {
      finalArtistName = `${finalArtistName} & ${collaborators.trim()}`
    }

    // Create pending catalog item
    try {
      const catalogItem = addCatalogItem({
        song: songName.trim(),
        artist: finalArtistName,
        artistId: userId,
        artistIds: [userId],
        releaseType: releaseType as 'single' | 'ep' | 'album',
        releaseDateRequested: releaseDate,
        releaseApprovalStatus: 'pending',
        totalStreams: 0,
        manuallyAdded: true,
        fileUrl: masterFileUrl, // For singles
        songs: albumSongs.length > 0 ? albumSongs : undefined, // For albums/EPs
        albumCover: coverFileUrl,
        fromCSV: false,
        promoNotes: promoIdeas || description || undefined,
      })

      // Log activity
      logActivity({
      action: 'Release Request Created',
      user: user.name,
      userId: userId,
      category: 'release',
      details: {
        songId: catalogItem.id,
        songName: songName.trim(),
        artist: finalArtistName,
        releaseType: releaseType,
        genre: genre || undefined,
        collaborators: collaborators || undefined,
        songsCount: albumSongs.length > 0 ? albumSongs.length : undefined,
        releaseDateRequested: releaseDate,
        hasCover: !!coverFileUrl,
        masterFile: masterFileName,
        coverFile: coverFile ? path.basename(coverFile.name) : undefined,
        promoIdeas: promoIdeas || undefined,
        description: description || undefined,
        instagramHandle: instagramHandle || undefined,
        twitterHandle: twitterHandle || undefined,
        tiktokHandle: tiktokHandle || undefined,
      },
    })

    // Build notification message with all details
    let notificationMessage = `${user.name} (${finalArtistName}) submitted a release request for "${songName}" scheduled for ${new Date(releaseDate).toLocaleDateString()}.\n\n`
    if (releaseType !== 'single') {
      notificationMessage += `Release Type: ${releaseType.toUpperCase()}\n`
    }
    if (genre) {
      notificationMessage += `Genre: ${genre}\n`
    }
    if (collaborators) {
      notificationMessage += `Collaborators: ${collaborators}\n`
    }
    if (promoIdeas) {
      notificationMessage += `\nPromo Ideas:\n${promoIdeas}\n`
    }
    if (description) {
      notificationMessage += `\nDescription:\n${description}\n`
    }
    if (instagramHandle || twitterHandle || tiktokHandle) {
      notificationMessage += `\nSocial Media:\n`
      if (instagramHandle) notificationMessage += `Instagram: @${instagramHandle}\n`
      if (twitterHandle) notificationMessage += `Twitter: @${twitterHandle}\n`
      if (tiktokHandle) notificationMessage += `TikTok: @${tiktokHandle}\n`
    }
    notificationMessage += `\nPlease review and approve/deny.`

      // Notify all admins via in-app messages
      const adminUsers = users.filter(u => u.role === 'admin')
      adminUsers.forEach(admin => {
        addMessage({
          from: userId,
          fromName: user.name,
          to: admin.id,
          toName: admin.name || 'Admin',
          subject: `Release Request: ${songName}`,
          message: notificationMessage,
          songId: catalogItem.id,
        })
      })

      // Notify AI server for SMS notifications
      try {
        await notifySongSubmitted({
          songName: songName.trim(),
          artistName: finalArtistName,
          userId: userId,
          userName: user.name,
          releaseDate: releaseDate,
          releaseType: releaseType as 'single' | 'ep' | 'album',
          genre: genre || undefined,
          collaborators: collaborators || undefined,
          description: description || undefined,
          promoIdeas: promoIdeas || undefined,
          instagramHandle: instagramHandle || undefined,
          twitterHandle: twitterHandle || undefined,
          tiktokHandle: tiktokHandle || undefined,
          songId: catalogItem.id,
          hasCover: !!coverFileUrl,
          songsCount: albumSongs.length > 0 ? albumSongs.length : undefined,
        })
      } catch (error) {
        console.error('[RELEASE REQUEST] Error notifying AI server (non-critical):', error)
        // Continue - don't fail the request if AI notification fails
      }
      return NextResponse.json({
        success: true,
        message: 'Release request submitted successfully. Waiting for admin approval.',
        songId: catalogItem.id,
      })
    } catch (catalogError: any) {
      console.error('[RELEASE REQUEST] Catalog item creation error:', catalogError)
      throw new Error(`Failed to create catalog item: ${catalogError.message}`)
    }
  } catch (error: any) {
    console.error('[RELEASE REQUEST] Error:', error.message || error)
    return NextResponse.json(
      { 
        error: 'Failed to submit release request', 
        details: error.message || 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

