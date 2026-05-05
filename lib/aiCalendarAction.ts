/**
 * AI action handler for adding personal calendar events.
 * Import and add to your ai-actions route switch:
 *
 * case 'add_calendar_event':
 *   return await handleAddCalendarEvent(params)
 */

import { NextResponse } from 'next/server'
import { addPersonalCalendarEvent, getUsers } from '@/lib/storage'

export async function handleAddCalendarEvent(params: {
  userId: string
  title: string
  date: string
  time?: string
  description?: string
  userName?: string
}) {
  const { userId, title, date, time, description } = params

  if (!userId || !title || !date) {
    return NextResponse.json(
      { error: 'userId, title, and date are required' },
      { status: 400 }
    )
  }

  const users = getUsers()
  const user = users.find((u) => u.id === userId)
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const event = addPersonalCalendarEvent({
    userId,
    title: String(title).trim(),
    date: String(date).trim(),
    time: time ? String(time).trim() : undefined,
    description: description ? String(description).trim() : undefined,
  })

  return NextResponse.json({
    success: true,
    message: `Added "${event.title}" to your calendar for ${event.date}${event.time ? ` at ${event.time}` : ''}`,
    event,
  })
}
