import { NextRequest, NextResponse } from 'next/server'
import { getCatalog, addCatalogItem } from '@/lib/storage'
import { addSongVaultFile } from '@/lib/storage'
import { logActivity } from '@/lib/activityLog'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { items } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Items array is required' }, { status: 400 })
    }

    const existingCatalog = getCatalog()
    const existingKeys = new Set(existingCatalog.map(item => `${item.song}-${item.artist}`.toLowerCase()))
    
    let added = 0
    let skipped = 0
    let vaultFilesAdded = 0

    for (const item of items) {
      const { song, artist, releaseType, releaseDate, distributor, upc, isrc, songLinks } = item

      if (!song || !artist) {
        skipped++
        continue
      }

      // Check for duplicates
      const key = `${song}-${artist}`.toLowerCase()
      if (existingKeys.has(key)) {
        skipped++
        continue
      }

      // Parse release date
      let parsedDate: string | undefined = undefined
      if (releaseDate) {
        try {
          const date = new Date(releaseDate)
          if (!isNaN(date.getTime())) {
            parsedDate = date.toISOString()
          }
        } catch {
          // Invalid date, skip it
        }
      }

      // Normalize release type
      let normalizedType: 'single' | 'ep' | 'album' = 'single'
      const typeLower = (releaseType || '').toLowerCase()
      if (typeLower === 'ep' || typeLower === 'e.p.') {
        normalizedType = 'ep'
      } else if (typeLower === 'album' || typeLower === 'lp') {
        normalizedType = 'album'
      }

      try {
        const catalogItem = addCatalogItem({
          song: song.trim(),
          artist: artist.trim(),
          releaseType: normalizedType,
          releaseDate: parsedDate,
          totalStreams: 0,
          distributor: distributor?.trim() || undefined,
          manuallyAdded: true,
          upc: upc?.trim() || undefined,
          isrc: isrc?.trim() || undefined,
          songs: normalizedType !== 'single' ? [] : undefined,
        })
        
        existingKeys.add(key)
        added++

        // Log activity
        logActivity({
          action: 'Song added via bulk import',
          user: 'System',
          category: 'catalog',
          details: {
            song: song.trim(),
            artist: artist.trim(),
            songId: catalogItem.id,
            releaseType: normalizedType,
            distributor: distributor?.trim(),
          },
        })

        // Add song links to vault if provided
        if (songLinks && songLinks.trim()) {
          try {
            // Check if it's a Google Drive/Docs link
            const isGoogleLink = songLinks.includes('drive.google.com') || songLinks.includes('docs.google.com')
            
            // Determine file type from link or default to 'other'
            let fileType: 'logic' | 'bounced' | 'stem' | 'master' | 'music_video' | 'other' = 'other'
            const linkLower = songLinks.toLowerCase()
            if (linkLower.includes('logic') || linkLower.includes('.logicx')) {
              fileType = 'logic'
            } else if (linkLower.includes('master')) {
              fileType = 'master'
            } else if (linkLower.includes('stem')) {
              fileType = 'stem'
            } else if (linkLower.includes('bounce') || linkLower.includes('audio')) {
              fileType = 'bounced'
            } else if (linkLower.includes('video') || linkLower.includes('mv')) {
              fileType = 'music_video'
            }

            // Extract filename from link or use song name
            let fileName = song.trim()
            try {
              const url = new URL(songLinks)
              const pathParts = url.pathname.split('/')
              const lastPart = pathParts[pathParts.length - 1]
              if (lastPart && lastPart !== 'view' && lastPart !== 'edit') {
                fileName = decodeURIComponent(lastPart)
              }
            } catch {
              // Not a valid URL, use song name
            }

            // Add to vault - use googleDriveUrl for Google links, fileUrl for others
            const vaultFile: any = {
              songId: catalogItem.id,
              fileName: fileName,
              fileType: fileType,
              uploadedBy: 'Bulk Import',
            }
            
            if (isGoogleLink) {
              vaultFile.googleDriveUrl = songLinks
            } else {
              vaultFile.fileUrl = songLinks
            }
            
            addSongVaultFile(vaultFile)
            
            vaultFilesAdded++
          } catch (vaultError: any) {
            console.error(`Error adding song link to vault for ${song}:`, vaultError)
            // Continue even if vault add fails
          }
        }
      } catch (error: any) {
        console.error(`Error adding item ${song} - ${artist}:`, error)
        skipped++
      }
    }

    // Log bulk import activity
    logActivity({
      action: 'Bulk catalog import completed',
      user: 'System',
      category: 'catalog',
      details: {
        total: items.length,
        added,
        skipped,
        vaultFilesAdded,
      },
    })

    return NextResponse.json({
      success: true,
      added,
      skipped,
      vaultFilesAdded,
      total: items.length,
    })
  } catch (error: any) {
    console.error('Bulk import error:', error)
    return NextResponse.json(
      { error: 'Failed to import catalog items', details: error.message },
      { status: 500 }
    )
  }
}

