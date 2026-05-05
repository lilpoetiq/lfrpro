/**
 * AI action handlers for complex scheduling: artist lookup, content calendar,
 * bulk scheduling, label page posts. Supports slang and fuzzy artist name matching.
 */

import { NextResponse } from 'next/server'
import {
  getUsers,
  getCatalog,
  getContentCalendar,
  addContentCalendar,
  addPersonalCalendarEvent,
  addTask,
} from '@/lib/storage'

/** Fuzzy match artist name to user. Handles "paris"→Paris Monroh, "od"→Od Sleep, "555"→555wick */
export function resolveArtistName(
  query: string,
  users?: { id: string; name?: string; artistName?: string; username?: string; email?: string; aliases?: string[] }[]
): { id: string; name: string; artistName?: string } | null {
  const list = users || getUsers()
  const artists = list.filter((u: any) => u.role === 'artist')
  if (artists.length === 0) return null

  const q = (query || '').toLowerCase().trim()
  if (!q) return null

  const normalize = (s: string) => (s || '').toLowerCase().trim()
  const fields = (u: any) => [
    u.name,
    u.artistName,
    u.username,
    (u.email || '').split('@')[0],
    ...(Array.isArray(u.aliases) ? u.aliases : []),
  ].filter(Boolean).map(normalize)

  // Exact match
  for (const u of artists) {
    for (const f of fields(u)) {
      if (f === q) return { id: u.id, name: u.name || u.artistName || u.username || '', artistName: u.artistName }
    }
  }

  // Starts-with
  for (const u of artists) {
    for (const f of fields(u)) {
      if (f.startsWith(q) || q.startsWith(f)) return { id: u.id, name: u.name || u.artistName || u.username || '', artistName: u.artistName }
    }
  }

  // Contains
  for (const u of artists) {
    for (const f of fields(u)) {
      if (f.includes(q) || q.includes(f)) return { id: u.id, name: u.name || u.artistName || u.username || '', artistName: u.artistName }
    }
  }

  // Word match (e.g. "od" in "Od Sleep")
  const qWords = q.split(/\s+/)
  for (const u of artists) {
    for (const f of fields(u)) {
      const fWords = f.split(/\s+/)
      if (qWords.some((w) => fWords.some((fw) => fw.startsWith(w) || w.startsWith(fw))))
        return { id: u.id, name: u.name || u.artistName || u.username || '', artistName: u.artistName }
    }
  }

  return null
}

/** Find artist(s) by name - fuzzy match. AI calls this to resolve "paris", "od", etc. */
export async function handleFindArtist(params: {
  name?: string
  names?: string[]
}): Promise<NextResponse> {
  const { name, names } = params
  const queries = names && Array.isArray(names) ? names : name ? [name] : []
  if (queries.length === 0) {
    return NextResponse.json({ error: 'name or names array required' }, { status: 400 })
  }

  const users = getUsers()
  const artists = users.filter((u: any) => u.role === 'artist')
  const results: { query: string; artist?: { id: string; name: string; artistName?: string }; error?: string }[] = []

  for (const q of queries) {
    const resolved = resolveArtistName(q, users)
    if (resolved) {
      results.push({ query: q, artist: resolved })
    } else {
      results.push({
        query: q,
        error: `No artist found matching "${q}". Available: ${artists.map((a: any) => a.artistName || a.name || a.username).filter(Boolean).join(', ')}`,
      })
    }
  }

  return NextResponse.json({
    success: true,
    artists: results.filter((r) => r.artist).map((r) => r.artist),
    unresolved: results.filter((r) => r.error).map((r) => ({ query: r.query, error: r.error })),
    allArtists: artists.map((a: any) => ({ id: a.id, name: a.name, artistName: a.artistName, username: a.username })),
  })
}

/** Get artist schedule: catalog releases + content calendar */
export async function handleGetArtistSchedule(params: {
  artistId?: string
  artistName?: string
  startDate?: string
  endDate?: string
}): Promise<NextResponse> {
  const { artistId, artistName, startDate, endDate } = params
  let resolvedId = artistId

  if (!resolvedId && artistName) {
    const resolved = resolveArtistName(artistName)
    if (!resolved) {
      return NextResponse.json({ error: `Artist not found: ${artistName}` }, { status: 404 })
    }
    resolvedId = resolved.id
  }

  if (!resolvedId) {
    return NextResponse.json({ error: 'artistId or artistName required' }, { status: 400 })
  }

  const catalog = getCatalog()
  const releases = catalog
    .filter((c: any) => c.artistId === resolvedId || (c.artistIds && c.artistIds.includes(resolvedId)))
    .filter((c: any) => c.releaseDate || c.releaseDateRequested)
    .map((c: any) => ({
      type: 'release',
      song: c.song,
      artist: c.artist,
      date: (c.releaseDate || c.releaseDateRequested || '').split('T')[0],
      status: c.releaseApprovalStatus,
    }))
    .sort((a: any, b: any) => a.date.localeCompare(b.date))

  const content = getContentCalendar(resolvedId, startDate, endDate).map((c: any) => ({
    type: 'content',
    title: c.title,
    date: (c.scheduledDate || '').split('T')[0],
    platform: c.platform,
    contentType: c.contentType,
    status: c.status,
  }))

  const users = getUsers()
  const artist = users.find((u: any) => u.id === resolvedId)

  return NextResponse.json({
    success: true,
    artistId: resolvedId,
    artistName: artist?.artistName || artist?.name,
    releases,
    contentCalendar: content,
    schedule: [...releases, ...content].sort((a: any, b: any) => (a.date || '').localeCompare(b.date || '')),
  })
}

/** Add content calendar item */
export async function handleAddContentCalendar(params: {
  artistId?: string
  artistName?: string
  scheduledDate: string
  platform?: 'instagram' | 'tiktok' | 'both'
  contentType?: 'reel' | 'post' | 'story' | 'carousel' | 'video'
  title: string
  description?: string
}): Promise<NextResponse> {
  const { artistId, artistName, scheduledDate, platform, contentType, title, description } = params

  let resolvedId = artistId
  if (!resolvedId && artistName) {
    const resolved = resolveArtistName(artistName)
    if (!resolved) return NextResponse.json({ error: `Artist not found: ${artistName}` }, { status: 404 })
    resolvedId = resolved.id
  }
  if (!resolvedId) return NextResponse.json({ error: 'artistId or artistName required' }, { status: 400 })
  if (!scheduledDate || !title) return NextResponse.json({ error: 'scheduledDate and title required' }, { status: 400 })

  const dateStr = scheduledDate.includes('T') ? scheduledDate.split('T')[0] : scheduledDate
  const item = addContentCalendar({
    artistId: resolvedId,
    scheduledDate: dateStr + 'T12:00:00.000Z',
    platform: platform || 'both',
    contentType: contentType || 'video',
    title: title.trim(),
    description: description?.trim(),
    status: 'scheduled',
  })

  return NextResponse.json({ success: true, message: `Added "${title}" to content calendar for ${dateStr}`, item })
}

/** Add label Instagram post (stored as personal calendar event for userId) */
export async function handleAddLabelInstagramPost(params: {
  userId: string
  artistName: string
  scheduledDate: string
  notes?: string
}): Promise<NextResponse> {
  const { userId, artistName, scheduledDate, notes } = params
  if (!userId || !artistName || !scheduledDate) {
    return NextResponse.json({ error: 'userId, artistName, scheduledDate required' }, { status: 400 })
  }

  const dateStr = scheduledDate.includes('T') ? scheduledDate.split('T')[0] : scheduledDate
  const title = `Label IG: ${artistName}${notes ? ` — ${notes}` : ''}`
  const event = addPersonalCalendarEvent({
    userId,
    title,
    date: dateStr,
    description: `Post ${artistName} on label Instagram page`,
  })

  return NextResponse.json({
    success: true,
    message: `Scheduled label Instagram post for ${artistName} on ${dateStr}`,
    event,
  })
}

/** Expand dates by frequency (every other day, daily, weekly) */
function expandDates(startDate: string, frequency: string, count: number): string[] {
  const dates: string[] = []
  const d = new Date(startDate)
  const base = d.toISOString().split('T')[0]

  for (let i = 0; i < count; i++) {
    const copy = new Date(d)
    if (frequency === 'daily') copy.setDate(copy.getDate() + i)
    else if (frequency === 'every_other_day') copy.setDate(copy.getDate() + i * 2)
    else if (frequency === 'weekly') copy.setDate(copy.getDate() + i * 7)
    else copy.setDate(copy.getDate() + i)
    dates.push(copy.toISOString().split('T')[0])
  }
  return dates
}

/** Bulk schedule: multiple artists, content rules, label posts. AI parses and calls this. */
export async function handleScheduleBulk(params: {
  userId: string
  items: Array<{
    type: 'content' | 'calendar' | 'task' | 'label_post'
    artistId?: string
    artistName?: string
    title: string
    date: string
    time?: string
    platform?: 'instagram' | 'tiktok' | 'both'
    contentType?: 'reel' | 'post' | 'story' | 'carousel' | 'video'
    description?: string
    frequency?: 'daily' | 'every_other_day' | 'weekly'
    count?: number
  }>
}): Promise<NextResponse> {
  const { userId, items } = params
  if (!userId || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'userId and items array required' }, { status: 400 })
  }

  const users = getUsers()
  const created: { type: string; title: string; date: string }[] = []
  const errors: string[] = []

  for (const item of items) {
    try {
      let artistId = item.artistId
      if (!artistId && item.artistName) {
        const resolved = resolveArtistName(item.artistName, users)
        if (!resolved) {
          errors.push(`Artist not found: ${item.artistName}`)
          continue
        }
        artistId = resolved.id
      }

      const startDate = (item.date || '').includes('T') ? item.date.split('T')[0] : item.date
      const freq = item.frequency || 'daily'
      const count = item.count ?? 1
      const dates = count > 1 ? expandDates(startDate, freq, count) : [startDate]

      for (const dateStr of dates) {
        if (item.type === 'content' && artistId) {
          addContentCalendar({
            artistId,
            scheduledDate: dateStr + 'T12:00:00.000Z',
            platform: item.platform || 'both',
            contentType: item.contentType || 'video',
            title: item.title,
            description: item.description,
            status: 'scheduled',
          })
          created.push({ type: 'content', title: item.title, date: dateStr })
        } else if (item.type === 'calendar') {
          addPersonalCalendarEvent({
            userId,
            title: item.title,
            date: dateStr,
            time: item.time,
            description: item.description,
          })
          created.push({ type: 'calendar', title: item.title, date: dateStr })
        } else if (item.type === 'label_post' && item.artistName) {
          addPersonalCalendarEvent({
            userId,
            title: `Label IG: ${item.artistName}`,
            date: dateStr,
            description: item.description || `Post ${item.artistName} on label Instagram`,
          })
          created.push({ type: 'label_post', title: `Label IG: ${item.artistName}`, date: dateStr })
        } else if (item.type === 'task' && artistId && dates.indexOf(dateStr) === 0) {
          const artist = users.find((u: any) => u.id === artistId)
          const assigner = users.find((u: any) => u.id === userId)
          addTask({
            title: item.title,
            description: item.description || '',
            assignedTo: artistId,
            assignedToName: artist?.artistName || artist?.name || 'Unknown',
            assignedBy: userId,
            assignedByName: assigner?.artistName || assigner?.name || 'System',
            dueDate: dateStr + 'T17:00:00.000Z',
            category: 'content',
            status: 'pending',
            completed: false,
          })
          created.push({ type: 'task', title: item.title, date: dateStr })
        }
      }
    } catch (e: any) {
      errors.push(`${item.title}: ${e.message || 'Failed'}`)
    }
  }

  return NextResponse.json({
    success: true,
    created: created.length,
    items: created,
    errors: errors.length ? errors : undefined,
  })
}
