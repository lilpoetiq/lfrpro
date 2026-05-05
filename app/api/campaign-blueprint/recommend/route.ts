import { NextRequest, NextResponse } from 'next/server'
import { getCatalog, computeCampaignStatus } from '@/lib/storage'

export const dynamic = 'force-dynamic'

/** GET: Suggest best blueprint for an upcoming song (by songId or artistId) */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const songId = searchParams.get('songId') || undefined
    const artistId = searchParams.get('artistId') || undefined

    const catalog = getCatalog()

    let targetSong: any = null
    let artistIds: string[] = []

    if (songId) {
      targetSong = catalog.find((c: any) => c.id === songId)
      if (!targetSong) return NextResponse.json({ error: 'Song not found' }, { status: 404 })
      artistIds = targetSong.artistIds?.length ? targetSong.artistIds : (targetSong.artistId ? [targetSong.artistId] : [])
    } else if (artistId) {
      artistIds = [artistId]
    } else {
      return NextResponse.json({ error: 'songId or artistId required' }, { status: 400 })
    }

    // Find completed/archived songs for same artist, prefer blueprint_ready
    const artistSongs = catalog.filter((c: any) => {
      const status = computeCampaignStatus(c)
      if (status !== 'completed' && status !== 'archived') return false
      const cArtistIds = c.artistIds?.length ? c.artistIds : (c.artistId ? [c.artistId] : [])
      return artistIds.some((id) => cArtistIds.includes(id))
    })

    const blueprintSongs = artistSongs.filter((c: any) => c.blueprintReady)
    const candidateSongs = blueprintSongs.length > 0 ? blueprintSongs : artistSongs

    // Sort by campaign_score desc, then by totalStreams
    candidateSongs.sort((a: any, b: any) => {
      const scoreA = a.campaignScore ?? 0
      const scoreB = b.campaignScore ?? 0
      if (scoreB !== scoreA) return scoreB - scoreA
      return (b.totalStreams || 0) - (a.totalStreams || 0)
    })

    const bestExample = candidateSongs[0]
    if (!bestExample) {
      return NextResponse.json({
        success: true,
        hasExample: false,
        message: 'Build a fresh campaign. No strong historical blueprint available.',
      })
    }

    // If no strong examples, suggest building fresh
    const outcome = bestExample.campaignOutcome

    return NextResponse.json({
      success: true,
      hasExample: true,
      example: {
        id: bestExample.id,
        song: bestExample.song,
        artist: bestExample.artist,
        releaseDate: bestExample.releaseDate,
        campaignScore: bestExample.campaignScore,
        campaignOutcome: bestExample.campaignOutcome,
        blueprintReady: bestExample.blueprintReady,
        totalStreams: bestExample.totalStreams,
        performanceMetrics: bestExample.performanceMetrics,
        campaignSummary: bestExample.campaignSummary,
        lessonsLearned: bestExample.lessonsLearned,
        strategyToRepeat: bestExample.strategyToRepeat,
        strategyToAvoid: bestExample.strategyToAvoid,
        campaignWins: bestExample.campaignWins,
      },
      useAsLearningOnly: outcome === 'weak',
    })
  } catch (error: any) {
    console.error('Get blueprint recommend error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
