import { NextRequest, NextResponse } from 'next/server'
import { getCatalog, updateCatalogItem, getUploads } from '@/lib/storage'
import { cleanSongName } from '@/lib/utils'
import { parseArtistsFromString } from '@/lib/artistParser'

/**
 * Fix All God streams - properly handle two different versions with different ISRCs
 * 1. "All God" by "Style One" (album version, ISRC: USUYG1755570)
 * 2. "All God" by "Style One & Mistah F.A.B" (single version, ISRC: USUYG1755767)
 * POST /api/catalog/fix-all-god-streams
 */
export async function POST(request: NextRequest) {
  try {
    const catalog = getCatalog()
    const uploads = getUploads()
    
    const normalize = (str: string): string => {
      return (str || '').toLowerCase().trim().replace(/\s+/g, ' ')
    }
    
    // Collect streams for each version separately
    const albumVersionStreams = new Map<string, number>() // Key: platform, Value: streams
    const singleVersionStreams = new Map<string, number>()
    
    uploads.forEach((upload) => {
      if (!upload?.data || !Array.isArray(upload.data)) return
      
      upload.data.forEach((row: any) => {
        const allKeys = Object.keys(row)
        
        // Process each platform column
        allKeys.forEach((platformKey, platformIdx) => {
          const platformKeyLower = platformKey.toLowerCase()
          
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
            
            const normalizedValue = normalize(platformValue)
            if (!normalizedValue.includes('all god')) return
            
            // Parse song and artist
            const parts = platformValue.split(' by ')
            if (parts.length < 2) return
            
            let songName = cleanSongName(parts[0].trim())
            const artistName = parts.slice(1).join(' by ').trim()
            
            if (!songName || songName.toLowerCase() !== 'all god') return
            
            // Determine which version this is based on artist name
            const isSingleVersion = normalize(artistName).includes('mistah') || normalize(artistName).includes('f.a.b') || normalize(artistName).includes('fab')
            const isAlbumVersion = !isSingleVersion && normalize(artistName).includes('style one')
            
            if (!isSingleVersion && !isAlbumVersion) return
            
            // Map platform to correct Total column
            let totalKey = ''
            if (platformKeyLower.includes('spotify')) {
              totalKey = 'Total'
            } else if (platformKeyLower.includes('apple')) {
              totalKey = 'Total_1'
            } else if (platformKeyLower.includes('pandora')) {
              totalKey = 'Total_2'
            } else if (platformKeyLower.includes('deezer')) {
              totalKey = 'Total_3'
            } else if (platformKeyLower.includes('amazon prime')) {
              totalKey = 'Total_4'
            } else if (platformKeyLower.includes('amazon music unlimited') || platformKeyLower.includes('amazon unlimited')) {
              totalKey = 'Total_5'
            } else if (platformKeyLower.includes('vevo')) {
              totalKey = 'Total_6'
            } else if (platformKeyLower.includes('youtube')) {
              totalKey = 'Total_7'
            } else if (platformKeyLower.includes('soundcloud')) {
              totalKey = 'Total_8'
            } else if (platformKeyLower.includes('itunes')) {
              totalKey = 'Total_9'
            } else if (platformKeyLower.includes('amazon')) {
              totalKey = 'Total_4' // Default to Prime Music
            }
            
            if (!totalKey) return
            
            const streams = parseInt(String(row[totalKey] || 0).replace(/,/g, '')) || 0
            if (streams <= 0) return
            
            // Store streams by platform for the correct version
            if (isSingleVersion) {
              const current = singleVersionStreams.get(platformKey) || 0
              singleVersionStreams.set(platformKey, Math.max(current, streams)) // Take max across uploads
            } else if (isAlbumVersion) {
              const current = albumVersionStreams.get(platformKey) || 0
              albumVersionStreams.set(platformKey, Math.max(current, streams)) // Take max across uploads
            }
          }
        })
      })
    })
    
    // Sum streams for each version
    const singleTotalStreams = Array.from(singleVersionStreams.values()).reduce((sum, val) => sum + val, 0)
    const albumTotalStreams = Array.from(albumVersionStreams.values()).reduce((sum, val) => sum + val, 0)
    
    console.log(`Single version (Style One & Mistah F.A.B) streams: ${singleTotalStreams}`)
    console.log(`  Platform breakdown:`, Object.fromEntries(singleVersionStreams))
    console.log(`Album version (Style One) streams: ${albumTotalStreams}`)
    console.log(`  Platform breakdown:`, Object.fromEntries(albumVersionStreams))
    
    let updated = 0
    
    // Update single version (Style One & Mistah F.A.B, ISRC: USUYG1755767)
    const singleEntry = catalog.find(item => 
      normalize(item.song) === 'all god' && 
      normalize(item.artist).includes('mistah') &&
      item.isrc === 'USUYG1755767'
    )
    
    if (singleEntry) {
      try {
        // If it has a songs array (unusual for a single), update that too
        let updateData: any = {
          totalStreams: singleTotalStreams,
          fromCSV: true,
        }
        
        if (singleEntry.songs && Array.isArray(singleEntry.songs) && singleEntry.songs.length > 0) {
          const updatedSongs = singleEntry.songs.map((s: any) => {
            if (s.isrc === 'USUYG1755767' || normalize(s.song) === 'all god') {
              return { ...s, streams: singleTotalStreams }
            }
            return s
          })
          updateData.songs = updatedSongs
        }
        
        updateCatalogItem(singleEntry.id, updateData)
        updated++
        console.log(`✅ Updated single: "${singleEntry.song}" by ${singleEntry.artist} (${singleEntry.totalStreams} → ${singleTotalStreams} streams)`)
      } catch (error: any) {
        console.error(`❌ Failed to update single:`, error)
      }
    } else {
      console.log(`⚠️ Single version not found in catalog`)
    }
    
    // Update album version - this is trickier because it's nested in the album
    // The album version is in "Fruit of Faith" album with ISRC: USUYG1755570
    const albumEntry = catalog.find(item => 
      item.releaseType === 'album' &&
      item.song === 'Fruit of Faith' &&
      normalize(item.artist) === 'style one' &&
      item.songs &&
      item.songs.some((s: any) => s.isrc === 'USUYG1755570')
    )
    
    if (albumEntry && albumEntry.songs) {
      const allGodSong = albumEntry.songs.find((s: any) => s.isrc === 'USUYG1755570')
      if (allGodSong) {
        const updatedSongs = albumEntry.songs.map((s: any) => {
          if (s.isrc === 'USUYG1755570') {
            return { ...s, streams: albumTotalStreams }
          }
          return s
        })
        
        // Recalculate album total streams
        const newAlbumTotal = updatedSongs.reduce((sum: number, s: any) => sum + (s.streams || 0), 0)
        
        try {
          updateCatalogItem(albumEntry.id, {
            songs: updatedSongs,
            totalStreams: newAlbumTotal,
            fromCSV: true,
          })
          updated++
          console.log(`✅ Updated album version: "All God" in "Fruit of Faith" (${allGodSong.streams} → ${albumTotalStreams} streams)`)
          console.log(`   Album total: ${albumEntry.totalStreams} → ${newAlbumTotal} streams`)
        } catch (error: any) {
          console.error(`❌ Failed to update album version:`, error)
        }
      }
    } else {
      console.log(`⚠️ Album version not found in catalog`)
    }
    
    return NextResponse.json({
      success: true,
      updated,
      singleVersion: {
        streams: singleTotalStreams,
        platformBreakdown: Object.fromEntries(singleVersionStreams)
      },
      albumVersion: {
        streams: albumTotalStreams,
        platformBreakdown: Object.fromEntries(albumVersionStreams)
      },
      message: `Updated ${updated} version(s) of All God.`,
    })
  } catch (error: any) {
    console.error('[POST /api/catalog/fix-all-god-streams] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fix All God streams', details: error.message },
      { status: 500 }
    )
  }
}
