import { NextRequest, NextResponse } from 'next/server'
import { getUsers, getUserById, updateUser } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const artistId = searchParams.get('artistId')

    if (!artistId) {
      return NextResponse.json({ error: 'Artist ID required' }, { status: 400 })
    }

    const user = getUserById(artistId)
    if (!user) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      preferredGenres: user.preferredGenres || [],
      preferredMoods: user.preferredMoods || [],
      listenHistory: user.beatListenHistory || [],
      favoriteBeats: user.favoriteBeats || [],
    })
  } catch (error: any) {
    console.error('Failed to fetch artist preferences:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch preferences' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { artistId, genres, moods } = body

    if (!artistId) {
      return NextResponse.json({ error: 'Artist ID required' }, { status: 400 })
    }

    const user = getUserById(artistId)
    if (!user) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
    }

    const updates: any = {}
    if (genres !== undefined) {
      updates.preferredGenres = genres
    }
    if (moods !== undefined) {
      updates.preferredMoods = moods
    }

    updateUser(artistId, updates)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to update artist preferences:', error)
    return NextResponse.json({ error: error.message || 'Failed to update preferences' }, { status: 500 })
  }
}
