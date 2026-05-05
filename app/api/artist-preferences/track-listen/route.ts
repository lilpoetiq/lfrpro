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

    const listenHistory = user.beatListenHistory || []
    // Check if already listened (within last 30 days to avoid duplicates)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const alreadyListened = listenHistory.some(
      entry => entry.beatId === beatId && entry.listenedAt > thirtyDaysAgo
    )
    
    if (!alreadyListened) {
      listenHistory.push({
        beatId,
        listenedAt: new Date().toISOString(),
      })
      updateUser(artistId, { beatListenHistory: listenHistory })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to track listen:', error)
    return NextResponse.json({ error: error.message || 'Failed to track listen' }, { status: 500 })
  }
}
