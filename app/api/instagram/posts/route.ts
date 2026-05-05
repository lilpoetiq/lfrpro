import { NextRequest, NextResponse } from 'next/server'
import { getUsers } from '@/lib/storage'

/**
 * GET /api/instagram/posts?artistId=xxx
 * Fetch individual post/reel metrics from Instagram
 * Note: Meta API requires fetching posts individually
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const artistId = searchParams.get('artistId')

    if (!artistId) {
      return NextResponse.json(
        { error: 'Artist ID is required' },
        { status: 400 }
      )
    }

    const users = getUsers()
    const artist = users.find(u => u.id === artistId)

    if (!artist) {
      return NextResponse.json(
        { error: 'Artist not found' },
        { status: 404 }
      )
    }

    if (!artist.instagramAccountId || !artist.instagramAccessToken) {
      return NextResponse.json(
        { error: 'Instagram not connected for this artist' },
        { status: 400 }
      )
    }

    // Fetch recent posts from Instagram
    const baseUrl = 'https://graph.facebook.com/v21.0'
    const accountId = artist.instagramAccountId
    const accessToken = artist.instagramAccessToken

    // Get recent media (posts/reels)
    const mediaUrl = `${baseUrl}/${accountId}/media?fields=id,caption,timestamp,media_type,media_url,permalink&limit=25&access_token=${accessToken}`
    const mediaResponse = await fetch(mediaUrl)
    const mediaData = await mediaResponse.json()

    if (!mediaResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch Instagram posts', details: mediaData.error?.message },
        { status: 500 }
      )
    }

    // For each post, fetch detailed insights
    const posts = []
    for (const item of mediaData.data || []) {
      try {
        // Fetch insights for this post
        const insightsUrl = `${baseUrl}/${item.id}/insights?metric=impressions,reach,likes,comments,saves,shares&access_token=${accessToken}`
        const insightsResponse = await fetch(insightsUrl)
        const insightsData = await insightsResponse.json()

        if (insightsResponse.ok && insightsData.data) {
          const metrics: any = {}
          insightsData.data.forEach((insight: any) => {
            metrics[insight.name] = insight.values?.[0]?.value || 0
          })

          // Calculate engagement rate
          const views = metrics.impressions || metrics.reach || 0
          const engagement = (metrics.likes || 0) + (metrics.comments || 0) + (metrics.saves || 0) + (metrics.shares || 0)
          const engagementRate = views > 0 ? (engagement / views) * 100 : 0

          posts.push({
            id: item.id,
            postId: item.id,
            postType: item.media_type === 'VIDEO' || item.media_type === 'REELS' ? 'reel' : 'photo',
            postedAt: item.timestamp,
            caption: item.caption || '',
            permalink: item.permalink,
            views: metrics.impressions || metrics.reach || 0,
            likes: metrics.likes || 0,
            comments: metrics.comments || 0,
            saves: metrics.saves || 0,
            shares: metrics.shares || 0,
            engagementRate: engagementRate.toFixed(2),
            fetchedAt: new Date().toISOString(),
          })
        }
      } catch (error: any) {
        console.warn(`Failed to fetch insights for post ${item.id}:`, error.message)
        // Continue with other posts
      }
    }

    return NextResponse.json({
      success: true,
      artistId,
      posts,
      count: posts.length,
    })
  } catch (error: any) {
    console.error('Instagram posts fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Instagram posts', details: error.message },
      { status: 500 }
    )
  }
}
