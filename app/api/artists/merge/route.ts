import { NextRequest, NextResponse } from 'next/server'
import { getCatalog, updateCatalogItem, getUploads, saveUpload, getArtistData, saveArtistData, getAllArtists, updateUpload, getUsers } from '@/lib/storage'
import { parseArtistsFromString } from '@/lib/artistParser'
import { logActivity } from '@/lib/activityLog'

// POST - Merge artist songs into another artist's account
// Supports merging multiple artists at once
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fromArtistName, fromArtistNames, toArtistName, toUserId, userId, userName } = body

    // Support both single artist (backwards compatible) and multiple artists
    const sourceArtists = fromArtistNames && Array.isArray(fromArtistNames) && fromArtistNames.length > 0
      ? fromArtistNames
      : fromArtistName
        ? [fromArtistName]
        : []

    if (sourceArtists.length === 0 || !toArtistName) {
      return NextResponse.json(
        { error: 'Source artist name(s) and target artist name are required' },
        { status: 400 }
      )
    }

    // Check if any source artist is the same as target
    const duplicateSource = sourceArtists.find(name => name.toLowerCase() === toArtistName.toLowerCase())
    if (duplicateSource) {
      return NextResponse.json(
        { error: `Cannot merge artist "${duplicateSource}" into itself` },
        { status: 400 }
      )
    }

    const catalog = getCatalog()
    const uploads = getUploads()
    let totalSongsMerged = 0
    let totalCatalogUpdated = 0
    const mergeResults: Record<string, { songsMerged: number; catalogUpdated: number }> = {}

    // Normalize all source artist names
    const normalizedSourceArtists = sourceArtists.map(name => name.toLowerCase().trim().replace(/\s+/g, ' '))
    console.log(`[Merge] Merging ${sourceArtists.length} artist(s) into "${toArtistName}":`, sourceArtists)

    // Process each source artist
    for (let i = 0; i < sourceArtists.length; i++) {
      const fromArtistName = sourceArtists[i]
      const normalizedFromArtist = normalizedSourceArtists[i]
      let songsMerged = 0
      let catalogUpdated = 0

      console.log(`[Merge] Processing artist ${i + 1}/${sourceArtists.length}: "${fromArtistName}"`)

      // 1. Update catalog items - change artist name and link to target user
      for (const item of catalog) {
        try {
          const itemArtists = parseArtistsFromString(item.artist)
          const normalizedItemArtists = itemArtists.map(a => a.toLowerCase().trim().replace(/\s+/g, ' '))
          
          // Check if from artist matches any of the item's artists (case-insensitive, normalized)
          const isFromArtist = normalizedItemArtists.some(a => {
            const normalized = a.toLowerCase().trim().replace(/\s+/g, ' ')
            return normalized === normalizedFromArtist || 
                   normalized.includes(normalizedFromArtist) || 
                   normalizedFromArtist.includes(normalized)
          })
          
          if (isFromArtist) {
            console.log(`[Merge] Found match: "${item.song}" by "${item.artist}"`)
            
            // If this is a solo song (only from artist), replace with to artist
            // If it's a collaboration, replace from artist with to artist
            const isSoloSong = itemArtists.length === 1
            const updates: any = {}
            
            if (isSoloSong) {
              // Solo song - replace artist name completely
              updates.artist = toArtistName
            } else {
              // Collaboration - replace from artist with to artist
              const updatedArtists = itemArtists.map(a => {
                const normalizedA = a.toLowerCase().trim().replace(/\s+/g, ' ')
                return (normalizedA === normalizedFromArtist || 
                        normalizedA.includes(normalizedFromArtist) || 
                        normalizedFromArtist.includes(normalizedA)) 
                        ? toArtistName 
                        : a
              })
              // Remove duplicates and join
              updates.artist = [...new Set(updatedArtists)].join(' & ')
            }
            
            // If toUserId is provided, add it to artistIds
            if (toUserId) {
              const currentArtistIds = item.artistIds || (item.artistId ? [item.artistId] : [])
              if (!currentArtistIds.includes(toUserId)) {
                updates.artistIds = [...currentArtistIds, toUserId]
                updates.artistId = toUserId // Backwards compatibility
              }
            }
            
            const updated = updateCatalogItem(item.id, updates)
            if (updated) {
              catalogUpdated++
              songsMerged++
              console.log(`[Merge] Updated catalog item: "${item.song}" - ${isSoloSong ? 'solo' : 'collaboration'}`)
            } else {
              console.warn(`[Merge] Failed to update catalog item ${item.id} (song: ${item.song}, artist: ${item.artist})`)
            }
          }
        } catch (itemError: any) {
          console.error(`[Merge] Error processing catalog item ${item.id}:`, itemError)
          // Continue with other items
        }
      }

      mergeResults[fromArtistName] = { songsMerged, catalogUpdated }
      totalSongsMerged += songsMerged
      totalCatalogUpdated += catalogUpdated
      console.log(`[Merge] Completed "${fromArtistName}": ${songsMerged} songs merged, ${catalogUpdated} catalog items updated`)
    }
    
    console.log(`[Merge] Total: ${totalSongsMerged} songs merged, ${totalCatalogUpdated} catalog items updated`)

    // 2. Update uploads - merge artist data for all source artists
    let totalUploadsUpdated = 0
    for (let i = 0; i < sourceArtists.length; i++) {
      const fromArtistName = sourceArtists[i]
      const normalizedFromArtist = normalizedSourceArtists[i]
      
      for (const upload of uploads) {
        if (upload.groupedByArtist) {
          // Check all artist keys for matches (case-insensitive)
          const artistKeys = Object.keys(upload.groupedByArtist)
          const matchingKey = artistKeys.find(key => {
            const normalizedKey = key.toLowerCase().trim().replace(/\s+/g, ' ')
            return normalizedKey === normalizedFromArtist || 
                   normalizedKey.includes(normalizedFromArtist) || 
                   normalizedFromArtist.includes(normalizedKey)
          })
          
          if (matchingKey) {
            console.log(`[Merge] Found CSV upload match: "${matchingKey}" -> "${toArtistName}"`)
            const fromArtistData = upload.groupedByArtist[matchingKey]
            
            // Initialize to artist's data if it doesn't exist
            if (!upload.groupedByArtist[toArtistName]) {
              upload.groupedByArtist[toArtistName] = []
            }
            
            // Merge data
            upload.groupedByArtist[toArtistName].push(...fromArtistData)
            
            // Remove from artist's data
            delete upload.groupedByArtist[matchingKey]
            
            // Update the upload
            updateUpload(upload.id, {
              groupedByArtist: upload.groupedByArtist,
            })
            totalUploadsUpdated++
          }
        }
      }
    }
    
    console.log(`[Merge] CSV uploads processed: ${totalUploadsUpdated} uploads updated`)

    // 3. Merge artist data files for all source artists
    const toArtistData = getArtistData(toArtistName)
    let allMergedData = [...toArtistData]
    
    for (const fromArtistName of sourceArtists) {
      const fromArtistData = getArtistData(fromArtistName)
      if (fromArtistData.length > 0) {
        allMergedData = [...allMergedData, ...fromArtistData]
      }
    }
    
    if (allMergedData.length > toArtistData.length) {
      saveArtistData(toArtistName, allMergedData)
    }

    // Log activity for merge operation
    const users = getUsers()
    const user = userId ? users.find(u => u.id === userId) : null
    const actorName = userName || user?.name || 'System'
    
    if (totalSongsMerged > 0 || totalUploadsUpdated > 0) {
      const sourceArtistsStr = sourceArtists.length === 1 
        ? sourceArtists[0]
        : `${sourceArtists.length} artists (${sourceArtists.join(', ')})`
      
      logActivity({
        action: `Merged ${sourceArtists.length === 1 ? 'artist' : 'artists'}: ${sourceArtistsStr} → ${toArtistName}`,
        user: actorName,
        userId: userId,
        category: 'catalog',
        details: {
          fromArtists: sourceArtists,
          toArtist: toArtistName,
          songsMerged: totalSongsMerged,
          catalogItemsUpdated: totalCatalogUpdated,
          csvUploadsUpdated: totalUploadsUpdated,
          toUserId: toUserId || null,
          mergeResults,
        },
      })
    }

    const sourceArtistsStr = sourceArtists.length === 1 
      ? sourceArtists[0]
      : `${sourceArtists.length} artists`

    return NextResponse.json({
      success: true,
      songsMerged: totalSongsMerged,
      catalogUpdated: totalCatalogUpdated,
      uploadsUpdated: totalUploadsUpdated,
      mergeResults,
      message: `Successfully merged ${totalSongsMerged} songs from ${sourceArtistsStr} to "${toArtistName}"`,
    })
  } catch (error: any) {
    console.error('Merge artists error:', error)
    console.error('Error stack:', error.stack)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to merge artists', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

