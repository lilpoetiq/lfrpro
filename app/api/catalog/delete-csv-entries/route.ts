import { NextRequest, NextResponse } from 'next/server'
import { getCatalog, deleteCatalogItem } from '@/lib/storage'
import { logActivity } from '@/lib/activityLog'

/**
 * Delete all catalog entries that were added from CSV uploads
 * POST /api/catalog/delete-csv-entries
 */
export async function POST(request: NextRequest) {
  try {
    const catalog = getCatalog()
    
    // Find all entries with fromCSV flag
    const csvEntries = catalog.filter(item => item.fromCSV === true)
    
    let deleted = 0
    const deletedSongs: string[] = []
    
    csvEntries.forEach((item) => {
      try {
        deleteCatalogItem(item.id)
        deleted++
        deletedSongs.push(`${item.song} - ${item.artist}`)
        console.log(`✅ Deleted CSV entry: "${item.song}" by ${item.artist}`)
      } catch (error: any) {
        console.error(`❌ Failed to delete CSV entry: "${item.song}" by ${item.artist}`, error)
      }
    })
    
    // Log activity
    logActivity({
      action: 'CSV entries deleted from catalog',
      user: 'System',
      category: 'catalog',
      details: {
        deleted,
        songsDeleted: deletedSongs.slice(0, 50), // Limit log size
      },
    })
    
    return NextResponse.json({
      success: true,
      deleted,
      deletedSongs: deletedSongs.slice(0, 100), // Limit response size
      message: `Deleted ${deleted} CSV entry/entries from catalog. You can now re-upload your CSV to merge with existing entries.`,
    })
  } catch (error: any) {
    console.error('[POST /api/catalog/delete-csv-entries] Error:', error)
    return NextResponse.json(
      { error: 'Failed to delete CSV entries', details: error.message },
      { status: 500 }
    )
  }
}







