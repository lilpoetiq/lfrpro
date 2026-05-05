/**
 * Post-Release Evaluation System
 * Compares readiness state at release time with Spotify snapshot outcomes
 * Stores internal notes (not exposed to artists)
 */

import { ReleaseReadiness, SpotifySnapshot } from './storage'
import { getCatalog } from './storage'

export interface PostReleaseEvaluation {
  id: string
  releaseId: string
  artistId: string
  releaseDate: string
  evaluatedAt: string
  
  // Readiness state at release time
  readinessAtRelease: {
    state: 'cooling' | 'building' | 'ready'
    momentum: 'rising' | 'steady' | 'falling'
    weightedScore: number
    explanation?: string
  }
  
  // Spotify outcomes (from snapshots)
  spotifyOutcomes: {
    week1Streams?: number
    week1Listeners?: number
    week1SaveRate?: number
    week1PlaylistAdds?: number
    week2Streams?: number
    week2Listeners?: number
    week4Streams?: number
    week4Listeners?: number
    peakStreams?: number
    peakListeners?: number
    totalStreams?: number
    totalListeners?: number
  }
  
  // Internal admin notes (not shown to artists)
  internalNotes: {
    performanceRating: 'exceeded' | 'met' | 'below' | 'significantly_below'
    keyFindings: string[]
    recommendations: string[]
    correlationNotes?: string  // How readiness state correlated with actual performance
  }
  
  // Metadata
  evaluatedBy?: string  // Admin/staff user ID
  isArchived?: boolean
}

/**
 * Evaluate a release after it's been out for a period
 * Compares readiness state at release time with actual Spotify performance
 */
export function evaluateRelease(
  releaseId: string,
  artistId: string,
  releaseDate: string,
  readinessAtRelease: PostReleaseEvaluation['readinessAtRelease'],
  spotifySnapshots: SpotifySnapshot[],
  internalNotes: PostReleaseEvaluation['internalNotes']
): PostReleaseEvaluation {
  // Calculate Spotify outcomes from snapshots
  const releaseDateObj = new Date(releaseDate)
  const week1End = new Date(releaseDateObj.getTime() + 7 * 24 * 60 * 60 * 1000)
  const week2End = new Date(releaseDateObj.getTime() + 14 * 24 * 60 * 60 * 1000)
  const week4End = new Date(releaseDateObj.getTime() + 28 * 24 * 60 * 60 * 1000)

  const week1Snapshots = spotifySnapshots.filter(s => {
    const snapshotDate = new Date(s.weekStart)
    return snapshotDate >= releaseDateObj && snapshotDate <= week1End
  })

  const week2Snapshots = spotifySnapshots.filter(s => {
    const snapshotDate = new Date(s.weekStart)
    return snapshotDate >= releaseDateObj && snapshotDate <= week2End
  })

  const week4Snapshots = spotifySnapshots.filter(s => {
    const snapshotDate = new Date(s.weekStart)
    return snapshotDate >= releaseDateObj && snapshotDate <= week4End
  })

  const allSnapshots = spotifySnapshots.filter(s => {
    const snapshotDate = new Date(s.weekStart)
    return snapshotDate >= releaseDateObj
  })

  // Calculate outcomes
  const week1Streams = week1Snapshots.reduce((sum, s) => sum + s.streams, 0)
  const week1Listeners = Math.max(...week1Snapshots.map(s => s.listeners), 0)
  const week1SaveRate = week1Snapshots.length > 0
    ? week1Snapshots.reduce((sum, s) => sum + s.saveRate, 0) / week1Snapshots.length
    : undefined
  const week1PlaylistAdds = week1Snapshots.reduce((sum, s) => sum + s.playlistAdds, 0)

  const week2Streams = week2Snapshots.reduce((sum, s) => sum + s.streams, 0)
  const week2Listeners = Math.max(...week2Snapshots.map(s => s.listeners), 0)

  const week4Streams = week4Snapshots.reduce((sum, s) => sum + s.streams, 0)
  const week4Listeners = Math.max(...week4Snapshots.map(s => s.listeners), 0)

  const peakStreams = Math.max(...allSnapshots.map(s => s.streams), 0)
  const peakListeners = Math.max(...allSnapshots.map(s => s.listeners), 0)
  const totalStreams = allSnapshots.reduce((sum, s) => sum + s.streams, 0)
  const totalListeners = Math.max(...allSnapshots.map(s => s.listeners), 0)

  // Determine performance rating based on readiness state vs outcomes
  let performanceRating: PostReleaseEvaluation['internalNotes']['performanceRating'] = 'met'
  
  if (readinessAtRelease.state === 'ready') {
    // If released in "ready" state, expect strong performance
    if (week1Streams > 0 && week1Streams < 1000) {
      performanceRating = 'significantly_below'
    } else if (week1Streams < 5000) {
      performanceRating = 'below'
    } else if (week1Streams >= 10000) {
      performanceRating = 'exceeded'
    }
  } else if (readinessAtRelease.state === 'building') {
    // If released in "building" state, moderate expectations
    if (week1Streams > 0 && week1Streams < 500) {
      performanceRating = 'significantly_below'
    } else if (week1Streams < 2000) {
      performanceRating = 'below'
    } else if (week1Streams >= 5000) {
      performanceRating = 'exceeded'
    }
  } else {
    // If released in "cooling" state, lower expectations
    if (week1Streams > 0 && week1Streams < 200) {
      performanceRating = 'significantly_below'
    } else if (week1Streams < 1000) {
      performanceRating = 'below'
    } else if (week1Streams >= 3000) {
      performanceRating = 'exceeded'
    }
  }

  const evaluation: PostReleaseEvaluation = {
    id: `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    releaseId,
    artistId,
    releaseDate,
    evaluatedAt: new Date().toISOString(),
    readinessAtRelease,
    spotifyOutcomes: {
      week1Streams: week1Streams > 0 ? week1Streams : undefined,
      week1Listeners: week1Listeners > 0 ? week1Listeners : undefined,
      week1SaveRate: week1SaveRate !== undefined ? week1SaveRate : undefined,
      week1PlaylistAdds: week1PlaylistAdds > 0 ? week1PlaylistAdds : undefined,
      week2Streams: week2Streams > 0 ? week2Streams : undefined,
      week2Listeners: week2Listeners > 0 ? week2Listeners : undefined,
      week4Streams: week4Streams > 0 ? week4Streams : undefined,
      week4Listeners: week4Listeners > 0 ? week4Listeners : undefined,
      peakStreams: peakStreams > 0 ? peakStreams : undefined,
      peakListeners: peakListeners > 0 ? peakListeners : undefined,
      totalStreams: totalStreams > 0 ? totalStreams : undefined,
      totalListeners: totalListeners > 0 ? totalListeners : undefined,
    },
    internalNotes: {
      ...internalNotes,
      performanceRating,
    },
  }

  return evaluation
}

/**
 * Generate correlation notes comparing readiness state with actual performance
 */
export function generateCorrelationNotes(
  readinessState: 'cooling' | 'building' | 'ready',
  week1Streams: number,
  week1Listeners: number
): string {
  if (readinessState === 'ready' && week1Streams >= 10000) {
    return 'Readiness state accurately predicted strong performance. Release timing was optimal.'
  } else if (readinessState === 'ready' && week1Streams < 5000) {
    return 'Readiness state suggested strong performance, but actual results were below expectations. May indicate external factors (playlist placement, promotion) were not aligned with readiness state.'
  } else if (readinessState === 'building' && week1Streams >= 5000) {
    return 'Performance exceeded expectations for "building" state. Artist may have had strong promotional support or playlist placements that compensated for lower readiness.'
  } else if (readinessState === 'building' && week1Streams < 2000) {
    return 'Performance aligned with "building" state expectations. Consistent with readiness assessment.'
  } else if (readinessState === 'cooling' && week1Streams >= 3000) {
    return 'Performance significantly exceeded expectations for "cooling" state. Strong promotional support or viral factor may have overcome lower readiness metrics.'
  } else if (readinessState === 'cooling' && week1Streams < 1000) {
    return 'Performance aligned with "cooling" state expectations. Release timing may have been suboptimal, confirming readiness assessment.'
  }
  
  return 'Performance data available but correlation analysis pending.'
}
