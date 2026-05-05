import { NextRequest, NextResponse } from 'next/server'
import { getCatalog, updateCatalogItem, getUploads, CatalogItem } from '@/lib/storage'
import { logActivity } from '@/lib/activityLog'
import { cleanSongName } from '@/lib/utils'

/**
 * Reconcile streams between CSV data and catalog items
 * Matches CSV songs to catalog items and adds only the difference
 * POST /api/catalog/reconcile-streams
 */
export async function POST(request: NextRequest) {
  try {
    const catalog = getCatalog()
    const uploads = getUploads()
    
    // Get all CSV songs from artist data
    const csvSongs = new Map<string, { song: string; artist: string; streams: number }>()
    
    const parseNumber = (value: any): number => {
      if (!value || value === '') return 0
      if (typeof value === 'number') return value
      const cleaned = String(value).replace(/,/g, '').trim()
      const parsed = parseInt(cleaned)
      return isNaN(parsed) ? 0 : parsed
    }

    // Collect all CSV songs from all uploads
    uploads.forEach((upload: any) => {
      if (!upload?.groupedByArtist) return
      Object.entries(upload.groupedByArtist).forEach(([artistName, rows]) => {
        if (!Array.isArray(rows)) return
        rows.forEach((row: any) => {
          let songName =
            row?._parsedSong ||
            row?.song ||
            row?.Song ||
            row?.SONG ||
            row?.['Song Name'] ||
            row?.['song_name'] ||
            row?.title ||
            row?.Title

          songName = cleanSongName(songName || '')
          if (!songName) return

          // Streams: sum Total columns if present, else fallback to common fields
          let streams = 0
          Object.keys(row || {}).forEach((key) => {
            if (key === 'Total' || key.startsWith('Total_')) {
              streams += parseNumber(row[key])
            }
          })
          if (streams === 0) {
            streams = parseNumber(row?.streams || row?.Streams || row?.Total || row?.total)
          }

          const key = `${songName}-${artistName}`.toLowerCase()
          const currentStreams = csvSongs.get(key)?.streams || 0
          if (!csvSongs.has(key) || streams > currentStreams) {
            csvSongs.set(key, { song: songName, artist: artistName, streams })
          }
        })
      })
    })
    
    let songsUpdated = 0
    let songsSkipped = 0
    
    // Normalize function
    const normalize = (str: string) => str.toLowerCase().trim()
    
    // Process each CSV song
    csvSongs.forEach((csvSong) => {
      const normalizedSong = normalize(csvSong.song)
      const normalizedArtist = normalize(csvSong.artist)
      const csvStreams = csvSong.streams
      
      // Find matching catalog item (top-level)
      let existing = catalog.find(
        (item) => normalize(item.song) === normalizedSong && normalize(item.artist) === normalizedArtist
      )
      
      // If not found, check nested songs in albums/EPs
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
      
      if (existing) {
        // Found as top-level item
        const existingStreams = existing.totalStreams || 0
        const streamDifference = csvStreams - existingStreams
        
        if (streamDifference > 0) {
          const newTotalStreams = existingStreams + streamDifference
          
          try {
            updateCatalogItem(existing.id, {
              totalStreams: newTotalStreams,
            })
            
            songsUpdated++
            console.log(`🔄 Reconciled: "${csvSong.song}" by ${csvSong.artist} (${existingStreams} + ${streamDifference} = ${newTotalStreams})`)
          } catch (error: any) {
            console.error(`❌ Failed to reconcile: "${csvSong.song}" by ${csvSong.artist}`, error)
          }
        } else {
          songsSkipped++
        }
      } else if (nestedSongMatch) {
        // Found as nested song
        const { album, songIndex } = nestedSongMatch
        const nestedSong = album.songs![songIndex]
        const existingStreams = nestedSong.streams || 0
        const streamDifference = csvStreams - existingStreams
        
        if (streamDifference > 0) {
          const updatedSongs = [...album.songs!]
          updatedSongs[songIndex] = {
            ...nestedSong,
            streams: existingStreams + streamDifference,
          }
          
          try {
            updateCatalogItem(album.id, {
              songs: updatedSongs,
            })
            
            songsUpdated++
            console.log(`🔄 Reconciled nested song: "${csvSong.song}" by ${csvSong.artist} (${existingStreams} + ${streamDifference} = ${existingStreams + streamDifference})`)
          } catch (error: any) {
            console.error(`❌ Failed to reconcile nested song: "${csvSong.song}" by ${csvSong.artist}`, error)
          }
        } else {
          songsSkipped++
        }
      }
    })
    
    // Log activity
    logActivity({
      action: 'Catalog streams reconciled with CSV data',
      user: 'System',
      category: 'catalog',
      details: {
        songsUpdated,
        songsSkipped,
        csvSongsProcessed: csvSongs.size,
      },
    })
    
    return NextResponse.json({
      success: true,
      songsUpdated,
      songsSkipped,
      csvSongsProcessed: csvSongs.size,
      message: `Reconciled ${songsUpdated} song(s) with CSV data. ${songsSkipped} skipped (no difference).`,
    })
  } catch (error: any) {
    console.error('[POST /api/catalog/reconcile-streams] Error:', error)
    return NextResponse.json(
      { error: 'Failed to reconcile streams', details: error.message },
      { status: 500 }
    )
  }
}

