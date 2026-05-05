import { NextRequest, NextResponse } from 'next/server'
import { getSongVaultFiles } from '@/lib/storage'
import { addCatalogItem, getCatalog } from '@/lib/storage'
import { logActivity } from '@/lib/activityLog'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { vaultFileId, releaseType, releaseDate, distributor, upc, isrc } = body

    if (!vaultFileId) {
      return NextResponse.json({ error: 'Vault file ID is required' }, { status: 400 })
    }

    const vaultFiles = getSongVaultFiles()
    const vaultFile = vaultFiles.find(f => f.id === vaultFileId)

    if (!vaultFile) {
      return NextResponse.json({ error: 'Vault file not found' }, { status: 404 })
    }

    if (!vaultFile.isUnreleased || !vaultFile.songName || !vaultFile.artistName) {
      return NextResponse.json({ error: 'This vault file is not an unreleased song' }, { status: 400 })
    }

    // Check if catalog item already exists
    const catalog = getCatalog()
    const existingItem = catalog.find(item => 
      item.song.toLowerCase() === vaultFile.songName!.toLowerCase() &&
      item.artist.toLowerCase() === vaultFile.artistName!.toLowerCase()
    )

    if (existingItem) {
      return NextResponse.json({ 
        error: 'Song already exists in catalog',
        catalogItem: existingItem,
      }, { status: 400 })
    }

    // Create catalog item
    const catalogItem = addCatalogItem({
      song: vaultFile.songName,
      artist: vaultFile.artistName,
      artistId: vaultFile.artistId,
      releaseType: releaseType || 'single',
      releaseDate: releaseDate || undefined,
      totalStreams: 0,
      distributor: distributor || undefined,
      manuallyAdded: true,
      fileUrl: vaultFile.fileUrl || undefined,
      googleDriveUrl: vaultFile.googleDriveUrl || undefined,
      upc: upc || undefined,
      isrc: isrc || undefined,
    })

    // Update vault file to link to catalog item
    const updatedVaultFile = {
      ...vaultFile,
      songId: catalogItem.id,
      isUnreleased: false,
      songName: undefined,
      artistName: undefined,
      artistId: undefined,
    }

    // Update vault file
    const vaultFilesUpdated = vaultFiles.map(f => 
      f.id === vaultFileId ? updatedVaultFile : f
    )
    
    const filePath = require('path').join(require('process').cwd(), 'data', 'songVault.json')
    require('fs').writeFileSync(filePath, JSON.stringify(vaultFilesUpdated, null, 2))

    // Log activity
    logActivity({
      action: 'Transferred unreleased vault song to catalog',
      user: 'Admin',
      category: 'catalog',
      details: {
        song: vaultFile.songName,
        artist: vaultFile.artistName,
        songId: catalogItem.id,
        vaultFileId,
      },
    })

    return NextResponse.json({ 
      success: true, 
      catalogItem,
      vaultFile: updatedVaultFile,
    })
  } catch (error: any) {
    console.error('Transfer vault to catalog error:', error)
    return NextResponse.json(
      { error: 'Failed to transfer to catalog', details: error.message },
      { status: 500 }
    )
  }
}

