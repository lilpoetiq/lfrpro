import { NextRequest, NextResponse } from 'next/server'
import { getCatalog, updateCatalogItem, getUploads } from '@/lib/storage'
import { cleanSongName } from '@/lib/utils'
import { parseArtistsFromString } from '@/lib/artistParser'

/**
 * Quick fix for Big Energy and other songs with multi-platform CSV structure
 * POST /api/catalog/fix-big-energy
 */
export async function POST(request: NextRequest) {
  try {
    const catalog = getCatalog()
    const uploads = getUploads()
    
    const normalize = (str: string): string => {
      return (str || '').toLowerCase().trim().replace(/\s+/g, ' ')
    }
    
    // Collect all songs from CSV with proper platform column parsing
    const csvSongs = new Map<string, {song: string, artist: string, streams: number}>()
    
    uploads.forEach((upload) => {
      if (!upload?.data || !Array.isArray(upload.data)) return
      
      upload.data.forEach((row: any) => {
        const allKeys = Object.keys(row)
        
        // Find platform columns and match them with Total columns
        allKeys.forEach((platformKey, platformIdx) => {
          const platformKeyLower = platformKey.toLowerCase()
          
          // Check if this is a platform column (contains song info)
          const isPlatformColumn = (
            platformKeyLower.includes('spotify') ||
            platformKeyLower.includes('apple') ||
            platformKeyLower.includes('pandora') ||
            platformKeyLower.includes('youtube') ||
            platformKeyLower.includes('deezer') ||
            platformKeyLower.includes('amazon') ||
            platformKeyLower.includes('soundcloud') ||
            platformKeyLower.includes('itunes') ||
            platformKeyLower.includes('vevo')
          ) && !platformKeyLower.includes('total') && !platformKeyLower.includes('change')
          
          if (isPlatformColumn && row[platformKey] && typeof row[platformKey] === 'string') {
            const platformValue = row[platformKey].trim()
            if (!platformValue || !platformValue.includes(' by ')) return
            
            // Parse song and artist
            const parts = platformValue.split(' by ')
            if (parts.length < 2) return
            
            let songName = cleanSongName(parts[0].trim())
            const artistName = parts.slice(1).join(' by ').trim()
            
            if (!songName || songName.toLowerCase() === 'unknown' || !artistName) return
            
            // Find corresponding Total column
            // Look for Total columns after this platform column
            let streams = 0
            for (let i = platformIdx + 1; i < Math.min(platformIdx + 10, allKeys.length); i++) {
              const nextKey = allKeys[i]
              if (nextKey.startsWith('Total') && !nextKey.includes('Change')) {
                const totalValue = row[nextKey]
                if (totalValue) {
                  streams = parseInt(String(totalValue).replace(/,/g, '')) || 0
                  if (streams > 0) break
                }
              }
            }
            
            if (streams > 0) {
              const key = `${normalize(songName)}|${normalize(artistName)}`
              const existing = csvSongs.get(key)
              if (!existing || streams > existing.streams) {
                csvSongs.set(key, { song: songName, artist: artistName, streams })
              }
            }
          }
        })
      })
    })
    
    console.log(`Found ${csvSongs.size} unique songs in CSV data`)
    
    let updated = 0
    let skipped = 0
    
    // Update catalog
    csvSongs.forEach((csvSong) => {
      const normalizedSong = normalize(csvSong.song)
      const normalizedArtist = normalize(csvSong.artist)
      
      // Find matching catalog item
      let existing = catalog.find(
        (item) => normalize(item.song) === normalizedSong && normalize(item.artist) === normalizedArtist
      )
      
      if (!existing) {
        existing = catalog.find((item) => {
          const itemSongNormalized = normalize(item.song)
          if (itemSongNormalized !== normalizedSong) return false
          const existingArtists = parseArtistsFromString(item.artist).map(a => normalize(a))
          const csvArtists = parseArtistsFromString(csvSong.artist).map(a => normalize(a))
          return csvArtists.some(csvArtist => existingArtists.includes(csvArtist))
        })
      }
      
      if (existing) {
        const existingStreams = existing.totalStreams || 0
        if (csvSong.streams > existingStreams || existingStreams === 0) {
          try {
            updateCatalogItem(existing.id, {
              totalStreams: csvSong.streams,
              fromCSV: true,
            })
            updated++
            console.log(`✅ Updated: "${csvSong.song}" by ${csvSong.artist} (${existingStreams} → ${csvSong.streams} streams)`)
          } catch (error: any) {
            console.error(`❌ Failed: "${csvSong.song}" by ${csvSong.artist}`, error)
          }
        } else {
          skipped++
        }
      } else {
        console.log(`⚠️ Not in catalog: "${csvSong.song}" by ${csvSong.artist} (${csvSong.streams} streams)`)
      }
    })
    
    return NextResponse.json({
      success: true,
      updated,
      skipped,
      totalSongs: csvSongs.size,
      message: `Updated ${updated} song(s), skipped ${skipped} song(s).`,
    })
  } catch (error: any) {
    console.error('[POST /api/catalog/fix-big-energy] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fix songs', details: error.message },
      { status: 500 }
    )
  }
}
