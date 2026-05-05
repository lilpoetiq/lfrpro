import { NextRequest, NextResponse } from 'next/server'
import { getCatalog, addCatalogItem, deleteCatalogItem } from '@/lib/storage'
import { logActivity } from '@/lib/activityLog'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { songIds, albumName, artist, releaseType, releaseDate, distributor, upc, isrc } = body

    if (!songIds || !Array.isArray(songIds) || songIds.length === 0) {
      return NextResponse.json({ error: 'Song IDs array is required' }, { status: 400 })
    }

    if (!albumName || !artist) {
      return NextResponse.json({ error: 'Album name and artist are required' }, { status: 400 })
    }

    if (!releaseType || (releaseType !== 'album' && releaseType !== 'ep')) {
      return NextResponse.json({ error: 'Release type must be "album" or "ep"' }, { status: 400 })
    }

    const catalog = getCatalog()
    const selectedSongs = catalog.filter(item => songIds.includes(item.id))

    if (selectedSongs.length !== songIds.length) {
      return NextResponse.json({ error: 'Some songs were not found' }, { status: 404 })
    }

    // Verify all songs are singles
    const nonSingles = selectedSongs.filter(song => song.releaseType !== 'single')
    if (nonSingles.length > 0) {
      return NextResponse.json({ 
        error: 'Can only combine singles into albums/EPs',
        nonSingles: nonSingles.map(s => s.song)
      }, { status: 400 })
    }

    // Combine streams
    const totalStreams = selectedSongs.reduce((sum, song) => sum + song.totalStreams, 0)

    // Get common artist (use first song's artist or provided artist)
    const commonArtist = artist || selectedSongs[0]?.artist

    // Create album/EP with all songs
    const albumItem = addCatalogItem({
      song: albumName,
      artist: commonArtist,
      artistId: selectedSongs[0]?.artistId,
      artistIds: selectedSongs[0]?.artistIds || (selectedSongs[0]?.artistId ? [selectedSongs[0].artistId] : undefined),
      releaseType: releaseType,
      releaseDate: releaseDate || undefined,
      totalStreams: totalStreams,
      distributor: distributor || undefined,
      manuallyAdded: true,
      upc: upc || undefined,
      isrc: isrc || undefined,
      songs: selectedSongs.map(song => ({
        id: song.id,
        song: song.song,
        isrc: song.isrc,
        streams: song.totalStreams,
      })),
    })

    // Delete the original singles
    for (const song of selectedSongs) {
      deleteCatalogItem(song.id)
    }

    // Log activity
    logActivity({
      action: `Combined ${selectedSongs.length} songs into ${releaseType}`,
      user: 'User',
      category: 'catalog',
      details: {
        albumName,
        artist: commonArtist,
        releaseType,
        songCount: selectedSongs.length,
        totalStreams,
        songIds: selectedSongs.map(s => s.id),
        albumId: albumItem.id,
      },
    })

    return NextResponse.json({ 
      success: true, 
      album: albumItem,
      deletedSongs: selectedSongs.map(s => ({ id: s.id, song: s.song }))
    })
  } catch (error: any) {
    console.error('Combine songs error:', error)
    return NextResponse.json(
      { error: 'Failed to combine songs', details: error.message },
      { status: 500 }
    )
  }
}

