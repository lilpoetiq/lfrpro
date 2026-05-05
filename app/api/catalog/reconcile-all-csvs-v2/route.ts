import { NextRequest, NextResponse } from 'next/server'
import { getCatalog, updateCatalogItem, getUploads, addCatalogItem, CatalogItem } from '@/lib/storage'
import { logActivity } from '@/lib/activityLog'
import { cleanSongName, parseSongFromSpotify } from '@/lib/utils'
import { parseArtistsFromString } from '@/lib/artistParser'

/**
 * Comprehensive reconciliation V2: Handles multi-platform CSV structure
 * Each CSV row can have different songs in different platform columns
 * POST /api/catalog/reconcile-all-csvs-v2
 */
export async function POST(request: NextRequest) {
  try {
    const catalog = getCatalog()
    const uploads = getUploads()
    
    // Sort uploads chronologically (oldest first)
    const sortedUploads = [...uploads].sort((a, b) => 
      new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()
    )
    
    console.log(`🔄 Starting comprehensive reconciliation V2 of ${sortedUploads.length} CSV uploads...`)
    
    let totalSongsUpdated = 0
    let totalSongsAdded = 0
    let totalSongsSkipped = 0
    
    // Normalize function
    const normalize = (str: string): string => {
      return (str || '').toLowerCase().trim().replace(/\s+/g, ' ')
    }
    
    // Process each upload
    for (const upload of sortedUploads) {
      if (!upload?.data || !Array.isArray(upload.data)) {
        console.log(`⏭️ Skipping upload ${upload.id} - no data array`)
        continue
      }
      
      console.log(`\n📊 Processing upload: ${upload.fileName} (${upload.uploadedAt})`)
      
      // Process each row - extract songs from ALL platform columns
      upload.data.forEach((row: any) => {
        // Platform columns that contain song info
        const platformColumns = [
          'Spotify', 'spotify',
          'Apple Music', 'apple music', 'Apple',
          'Pandora', 'pandora',
          'YouTube', 'youtube', 'YouTube Music',
          'Deezer', 'deezer',
          'Amazon Prime Music', 'Amazon Music Unlimited', 'Amazon', 'amazon',
          'Soundcloud', 'soundcloud', 'SoundCloud',
          'iTunes', 'itunes',
          'VEVO', 'vevo',
        ]
        
        // Find all platform columns and their corresponding Total columns
        const platformSongs: Array<{song: string, artist: string, streams: number, platform: string}> = []
        
        Object.keys(row).forEach((key) => {
          // Check if this is a platform column
          const isPlatformColumn = platformColumns.some(p => 
            key.toLowerCase().includes(p.toLowerCase())
          )
          
          if (isPlatformColumn && row[key] && typeof row[key] === 'string' && row[key].trim()) {
            const platformValue = row[key].trim()
            
            // Parse song and artist from platform value (e.g., "Big Energy [Explicit] by Paris Monroh")
            let songName = ''
            let artistName = ''
            
            if (platformValue.includes(' by ')) {
              const parts = platformValue.split(' by ')
              songName = cleanSongName(parts[0].trim())
              artistName = parts.slice(1).join(' by ').trim()
            } else {
              // Try parsing as Spotify format
              const parsed = parseSongFromSpotify(platformValue)
              songName = parsed.song ? cleanSongName(parsed.song) : cleanSongName(platformValue)
              artistName = parsed.artist || ''
            }
            
            if (!songName || songName.toLowerCase() === 'unknown') return
            
            // Find corresponding Total column
            // Platform columns are usually in order: Spotify=Total, Apple Music=Total_1, Pandora=Total_2, etc.
            let streams = 0
            const keyIndex = Object.keys(row).indexOf(key)
            const totalKeys = Object.keys(row).filter(k => k.startsWith('Total'))
            const totalKeyIndex = Math.floor(keyIndex / 2) // Rough estimate - may need adjustment
            
            // Try to find Total column by matching index or by checking nearby columns
            if (totalKeys.length > 0) {
              // Check if there's a Total column right after this platform column
              const allKeys = Object.keys(row)
              const platformIndex = allKeys.indexOf(key)
              
              // Look for Total columns near this platform column
              for (let i = platformIndex + 1; i < Math.min(platformIndex + 5, allKeys.length); i++) {
                if (allKeys[i].startsWith('Total')) {
                  const totalValue = row[allKeys[i]]
                  if (totalValue) {
                    streams = parseInt(String(totalValue).replace(/,/g, '')) || 0
                    break
                  }
                }
              }
              
              // If still no streams, try to match by platform order
              if (streams === 0) {
                const platformOrder = ['spotify', 'apple', 'pandora', 'deezer', 'amazon', 'vevo', 'youtube', 'soundcloud', 'itunes']
                const platformLower = key.toLowerCase()
                let platformIdx = -1
                for (let i = 0; i < platformOrder.length; i++) {
                  if (platformLower.includes(platformOrder[i])) {
                    platformIdx = i
                    break
                  }
                }
                
                if (platformIdx >= 0 && platformIdx < totalKeys.length) {
                  const totalValue = row[totalKeys[platformIdx]]
                  if (totalValue) {
                    streams = parseInt(String(totalValue).replace(/,/g, '')) || 0
                  }
                }
              }
            }
            
            // Fallback: sum all Total columns if we can't match
            if (streams === 0) {
              // This is a fallback - ideally we'd match correctly above
              // For now, if we can't match, skip this entry
              return
            }
            
            if (songName && artistName && streams > 0) {
              platformSongs.push({
                song: songName,
                artist: artistName,
                streams: streams,
                platform: key
              })
            }
          }
        })
        
        // Now process each song found in this row
        platformSongs.forEach(({song, artist, streams}) => {
          const normalizedSong = normalize(song)
          const normalizedArtist = normalize(artist)
          
          // Find matching catalog item
          let existing = catalog.find(
            (item) => {
              const itemSongNormalized = normalize(item.song)
              const itemArtistNormalized = normalize(item.artist)
              return itemSongNormalized === normalizedSong && itemArtistNormalized === normalizedArtist
            }
          )
          
          // Try partial artist match
          if (!existing) {
            existing = catalog.find((item) => {
              const itemSongNormalized = normalize(item.song)
              if (itemSongNormalized !== normalizedSong) return false
              
              const existingArtists = parseArtistsFromString(item.artist).map(a => normalize(a))
              const csvArtists = parseArtistsFromString(artist).map(a => normalize(a))
              
              return csvArtists.some(csvArtist => existingArtists.includes(csvArtist))
            })
          }
          
          // Check nested songs
          let nestedSongMatch: { album: CatalogItem; songIndex: number } | null = null
          if (!existing) {
            for (const item of catalog) {
              if ((item.releaseType === 'album' || item.releaseType === 'ep') && item.songs && Array.isArray(item.songs)) {
                const songIndex = item.songs.findIndex((s: any) => 
                  normalize(s.song) === normalizedSong && normalize(item.artist) === normalizedArtist
                )
                if (songIndex !== -1) {
                  nestedSongMatch = { album: item, songIndex }
                  break
                }
              }
            }
          }
          
          // Update or add
          if (existing) {
            const existingStreams = existing.totalStreams || 0
            if (streams > existingStreams || existingStreams === 0) {
              try {
                updateCatalogItem(existing.id, {
                  totalStreams: streams, // Use CSV streams
                  fromCSV: true,
                })
                totalSongsUpdated++
                console.log(`  ✅ Updated: "${song}" by ${artist} (${existingStreams} → ${streams} streams)`)
              } catch (error: any) {
                console.error(`  ❌ Failed to update: "${song}" by ${artist}`, error)
              }
            } else {
              totalSongsSkipped++
            }
          } else if (nestedSongMatch) {
            const { album, songIndex } = nestedSongMatch
            const nestedSong = album.songs![songIndex]
            const existingStreams = nestedSong.streams || 0
            
            if (streams > existingStreams || existingStreams === 0) {
              const updatedSongs = [...album.songs!]
              updatedSongs[songIndex] = {
                ...nestedSong,
                streams: streams,
              }
              
              try {
                updateCatalogItem(album.id, {
                  songs: updatedSongs,
                })
                totalSongsUpdated++
                console.log(`  ✅ Updated nested: "${song}" in ${album.releaseType} by ${artist} (${existingStreams} → ${streams} streams)`)
              } catch (error: any) {
                console.error(`  ❌ Failed to update nested: "${song}" by ${artist}`, error)
              }
            } else {
              totalSongsSkipped++
            }
          } else {
            // Add new song
            if (song && artist && streams > 0) {
              try {
                addCatalogItem({
                  song: song.trim(),
                  artist: artist.trim(),
                  releaseType: 'single',
                  totalStreams: streams,
                  manuallyAdded: false,
                  fromCSV: true,
                })
                totalSongsAdded++
                console.log(`  ➕ Added: "${song}" by ${artist} (${streams} streams)`)
              } catch (error: any) {
                console.error(`  ❌ Failed to add: "${song}" by ${artist}`, error)
              }
            }
          }
        })
      })
    }
    
    // Log activity
    logActivity({
      action: 'Comprehensive CSV reconciliation V2 completed',
      user: 'System',
      category: 'catalog',
      details: {
        uploadsProcessed: sortedUploads.length,
        songsUpdated: totalSongsUpdated,
        songsAdded: totalSongsAdded,
        songsSkipped: totalSongsSkipped,
      },
    })
    
    console.log(`\n✅ Reconciliation V2 complete!`)
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
    console.error('[POST /api/catalog/reconcile-all-csvs-v2] Error:', error)
    return NextResponse.json(
      { error: 'Failed to reconcile CSV data', details: error.message },
      { status: 500 }
    )
  }
}
