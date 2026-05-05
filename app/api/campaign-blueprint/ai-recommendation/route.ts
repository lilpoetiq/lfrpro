import { NextRequest, NextResponse } from 'next/server'
import { getCatalog, getLabelCalendarEvents, getUsers, computeCampaignStatus } from '@/lib/storage'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'

/** POST: Generate AI campaign recommendation from a past example */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { songId, exampleSongId } = body

    if (!songId || !exampleSongId) {
      return NextResponse.json({ error: 'songId and exampleSongId required' }, { status: 400 })
    }

    const catalog = getCatalog()
    const events = getLabelCalendarEvents(undefined, undefined, exampleSongId)

    const targetSong = catalog.find((c: any) => c.id === songId)
    const exampleSong = catalog.find((c: any) => c.id === exampleSongId)

    if (!targetSong || !exampleSong) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI not configured' }, { status: 503 })
    }
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const eventSummary = events
      .sort((a: any, b: any) => a.date.localeCompare(b.date))
      .map((e: any) => `- ${e.date}: ${e.eventType} - ${e.title}${e.notes ? ` (${e.notes})` : ''}`)
      .join('\n')

    const outcome = exampleSong.campaignOutcome || 'average'
    const isWeak = outcome === 'weak'

    const systemPrompt = `You are a music campaign strategist. Generate a structured campaign recommendation based on a past campaign example.
Format your response as valid JSON with this structure:
{
  "exampleBasedOn": "Song Title",
  "releaseDate": "YYYY-MM-DD",
  "totalStreamsMonth1": number,
  "engagementRate": "string or null",
  "whatWorked": ["string"],
  "whatHurt": ["string"],
  "recommendationForNewRelease": ["string"],
  "whatFailed": ["string"] (only if outcome was weak),
  "avoidThisBy": ["string"] (only if outcome was weak),
  "warning": "string or null" (only if outcome was weak: "Use as learning example only.")
}

Be specific and actionable. Use real data from the example when available.`

    const userPrompt = `Target song (upcoming): ${targetSong.song} by ${targetSong.artist}
Release type: ${targetSong.releaseType || 'single'}

Example campaign (past): ${exampleSong.song} by ${exampleSong.artist}
Release date: ${exampleSong.releaseDate || 'N/A'}
Campaign outcome: ${outcome}
Campaign score: ${exampleSong.campaignScore ?? 'N/A'}/10
Total streams: ${exampleSong.totalStreams ?? 0}
Month 1 streams: ${exampleSong.performanceMetrics?.month1Streams ?? 'N/A'}
Engagement: ${exampleSong.performanceMetrics?.engagementPercent ?? 'N/A'}%
Best posting day: ${exampleSong.performanceMetrics?.bestPostingDay ?? 'N/A'}
Top content: ${exampleSong.performanceMetrics?.topPerformingContent ?? 'N/A'}

Campaign summary: ${exampleSong.campaignSummary || 'N/A'}
Lessons learned: ${exampleSong.lessonsLearned || 'N/A'}
Strategy to repeat: ${exampleSong.strategyToRepeat || 'N/A'}
Strategy to avoid: ${exampleSong.strategyToAvoid || 'N/A'}
Campaign wins: ${exampleSong.campaignWins || 'N/A'}

Calendar events for example:
${eventSummary || 'No events'}

${isWeak ? 'This was a WEAK campaign. Focus on what failed and what to avoid.' : ''}

Generate the recommendation JSON.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
    })

    const content = completion.choices[0]?.message?.content || '{}'
    let parsed: any
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : '{}')
    } catch {
      parsed = { raw: content }
    }

    return NextResponse.json({
      success: true,
      recommendation: parsed,
      exampleSong: {
        id: exampleSong.id,
        song: exampleSong.song,
        artist: exampleSong.artist,
        campaignOutcome: outcome,
      },
    })
  } catch (error: any) {
    console.error('AI recommendation error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
