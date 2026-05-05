import { NextRequest, NextResponse } from 'next/server'
import { getCatalog, getUsers } from '@/lib/storage'
import { findTriggerReadySongs, flagTriggerReadySongs } from '@/lib/triggerReady'

/**
 * GET /api/trigger-ready?artistId=xxx
 * Find songs that match current readiness conditions
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const artistId = searchParams.get('artistId')

    if (!artistId) {
      return NextResponse.json(
        { error: 'Artist ID is required' },
        { status: 400 }
      )
    }

    // Get catalog and filter unreleased songs for this artist
    const catalog = getCatalog()
    const unreleasedSongs = catalog.filter(item => {
      const isUnreleased = item.isUnreleased === true || !item.releaseDate
      const belongsToArtist = item.artistId === artistId || 
                             (item.artistIds && item.artistIds.includes(artistId))
      return isUnreleased && belongsToArtist
    })

    // Find trigger-ready matches
    const matches = findTriggerReadySongs(artistId, unreleasedSongs)

    // Get artist info
    const users = getUsers()
    const artist = users.find(u => u.id === artistId)

    return NextResponse.json({
      success: true,
      artist: {
        id: artistId,
        name: artist?.artistName || artist?.name || 'Unknown',
      },
      matches,
      summary: {
        totalUnreleased: unreleasedSongs.length,
        triggerReady: matches.filter(m => m.matchScore >= 60 && m.recommendedAction === 'release_now').length,
        building: matches.filter(m => m.recommendedAction === 'build_momentum_first').length,
        waiting: matches.filter(m => m.recommendedAction === 'wait_for_better_timing').length,
      },
    })
  } catch (error: any) {
    console.error('Trigger-ready error:', error)
    return NextResponse.json(
      { error: 'Failed to find trigger-ready songs', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/trigger-ready/flag
 * Flag songs as trigger-ready (internal use)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { artistId } = body

    if (!artistId) {
      return NextResponse.json(
        { error: 'Artist ID is required' },
        { status: 400 }
      )
    }

    // Get unreleased songs
    const catalog = getCatalog()
    const unreleasedSongs = catalog.filter(item => {
      const isUnreleased = item.isUnreleased === true || !item.releaseDate
      const belongsToArtist = item.artistId === artistId || 
                             (item.artistIds && item.artistIds.includes(artistId))
      return isUnreleased && belongsToArtist
    })

    const result = flagTriggerReadySongs(artistId, unreleasedSongs)

    return NextResponse.json({
      success: true,
      flagged: result.flagged,
      matches: result.matches,
    })
  } catch (error: any) {
    console.error('Flag trigger-ready error:', error)
    return NextResponse.json(
      { error: 'Failed to flag trigger-ready songs', details: error.message },
      { status: 500 }
    )
  }
}
