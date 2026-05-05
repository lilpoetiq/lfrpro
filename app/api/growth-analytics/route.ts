import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import {
  getInstagramMetrics,
  getTikTokMetrics,
  getCatalog,
  getUsers,
  getArtistGoals,
  getMilestones,
  getContentPerformance,
  getContentCalendar,
  getAudienceInsights,
  getContentIdeas,
  getBenchmarks,
  getActionItems,
  getHashtagPerformance,
  getCrossPlatformComparisons,
  getEngagementResponses,
  getStoryPerformance,
  getCollaborationOpportunities,
  getRevenueProjections,
  getWeeklyGrowthReports,
  addContentIdea,
  addActionItem,
  addBenchmark,
  addAudienceInsight,
  addCrossPlatformComparison,
  addRevenueProjection,
  addWeeklyGrowthReport,
  addCollaborationOpportunity,
  addArtistGoal,
} from '@/lib/storage'

const openaiApiKey = process.env.OPENAI_API_KEY
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const artistId = searchParams.get('artistId')
    const type = searchParams.get('type') || 'all'

    if (!artistId) {
      return NextResponse.json({ error: 'Artist ID required' }, { status: 400 })
    }

    const instagramMetrics = getInstagramMetrics(artistId)
    const tikTokMetrics = getTikTokMetrics(artistId)
    const catalog = getCatalog()
    const artistSongs = catalog.filter(s => s.artistId === artistId || s.artistIds?.includes(artistId))
    
    const result: any = {}

    if (type === 'all' || type === 'goals') {
      result.goals = getArtistGoals(artistId)
    }

    if (type === 'all' || type === 'milestones') {
      result.milestones = getMilestones(artistId)
    }

    if (type === 'all' || type === 'content') {
      result.contentPerformance = getContentPerformance(artistId, 50)
      result.contentCalendar = getContentCalendar(artistId)
    }

    if (type === 'all' || type === 'insights') {
      result.audienceInsights = getAudienceInsights(artistId)
      result.contentIdeas = getContentIdeas(artistId, false)
    }

    if (type === 'all' || type === 'benchmarks') {
      result.benchmarks = getBenchmarks(artistId)
    }

    if (type === 'all' || type === 'actions') {
      result.actionItems = getActionItems(artistId, false)
    }

    if (type === 'all' || type === 'hashtags') {
      result.hashtagPerformance = getHashtagPerformance(artistId)
    }

    if (type === 'all' || type === 'comparison') {
      result.crossPlatform = getCrossPlatformComparisons(artistId)
    }

    if (type === 'all' || type === 'responses') {
      result.engagementResponses = getEngagementResponses(artistId, 100)
    }

    if (type === 'all' || type === 'stories') {
      result.storyPerformance = getStoryPerformance(artistId, 50)
    }

    if (type === 'all' || type === 'collaborations') {
      result.collaborations = getCollaborationOpportunities(artistId)
    }

    if (type === 'all' || type === 'revenue') {
      result.revenueProjections = getRevenueProjections(artistId)
    }

    if (type === 'all' || type === 'reports') {
      result.weeklyReports = getWeeklyGrowthReports(artistId, 4)
    }

    // Always include engagement responses and story performance in 'all' or specific types
    if (type === 'all' || type === 'responses') {
      result.engagementResponses = getEngagementResponses(artistId, 100)
    }

    if (type === 'all' || type === 'stories') {
      result.storyPerformance = getStoryPerformance(artistId, 50)
    }

    if (type === 'all' || type === 'insights') {
      result.audienceInsights = getAudienceInsights(artistId)
    }

    // Calculate best posting times
    if (instagramMetrics.length > 0) {
      const postingHours: Record<number, number> = {}
      instagramMetrics.forEach(metric => {
        const hour = new Date(metric.metricDate).getHours()
        postingHours[hour] = (postingHours[hour] || 0) + metric.views
      })
      const bestHours = Object.entries(postingHours)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([hour]) => parseInt(hour))
      result.bestPostingHours = bestHours
    }

    // Calculate content type performance
    if (result.contentPerformance && result.contentPerformance.length > 0) {
      const typePerformance: Record<string, { count: number; avgEngagement: number; totalViews: number }> = {}
      result.contentPerformance.forEach((cp: any) => {
        if (!typePerformance[cp.contentType]) {
          typePerformance[cp.contentType] = { count: 0, avgEngagement: 0, totalViews: 0 }
        }
        typePerformance[cp.contentType].count++
        typePerformance[cp.contentType].totalViews += cp.views
        typePerformance[cp.contentType].avgEngagement += cp.engagementRate
      })
      Object.keys(typePerformance).forEach(key => {
        typePerformance[key].avgEngagement /= typePerformance[key].count
      })
      result.contentTypePerformance = typePerformance
    }

    // Calculate streaming correlation
    if (artistSongs.length > 0 && instagramMetrics.length > 0) {
      const totalStreams = artistSongs.reduce((sum, s) => sum + (s.totalStreams || 0), 0)
      const avgFollowers = instagramMetrics.length > 0
        ? instagramMetrics.reduce((sum, m) => sum + m.followers, 0) / instagramMetrics.length
        : 0
      result.streamingCorrelation = {
        totalStreams,
        avgFollowers,
        streamsPerFollower: avgFollowers > 0 ? totalStreams / avgFollowers : 0,
      }
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    console.error('Growth analytics error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, artistId, data } = body

    if (!artistId) {
      return NextResponse.json({ error: 'Artist ID required' }, { status: 400 })
    }

    switch (action) {
      case 'generate_content_ideas':
        if (!openai) {
          return NextResponse.json({ error: 'OpenAI not configured' }, { status: 500 })
        }

        const instagramMetrics = getInstagramMetrics(artistId)
        const tikTokMetrics = getTikTokMetrics(artistId)
        const latestInstagram = instagramMetrics.length > 0
          ? instagramMetrics.sort((a, b) => new Date(b.metricDate).getTime() - new Date(a.metricDate).getTime())[0]
          : null

        const prompt = `Generate 5 creative content ideas for a music artist based on this data:
- Latest Instagram followers: ${latestInstagram?.followers || 'N/A'}
- Latest views: ${latestInstagram?.views || 'N/A'}
- Engagement rate: ${latestInstagram ? ((latestInstagram.comments + latestInstagram.shares + latestInstagram.saves) / latestInstagram.views * 100).toFixed(1) : 'N/A'}%

Return JSON array with: {idea: string, contentType: 'reel'|'post'|'story'|'carousel'|'video', reasoning: string, suggestedHashtags: string[], priority: 'high'|'medium'|'low'}`

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.8,
          response_format: { type: 'json_object' },
        })

        const ideas = JSON.parse(completion.choices[0].message.content || '{}').ideas || []
        const savedIdeas = ideas.map((idea: any) => addContentIdea({
          artistId,
          ...idea,
        }))

        return NextResponse.json({ success: true, ideas: savedIdeas })

      case 'generate_action_items':
        const goals = getArtistGoals(artistId)
        const incompleteGoals = goals.filter(g => !g.isCompleted)
        const actionItems = incompleteGoals.map(goal => {
          let title = ''
          let description = ''
          let category: 'content' | 'engagement' | 'growth' | 'release' | 'collaboration' | 'optimization' = 'growth'
          
          if (goal.type === 'followers') {
            title = `Grow followers to ${goal.target.toLocaleString()}`
            description = `You're at ${goal.current.toLocaleString()}/${goal.target.toLocaleString()}. Post consistently and engage with your audience.`
            category = 'growth'
          } else if (goal.type === 'engagement_rate') {
            title = `Improve engagement rate to ${goal.target}%`
            description = `Current: ${goal.current.toFixed(1)}%. Focus on creating engaging content and responding to comments.`
            category = 'engagement'
          } else if (goal.type === 'streams') {
            title = `Reach ${goal.target.toLocaleString()} streams`
            description = `Current: ${goal.current.toLocaleString()}. Promote your music on social media and collaborate with other artists.`
            category = 'release'
          }

          return addActionItem({
            artistId,
            title,
            description,
            category,
            priority: goal.deadline && new Date(goal.deadline) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) ? 'high' : 'medium',
            dueDate: goal.deadline,
            impact: 'high',
          })
        })

        return NextResponse.json({ success: true, actionItems })

      case 'generate_benchmarks':
        const users = getUsers()
        const artist = users.find(u => u.id === artistId)
        if (!artist) {
          return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
        }

        const allArtists = users.filter(u => u.role === 'artist' && u.lane === artist.lane)
        const allInstagramMetrics = allArtists.flatMap(a => getInstagramMetrics(a.id))
        const artistInstagramMetrics = getInstagramMetrics(artistId)
        
        if (allInstagramMetrics.length === 0) {
          return NextResponse.json({ success: true, benchmarks: [] })
        }

        const latestMetrics = artistInstagramMetrics.length > 0
          ? artistInstagramMetrics.sort((a, b) => new Date(b.metricDate).getTime() - new Date(a.metricDate).getTime())[0]
          : null

        if (!latestMetrics) {
          return NextResponse.json({ success: true, benchmarks: [] })
        }

        const avgFollowers = allInstagramMetrics.reduce((sum, m) => sum + m.followers, 0) / allInstagramMetrics.length
        const avgEngagement = allInstagramMetrics.reduce((sum, m) => {
          const rate = m.views > 0 ? ((m.comments + m.shares + m.saves) / m.views * 100) : 0
          return sum + rate
        }, 0) / allInstagramMetrics.length
        const currentEngagement = latestMetrics.views > 0
          ? ((latestMetrics.comments + latestMetrics.shares + latestMetrics.saves) / latestMetrics.views * 100)
          : 0

        const benchmarks = [
          addBenchmark({
            artistId,
            metric: 'followers',
            artistValue: latestMetrics.followers,
            industryAverage: avgFollowers,
            percentile: (latestMetrics.followers / avgFollowers) * 50,
            comparison: latestMetrics.followers > avgFollowers ? 'above' : latestMetrics.followers < avgFollowers ? 'below' : 'average',
            period: 'current',
          }),
          addBenchmark({
            artistId,
            metric: 'engagement_rate',
            artistValue: currentEngagement,
            industryAverage: avgEngagement,
            percentile: (currentEngagement / avgEngagement) * 50,
            comparison: currentEngagement > avgEngagement ? 'above' : currentEngagement < avgEngagement ? 'below' : 'average',
            period: 'current',
          }),
        ]

        return NextResponse.json({ success: true, benchmarks })

      case 'generate_weekly_report':
        const weekStart = new Date()
        weekStart.setDate(weekStart.getDate() - 7)
        const weekEnd = new Date()
        const weeklyInstagramMetrics = getInstagramMetrics(artistId)

        const weekInstagram = weeklyInstagramMetrics.filter(m => {
          const date = new Date(m.metricDate)
          return date >= weekStart && date <= weekEnd
        })

        const prevWeekStart = new Date(weekStart)
        prevWeekStart.setDate(prevWeekStart.getDate() - 7)
        const prevWeekInstagram = weeklyInstagramMetrics.filter(m => {
          const date = new Date(m.metricDate)
          return date >= prevWeekStart && date < weekStart
        })

        const followerGrowth = weekInstagram.length > 0 && prevWeekInstagram.length > 0
          ? weekInstagram[weekInstagram.length - 1].followers - prevWeekInstagram[prevWeekInstagram.length - 1].followers
          : 0

        const report = addWeeklyGrowthReport({
          artistId,
          weekStart: weekStart.toISOString(),
          weekEnd: weekEnd.toISOString(),
          summary: {
            followerGrowth,
            engagementChange: 0, // Calculate from metrics
            viewsChange: 0,
            topPerformingContent: [],
            keyInsights: ['Continue posting consistently', 'Engage with your audience'],
            recommendations: ['Try new content formats', 'Post during peak hours'],
          },
        })

        return NextResponse.json({ success: true, report })

      case 'add_goal':
        if (!data) {
          return NextResponse.json({ error: 'Goal data required' }, { status: 400 })
        }
        const goal = addArtistGoal(data)
        return NextResponse.json({ success: true, goal })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Growth analytics POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
