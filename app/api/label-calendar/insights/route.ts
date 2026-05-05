import { NextRequest, NextResponse } from 'next/server'
import {
  getLabelCalendarEvents,
  getTasks,
  getCatalog,
  getUsers,
} from '@/lib/storage'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30', 10)
    const today = new Date()
    const start = new Date(today)
    start.setDate(start.getDate() - 7)
    const end = new Date(today)
    end.setDate(end.getDate() + days)
    const startStr = start.toISOString().split('T')[0]
    const endStr = end.toISOString().split('T')[0]

    const events = getLabelCalendarEvents(startStr, endStr)
    const tasks = getTasks().filter((t) => t.dueDate && !t.completed)
    const catalog = getCatalog()
    const users = getUsers()
    const todayStr = today.toISOString().split('T')[0]

    const suggestions: string[] = []
    const needsAttention: string[] = []

    // Collab conflict: artist_post + collab_post same day same artist
    const byDate = new Map<string, typeof events>()
    for (const e of events) {
      if (!byDate.has(e.date)) byDate.set(e.date, [])
      byDate.get(e.date)!.push(e)
    }
    for (const [date, dayEvents] of byDate) {
      const artistPosts = dayEvents.filter((e) => e.promotionTarget === 'artist_page' || e.eventType === 'artist_post')
      const collabs = dayEvents.filter((e) => e.eventType === 'collab_post' || e.promotionTarget === 'both')
      for (const c of collabs) {
        if (c.artistId && artistPosts.some((a) => a.artistId === c.artistId)) {
          const artist = users.find((u: any) => u.id === c.artistId)
          suggestions.push(`⚠️ Collab conflict on ${date}: ${artist?.artistName || artist?.name || 'Artist'} has artist post same day as collab. Move one or convert to label_page only.`)
        }
      }
      const labelPosts = dayEvents.filter((e) => e.promotionTarget === 'label_page' || e.promotionTarget === 'both' || e.eventType === 'label_post' || e.eventType === 'collab_post')
      if (labelPosts.length > 1) {
        suggestions.push(`⚠️ Label page double-booked on ${date}: ${labelPosts.length} posts. Only one label feature per day.`)
      }
    }

    // Artist overexposure: same artist on label page 4+ times in a week
    const weekStart = new Date(today)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    for (let w = 0; w < 4; w++) {
      const ws = new Date(weekStart)
      ws.setDate(ws.getDate() + w * 7)
      const we = new Date(ws)
      we.setDate(we.getDate() + 6)
      const wsStr = ws.toISOString().split('T')[0]
      const weStr = we.toISOString().split('T')[0]
      const weekEvents = events.filter((e) => e.date >= wsStr && e.date <= weStr && (e.promotionTarget === 'label_page' || e.promotionTarget === 'both'))
      const byArtist = new Map<string, number>()
      for (const e of weekEvents) {
        if (e.artistId) {
          byArtist.set(e.artistId, (byArtist.get(e.artistId) || 0) + 1)
        }
      }
      for (const [aid, count] of byArtist) {
        if (count >= 4) {
          const artist = users.find((u: any) => u.id === aid)
          suggestions.push(`📊 ${artist?.artistName || artist?.name || 'Artist'} is scheduled ${count}x this week on label page. Consider rotating.`)
        }
      }
    }

    // First empty label day in next 14 days
    for (let i = 1; i <= 14; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      const dStr = d.toISOString().split('T')[0]
      const hasLabel = events.some((e) => e.date === dStr && (e.promotionTarget === 'label_page' || e.promotionTarget === 'both'))
      if (!hasLabel) {
        suggestions.push(`📅 Empty label day: ${dStr}. Consider scheduling a post.`)
        break
      }
    }

    // Needs attention
    const todayTasks = tasks.filter((t) => t.dueDate && t.dueDate.startsWith(todayStr))
    if (todayTasks.length > 0) {
      needsAttention.push(`📌 ${todayTasks.length} task(s) due today`)
    }
    const upcomingTasks = tasks.filter((t) => {
      if (!t.dueDate) return false
      const due = new Date(t.dueDate)
      const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return diff > 0 && diff <= 3
    })
    if (upcomingTasks.length > 0) {
      needsAttention.push(`⏰ ${upcomingTasks.length} task(s) due in next 3 days`)
    }
    const postsNoMedia = events.filter((e) => (e.eventType === 'artist_post' || e.eventType === 'label_post' || e.eventType === 'collab_post') && !e.linkedMediaUrl && !e.linkedDriveUrl && e.date >= todayStr)
    const next48 = new Date(today)
    next48.setHours(next48.getHours() + 48)
    const next48Str = next48.toISOString().split('T')[0]
    const unlockedSoon = events.filter((e) => !e.locked && e.date >= todayStr && e.date <= next48Str && (e.eventType === 'artist_post' || e.eventType === 'label_post' || e.eventType === 'collab_post'))
    if (unlockedSoon.length > 0) {
      needsAttention.push(`🔓 ${unlockedSoon.length} post(s) in next 48h without media attached`)
    }
    const studioToday = events.filter((e) => e.eventType === 'studio_session' && e.date === todayStr)
    if (studioToday.length > 0) {
      needsAttention.push(`🎙 ${studioToday.length} studio session(s) today`)
    }

    return NextResponse.json({
      success: true,
      suggestions,
      needsAttention,
    })
  } catch (error: any) {
    console.error('Label calendar insights error:', error)
    return NextResponse.json(
      { error: 'Failed to get insights', details: error.message },
      { status: 500 }
    )
  }
}
