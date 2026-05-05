/**
 * Per-Post/Reel Tracking
 * Tracks individual Instagram posts/reels for detailed analysis
 * Note: Meta API limitations may require alternative approaches
 */

import { InstagramMetrics } from './storage'

export interface InstagramPost {
  id: string
  artistId: string
  postId: string  // Instagram post/reel ID
  postType: 'photo' | 'video' | 'reel' | 'carousel'
  postedAt: string
  caption?: string
  
  // Metrics (snapshot at fetch time)
  views: number
  likes: number
  comments: number
  saves: number
  shares: number
  watchTime?: number  // For reels/videos (seconds)
  completionRate?: number  // For reels/videos (0-1)
  
  // Analysis
  performanceRating: 'excellent' | 'good' | 'average' | 'below_average'
  engagementRate: number  // (likes + comments + saves + shares) / views
  bestPerformingMetric: 'views' | 'saves' | 'shares' | 'comments' | 'watchTime'
  
  // Content analysis
  contentType?: 'emotional' | 'visual' | 'engaging' | 'viral' | 'promotional'
  emotionDetected?: string  // From caption analysis
  
  fetchedAt: string
}

/**
 * Analyze post performance vs artist baseline
 */
export function analyzePostPerformance(
  post: InstagramPost,
  baselineMetrics: InstagramMetrics[]
): {
  performanceRating: InstagramPost['performanceRating']
  engagementRate: number
  bestPerformingMetric: InstagramPost['bestPerformingMetric']
  insights: string[]
} {
  if (baselineMetrics.length === 0) {
    return {
      performanceRating: 'average',
      engagementRate: 0,
      bestPerformingMetric: 'views',
      insights: ['No baseline data available'],
    }
  }

  const baselineAvg = {
    views: baselineMetrics.reduce((sum, m) => sum + m.views, 0) / baselineMetrics.length,
    saves: baselineMetrics.reduce((sum, m) => sum + m.saves, 0) / baselineMetrics.length,
    shares: baselineMetrics.reduce((sum, m) => sum + m.shares, 0) / baselineMetrics.length,
    comments: baselineMetrics.reduce((sum, m) => sum + m.comments, 0) / baselineMetrics.length,
  }

  // Calculate engagement rate
  const engagementRate = post.views > 0
    ? ((post.likes + post.comments + post.saves + post.shares) / post.views) * 100
    : 0

  // Determine best performing metric
  const metrics = {
    views: post.views / baselineAvg.views,
    saves: baselineAvg.saves > 0 ? post.saves / baselineAvg.saves : 0,
    shares: baselineAvg.shares > 0 ? post.shares / baselineAvg.shares : 0,
    comments: baselineAvg.comments > 0 ? post.comments / baselineAvg.comments : 0,
  }

  const bestMetric = Object.entries(metrics).reduce((a, b) => 
    metrics[a[0] as keyof typeof metrics] > metrics[b[0] as keyof typeof metrics] ? a : b
  )[0] as InstagramPost['bestPerformingMetric']

  // Determine performance rating
  let performanceRating: InstagramPost['performanceRating'] = 'average'
  const insights: string[] = []

  if (post.views > baselineAvg.views * 1.5) {
    performanceRating = 'excellent'
    insights.push('Views significantly above baseline')
  } else if (post.views > baselineAvg.views * 1.2) {
    performanceRating = 'good'
    insights.push('Views above baseline')
  } else if (post.views < baselineAvg.views * 0.8) {
    performanceRating = 'below_average'
    insights.push('Views below baseline')
  }

  if (post.saves > baselineAvg.saves * 1.3) {
    insights.push('High saves - emotional content resonating')
  }

  if (post.shares > baselineAvg.shares * 1.5) {
    insights.push('High shares - viral potential')
  }

  if (post.completionRate && post.completionRate > 0.7) {
    insights.push('High completion rate - engaging content')
  }

  return {
    performanceRating,
    engagementRate,
    bestPerformingMetric: bestMetric,
    insights,
  }
}

/**
 * Detect engagement decay (silence tracking)
 */
export function detectEngagementDecay(
  recentPosts: InstagramPost[],
  baselineMetrics: InstagramMetrics[]
): {
  isDecaying: boolean
  decayRate: number  // Percentage drop
  indicators: string[]
  recommendation: string
} {
  if (recentPosts.length < 3 || baselineMetrics.length === 0) {
    return {
      isDecaying: false,
      decayRate: 0,
      indicators: [],
      recommendation: 'Need more data to detect decay',
    }
  }

  // Sort posts by date (newest first)
  const sorted = [...recentPosts].sort((a, b) => 
    new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
  )

  // Compare most recent 3 posts vs previous 3
  const recent3 = sorted.slice(0, 3)
  const previous3 = sorted.slice(3, 6)

  if (previous3.length === 0) {
    return {
      isDecaying: false,
      decayRate: 0,
      indicators: [],
      recommendation: 'Need more historical data',
    }
  }

  const recentAvg = {
    views: recent3.reduce((sum, p) => sum + p.views, 0) / recent3.length,
    engagement: recent3.reduce((sum, p) => sum + (p.likes + p.comments + p.saves + p.shares), 0) / recent3.length,
  }

  const previousAvg = {
    views: previous3.reduce((sum, p) => sum + p.views, 0) / previous3.length,
    engagement: previous3.reduce((sum, p) => sum + (p.likes + p.comments + p.saves + p.shares), 0) / previous3.length,
  }

  const viewsDecay = ((previousAvg.views - recentAvg.views) / previousAvg.views) * 100
  const engagementDecay = ((previousAvg.engagement - recentAvg.engagement) / previousAvg.engagement) * 100

  const isDecaying = viewsDecay > 15 || engagementDecay > 20
  const indicators: string[] = []
  let recommendation = ''

  if (viewsDecay > 15) {
    indicators.push(`Views dropped ${viewsDecay.toFixed(1)}%`)
  }
  if (engagementDecay > 20) {
    indicators.push(`Engagement dropped ${engagementDecay.toFixed(1)}%`)
  }

  if (isDecaying) {
    recommendation = 'Pause. Don\'t drop yet. Engagement is decaying - audience may be experiencing fatigue. Consider reducing posting frequency or changing content style.'
  } else {
    recommendation = 'Engagement is stable - continue current strategy'
  }

  return {
    isDecaying,
    decayRate: Math.max(viewsDecay, engagementDecay),
    indicators,
    recommendation,
  }
}
