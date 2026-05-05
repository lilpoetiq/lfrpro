/**
 * Trigger-Ready System
 * Matches artist readiness state with unreleased songs based on tags
 * Flags songs when conditions align for optimal release timing
 */

import { CatalogItem } from './storage'
import { ReleaseReadiness, getReleaseReadinessByArtistId } from './storage'
import { InstagramMetrics, getInstagramMetrics } from './storage'
import { ReadinessState } from './readinessEngine'
import { LANE_DEFINITIONS } from './laneDefinitions'

export interface TriggerReadyMatch {
  songId: string
  songName: string
  artistId: string
  artistName: string
  matchScore: number  // 0-100, how well it matches current conditions
  matchReasons: string[]
  readinessState: ReadinessState
  currentMomentum: {
    direction: 'rising' | 'steady' | 'falling'
    keyMetrics: string[]  // Which metrics are driving the match
  }
  recommendedAction: 'release_now' | 'wait_for_better_timing' | 'build_momentum_first'
}

/**
 * Analyze what type of content is currently working for an artist
 * Based on recent Instagram metrics
 */
function analyzeContentPerformance(metrics: InstagramMetrics[]): {
  topPerformingType: 'emotional' | 'visual' | 'engaging' | 'viral' | 'unknown'
  keyIndicators: string[]
} {
  if (metrics.length === 0) {
    return { topPerformingType: 'unknown', keyIndicators: [] }
  }

  const recent = metrics[metrics.length - 1]
  const baseline = metrics.length > 1
    ? metrics.slice(0, -1).reduce((sum, m) => ({
        saves: sum.saves + m.saves,
        shares: sum.shares + m.shares,
        comments: sum.comments + m.comments,
        views: sum.views + m.views,
      }), { saves: 0, shares: 0, comments: 0, views: 0 })
    : { saves: 0, shares: 0, comments: 0, views: 0 }

  const baselineAvg = metrics.length > 1
    ? {
        saves: baseline.saves / (metrics.length - 1),
        shares: baseline.shares / (metrics.length - 1),
        comments: baseline.comments / (metrics.length - 1),
        views: baseline.views / (metrics.length - 1),
      }
    : { saves: 0, shares: 0, comments: 0, views: 0 }

  const indicators: string[] = []
  let topType: 'emotional' | 'visual' | 'engaging' | 'viral' | 'unknown' = 'unknown'

  // High saves = emotional/deep content
  if (recent.saves > baselineAvg.saves * 1.2) {
    indicators.push('High saves (emotional content resonating)')
    topType = 'emotional'
  }

  // High shares = viral potential
  if (recent.shares > baselineAvg.shares * 1.3) {
    indicators.push('High shares (viral potential)')
    topType = 'viral'
  }

  // High comments = engaging content
  if (recent.comments > baselineAvg.comments * 1.2) {
    indicators.push('High comments (engaging content)')
    if (topType === 'unknown') topType = 'engaging'
  }

  // High completion rate = visual/story content
  if (recent.completionRate > 0.7) {
    indicators.push('High completion rate (visual content working)')
    if (topType === 'unknown') topType = 'visual'
  }

  return { topPerformingType: topType, keyIndicators: indicators }
}

/**
 * Match song tags to current readiness state and content performance
 */
export function findTriggerReadySongs(
  artistId: string,
  unreleasedSongs: CatalogItem[]
): TriggerReadyMatch[] {
  const readiness = getReleaseReadinessByArtistId(artistId)
  const metrics = getInstagramMetrics(artistId)

  if (!readiness || metrics.length === 0) {
    return []
  }

  const contentAnalysis = analyzeContentPerformance(metrics)
  const matches: TriggerReadyMatch[] = []

  for (const song of unreleasedSongs) {
    // Only check unreleased songs
    if (!song.isUnreleased && song.releaseDate) {
      continue
    }

    const tags = song.readinessTags || song.songs?.[0]?.readinessTags
    if (!tags) {
      continue // Skip songs without tags
    }

    let matchScore = 0
    const matchReasons: string[] = []
    const keyMetrics: string[] = []

    // Check readiness state match
    if (readiness.state === 'ready') {
      matchScore += 40
      matchReasons.push('Artist is in Ready state')
      keyMetrics.push('readiness:ready')
    } else if (readiness.state === 'building') {
      matchScore += 20
      matchReasons.push('Artist is Building momentum')
      keyMetrics.push('readiness:building')
    } else {
      // Cooling - lower score
      matchScore += 5
      matchReasons.push('Artist is Cooling (timing may not be optimal)')
    }

    // Check lane match
    const artistLane = tags.lane
    if (artistLane && Object.keys(LANE_DEFINITIONS).includes(artistLane)) {
      matchScore += 15
      matchReasons.push(`Song matches ${LANE_DEFINITIONS[artistLane as keyof typeof LANE_DEFINITIONS].name} lane`)
    }

    // Check content fit match
    if (tags.contentFit) {
      if (contentAnalysis.topPerformingType === 'visual' && tags.contentFit === 'visual-heavy') {
        matchScore += 20
        matchReasons.push('Visual content is performing well, song is visual-heavy')
        keyMetrics.push('content:visual')
      } else if (contentAnalysis.topPerformingType === 'emotional' && tags.contentFit === 'story-driven') {
        matchScore += 20
        matchReasons.push('Emotional content resonating, song is story-driven')
        keyMetrics.push('content:emotional')
      } else if (contentAnalysis.topPerformingType === 'viral' && tags.contentFit === 'viral-potential') {
        matchScore += 25
        matchReasons.push('Viral content performing, song has viral potential')
        keyMetrics.push('content:viral')
      } else if (tags.contentFit === 'snippet-ready') {
        matchScore += 10
        matchReasons.push('Song is snippet-ready (good for quick content)')
      }
    }

    // Check emotion match (if emotional content is working)
    if (contentAnalysis.topPerformingType === 'emotional' && tags.emotion) {
      matchScore += 15
      matchReasons.push(`Emotional content working, song emotion: ${tags.emotion}`)
    }

    // Energy match (high energy when momentum is rising)
    if (readiness.state === 'ready' && tags.energy === 'high') {
      matchScore += 10
      matchReasons.push('High energy song matches rising momentum')
      keyMetrics.push('energy:high')
    } else if (readiness.state === 'building' && tags.energy === 'medium') {
      matchScore += 5
      matchReasons.push('Medium energy song fits building phase')
    }

    // Calculate momentum direction from metrics
    let momentumDirection: 'rising' | 'steady' | 'falling' = 'steady'
    if (metrics.length >= 7) {
      const recent7 = metrics.slice(-7)
      const previous7 = metrics.slice(-14, -7)
      if (previous7.length > 0) {
        const recentAvg = recent7.reduce((sum, m) => sum + m.views + m.saves + m.shares, 0) / recent7.length
        const previousAvg = previous7.reduce((sum, m) => sum + m.views + m.saves + m.shares, 0) / previous7.length
        if (recentAvg > previousAvg * 1.1) {
          momentumDirection = 'rising'
        } else if (recentAvg < previousAvg * 0.9) {
          momentumDirection = 'falling'
        }
      }
    }

    // Only include songs with meaningful match scores
    if (matchScore >= 30) {
      matches.push({
        songId: song.id,
        songName: song.song,
        artistId: artistId,
        artistName: song.artist,
        matchScore: Math.min(100, matchScore),
        matchReasons,
        readinessState: readiness.state,
        currentMomentum: {
          direction: momentumDirection,
          keyMetrics,
        },
        recommendedAction: matchScore >= 60 && readiness.state === 'ready'
          ? 'release_now'
          : matchScore >= 40 && readiness.state === 'building'
          ? 'build_momentum_first'
          : 'wait_for_better_timing',
      })
    }
  }

  // Sort by match score (highest first)
  return matches.sort((a, b) => b.matchScore - a.matchScore)
}

/**
 * Flag songs as Trigger-Ready when conditions align
 * Note: This function requires unreleased songs to be passed in
 * Use findTriggerReadySongs() directly for most use cases
 */
export function flagTriggerReadySongs(
  artistId: string,
  unreleasedSongs: CatalogItem[]
): {
  flagged: number
  matches: TriggerReadyMatch[]
} {
  const matches = findTriggerReadySongs(artistId, unreleasedSongs)
  
  return {
    flagged: matches.filter(m => m.matchScore >= 60 && m.recommendedAction === 'release_now').length,
    matches,
  }
}
