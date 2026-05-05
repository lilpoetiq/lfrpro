import { NextRequest, NextResponse } from 'next/server'
import { getCatalog, deleteCatalogItem, getUploads, getArtistData, getUsers } from '@/lib/storage'
import { parseArtistsFromString } from '@/lib/artistParser'
import { logActivity } from '@/lib/activityLog'
import fs from 'fs'
import path from 'path'

// DELETE - Delete an artist and all their data
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const artistName = searchParams.get('artistName')
    const userId = searchParams.get('userId')
    const userName = searchParams.get('userName')

    if (!artistName) {
      return NextResponse.json(
        { error: 'Artist name is required' },
        { status: 400 }
      )
    }

    const catalog = getCatalog()
    const uploads = getUploads()
    let songsDeleted = 0
    let catalogItemsDeleted = 0

    // 1. Delete catalog items where this is the ONLY artist
    const itemsToDelete: string[] = []
    catalog.forEach((item) => {
      const itemArtists = parseArtistsFromString(item.artist)
      const normalizedArtistName = artistName.toLowerCase().trim()
      const isOnlyArtist = itemArtists.length === 1 && 
        itemArtists[0].toLowerCase().trim() === normalizedArtistName
      
      if (isOnlyArtist) {
        itemsToDelete.push(item.id)
        catalogItemsDeleted++
      } else {
        // If it's a collaboration, remove this artist from the artist string
        const hasArtist = itemArtists.some(a => a.toLowerCase().trim() === normalizedArtistName)
        if (hasArtist) {
          const updatedArtists = itemArtists.filter(a => 
            a.toLowerCase().trim() !== normalizedArtistName
          )
          if (updatedArtists.length > 0) {
            const newArtistString = updatedArtists.join(' & ')
            const { updateCatalogItem } = require('@/lib/storage')
            updateCatalogItem(item.id, { artist: newArtistString })
            songsDeleted++
          } else {
            // If no artists left, delete the item
            itemsToDelete.push(item.id)
            catalogItemsDeleted++
          }
        }
      }
    })

    // Delete catalog items
    itemsToDelete.forEach(id => {
      deleteCatalogItem(id)
    })

    // 2. Remove artist from uploads
    const { updateUpload } = await import('@/lib/storage')
    uploads.forEach((upload) => {
      if (upload.groupedByArtist && upload.groupedByArtist[artistName]) {
        const updatedGroupedByArtist = { ...upload.groupedByArtist }
        delete updatedGroupedByArtist[artistName]
        updateUpload(upload.id, {
          groupedByArtist: updatedGroupedByArtist,
        })
      }
    })

    // 3. Delete artist data file
    const DATA_DIR = path.join(process.cwd(), 'data')
    const artistFileName = `artist_${artistName.replace(/[^a-zA-Z0-9]/g, '_')}.json`
    const artistFilePath = path.join(DATA_DIR, artistFileName)
    if (fs.existsSync(artistFilePath)) {
      fs.unlinkSync(artistFilePath)
    }

    // Log activity
    const users = getUsers()
    const user = userId ? users.find(u => u.id === userId) : null
    const actorName = userName || user?.name || 'System'
    
    if (songsDeleted + catalogItemsDeleted > 0) {
      logActivity({
        action: `Deleted artist: ${artistName}`,
        user: actorName,
        userId: userId || undefined,
        category: 'catalog',
        details: {
          artistName,
          songsDeleted: songsDeleted + catalogItemsDeleted,
          catalogItemsDeleted,
          songsRemovedFromCollaborations: songsDeleted,
        },
      })
    }

    return NextResponse.json({
      success: true,
      songsDeleted: songsDeleted + catalogItemsDeleted,
      catalogItemsDeleted,
      message: `Successfully deleted artist "${artistName}" and ${songsDeleted + catalogItemsDeleted} songs`,
    })
  } catch (error: any) {
    console.error('Delete artist error:', error)
    return NextResponse.json(
      { error: 'Failed to delete artist', details: error.message },
      { status: 500 }
    )
  }
}

