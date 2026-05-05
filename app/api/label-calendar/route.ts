import { NextRequest, NextResponse } from 'next/server'
import {
  getLabelCalendarEvents,
  addLabelCalendarEvent,
  updateLabelCalendarEvent,
  deleteLabelCalendarEvent,
  getCatalog,
  getUsers,
} from '@/lib/storage'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined
    const songId = searchParams.get('songId') || undefined

    const events = getLabelCalendarEvents(startDate, endDate, songId)
    const catalog = getCatalog()
    const users = getUsers()

    const enriched = events.map((e) => {
      const artist = e.artistId ? users.find((u: any) => u.id === e.artistId) : null
      const song = e.songId ? catalog.find((c: any) => c.id === e.songId) : null
      return {
        ...e,
        artistName: artist?.artistName || artist?.name,
        songTitle: song?.song,
      }
    })

    return NextResponse.json({ success: true, events: enriched })
  } catch (error: any) {
    console.error('Get label calendar error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch label calendar', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      date,
      scheduledTime,
      artistId,
      songId,
      productType,
      contentType,
      vaultVideoId,
      rolloutPhase,
      eventType,
      promotionTarget,
      title,
      linkedMediaUrl,
      linkedSnippetUrl,
      linkedDriveUrl,
      notes,
      status,
      locked,
      createdBy,
      userId,
    } = body

    if (!date || !eventType || !promotionTarget || !title) {
      return NextResponse.json(
        { error: 'date, eventType, promotionTarget, and title are required' },
        { status: 400 }
      )
    }

    const event = addLabelCalendarEvent({
      date: date.includes('T') ? date.split('T')[0] : date,
      scheduledTime: scheduledTime || undefined,
      artistId: artistId || undefined,
      songId: songId || undefined,
      productType: productType || undefined,
      contentType: contentType || undefined,
      vaultVideoId: vaultVideoId || undefined,
      rolloutPhase: rolloutPhase || undefined,
      eventType,
      promotionTarget,
      title,
      linkedMediaUrl: linkedMediaUrl || undefined,
      linkedSnippetUrl: linkedSnippetUrl || undefined,
      linkedDriveUrl: linkedDriveUrl || undefined,
      notes: notes || undefined,
      status: status || 'scheduled',
      locked: locked ?? false,
      createdBy: createdBy || 'user',
      userId: userId || undefined,
    })

    return NextResponse.json({ success: true, event })
  } catch (error: any) {
    console.error('Add label calendar event error:', error)
    return NextResponse.json(
      { error: 'Failed to add event', details: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const event = updateLabelCalendarEvent(id, updates)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, event })
  } catch (error: any) {
    console.error('Update label calendar error:', error)
    return NextResponse.json(
      { error: 'Failed to update event', details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const deleted = deleteLabelCalendarEvent(id)
    if (!deleted) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete label calendar error:', error)
    return NextResponse.json(
      { error: 'Failed to delete event', details: error.message },
      { status: 500 }
    )
  }
}
