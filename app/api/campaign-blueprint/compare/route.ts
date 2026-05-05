import { NextRequest, NextResponse } from 'next/server'
import { getCatalog, getLabelCalendarEvents, computeCampaignStatus } from '@/lib/storage'

export const dynamic = 'force-dynamic'

/** GET: Get comparison data for two songs */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const songIdA = searchParams.get('songA')
    const songIdB = searchParams.get('songB')

    if (!songIdA || !songIdB) {
      return NextResponse.json({ error: 'songA and songB required' }, { status: 400 })
    }

    const catalog = getCatalog()
    const songA = catalog.find((c: any) => c.id === songIdA)
    const songB = catalog.find((c: any) => c.id === songIdB)

    if (!songA || !songB) {
      return NextResponse.json({ error: 'One or both songs not found' }, { status: 404 })
    }

    const eventsA = getLabelCalendarEvents(undefined, undefined, songIdA)
    const eventsB = getLabelCalendarEvents(undefined, undefined, songIdB)

    const toComparison = (song: any, events: any[]) => ({
      id: song.id,
      song: song.song,
      artist: song.artist,
      releaseDate: song.releaseDate,
      releaseType: song.releaseType,
      campaignStatus: computeCampaignStatus(song),
      campaignScore: song.campaignScore,
      campaignOutcome: song.campaignOutcome,
      blueprintReady: song.blueprintReady,
      totalStreams: song.totalStreams,
      performanceMetrics: song.performanceMetrics,
      campaignSummary: song.campaignSummary,
      lessonsLearned: song.lessonsLearned,
      strategyToRepeat: song.strategyToRepeat,
      strategyToAvoid: song.strategyToAvoid,
      campaignWins: song.campaignWins,
      eventCount: events.length,
      events: events
        .sort((a: any, b: any) => a.date.localeCompare(b.date))
        .map((e: any) => ({ date: e.date, eventType: e.eventType, title: e.title })),
    })

    return NextResponse.json({
      success: true,
      songA: toComparison(songA, eventsA),
      songB: toComparison(songB, eventsB),
    })
  } catch (error: any) {
    console.error('Compare campaigns error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
