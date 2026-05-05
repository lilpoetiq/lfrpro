import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import {
  getInstagramMetrics,
  getTikTokMetrics,
  getTikTokSongViews,
  getReleaseReadinessByArtistId,
  getUsers,
  getCatalog,
} from '@/lib/storage'
import { calculateEnhancedReadiness, ReleaseGoal } from '@/lib/enhancedReadinessEngine'

const openaiApiKey = process.env.OPENAI_API_KEY
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null

export async function POST(request: NextRequest) {
  try {
    if (!openai) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { artistId, question, context, releaseGoal = 'streams' } = body

    if (!artistId) {
      return NextResponse.json(
        { error: 'Artist ID is required' },
        { status: 400 }
      )
    }

    // Get all relevant data
    const users = getUsers()
    const user = users.find(u => u.id === artistId && u.role === 'artist')
    if (!user) {
      return NextResponse.json(
        { error: 'Artist not found' },
        { status: 404 }
      )
    }

    const instagramMetrics = getInstagramMetrics(artistId)
    const tikTokMetrics = getTikTokMetrics(artistId)
    const tikTokSongViews = getTikTokSongViews()
    const catalog = getCatalog()
    const readiness = getReleaseReadinessByArtistId(artistId)

    // Filter TikTok song views for this artist
    const artistTikTokSongViews = tikTokSongViews.filter(v => {
      const song = catalog.find(s => s.id === v.songId)
      return song?.artistId === artistId || song?.artistIds?.includes(artistId)
    })

    // Calculate enhanced readiness
    let enhancedData = null
    if (instagramMetrics.length > 0) {
      enhancedData = calculateEnhancedReadiness(
        instagramMetrics,
        tikTokMetrics,
        artistTikTokSongViews,
        user,
        releaseGoal as ReleaseGoal
      )
    }

    // Get latest metrics
    const latestInstagram = instagramMetrics.length > 0
      ? instagramMetrics.sort((a, b) => new Date(b.metricDate).getTime() - new Date(a.metricDate).getTime())[0]
      : null

    const latestTikTok = tikTokMetrics.length > 0
      ? tikTokMetrics.sort((a, b) => new Date(b.metricDate).getTime() - new Date(a.metricDate).getTime())[0]
      : null

    // Get unreleased songs
    const unreleasedSongs = catalog.filter(item => {
      const isUnreleased = item.isUnreleased === true || !item.releaseDate
      const belongsToArtist = item.artistId === artistId || 
                             (item.artistIds && item.artistIds.includes(artistId))
      return isUnreleased && belongsToArtist
    })

    // Build context for AI
    const dataContext = {
      artist: {
        name: user.artistName || user.name,
        lane: user.lane || 'developing',
      },
      readiness: readiness ? {
        state: readiness.state,
        lastUpdated: readiness.lastUpdated,
      } : null,
      enhanced: enhancedData ? {
        state: enhancedData.state,
        window: enhancedData.window,
        heat: enhancedData.heat,
        momentum: enhancedData.momentumSpeed,
        confidence: enhancedData.confidenceIndex,
        fatigue: enhancedData.fatigue,
        simulation: enhancedData.simulation,
        dropType: enhancedData.dropTypeRecommendation,
      } : null,
      metrics: {
        instagram: latestInstagram ? {
          followers: latestInstagram.followers,
          views: latestInstagram.views,
          saves: latestInstagram.saves,
          shares: latestInstagram.shares,
          comments: latestInstagram.comments,
          completionRate: latestInstagram.completionRate,
          engagementRate: latestInstagram.views > 0 
            ? ((latestInstagram.comments + latestInstagram.shares + latestInstagram.saves) / latestInstagram.views * 100).toFixed(1)
            : 0,
        } : null,
        tiktok: latestTikTok ? {
          views: latestTikTok.views,
          followers: latestTikTok.followers,
          engagementRate: latestTikTok.engagementRate,
        } : null,
        totalDataPoints: instagramMetrics.length + tikTokMetrics.length,
      },
      unreleasedSongs: unreleasedSongs.map(song => ({
        name: song.song,
        artist: song.artist,
        releaseType: song.releaseType,
        readinessTags: song.readinessTags,
      })),
      context: context || {},
    }

    // Build prompt
    const systemPrompt = `You are an expert music industry strategist and release readiness advisor. You analyze artist data to provide actionable insights about when and how to release music.

Your role:
- Analyze release readiness data and provide strategic advice
- Suggest creative release ideas based on the artist's current momentum
- Answer questions about release timing, strategy, and audience engagement
- Learn from artist ideas and incorporate them into recommendations
- Be direct, actionable, and artist-friendly

Current Artist Context:
- Artist: ${dataContext.artist.name}
- Lane: ${dataContext.artist.lane}
- Current State: ${dataContext.readiness?.state || 'No data yet'}
- Data Points Available: ${dataContext.metrics.totalDataPoints}
${enhancedData ? `
- Heat Score: ${enhancedData.heat.combinedHeat}/100
- Momentum: ${enhancedData.momentumSpeed.speed}
- Confidence: ${enhancedData.confidenceIndex?.level || 'medium'}
` : ''}

${dataContext.metrics.instagram ? `
Instagram Metrics:
- Followers: ${dataContext.metrics.instagram.followers.toLocaleString()}
- Latest Views: ${dataContext.metrics.instagram.views.toLocaleString()}
- Engagement Rate: ${dataContext.metrics.instagram.engagementRate}%
- Completion Rate: ${(dataContext.metrics.instagram.completionRate * 100).toFixed(1)}%
` : 'No Instagram data available yet.'}

${dataContext.metrics.tiktok ? `
TikTok Metrics:
- Followers: ${dataContext.metrics.tiktok.followers.toLocaleString()}
- Latest Views: ${dataContext.metrics.tiktok.views.toLocaleString()}
- Engagement Rate: ${dataContext.metrics.tiktok.engagementRate || 'N/A'}%
` : 'No TikTok data available yet.'}

${dataContext.unreleasedSongs.length > 0 ? `
Unreleased Songs (${dataContext.unreleasedSongs.length}):
${dataContext.unreleasedSongs.slice(0, 5).map(s => `- ${s.name} (${s.releaseType})`).join('\n')}
` : 'No unreleased songs found.'}

When providing advice:
- Be specific and actionable
- Reference actual numbers from their data
- Consider their lane and current state
- Provide creative, outside-the-box ideas when appropriate
- If data is limited, acknowledge it and provide general guidance
- Learn from their ideas and build on them`

    const userPrompt = question || 'Analyze my current release readiness and provide strategic recommendations.'

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    })

    const analysis = completion.choices[0].message.content || ''

    return NextResponse.json({
      success: true,
      analysis,
      dataContext,
    })
  } catch (error: any) {
    console.error('Release readiness AI analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to generate analysis', details: error.message },
      { status: 500 }
    )
  }
}
