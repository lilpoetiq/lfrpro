/**
 * Release Readiness Engine
 * Uses momentum calculation + lane-based weighting to determine readiness state
 */

import { MomentumDirection, calculateMomentum } from './momentum'
import { InstagramMetrics, User } from './storage'
import { ArtistLane as NewArtistLane, LANE_DEFINITIONS } from './laneDefinitions'

export type ReadinessState = 'cooling' | 'building' | 'ready'
export type ArtistLane = NewArtistLane | 'emerging' | 'developing' | 'established' | 'elite' // Support both old and new lane types

/**
 * Lane-based weighting configuration
 * Different lanes have different thresholds and weightings for Instagram metrics
 */
export interface LaneWeights {
  views: number
  saves: number
  shares: number
  comments: number
  completionRate: number
  followers: number
  momentumThreshold: number  // Minimum momentum change % to trigger state change
}

export const LANE_CONFIGS: Record<ArtistLane, LaneWeights> = {
  // New lane-based configs
  underground: {
    views: 0.15,      // Less important
    saves: 0.35,      // High - cult loyalty
    shares: 0.3,      // High - underground spread
    comments: 0.2,    // Medium - community engagement
    completionRate: 0.1,
    followers: 0.05,  // Low - not chasing numbers
    momentumThreshold: 12,
  },
  regional: {
    views: 0.3,       // High - local reach
    saves: 0.2,
    shares: 0.3,      // High - local buzz
    comments: 0.2,    // High - community engagement
    completionRate: 0.1,
    followers: 0.15,
    momentumThreshold: 12,
  },
  faith: {
    views: 0.2,
    saves: 0.35,      // High - long-term value
    shares: 0.15,
    comments: 0.15,
    completionRate: 0.25, // High - full message engagement
    followers: 0.2,   // High - community growth
    momentumThreshold: 10,
  },
  creative: {
    views: 0.35,      // High - viral potential
    saves: 0.2,
    shares: 0.3,      // High - aesthetic spread
    comments: 0.1,
    completionRate: 0.25, // High - visual engagement
    followers: 0.15,
    momentumThreshold: 10,
  },
  inspirational: {
    views: 0.2,
    saves: 0.35,      // High - deep connection
    shares: 0.15,
    comments: 0.3,    // High - emotional engagement
    completionRate: 0.25, // High - full story engagement
    followers: 0.15,
    momentumThreshold: 10,
  },
  // Legacy configs (for backward compatibility)
  emerging: {
    views: 0.2,
    saves: 0.3,
    shares: 0.25,
    comments: 0.25,
    completionRate: 0.1,
    followers: 0.1,
    momentumThreshold: 15,
  },
  developing: {
    views: 0.25,
    saves: 0.3,
    shares: 0.2,
    comments: 0.25,
    completionRate: 0.15,
    followers: 0.15,
    momentumThreshold: 12,
  },
  established: {
    views: 0.3,
    saves: 0.25,
    shares: 0.2,
    comments: 0.15,
    completionRate: 0.2,
    followers: 0.2,
    momentumThreshold: 10,
  },
  elite: {
    views: 0.35,
    saves: 0.2,
    shares: 0.15,
    comments: 0.1,
    completionRate: 0.25,
    followers: 0.25,
    momentumThreshold: 8,
  },
}

/**
 * Get default lane for artist (if not set)
 */
function getDefaultLane(user: User): ArtistLane {
  // Use artist's lane if set, otherwise default to 'developing' (legacy)
  return (user.lane as ArtistLane) || 'developing'
}

/**
 * Apply lane-based weights to Instagram metrics
 * Returns weighted score based on lane configuration
 */
function applyLaneWeights(
  metrics: InstagramMetrics[],
  lane: ArtistLane
): number {
  if (metrics.length === 0) return 0

  const config = LANE_CONFIGS[lane]
  const latest = metrics[metrics.length - 1]

  // Normalize metrics to 0-1 scale (using max values as reference)
  // For simplicity, we'll use relative scaling
  const maxViews = Math.max(...metrics.map(m => m.views), 1)
  const maxSaves = Math.max(...metrics.map(m => m.saves), 1)
  const maxShares = Math.max(...metrics.map(m => m.shares), 1)
  const maxComments = Math.max(...metrics.map(m => m.comments), 1)

  const normalizedViews = latest.views / maxViews
  const normalizedSaves = latest.saves / maxSaves
  const normalizedShares = latest.shares / maxShares
  const normalizedComments = latest.comments / maxComments
  const normalizedCompletion = latest.completionRate
  const normalizedFollowers = Math.min(latest.followers / 100000, 1) // Cap at 100k for normalization

  return (
    normalizedViews * config.views +
    normalizedSaves * config.saves +
    normalizedShares * config.shares +
    normalizedComments * config.comments +
    normalizedCompletion * config.completionRate +
    normalizedFollowers * config.followers
  )
}

/**
 * Resolve readiness state from momentum direction
 * 
 * Mapping:
 * - rising → ready (BUT only if metrics quality is good)
 * - steady → building
 * - falling → cooling
 * 
 * Also considers lane-based thresholds and actual metric quality for more nuanced decisions
 * Must be consistent with release decision engine criteria
 */
export function resolveReadinessState(
  momentum: MomentumDirection,
  metrics: InstagramMetrics[],
  user: User
): ReadinessState {
  const lane = getDefaultLane(user)
  const config = LANE_CONFIGS[lane]

  // Check metric quality first - if metrics are poor, can't be ready regardless of momentum
  const hasEnoughDataPoints = metrics.length >= 2
  const avgCompletionRate = metrics.length > 0 
    ? metrics.reduce((sum, m) => sum + (m.completionRate || 0), 0) / metrics.length 
    : 0
  const audienceHeatAboveThreshold = avgCompletionRate > 30 // Minimum threshold
  
  // Check save rate (streams converting)
  const totalViews = metrics.reduce((sum, m) => sum + (m.views || 0), 0)
  const totalSaves = metrics.reduce((sum, m) => sum + (m.saves || 0), 0)
  const avgSaveRate = totalViews > 0 ? totalSaves / totalViews : 0
  const streamsConverting = avgSaveRate >= 0.02 // At least 2% save rate
  
  // Check if audience is inactive
  const audienceInactive = avgCompletionRate < 30
  
  // Base mapping - but override if metrics quality is poor
  let state: ReadinessState = 'building' // default

  if (momentum === 'rising') {
    // Only set to ready if metrics quality is good
    if (hasEnoughDataPoints && audienceHeatAboveThreshold && streamsConverting && !audienceInactive) {
      state = 'ready'
    } else {
      // Rising momentum but poor metrics = building (need to improve metrics)
      state = 'building'
    }
  } else if (momentum === 'falling') {
    state = 'cooling'
  } else {
    // For steady momentum, check weighted score AND metric quality
    const weightedScore = applyLaneWeights(metrics, lane)
    // If weighted score is high AND metrics quality is good, might still be ready
    if (weightedScore > 0.7 && hasEnoughDataPoints && audienceHeatAboveThreshold && streamsConverting && !audienceInactive) {
      state = 'ready'
    } else {
      state = 'building'
    }
  }

  // Final override: if audience is inactive or streams not converting, force to building/cooling
  if (audienceInactive || !streamsConverting) {
    if (momentum === 'falling') {
      state = 'cooling'
    } else {
      state = 'building'
    }
  }

  return state
}

/**
 * Calculate readiness state for an artist
 * Combines momentum calculation with lane-based weighting
 */
export function calculateReadinessState(
  metrics: InstagramMetrics[],
  user: User
): {
  state: ReadinessState
  momentum: MomentumDirection
  momentumData: {
    direction: MomentumDirection
    baseline: number
    recent: number
    changePercent: number
    confidence: number
  }
  lane: ArtistLane
  weightedScore: number
} {
  const lane = getDefaultLane(user)
  const momentumResult = calculateMomentum(metrics)
  const state = resolveReadinessState(momentumResult.direction, metrics, user)
  const weightedScore = applyLaneWeights(metrics, lane)

  return {
    state,
    momentum: momentumResult.direction,
    momentumData: momentumResult,
    lane,
    weightedScore,
  }
}
