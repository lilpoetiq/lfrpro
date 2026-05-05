import { NextRequest, NextResponse } from 'next/server'
import { getAllArtists, getUsers, getUploads, getArtistData, getUserIdForArtist, getArtistUserMappings, getCatalog } from '@/lib/storage'
import { getPrimaryUserIdForCollaborativeSong } from '@/lib/storage'
import { matchArtistsToUsers, parseArtistsFromString } from '@/lib/artistParser'
import { cleanSongName } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const artistNames = getAllArtists()
    const users = getUsers()
    const uploads = getUploads()
    const catalog = getCatalog()
    
    // Get manual mappings
    const mappings = getArtistUserMappings()
    const manualMappings: Record<string, string> = {}
    mappings.forEach(m => {
      manualMappings[m.artistName.toLowerCase()] = m.userId
    })
    
    // Enrich artist data with user account info and stats
    const enrichedArtists = artistNames.map((artistName) => {
      // Track matched user ids for this artist (used later for catalog/CSV attribution)
      let matchedUserIds: string[] = []

      // Check manual mappings first
      let userId = manualMappings[artistName.toLowerCase()] || getUserIdForArtist(artistName)
      let user = userId ? users.find(u => u.id === userId) : null
      if (user) matchedUserIds = [user.id]
      
      // If no manual mapping, try automatic matching
      if (!user) {
        matchedUserIds = matchArtistsToUsers([artistName], users, manualMappings)
        user = matchedUserIds.length > 0 ? users.find(u => u.id === matchedUserIds[0]) : null
        if (user) userId = user.id
      }
      
      // If no match found, try more aggressive matching (case-insensitive, space variations)
      if (!user) {
        const normalizedSearch = artistName.toLowerCase().replace(/\s+/g, '').trim()
        user = users.find(u => {
          const userName = (u.name || '').toLowerCase().replace(/\s+/g, '').trim()
          const username = (u.username || '').toLowerCase().trim()
          const userArtistName = (u.artistName || '').toLowerCase().replace(/\s+/g, '').trim()
          const realName = (u.realName || '').toLowerCase().replace(/\s+/g, '').trim()
          
          // Check normalized matches (including username)
          if (normalizedSearch === userName || normalizedSearch === username || normalizedSearch === userArtistName || normalizedSearch === realName) {
            return true
          }
          
          // Check aliases
          if (u.aliases && Array.isArray(u.aliases)) {
            for (const alias of u.aliases) {
              const aliasNormalized = (alias || '').toLowerCase().replace(/\s+/g, '').trim()
              if (normalizedSearch === aliasNormalized) return true
            }
          }
          
          return false
        })
        if (user) {
          matchedUserIds = [user.id]
          userId = user.id
          console.log(`Matched "${artistName}" to user "${user.name}" (username: ${user.username}) via aggressive matching`)
        } else {
          console.log(`Could not match artist "${artistName}" to any user account. Consider adding it as an artistName or alias.`)
        }
      }
      
      // Get artist data to calculate stats
      const artistFileData = getArtistData(artistName)
      const songs = new Map<string, any>()
      
      // FIRST: Process catalog songs (catalog is source of truth for released songs)
      // This ensures catalog data takes precedence over CSV uploads
      const artistUserIds = user ? [user.id] : (matchedUserIds.length > 0 ? matchedUserIds : matchArtistsToUsers([artistName], users, manualMappings))
      
      catalog.forEach((item) => {
        // Skip pending items
        if (item.releaseApprovalStatus === 'pending') return
        
        // Check if this artist is in the catalog item
        const itemArtists = parseArtistsFromString(item.artist)
        const normalizedArtistName = artistName.toLowerCase().trim()
        const isArtistInItem = itemArtists.some(a => a.toLowerCase().trim() === normalizedArtistName)
        
        // Also check if user ID matches
        const itemArtistIds = item.artistIds || (item.artistId ? [item.artistId] : [])
        const isUserInItem = user && itemArtistIds.includes(user.id)
        
        // Check for collaborative song mapping
        const collaborativeMapping = getPrimaryUserIdForCollaborativeSong(item.song, item.artist)
        const isCollaborative = collaborativeMapping !== null
        const isPrimaryAccount = collaborativeMapping === user?.id
        
        // Include song if artist is in the collaboration (show on all collaborators' pages)
        const shouldInclude = isArtistInItem || isUserInItem
        
        // Only count toward song total if:
        // 1. No collaborative mapping (count for all collaborators)
        // 2. Collaborative mapping exists AND this is the primary account
        const shouldCount = !isCollaborative || isPrimaryAccount
        
        if (shouldInclude) {
          const songName = cleanSongName(item.song)
          if (songName) {
            // Normalize song name for comparison (lowercase, trim)
            const normalizedSongName = songName.toLowerCase().trim()
            
            // Check if we already have this song (case-insensitive match)
            let existingSongKey: string | undefined
            for (const [key, song] of songs.entries()) {
              if (key.toLowerCase().trim() === normalizedSongName) {
                existingSongKey = key
                break
              }
            }
            
            if (existingSongKey) {
              // Song already exists - update it with catalog data (catalog is source of truth)
              const existingSong = songs.get(existingSongKey)!
              if (shouldCount) {
                existingSong.streams = item.totalStreams || 0
              }
              existingSong.platform = item.distributor || 'Catalog'
              existingSong.fromCatalog = true
            } else {
              // New song - add it
              songs.set(songName, {
                name: songName,
                streams: shouldCount ? (item.totalStreams || 0) : 0,
                platform: item.distributor || 'Catalog',
                fromCatalog: true, // Mark as from catalog
              })
            }
          }
          
          // Also include EP/Album songs
          if (item.songs && item.songs.length > 0) {
            item.songs.forEach((subSong: any) => {
              const subSongName = cleanSongName(subSong.song)
              if (subSongName) {
                const normalizedSubSongName = subSongName.toLowerCase().trim()
                
                // Check if we already have this song (case-insensitive match)
                let existingSubSongKey: string | undefined
                for (const [key, song] of songs.entries()) {
                  if (key.toLowerCase().trim() === normalizedSubSongName) {
                    existingSubSongKey = key
                    break
                  }
                }
                
                if (existingSubSongKey) {
                  // Song already exists - update it with catalog data
                  const existingSubSong = songs.get(existingSubSongKey)!
                  if (shouldCount) {
                    existingSubSong.streams = subSong.streams || 0
                  }
                  existingSubSong.platform = item.distributor || 'Catalog'
                  existingSubSong.fromCatalog = true
                } else {
                  // New song - add it
                  songs.set(subSongName, {
                    name: subSongName,
                    streams: shouldCount ? (subSong.streams || 0) : 0,
                    platform: item.distributor || 'Catalog',
                    fromCatalog: true, // Mark as from catalog
                  })
                }
              }
            })
          }
        }
      })
      
      // SECOND: Process CSV uploads - only add songs that DON'T exist in catalog
      // This prevents double counting (catalog is source of truth for released songs)
      uploads.forEach((upload) => {
        if (upload.groupedByArtist && upload.groupedByArtist[artistName]) {
          upload.groupedByArtist[artistName].forEach((row: any) => {
            let songName = row._parsedSong || row.song || row.Song || row.SONG || row['Song Name'] || row['song_name'] || row.title || row.Title
            songName = cleanSongName(songName || '')
            if (songName) {
              // Normalize song name for comparison (lowercase, trim)
              const normalizedSongName = songName.toLowerCase().trim()
              
              // Check if song already exists in catalog (case-insensitive match)
              let songExistsInCatalog = false
              for (const [key] of songs.entries()) {
                if (key.toLowerCase().trim() === normalizedSongName) {
                  songExistsInCatalog = true
                  break
                }
              }
              
              // Only add CSV data if song doesn't exist in catalog
              // Catalog is the source of truth for released songs
              if (!songExistsInCatalog) {
                const parseNumber = (value: any): number => {
                  if (!value || value === '') return 0
                  if (typeof value === 'number') return value
                  const cleaned = String(value).replace(/,/g, '').trim()
                  const parsed = parseInt(cleaned)
                  return isNaN(parsed) ? 0 : parsed
                }
                
                let streams = 0
                Object.keys(row).forEach((key) => {
                  if (key === 'Total' || key.startsWith('Total_')) {
                    streams += parseNumber(row[key])
                  }
                })
                
                if (streams === 0) {
                  streams = parseNumber(row.streams || row.Streams || row.Total || row.total)
                }
                
                const platform = row.platform || row.Platform || row.distributor || row.Distributor || 'Unknown'
                songs.set(songName, {
                  name: songName,
                  streams: streams,
                  platform: platform,
                  fromCatalog: false, // Mark as from CSV
                })
              }
              // If song exists in catalog, skip CSV data (catalog is source of truth)
            }
          })
        }
      })
      
      const songsArray = Array.from(songs.values())
      const artistUploads = uploads.filter(u => u.groupedByArtist && u.groupedByArtist[artistName])
      const lastUpload = artistUploads.length > 0 
        ? artistUploads.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0]
        : null
      
      return {
        name: artistName,
        uploads: artistUploads.length,
        totalRows: artistFileData.length,
        lastUpload: lastUpload?.uploadedAt || null,
        songs: songsArray,
        userId: user?.id,
        userName: user?.name,
        phoneNumber: user?.phoneNumber,
        email: user?.email,
        role: user?.role,
      }
    })
    
    return NextResponse.json({ success: true, artists: enrichedArtists })
  } catch (error: any) {
    console.error('Get artists error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch artists', details: error.message },
      { status: 500 }
    )
  }
}
