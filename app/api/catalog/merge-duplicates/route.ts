import { NextRequest, NextResponse } from 'next/server'
import { getCatalog, updateCatalogItem, deleteCatalogItem, type CatalogItem } from '@/lib/storage'
import { logActivity } from '@/lib/activityLog'

/**
 * Merge duplicate songs in catalog (same song name, different artists)
 * POST /api/catalog/merge-duplicates
 */
export async function POST(request: NextRequest) {
  try {
    const catalog = getCatalog()
    const normalize = (str: string) => str.toLowerCase().trim()
    
    // Group songs by normalized song name
    const songsByName = new Map<string, CatalogItem[]>()
    
    catalog.forEach((item) => {
      const normalizedSong = normalize(item.song)
      if (!songsByName.has(normalizedSong)) {
        songsByName.set(normalizedSong, [])
      }
      songsByName.get(normalizedSong)!.push(item)
    })
    
    let merged = 0
    let deleted = 0
    const mergedSongs: string[] = []
    
    // Process each group of songs with the same name
    songsByName.forEach((items, normalizedSongName) => {
      // If there's only one entry, skip it
      if (items.length <= 1) return
      
      // Sort by streams (keep the one with highest streams, or oldest if equal)
      items.sort((a, b) => {
        const streamDiff = (b.totalStreams || 0) - (a.totalStreams || 0)
        if (streamDiff !== 0) return streamDiff
        // If streams are equal, keep the older one (lower ID timestamp)
        return a.id.localeCompare(b.id)
      })
      
      const keepItem = items[0] // Keep the first one (highest streams or oldest)
      const duplicateItems = items.slice(1) // All others are duplicates
      
      // Calculate total streams from all duplicates
      let totalStreams = keepItem.totalStreams || 0
      const allArtists = new Set<string>([keepItem.artist])
      
      duplicateItems.forEach((dup) => {
        totalStreams += dup.totalStreams || 0
        allArtists.add(dup.artist)
        
        // Merge other metadata if missing from keepItem
        if (!keepItem.distributor && dup.distributor) {
          keepItem.distributor = dup.distributor
        }
        if (!keepItem.googleDriveUrl && dup.googleDriveUrl) {
          keepItem.googleDriveUrl = dup.googleDriveUrl
        }
        if (!keepItem.upc && dup.upc) {
          keepItem.upc = dup.upc
        }
        if (!keepItem.isrc && dup.isrc) {
          keepItem.isrc = dup.isrc
        }
      })
      
      // Combine artist names for collaborations
      const combinedArtists = Array.from(allArtists).join(' & ')
      
      // Update the kept item with merged data
      try {
        updateCatalogItem(keepItem.id, {
          totalStreams,
          artist: combinedArtists,
          distributor: keepItem.distributor,
          googleDriveUrl: keepItem.googleDriveUrl,
          upc: keepItem.upc,
          isrc: keepItem.isrc,
        })
        
        // Delete duplicate items
        duplicateItems.forEach((dup) => {
          try {
            deleteCatalogItem(dup.id)
            deleted++
          } catch (error: any) {
            console.error(`Failed to delete duplicate: ${dup.id}`, error)
          }
        })
        
        merged++
        mergedSongs.push(`${keepItem.song} (${items.length} entries merged → ${combinedArtists})`)
        
        console.log(`✅ Merged ${items.length} entries for "${keepItem.song}": ${combinedArtists} (${totalStreams} total streams)`)
      } catch (error: any) {
        console.error(`Failed to merge duplicates for "${keepItem.song}"`, error)
      }
    })
    
    // Log activity
    logActivity({
      action: 'Duplicate songs merged in catalog',
      user: 'System',
      category: 'catalog',
      details: {
        merged,
        deleted,
        songsProcessed: mergedSongs,
      },
    })
    
    return NextResponse.json({
      success: true,
      merged,
      deleted,
      mergedSongs: mergedSongs.slice(0, 50), // Limit response size
      message: `Merged ${merged} duplicate song(s), deleted ${deleted} duplicate entries.`,
    })
  } catch (error: any) {
    console.error('[POST /api/catalog/merge-duplicates] Error:', error)
    return NextResponse.json(
      { error: 'Failed to merge duplicates', details: error.message },
      { status: 500 }
    )
  }
}



