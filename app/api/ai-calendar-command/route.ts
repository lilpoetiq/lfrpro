import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { resolveArtistName } from '@/lib/aiScheduleActions'
import {
  getLabelCalendarEvents,
  getUsers,
  getCatalog,
} from '@/lib/storage'

/** Collab rule: artist_post on date X + collab_post on same date = CONFLICT (collab = artist page + label page) */
function detectCollabConflicts(events: { date: string; artistId?: string; eventType: string; promotionTarget: string }[]): string[] {
  const conflicts: string[] = []
  const byDate = new Map<string, typeof events>()
  for (const e of events) {
    if (!byDate.has(e.date)) byDate.set(e.date, [])
    byDate.get(e.date)!.push(e)
  }
  for (const [date, dayEvents] of byDate) {
    const artistPosts = dayEvents.filter((e) => e.eventType === 'artist_post' || (e.promotionTarget === 'artist_page' && e.eventType !== 'label_post'))
    const collabPosts = dayEvents.filter((e) => e.eventType === 'collab_post' || e.promotionTarget === 'both')
    for (const collab of collabPosts) {
      if (collab.artistId && artistPosts.some((a) => a.artistId === collab.artistId)) {
        conflicts.push(`Collab conflict on ${date}: Artist has artist_page post same day as collab_post. Move one or convert to label_page only.`)
      }
    }
  }
  return conflicts
}

/** Double-book label page: more than one label_post or collab_post on same day */
function detectLabelDoubleBook(events: { date: string; eventType: string; promotionTarget: string }[]): string[] {
  const warnings: string[] = []
  const byDate = new Map<string, typeof events>()
  for (const e of events) {
    if (!byDate.has(e.date)) byDate.set(e.date, [])
    byDate.get(e.date)!.push(e)
  }
  for (const [date, dayEvents] of byDate) {
    const labelPosts = dayEvents.filter((e) => e.promotionTarget === 'label_page' || e.promotionTarget === 'both' || e.eventType === 'label_post' || e.eventType === 'collab_post')
    if (labelPosts.length > 1) {
      warnings.push(`Label page double-booked on ${date}: ${labelPosts.length} posts. Only one label feature per day.`)
    }
  }
  return warnings
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
    }
    const openai = new OpenAI({ apiKey })

    const body = await request.json()
    const { command, userId, conversationHistory } = body

    if (!command || typeof command !== 'string') {
      return NextResponse.json({ error: 'command is required' }, { status: 400 })
    }

    const historyMessages = Array.isArray(conversationHistory)
      ? conversationHistory.filter((m: any) => m?.role && m?.content)
      : []

    const users = getUsers()
    const artists = users.filter((u: any) => u.role === 'artist').map((a: any) => ({ id: a.id, name: a.name, artistName: a.artistName, username: a.username }))
    const catalog = getCatalog()
    const existingEvents = getLabelCalendarEvents()
    const today = new Date().toISOString().split('T')[0]

    const systemPrompt = `You are an AI scheduling assistant for Legendary Fyre Records label calendar.
Parse the user's natural language command and return a JSON object with this structure:
{
  "interpretation": "Brief summary of what you understood",
  "artists": [{"query": "paris", "artistId": "user_123", "artistName": "Paris Monroh"}],
  "actions": [
    {
      "action": "add_event",
      "date": "YYYY-MM-DD",
      "eventType": "artist_post|label_post|collab_post|release|promo|studio_session|meeting|deadline|event|content_due",
      "promotionTarget": "artist_page|label_page|both",
      "title": "string",
      "artistId": "optional",
      "songId": "optional",
      "notes": "optional",
      "frequency": "daily|every_other_day|weekly",
      "count": number
    }
  ],
  "suggestions": ["Suggestion 1", "Suggestion 2"],
  "clarifications": ["Question if ambiguous"]
}

RULES:
- artist_post = artist's own page only (promotionTarget: artist_page)
- label_post = label Instagram page only (promotionTarget: label_page)
- collab_post = BOTH artist page AND label page (promotionTarget: both). NEVER schedule collab_post same day as artist_post for that artist.
- "every other day" = frequency: every_other_day, count: 5-7
- "post often" = multiple artist_posts, balance across week
- "give them their own day" = assign unique label_post day per artist
- "move stuff around" = suggest rescheduling non-locked events to avoid conflicts
- Match artist names: paris→Paris Monroh, od→Od Sleep, 555→555wick, picasso→Picasso
- If name ambiguous, add to clarifications
- Never double-book label page (one label_post/collab per day)
- Existing events (locked): ${JSON.stringify(existingEvents.slice(0, 30))}
- Available artists: ${JSON.stringify(artists)}
- Today: ${today}`

    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
      ...historyMessages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: command },
    ]

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.3,
    })

    const raw = completion.choices[0]?.message?.content || '{}'
    let parsed: any
    try {
      parsed = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'AI returned invalid JSON', raw }, { status: 500 })
    }

    // Resolve artist names to IDs
    const resolvedArtists: { query: string; artistId: string; artistName: string }[] = []
    for (const a of parsed.artists || []) {
      const resolved = resolveArtistName(a.query || a.name, users)
      if (resolved) {
        resolvedArtists.push({ query: a.query || a.name, artistId: resolved.id, artistName: resolved.artistName || resolved.name })
      }
    }
    parsed.artists = resolvedArtists

    // Expand actions with resolved artistIds
    const expandedActions: any[] = []
    for (const act of parsed.actions || []) {
      let artistId = act.artistId
      if (!artistId && act.artistName) {
        const r = resolvedArtists.find((ra) => ra.artistName?.toLowerCase().includes((act.artistName || '').toLowerCase()))
        if (r) artistId = r.artistId
      }
      const count = act.count ?? 1
      const freq = act.frequency || 'daily'
      const startDate = act.date || today
      const dates: string[] = []
      const d = new Date(startDate)
      for (let i = 0; i < count; i++) {
        const copy = new Date(d)
        if (freq === 'every_other_day') copy.setDate(copy.getDate() + i * 2)
        else if (freq === 'weekly') copy.setDate(copy.getDate() + i * 7)
        else copy.setDate(copy.getDate() + i)
        dates.push(copy.toISOString().split('T')[0])
      }
      for (const date of dates) {
        expandedActions.push({
          ...act,
          date,
          artistId: artistId || act.artistId,
        })
      }
    }

    // Simulate conflicts on proposed events
    const proposed = expandedActions.map((a) => ({
      date: a.date,
      artistId: a.artistId,
      eventType: a.eventType,
      promotionTarget: a.promotionTarget || (a.eventType === 'collab_post' ? 'both' : a.eventType === 'label_post' ? 'label_page' : 'artist_page'),
    }))
    const allEvents = [...existingEvents.map((e) => ({ date: e.date, artistId: e.artistId, eventType: e.eventType, promotionTarget: e.promotionTarget })), ...proposed]
    const collabConflicts = detectCollabConflicts(allEvents)
    const labelConflicts = detectLabelDoubleBook(allEvents)

    const allSuggestions = [
      ...(parsed.suggestions || []),
      ...collabConflicts.map((c) => `⚠️ ${c}`),
      ...labelConflicts.map((c) => `⚠️ ${c}`),
    ]

    return NextResponse.json({
      success: true,
      interpretation: parsed.interpretation,
      artists: parsed.artists,
      actions: expandedActions,
      suggestions: allSuggestions,
      clarifications: parsed.clarifications || [],
      conflicts: [...collabConflicts, ...labelConflicts],
      preview: true,
    })
  } catch (error: any) {
    console.error('AI calendar command error:', error)
    return NextResponse.json(
      { error: 'Failed to parse command', details: error.message },
      { status: 500 }
    )
  }
}
