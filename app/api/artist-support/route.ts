import { NextRequest, NextResponse } from 'next/server'
import { getUsers } from '@/lib/storage'
import { logActivity } from '@/lib/activityLog'
import { notifyArtistQuestion } from '@/lib/aiNotifications'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      question, 
      userId, 
      songId, 
      context, 
      category, 
      urgency 
    } = body

    // Validation
    if (!question || !question.trim()) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Get user info
    const users = getUsers()
    const user = users.find(u => u.id === userId)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get song info if songId is provided
    let songName: string | undefined = undefined
    if (songId) {
      const { getCatalog } = await import('@/lib/storage')
      const catalog = getCatalog()
      const song = catalog.find(s => s.id === songId)
      if (song) {
        songName = song.song
      }
    }

    // Determine context if not provided
    const finalContext = context || 'General Support'
    const finalCategory = category || 'general'
    const finalUrgency = urgency || 'high' // Questions are usually high priority

    // Log activity
    logActivity({
      action: 'Artist Support Question',
      user: user.name,
      userId: userId,
      category: 'chat',
      details: {
        question: question.trim(),
        context: finalContext,
        category: finalCategory,
        urgency: finalUrgency,
        songId: songId || undefined,
        songName: songName || undefined,
      },
    })

    // Notify AI server for SMS notifications
    try {
      await notifyArtistQuestion({
        question: question.trim(),
        artistName: user.artistName || user.name,
        artistId: userId,
        userName: user.name,
        songName: songName,
        songId: songId,
        context: finalContext,
        category: finalCategory as 'release' | 'catalog' | 'checklist' | 'technical' | 'general',
        urgency: finalUrgency as 'low' | 'medium' | 'high' | 'urgent',
        contactMethod: 'both', // Default to both email and SMS
      })
      console.log('[ARTIST SUPPORT] Successfully notified AI server of question')
    } catch (error) {
      console.error('[ARTIST SUPPORT] Error notifying AI server (non-critical):', error)
      // Continue - don't fail the request if AI notification fails
    }

    return NextResponse.json({
      success: true,
      message: 'Your question has been submitted. Our team will get back to you soon.',
    })
  } catch (error: any) {
    console.error('Artist support question error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to submit question', 
        details: error.message || 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

