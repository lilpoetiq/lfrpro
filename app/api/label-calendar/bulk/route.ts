import { NextRequest, NextResponse } from 'next/server'
import { addLabelCalendarEvent } from '@/lib/storage'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { events, createdBy = 'user', userId } = body

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'events array is required' }, { status: 400 })
    }

    const created: any[] = []
    const errors: string[] = []

    for (const e of events) {
      try {
        const date = (e.date || '').includes('T') ? e.date.split('T')[0] : e.date
        if (!date || !e.eventType || !e.promotionTarget || !e.title) {
          errors.push(`Invalid event: missing date, eventType, promotionTarget, or title`)
          continue
        }
        const event = addLabelCalendarEvent({
          date,
          scheduledTime: e.scheduledTime || undefined,
          artistId: e.artistId || undefined,
          songId: e.songId || undefined,
          productType: e.productType || undefined,
          contentType: e.contentType || undefined,
          vaultVideoId: e.vaultVideoId || undefined,
          rolloutPhase: e.rolloutPhase || undefined,
          eventType: e.eventType,
          promotionTarget: e.promotionTarget,
          title: e.title,
          linkedMediaUrl: e.linkedMediaUrl,
          linkedSnippetUrl: e.linkedSnippetUrl,
          linkedDriveUrl: e.linkedDriveUrl,
          notes: e.notes,
          status: e.status || 'scheduled',
          locked: e.locked ?? false,
          createdBy: e.createdBy || createdBy,
          userId: e.userId || userId,
        })
        created.push(event)
      } catch (err: any) {
        errors.push(`${e.title || 'Event'}: ${err.message || 'Failed'}`)
      }
    }

    return NextResponse.json({
      success: true,
      created: created.length,
      events: created,
      errors: errors.length ? errors : undefined,
    })
  } catch (error: any) {
    console.error('Bulk add label calendar error:', error)
    return NextResponse.json(
      { error: 'Failed to add events', details: error.message },
      { status: 500 }
    )
  }
}
