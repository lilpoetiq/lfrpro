import { NextRequest, NextResponse } from 'next/server'
import { getArtistUserMappings, addArtistUserMapping, deleteArtistUserMapping, getUsers } from '@/lib/storage'

// GET - Get all artist-to-user mappings
export async function GET(request: NextRequest) {
  try {
    const mappings = getArtistUserMappings()
    const users = getUsers()
    
    // Enrich mappings with user info
    const enrichedMappings = mappings.map(mapping => {
      const user = users.find(u => u.id === mapping.userId)
      return {
        ...mapping,
        userName: user?.name,
        username: user?.username,
        email: user?.email,
        phoneNumber: user?.phoneNumber,
      }
    })
    
    return NextResponse.json({ success: true, mappings: enrichedMappings })
  } catch (error: any) {
    console.error('Get artist mappings error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch mappings', details: error.message },
      { status: 500 }
    )
  }
}

// POST - Create or update artist-to-user mapping
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { artistName, userId } = body

    console.log('[POST /api/artist-mappings] Request:', { artistName, userId })

    if (!artistName || !userId) {
      console.error('[POST /api/artist-mappings] Missing required fields:', { artistName, userId })
      return NextResponse.json(
        { error: 'Artist name and user ID are required', received: { artistName, userId } },
        { status: 400 }
      )
    }

    // Verify user exists
    const users = getUsers()
    const user = users.find(u => u.id === userId)
    if (!user) {
      console.error('[POST /api/artist-mappings] User not found:', userId, 'Available users:', users.map(u => ({ id: u.id, name: u.name })))
      return NextResponse.json(
        { error: 'User not found', userId },
        { status: 404 }
      )
    }

    console.log('[POST /api/artist-mappings] Creating mapping for user:', user.name)
    
    const mapping = addArtistUserMapping({
      artistName: artistName.trim(),
      userId,
    })

    console.log('[POST /api/artist-mappings] Mapping created successfully:', mapping)

    return NextResponse.json({ success: true, mapping })
  } catch (error: any) {
    console.error('[POST /api/artist-mappings] Error:', error)
    console.error('[POST /api/artist-mappings] Error stack:', error.stack)
    return NextResponse.json(
      { error: 'Failed to create mapping', details: error.message, stack: error.stack },
      { status: 500 }
    )
  }
}

// DELETE - Remove artist-to-user mapping
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { artistName } = body

    if (!artistName) {
      return NextResponse.json(
        { error: 'Artist name is required' },
        { status: 400 }
      )
    }

    const success = deleteArtistUserMapping(artistName)

    if (!success) {
      return NextResponse.json(
        { error: 'Mapping not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete artist mapping error:', error)
    return NextResponse.json(
      { error: 'Failed to delete mapping', details: error.message },
      { status: 500 }
    )
  }
}



