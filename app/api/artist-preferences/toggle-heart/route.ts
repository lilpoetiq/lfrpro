import { NextRequest, NextResponse } from 'next/server'
import { getUserById, updateUser } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { artistId, beatId } = body

    if (!artistId || !beatId) {
      return NextResponse.json({ error: 'Artist ID and beat ID required' }, { status: 400 })
    }

    const user = getUserById(artistId)
    if (!user) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
    }

    const favoriteBeats = user.favoriteBeats || []
    const isHearted = favoriteBeats.includes(beatId)

    if (isHearted) {
      // Remove from favorites
      const updatedFavorites = favoriteBeats.filter(id => id !== beatId)
      updateUser(artistId, { favoriteBeats: updatedFavorites })
      return NextResponse.json({ success: true, hearted: false })
    } else {
      // Add to favorites
      const updatedFavorites = [...favoriteBeats, beatId]
      updateUser(artistId, { favoriteBeats: updatedFavorites })
      return NextResponse.json({ success: true, hearted: true })
    }
  } catch (error: any) {
    console.error('Failed to toggle heart:', error)
    return NextResponse.json({ error: error.message || 'Failed to toggle heart' }, { status: 500 })
  }
}
