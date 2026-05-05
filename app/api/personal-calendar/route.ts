import { NextRequest, NextResponse } from 'next/server'
import {
  getPersonalCalendarEvents,
  addPersonalCalendarEvent,
  updatePersonalCalendarEvent,
  deletePersonalCalendarEvent,
} from '@/lib/storage'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const events = getPersonalCalendarEvents(userId, startDate, endDate)
    return NextResponse.json({ success: true, events })
  } catch (error: any) {
    console.error('Get personal calendar error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch calendar events', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, title, date, time, description, notifyAt } = body

    if (!userId || !title || !date) {
      return NextResponse.json(
        { error: 'userId, title, and date are required' },
        { status: 400 }
      )
    }

    const event = addPersonalCalendarEvent({
      userId,
      title: String(title).trim(),
      date: String(date).trim(),
      time: time ? String(time).trim() : undefined,
      description: description ? String(description).trim() : undefined,
      notifyAt: notifyAt ? String(notifyAt).trim() : undefined,
    })

    return NextResponse.json({ success: true, event })
  } catch (error: any) {
    console.error('Add personal calendar event error:', error)
    return NextResponse.json(
      { error: 'Failed to add event', details: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, userId, title, date, time, description, notifyAt } = body

    if (!id || !userId) {
      return NextResponse.json({ error: 'id and userId are required' }, { status: 400 })
    }

    const updates: Record<string, any> = {}
    if (title !== undefined) updates.title = String(title).trim()
    if (date !== undefined) updates.date = String(date).trim()
    if (time !== undefined) updates.time = time ? String(time).trim() : undefined
    if (description !== undefined) updates.description = description ? String(description).trim() : undefined
    if (notifyAt !== undefined) updates.notifyAt = notifyAt ? String(notifyAt).trim() : undefined

    const event = updatePersonalCalendarEvent(id, userId, updates)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, event })
  } catch (error: any) {
    console.error('Update personal calendar event error:', error)
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
    const userId = searchParams.get('userId')

    if (!id || !userId) {
      return NextResponse.json({ error: 'id and userId are required' }, { status: 400 })
    }

    const deleted = deletePersonalCalendarEvent(id, userId)
    if (!deleted) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete personal calendar event error:', error)
    return NextResponse.json(
      { error: 'Failed to delete event', details: error.message },
      { status: 500 }
    )
  }
}
