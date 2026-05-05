import { NextRequest, NextResponse } from 'next/server'
import {
  getLabelCalendarEvents,
  getCatalog,
  getUsers,
  getInstagramMetrics,
  getTikTokMetrics,
  getTikTokSongViews,
  getVideoVaultItems,
} from '@/lib/storage'

export const dynamic = 'force-dynamic'

/** GET: Campaign detail for a day - events grouped by artist with metrics */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    if (!date) {
      return NextResponse.json({ error: 'date required (YYYY-MM-DD)' }, { status: 400 })
    }

    const catalog = getCatalog()
    const users = getUsers()
    const vaultItems = getVideoVaultItems()
    const labelEvents = getLabelCalendarEvents(date, date)

    const enriched = labelEvents.map((e) => {
      const artist = e.artistId ? users.find((u: any) => u.id === e.artistId) : null
      const song = e.songId ? catalog.find((c: any) => c.id === e.songId) : null
      const vaultVideo = e.vaultVideoId ? vaultItems.find((v: any) => v.id === e.vaultVideoId) : null
      const productType = e.productType
        ? (e.productType.charAt(0).toUpperCase() + e.productType.slice(1).replace('_', ' '))
        : song?.releaseType
          ? (song.releaseType.charAt(0).toUpperCase() + song.releaseType.slice(1))
          : (e.eventType === 'label_post' || e.eventType === 'promo' ? 'Label Promo' : 'Campaign')
      return {
        ...e,
        artistName: artist?.artistName || artist?.name || 'Unknown',
        artistId: e.artistId,
        songTitle: song?.song || e.title,
        songId: e.songId,
        productType,
        vaultVideo: vaultVideo ? { id: vaultVideo.id, title: vaultVideo.title, videoUrl: vaultVideo.videoUrl, platform: vaultVideo.platform } : null,
      }
    })

    // Group by artist
    const byArtist = new Map<string, typeof enriched>()
    enriched.forEach((ev) => {
      const key = ev.artistName || 'Other'
      if (!byArtist.has(key)) byArtist.set(key, [])
      byArtist.get(key)!.push(ev)
    })

    // Get latest metrics per artist/song
    const artistIds = [...new Set(enriched.map((e) => e.artistId).filter(Boolean))] as string[]
    const songIds = [...new Set(enriched.map((e) => e.songId).filter(Boolean))] as string[]

    const igByArtist: Record<string, number> = {}
    artistIds.forEach((aid) => {
      const metrics = getInstagramMetrics(aid)
      const latest = metrics.sort((a, b) => b.metricDate.localeCompare(a.metricDate))[0]
      igByArtist[aid] = latest?.views ?? 0
    })

    const tiktokByArtist: Record<string, number> = {}
    artistIds.forEach((aid) => {
      const metrics = getTikTokMetrics(aid)
      const latest = metrics.sort((a, b) => (b.metricDate || '').localeCompare(a.metricDate || ''))[0]
      tiktokByArtist[aid] = (latest as any)?.views ?? 0
    })

    const tiktokBySong: Record<string, number> = {}
    songIds.forEach((sid) => {
      const views = getTikTokSongViews(sid)
      const total = views.reduce((sum, v) => sum + v.views, 0)
      tiktokBySong[sid] = total
    })

    // Upcoming milestones per artist: next drop (release), shows
    const today = date
    const upcomingByArtist: Record<string, Array<{ type: 'drop' | 'show'; label: string; date: string }>> = {}
    artistIds.forEach((aid) => {
      const artist = users.find((u: any) => u.id === aid)
      const artistName = artist?.artistName || artist?.name || 'Unknown'
      if (!upcomingByArtist[artistName]) upcomingByArtist[artistName] = []
      const artistReleases = catalog
        .filter((c: any) => (c.artistId === aid || c.artistIds?.includes(aid) || (artist && c.artist === (artist.artistName || artist.name))) && (c.releaseDate || c.releaseDateRequested))
        .map((c: any) => ({ date: (c.releaseDate || c.releaseDateRequested || '').split('T')[0], song: c.song }))
        .filter((r: any) => r.date >= today)
        .sort((a: any, b: any) => a.date.localeCompare(b.date))
        .slice(0, 2)
      artistReleases.forEach((r: any) => {
        upcomingByArtist[artistName].push({
          type: 'drop',
          label: `${r.song} – ${new Date(r.date + 'T12:00:00').toLocaleDateString('default', { month: 'short', day: 'numeric' })}`,
          date: r.date,
        })
      })
      // Sort by date
      upcomingByArtist[artistName].sort((a: any, b: any) => a.date.localeCompare(b.date))
    })

    const groups = Array.from(byArtist.entries()).map(([artistName, events]) => {
      const artistId = events[0]?.artistId
      const milestones = upcomingByArtist[artistName] || []
      const artistEvents = events.map((ev) => {
        const igViews = ev.artistId ? igByArtist[ev.artistId] : 0
        const tiktokViews = ev.songId ? tiktokBySong[ev.songId] : (ev.artistId ? tiktokByArtist[ev.artistId] : 0)
        const youtubeViews = 0
        const hasMetrics = igViews > 0 || tiktokViews > 0 || youtubeViews > 0
        const hasVideo = !!(ev.vaultVideoId || ev.linkedMediaUrl || ev.linkedDriveUrl || ev.linkedSnippetUrl)
        const hasProduct = !!(ev.songId || ev.productType)
        const campaignStatus: 'on_track' | 'needs_content' | 'missing_assets' =
          hasProduct && hasVideo ? 'on_track' : !hasVideo ? 'missing_assets' : 'needs_content'
        return {
          ...ev,
          igViews,
          tiktokViews,
          youtubeViews,
          hasVideo,
          hasMetrics,
          campaignStatus,
        }
      })
      const sectionStatus = artistEvents.every((e) => e.campaignStatus === 'on_track')
        ? 'on_track'
        : artistEvents.some((e) => e.campaignStatus === 'missing_assets')
          ? 'missing_assets'
          : 'needs_content'
      return {
        artistName,
        artistId,
        campaignStatus: sectionStatus,
        upcomingMilestones: milestones,
        events: artistEvents,
      }
    })

    return NextResponse.json({
      success: true,
      date,
      totalEvents: enriched.length,
      artistsActive: groups.length,
      groups,
    })
  } catch (error: any) {
    console.error('Day detail error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
