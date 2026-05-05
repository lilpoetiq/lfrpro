import { NextRequest, NextResponse } from 'next/server'
import { getCollaborativeSongMappings, addCollaborativeSongMapping, deleteCollaborativeSongMapping, getUsers, getCatalog } from '@/lib/storage'
import { parseArtistsFromString } from '@/lib/artistParser'

// GET - Get all collaborative song mappings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const songName = searchParams.get('songName')
    const artistString = searchParams.get('artistString')
    
    const mappings = getCollaborativeSongMappings()
    const users = getUsers()
    const catalog = getCatalog()
    
    // Filter by song name and artist if provided
    let filteredMappings = mappings
    if (songName && artistString) {
      filteredMappings = mappings.filter(m => 
        m.songName.toLowerCase() === songName.toLowerCase() &&
        m.artistString.toLowerCase() === artistString.toLowerCase()
      )
    }
    
    // Enrich mappings with user and song info
    const enrichedMappings = filteredMappings.map(mapping => {
      const user = users.find(u => u.id === mapping.primaryUserId)
      const song = catalog.find(s => 
        s.song.toLowerCase() === mapping.songName.toLowerCase() &&
        s.artist.toLowerCase() === mapping.artistString.toLowerCase()
      )
      
      return {
        ...mapping,
        userName: user?.name,
        username: user?.username,
        songExists: !!song,
        songId: song?.id,
      }
    })
    
    return NextResponse.json({ success: true, mappings: enrichedMappings })
  } catch (error: any) {
    console.error('Get collaborative song mappings error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch mappings', details: error.message },
      { status: 500 }
    )
  }
}

// POST - Create or update collaborative song mapping
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { songName, artistString, primaryUserId } = body

    if (!songName || !artistString || !primaryUserId) {
      return NextResponse.json(
        { error: 'Song name, artist string, and primary user ID are required' },
        { status: 400 }
      )
    }

    // Verify user exists
    const users = getUsers()
    const user = users.find(u => u.id === primaryUserId)
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const mapping = addCollaborativeSongMapping({
      songName: songName.trim(),
      artistString: artistString.trim(),
      primaryUserId,
    })

    return NextResponse.json({ success: true, mapping })
  } catch (error: any) {
    console.error('Create collaborative song mapping error:', error)
    return NextResponse.json(
      { error: 'Failed to create mapping', details: error.message },
      { status: 500 }
    )
  }
}

// DELETE - Remove collaborative song mapping
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Mapping ID is required' },
        { status: 400 }
      )
    }

    const success = deleteCollaborativeSongMapping(id)

    if (!success) {
      return NextResponse.json(
        { error: 'Mapping not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete collaborative song mapping error:', error)
    return NextResponse.json(
      { error: 'Failed to delete mapping', details: error.message },
      { status: 500 }
    )
  }
}

