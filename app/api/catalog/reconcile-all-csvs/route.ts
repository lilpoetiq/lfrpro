import { NextRequest, NextResponse } from 'next/server'
import { getCatalog, updateCatalogItem, getUploads, addCatalogItem, CatalogItem } from '@/lib/storage'
import { logActivity } from '@/lib/activityLog'
import { groupDataByArtist, cleanSongName, isNumericOnly } from '@/lib/utils'
import { parseArtistsFromString } from '@/lib/artistParser'

/**
 * Comprehensive reconciliation: Process ALL CSV uploads and ensure catalog is complete
 * This goes through every CSV upload and updates/adds songs with correct stream counts
 * POST /api/catalog/reconcile-all-csvs
 */
export async function POST(request: NextRequest) {
  try {
    const catalog = getCatalog()
    const uploads = getUploads()
    
    // Sort uploads chronologically (oldest first) to process in order
    const sortedUploads = [...uploads].sort((a, b) => 
      new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()
    )
    
    console.log(`🔄 Starting comprehensive reconciliation of ${sortedUploads.length} CSV uploads...`)
    
    let totalSongsUpdated = 0
    let totalSongsAdded = 0
    let totalSongsSkipped = 0
    const processedSongs = new Set<string>() // Track processed songs to avoid duplicates
    
    // Normalize function
    const normalize = (str: string): string => {
      return (str || '').toLowerCase().trim().replace(/\s+/g, ' ')
    }
    
    // Process each upload chronologically
    for (const upload of sortedUploads) {
      if (!upload?.groupedByArtist) {
        console.log(`⏭️ Skipping upload ${upload.id} - no groupedByArtist data`)
        continue
      }
      
      console.log(`\n📊 Processing upload: ${upload.fileName} (${upload.uploadedAt})`)
      
      // Process each artist in this upload
      Object.entries(upload.groupedByArtist).forEach(([artistName, artistRows]: [string, any]) => {
        if (!Array.isArray(artistRows) || artistRows.length === 0) return
        
        // Aggregate songs from this artist's rows (same logic as upload-csv)
        const songsMap = new Map<string, any>()
        
        artistRows.forEach((row: any) => {
          // Use parsed values from groupDataByArtist if available
          let songName = row._parsedSong || row.song || row.Song || row.SONG || row['Song Name'] || row['song_name'] || row.title || row.Title || row['Track Name'] || ''
          songName = cleanSongName(songName)
          
          // Skip if song name is empty, is a date, is numeric-only, or is "Unknown"
          const normalizedSongName = songName.toLowerCase().trim()
          if (!songName || songName.trim() === '' || isNumericOnly(songName) || normalizedSongName === 'unknown') {
            return
          }
          
          // Calculate total streams using same logic as upload-csv
          let streams = 0
          
          // Sum all Total columns (Total, Total_1, Total_2, etc.)
          Object.keys(row).forEach((key) => {
            if (key === 'Total' || key.startsWith('Total_')) {
              const value = row[key]
              if (value && value !== '') {
                const num = parseInt(String(value).replace(/,/g, '')) || 0
                streams += num
              }
            }
          })
          
          // If no Total columns found, sum individual platform columns
          if (streams === 0) {
            const platformKeywords = [
              'youtube', 'yt', 'you tube',
              'spotify', 'spot',
              'apple', 'apple music', 'itunes',
              'soundcloud', 'sc',
              'tidal',
              'amazon', 'amazon music',
              'deezer',
              'pandora',
              'iheartradio', 'iheart',
              'tiktok', 'tik tok',
              'instagram', 'ig',
              'facebook', 'fb',
              'twitter', 'tw',
              'streams', 'plays', 'views', 'listens'
            ]
            
            Object.keys(row).forEach((key) => {
              const keyLower = key.toLowerCase().trim()
              
              // Skip non-numeric columns
              if (keyLower.includes('song') || keyLower.includes('artist') || 
                  keyLower.includes('title') || keyLower.includes('name') ||
                  keyLower.includes('date') || keyLower.includes('time') ||
                  keyLower.includes('url') || keyLower.includes('link') ||
                  keyLower.includes('upc') || keyLower.includes('isrc') ||
                  keyLower.includes('distributor') || keyLower.includes('platform')) {
                return
              }
              
              const isPlatformColumn = platformKeywords.some(keyword => keyLower.includes(keyword))
              const value = row[key]
              
              if (isPlatformColumn || (typeof value === 'number' && value > 0) || 
                  (typeof value === 'string' && /^\d+[,\d]*$/.test(value.replace(/,/g, '')))) {
                const numValue = parseInt(String(value).replace(/,/g, '')) || 0
                if (numValue > 0) {
                  streams += numValue
                }
              }
            })
          }
          
          // Final fallback: try standard streams column
          if (streams === 0) {
            streams = parseInt(String(row.streams || row.Streams || row.STREAMS || row.Total || row.total || row.TOTAL || 0).replace(/,/g, '')) || 0
          }
          
          const distributor = row.distributor || row.Distributor || row.DISTRIBUTOR || row.platform || row.Platform || row.PLATFORM || 'Unknown'
          
          if (songName && songName.trim() !== '') {
            const key = `${songName}-${artistName}`
            if (!songsMap.has(key)) {
              songsMap.set(key, {
                song: songName.trim(),
                artist: artistName,
                streams: streams,
                distributor: distributor,
                upc: row.upc || row.UPC || row['UPC Code'],
                isrc: row.isrc || row.ISRC || row['ISRC Code'],
                driveLink: row.driveLink || row['Google Drive Link'] || row['Drive Link'],
              })
            } else {
              const existing = songsMap.get(key)!
              existing.streams += streams  // Aggregate streams
              if (row.upc && !existing.upc) existing.upc = row.upc
              if (row.isrc && !existing.isrc) existing.isrc = row.isrc
              if (row.driveLink && !existing.driveLink) existing.driveLink = row.driveLink
            }
          }
        })
        
        // Now process each song from this artist
        let currentCatalog = getCatalog() // Refresh catalog
        
        songsMap.forEach((songData) => {
          const normalizedSong = normalize(songData.song)
          const normalizedArtist = normalize(songData.artist)
          const csvStreams = songData.streams || 0
          
          // Skip if no streams (but still process if it's 0 to ensure catalog completeness)
          // Create a unique key for this song
          const songKey = `${normalizedSong}|${normalizedArtist}`
          
          // Check against current catalog using improved matching logic
          // First, try exact match (song name + artist name)
          let existing = currentCatalog.find(
            (item) => {
              const itemSongNormalized = normalize(item.song)
              const itemArtistNormalized = normalize(item.artist)
              return itemSongNormalized === normalizedSong && itemArtistNormalized === normalizedArtist
            }
          )
          
          // If no exact match, try partial artist match
          if (!existing) {
            existing = currentCatalog.find((item) => {
              const itemSongNormalized = normalize(item.song)
              if (itemSongNormalized !== normalizedSong) return false
              
              const existingArtists = parseArtistsFromString(item.artist).map(a => normalize(a))
              const csvArtists = parseArtistsFromString(songData.artist).map(a => normalize(a))
              
              return csvArtists.some(csvArtist => existingArtists.includes(csvArtist))
            })
          }
          
          // Check if song exists as a single with a songs array
          if (!existing) {
            existing = currentCatalog.find((item) => {
              const itemSongNormalized = normalize(item.song)
              const itemArtistNormalized = normalize(item.artist)
              if (itemSongNormalized === normalizedSong && itemArtistNormalized === normalizedArtist) {
                return true
              }
              if (item.releaseType === 'single' && item.songs && Array.isArray(item.songs)) {
                const hasMatchingSong = item.songs.some((s: any) => {
                  const songNameMatch = normalize(s.song) === normalizedSong
                  const artistMatch = normalize(item.artist) === normalizedArtist
                  return songNameMatch && artistMatch
                })
                return hasMatchingSong
              }
              return false
            })
          }
        
        // Last resort: check for same song name only
        if (!existing) {
          const potentialMatch = currentCatalog.find(
            (item) => normalize(item.song) === normalizedSong
          )
          
          if (potentialMatch && normalizedSong.length > 3 && !['song', 'track', 'music', 'title'].includes(normalizedSong)) {
            existing = potentialMatch
          }
        }
        
        // Check for nested songs in albums/EPs
        let nestedSongMatch: { album: CatalogItem; songIndex: number } | null = null
        if (!existing) {
          for (const item of currentCatalog) {
            if ((item.releaseType === 'album' || item.releaseType === 'ep') && item.songs && Array.isArray(item.songs)) {
              let songIndex = item.songs.findIndex((s: any) => 
                normalize(s.song) === normalizedSong && normalize(item.artist) === normalizedArtist
              )
              
              if (songIndex === -1) {
                songIndex = item.songs.findIndex((s: any) => 
                  normalize(s.song) === normalizedSong
                )
              }
              
              if (songIndex !== -1) {
                nestedSongMatch = { album: item, songIndex }
                break
              }
            }
          }
        }
        
        // Process the match
        if (existing) {
          const existingStreams = existing.totalStreams || 0
          
          // Always update with CSV streams if CSV has more streams OR if existing is 0
          // CSV is the source of truth for stream counts
          if (csvStreams > existingStreams || existingStreams === 0) {
            try {
              updateCatalogItem(existing.id, {
                totalStreams: csvStreams, // Use CSV streams directly
                distributor: songData.distributor || existing.distributor,
                googleDriveUrl: songData.driveLink || existing.googleDriveUrl,
                upc: songData.upc || existing.upc,
                isrc: songData.isrc || existing.isrc,
                fromCSV: true,
              })
              
              totalSongsUpdated++
              console.log(`  ✅ Updated: "${songData.song}" by ${songData.artist} (${existingStreams} → ${csvStreams} streams)`)
              currentCatalog = getCatalog() // Refresh
            } catch (error: any) {
              console.error(`  ❌ Failed to update: "${songData.song}" by ${songData.artist}`, error)
            }
          } else {
            totalSongsSkipped++
          }
        } else if (nestedSongMatch) {
          const { album, songIndex } = nestedSongMatch
          const nestedSong = album.songs![songIndex]
          const existingStreams = nestedSong.streams || 0
          
          if (csvStreams > existingStreams || existingStreams === 0) {
            const updatedSongs = [...album.songs!]
            updatedSongs[songIndex] = {
              ...nestedSong,
              streams: csvStreams,
            }
            
            try {
              updateCatalogItem(album.id, {
                songs: updatedSongs,
                distributor: songData.distributor || album.distributor,
                googleDriveUrl: songData.driveLink || album.googleDriveUrl,
                upc: songData.upc || album.upc,
                isrc: nestedSong.isrc || songData.isrc || album.isrc,
              })
              
              totalSongsUpdated++
              console.log(`  ✅ Updated nested: "${songData.song}" in ${album.releaseType} by ${songData.artist} (${existingStreams} → ${csvStreams} streams)`)
              currentCatalog = getCatalog() // Refresh
            } catch (error: any) {
              console.error(`  ❌ Failed to update nested: "${songData.song}" by ${songData.artist}`, error)
            }
          } else {
            totalSongsSkipped++
          }
        } else {
          // Song doesn't exist - add it
          const finalSongName = songData.song.trim()
          const finalArtistName = songData.artist.trim()
          
          if (!finalSongName || finalSongName.toLowerCase() === 'unknown' || !finalArtistName || finalArtistName.toLowerCase() === 'unknown') {
            totalSongsSkipped++
            return
          }
          
          // Only add if we haven't processed this exact song already
          if (!processedSongs.has(songKey)) {
            try {
              const newItem = addCatalogItem({
                song: finalSongName,
                artist: finalArtistName,
                releaseType: 'single',
                totalStreams: csvStreams,
                distributor: songData.distributor,
                manuallyAdded: false,
                fromCSV: true,
                googleDriveUrl: songData.driveLink,
                upc: songData.upc,
                isrc: songData.isrc,
              })
              
              totalSongsAdded++
              processedSongs.add(songKey)
              console.log(`  ➕ Added: "${finalSongName}" by ${finalArtistName} (${csvStreams} streams)`)
              currentCatalog = getCatalog() // Refresh
            } catch (error: any) {
              console.error(`  ❌ Failed to add: "${finalSongName}" by ${finalArtistName}`, error)
            }
          }
        }
      })
    })
    }
    
    // Log activity
    logActivity({
      action: 'Comprehensive CSV reconciliation completed',
      user: 'System',
      category: 'catalog',
      details: {
        uploadsProcessed: sortedUploads.length,
        songsUpdated: totalSongsUpdated,
        songsAdded: totalSongsAdded,
        songsSkipped: totalSongsSkipped,
      },
    })
    
    console.log(`\n✅ Reconciliation complete!`)
    console.log(`   Updated: ${totalSongsUpdated} songs`)
    console.log(`   Added: ${totalSongsAdded} songs`)
    console.log(`   Skipped: ${totalSongsSkipped} songs`)
    
    return NextResponse.json({
      success: true,
      uploadsProcessed: sortedUploads.length,
      songsUpdated: totalSongsUpdated,
      songsAdded: totalSongsAdded,
      songsSkipped: totalSongsSkipped,
      message: `Reconciled ${sortedUploads.length} CSV upload(s). Updated ${totalSongsUpdated} song(s), added ${totalSongsAdded} song(s).`,
    })
  } catch (error: any) {
    console.error('[POST /api/catalog/reconcile-all-csvs] Error:', error)
    return NextResponse.json(
      { error: 'Failed to reconcile CSV data', details: error.message },
      { status: 500 }
    )
  }
}
