import { NextRequest, NextResponse } from 'next/server'
import { getCatalog, getLabelCalendarEvents, getUsers, computeCampaignStatus } from '@/lib/storage'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'

/** POST: Answer strategic question about a campaign using its data */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { songId, question } = body

    if (!songId || !question?.trim()) {
      return NextResponse.json({ error: 'songId and question required' }, { status: 400 })
    }

    const catalog = getCatalog()
    const events = getLabelCalendarEvents(undefined, undefined, songId)

    const song = catalog.find((c: any) => c.id === songId)
    if (!song) return NextResponse.json({ error: 'Song not found' }, { status: 404 })

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI not configured' }, { status: 503 })
    }
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const eventSummary = events
      .sort((a: any, b: any) => a.date.localeCompare(b.date))
      .map((e: any) => `- ${e.date}: ${e.eventType} - ${e.title}`)
      .join('\n')

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a music campaign strategist. Answer questions about this campaign using ONLY the data provided. Be specific and actionable. If the data doesn't support an answer, say so. Keep responses concise (2-4 paragraphs max).`,
        },
        {
          role: 'user',
          content: `Campaign: ${song.song} by ${song.artist}
Release date: ${song.releaseDate || 'N/A'}
Release type: ${song.releaseType || 'single'}
Status: ${computeCampaignStatus(song)}

Total streams: ${song.totalStreams ?? 0}
Week 1: ${song.performanceMetrics?.week1Streams ?? 'N/A'}
Month 1: ${song.performanceMetrics?.month1Streams ?? 'N/A'}
Engagement: ${song.performanceMetrics?.engagementPercent ?? 'N/A'}%
Best posting day: ${song.performanceMetrics?.bestPostingDay ?? 'N/A'}
Top content: ${song.performanceMetrics?.topPerformingContent ?? 'N/A'}

Campaign score: ${song.campaignScore ?? 'N/A'}/10
Outcome: ${song.campaignOutcome ?? 'N/A'}
Summary: ${song.campaignSummary || 'N/A'}
Lessons: ${song.lessonsLearned || 'N/A'}
Strategy to repeat: ${song.strategyToRepeat || 'N/A'}
Strategy to avoid: ${song.strategyToAvoid || 'N/A'}
Campaign wins: ${song.campaignWins || 'N/A'}

Calendar events:
${eventSummary || 'No events'}

Question: ${question.trim()}`,
        },
      ],
      temperature: 0.4,
    })

    const answer = completion.choices[0]?.message?.content || 'No response generated.'

    return NextResponse.json({ success: true, answer })
  } catch (error: any) {
    console.error('AI insight error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
