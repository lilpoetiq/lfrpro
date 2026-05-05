/**
 * Enhanced Release Readiness Engine
 * Advanced decision engine with time-aware windows, heat separation, momentum speed,
 * lane-based risk tolerance, goal-based weighting, and predictive analytics
 */

import { MomentumDirection, MomentumResult, calculateMomentum } from './momentum'
import { InstagramMetrics, TikTokMetrics, TikTokSongViews, User, PostDropHealth, ReleaseMemory } from './storage'
import { ReadinessState, ArtistLane, LANE_CONFIGS } from './readinessEngine'

// Helper function to get default lane
function getDefaultLane(user: User): ArtistLane {
  return (user.lane as ArtistLane) || 'developing'
}

// ============================================================================
// 1. RELEASE WINDOWS (Time-Aware States)
// ============================================================================

export type ReleaseWindow = 
  | '3-5-day-window'      // Optimal window, act within 3-5 days
  | '24-48-hour-peak'     // Peak moment, act now
  | 'fading'              // Window closing, act immediately
  | 'extended'             // Stable window, less urgent
  | 'no-window'            // Not ready

export interface ReleaseWindowInfo {
  window: ReleaseWindow
  urgency: 'critical' | 'high' | 'medium' | 'low' | 'none'
  estimatedDaysRemaining: number | null
  description: string
}

/**
 * Calculate release window based on momentum trajectory and data freshness
 * Also validates metric quality - won't show window if metrics are poor
 */
export function calculateReleaseWindow(
  momentum: MomentumResult,
  metrics: InstagramMetrics[],
  state: ReadinessState
): ReleaseWindowInfo {
  // Check metric quality - even if state is "ready", validate actual metrics
  const hasEnoughDataPoints = metrics.length >= 2
  const avgCompletionRate = metrics.length > 0 
    ? metrics.reduce((sum, m) => sum + (m.completionRate || 0), 0) / metrics.length 
    : 0
  const audienceHeatAboveThreshold = avgCompletionRate > 30
  
  const totalViews = metrics.reduce((sum, m) => sum + (m.views || 0), 0)
  const totalSaves = metrics.reduce((sum, m) => sum + (m.saves || 0), 0)
  const avgSaveRate = totalViews > 0 ? totalSaves / totalViews : 0
  const streamsConverting = avgSaveRate >= 0.02
  
  // If state is not ready OR metrics quality is poor, no window
  if (state !== 'ready' || !hasEnoughDataPoints || !audienceHeatAboveThreshold || !streamsConverting) {
    return {
      window: 'no-window',
      urgency: 'none',
      estimatedDaysRemaining: null,
      description: !hasEnoughDataPoints 
        ? 'Need more data points (at least 2) before release window can be calculated'
        : !audienceHeatAboveThreshold
        ? 'Audience engagement is too low (completion rate below 30%)'
        : !streamsConverting
        ? 'Content is not converting to saves (save rate below 2%)'
        : 'Not in a release-ready state',
    }
  }

  // Check data freshness (how recent is the latest metric?)
  const latestMetric = metrics[metrics.length - 1]
  const daysSinceLastMetric = (Date.now() - new Date(latestMetric.metricDate).getTime()) / (1000 * 60 * 60 * 24)

  // Calculate momentum velocity (rate of change)
  const velocity = Math.abs(momentum.changePercent)
  const isRising = momentum.direction === 'rising'
  const isFalling = momentum.direction === 'falling'

  // Determine window based on momentum speed and direction
  if (isRising && velocity > 25) {
    // Fast rising momentum - peak window
    return {
      window: '24-48-hour-peak',
      urgency: 'critical',
      estimatedDaysRemaining: 2,
      description: 'Momentum is rising fast — this is your peak window. Act within 24-48 hours.',
    }
  } else if (isRising && velocity > 15) {
    // Moderate rising - good window
    return {
      window: '3-5-day-window',
      urgency: 'high',
      estimatedDaysRemaining: 4,
      description: 'Strong momentum building — optimal window is 3-5 days. Don\'t wait too long.',
    }
  } else if (isFalling && velocity > 15) {
    // Momentum fading - act now
    return {
      window: 'fading',
      urgency: 'critical',
      estimatedDaysRemaining: 1,
      description: 'Momentum is fading — act now before the window closes completely.',
    }
  } else if (momentum.direction === 'steady' && momentum.changePercent > 5) {
    // Stable but positive - extended window
    return {
      window: 'extended',
      urgency: 'medium',
      estimatedDaysRemaining: 7,
      description: 'Stable positive momentum — you have an extended window, but don\'t delay unnecessarily.',
    }
  } else {
    // Default ready state
    return {
      window: '3-5-day-window',
      urgency: 'high',
      estimatedDaysRemaining: 4,
      description: 'Ready state detected — optimal window is 3-5 days.',
    }
  }
}

// ============================================================================
// 2. SEPARATE AUDIENCE HEAT vs CONTENT HEAT
// ============================================================================

export interface HeatScores {
  audienceHeat: number      // 0-100: Followers active, story views, comment velocity, repeat viewers
  contentHeat: number        // 0-100: Reel saves, shares, completion rate, watch time
  combinedHeat: number       // Weighted combination
}

/**
 * Calculate Audience Heat (follower activity, engagement velocity)
 */
function calculateAudienceHeat(metrics: InstagramMetrics[]): number {
  if (metrics.length === 0) return 0

  const latest = metrics[metrics.length - 1]
  const recent = metrics.slice(-3) // Last 3 data points

  // Factors:
  // - Follower growth rate
  // - Comment velocity (comments per view)
  // - Repeat engagement (consistent viewers)
  // - Story views (if available via audience metric)

  const followerGrowth = recent.length > 1
    ? ((latest.followers - recent[0].followers) / recent[0].followers) * 100
    : 0

  const commentVelocity = latest.views > 0 ? (latest.comments / latest.views) * 1000 : 0 // Comments per 1000 views
  const engagementConsistency = recent.length > 1
    ? 1 - (recent.reduce((sum, m, i) => {
        if (i === 0) return sum
        const prev = recent[i - 1]
        const change = Math.abs(m.comments - prev.comments) / Math.max(prev.comments, 1)
        return sum + change
      }, 0) / (recent.length - 1))
    : 0.5

  // Normalize to 0-100
  const followerScore = Math.min(Math.max(followerGrowth * 10, 0), 50) // Max 50 points
  const velocityScore = Math.min(commentVelocity * 2, 30) // Max 30 points
  const consistencyScore = engagementConsistency * 20 // Max 20 points

  return Math.min(followerScore + velocityScore + consistencyScore, 100)
}

/**
 * Calculate Content Heat (content performance, viral potential)
 */
function calculateContentHeat(metrics: InstagramMetrics[]): number {
  if (metrics.length === 0) return 0

  const latest = metrics[metrics.length - 1]

  // Factors:
  // - Save rate (saves per view)
  // - Share rate (shares per view)
  // - Completion rate
  // - Watch time (if available)

  const saveRate = latest.views > 0 ? (latest.saves / latest.views) * 100 : 0
  const shareRate = latest.views > 0 ? (latest.shares / latest.views) * 100 : 0
  const completionScore = latest.completionRate * 100
  const watchTimeScore = latest.watchTime ? Math.min((latest.watchTime / 30) * 10, 20) : 0 // Max 20 points for 30s+ watch time

  // Normalize to 0-100
  const saveScore = Math.min(saveRate * 10, 30) // Max 30 points
  const shareScore = Math.min(shareRate * 20, 30) // Max 30 points
  const completionScoreNormalized = Math.min(completionScore, 20) // Max 20 points

  return Math.min(saveScore + shareScore + completionScoreNormalized + watchTimeScore, 100)
}

/**
 * Calculate both heat scores
 */
export function calculateHeatScores(metrics: InstagramMetrics[]): HeatScores {
  const audienceHeat = calculateAudienceHeat(metrics)
  const contentHeat = calculateContentHeat(metrics)
  
  // Combined heat: weighted average (content slightly more important)
  const combinedHeat = (audienceHeat * 0.4) + (contentHeat * 0.6)

  return {
    audienceHeat: Math.round(audienceHeat),
    contentHeat: Math.round(contentHeat),
    combinedHeat: Math.round(combinedHeat),
  }
}

// ============================================================================
// 3. MOMENTUM SPEED (Fast/Slow/Plateau/Sharp Drop)
// ============================================================================

export type MomentumSpeed = 'rising-fast' | 'rising-slow' | 'plateau' | 'falling-slow' | 'falling-fast' | 'sharp-drop'

export interface MomentumSpeedInfo {
  speed: MomentumSpeed
  velocity: number        // Rate of change (%)
  acceleration: number    // Rate of acceleration (%)
  description: string
  recommendation: string
}

/**
 * Calculate momentum speed and acceleration
 */
export function calculateMomentumSpeed(
  momentum: MomentumResult,
  metrics: InstagramMetrics[]
): MomentumSpeedInfo {
  const velocity = Math.abs(momentum.changePercent)
  const direction = momentum.direction

  // Calculate acceleration (change in velocity over time)
  let acceleration = 0
  if (metrics.length >= 3) {
    const recent = metrics.slice(-3)
    const velocities = recent.map((m, i) => {
      if (i === 0) return 0
      const prev = recent[i - 1]
      const change = ((m.views + m.saves + m.shares) - (prev.views + prev.saves + prev.shares)) / 
                     Math.max(prev.views + prev.saves + prev.shares, 1) * 100
      return change
    })
    acceleration = velocities[velocities.length - 1] - velocities[0]
  }

  let speed: MomentumSpeed
  let description: string
  let recommendation: string

  if (direction === 'rising') {
    if (velocity > 30 && acceleration > 5) {
      speed = 'rising-fast'
      description = 'Momentum is accelerating rapidly'
      recommendation = 'Drop immediately — this is peak momentum. Consider going live or dropping teaser today.'
    } else if (velocity > 15) {
      speed = 'rising-slow'
      description = 'Steady positive growth'
      recommendation = 'Drop within 3-5 days. Maintain content cadence to sustain momentum.'
    } else {
      speed = 'plateau'
      description = 'Stable momentum, minimal growth'
      recommendation = 'Consider dropping a teaser to test response. Full release can wait.'
    }
  } else if (direction === 'falling') {
    if (velocity > 30 && acceleration < -5) {
      speed = 'sharp-drop'
      description = 'Rapid decline in engagement'
      recommendation = 'Wait 72 hours minimum. Focus on content reset before considering release.'
    } else if (velocity > 15) {
      speed = 'falling-fast'
      description = 'Significant decline'
      recommendation = 'Wait 1-2 weeks. Rebuild engagement first.'
    } else {
      speed = 'falling-slow'
      description = 'Gradual decline'
      recommendation = 'Wait 3-5 days. Post high-engagement content to stabilize.'
    }
  } else {
    // Steady
    speed = 'plateau'
    description = 'Stable momentum, no significant change'
    recommendation = 'Maintain current strategy. Release timing is flexible but not urgent.'
  }

  return {
    speed,
    velocity: Math.round(velocity * 10) / 10,
    acceleration: Math.round(acceleration * 10) / 10,
    description,
    recommendation,
  }
}

// ============================================================================
// 4. LANE-BASED RISK TOLERANCE
// ============================================================================

export interface RiskTolerance {
  canDropAtBuilding: boolean
  canDropAtCooling: boolean
  requiresReady: boolean
  riskLevel: 'low' | 'medium' | 'high'
  explanation: string
}

/**
 * Get lane-based risk tolerance
 */
export function getLaneRiskTolerance(lane: ArtistLane): RiskTolerance {
  const configs: Record<ArtistLane, RiskTolerance> = {
    underground: {
      canDropAtBuilding: true,      // Cult fans reward mystery + scarcity
      canDropAtCooling: false,
      requiresReady: false,
      riskLevel: 'low',
      explanation: 'Underground/cult lanes can drop during Building phase. Fans reward mystery and scarcity.',
    },
    regional: {
      canDropAtBuilding: true,      // Local buzz can work even if not perfect
      canDropAtCooling: false,
      requiresReady: false,
      riskLevel: 'medium',
      explanation: 'Regional releases can work during Building if local engagement is present.',
    },
    faith: {
      canDropAtBuilding: false,     // Needs strong context
      canDropAtCooling: false,
      requiresReady: true,
      riskLevel: 'high',
      explanation: 'Faith/inspirational lanes require Ready state or strong contextual narrative.',
    },
    creative: {
      canDropAtBuilding: true,      // Can drop even while Cooling if narrative strong
      canDropAtCooling: true,       // Experimental can work with strong narrative
      requiresReady: false,
      riskLevel: 'low',
      explanation: 'Creative/experimental lanes can drop even during Cooling if narrative is strong.',
    },
    inspirational: {
      canDropAtBuilding: false,     // Needs emotional readiness
      canDropAtCooling: false,
      requiresReady: true,
      riskLevel: 'high',
      explanation: 'Inspirational/healing lanes need Ready state for emotional impact.',
    },
    // Legacy lanes
    emerging: {
      canDropAtBuilding: true,
      canDropAtCooling: false,
      requiresReady: false,
      riskLevel: 'medium',
      explanation: 'Emerging artists can take calculated risks during Building phase.',
    },
    developing: {
      canDropAtBuilding: true,
      canDropAtCooling: false,
      requiresReady: false,
      riskLevel: 'medium',
      explanation: 'Developing artists can drop during Building with proper support.',
    },
    established: {
      canDropAtBuilding: false,
      canDropAtCooling: false,
      requiresReady: true,
      riskLevel: 'medium',
      explanation: 'Established artists should wait for Ready state to maintain momentum.',
    },
    elite: {
      canDropAtBuilding: false,
      canDropAtCooling: false,
      requiresReady: true,
      riskLevel: 'high',
      explanation: 'Elite artists require Ready state to maintain brand positioning.',
    },
  }

  return configs[lane] || configs.developing
}

// ============================================================================
// 5. RELEASE GOAL SELECTOR
// ============================================================================

export type ReleaseGoal = 'streams' | 'discovery' | 'fan-conversion' | 'algorithm-push' | 'revenue'

export interface GoalWeights {
  views: number
  saves: number
  shares: number
  comments: number
  completionRate: number
  followers: number
}

/**
 * Get metric weights based on release goal
 */
export function getGoalWeights(goal: ReleaseGoal): GoalWeights {
  const weights: Record<ReleaseGoal, GoalWeights> = {
    streams: {
      views: 0.3,
      saves: 0.35,        // High - saves = repeat streams
      shares: 0.15,
      comments: 0.1,
      completionRate: 0.3, // High - completion = full stream
      followers: 0.1,
    },
    discovery: {
      views: 0.4,         // High - reach matters
      saves: 0.2,
      shares: 0.35,       // High - shares = discovery
      comments: 0.15,
      completionRate: 0.2,
      followers: 0.25,   // High - new followers = discovery
    },
    'fan-conversion': {
      views: 0.2,
      saves: 0.3,
      shares: 0.2,
      comments: 0.35,     // High - comments = engagement
      completionRate: 0.25,
      followers: 0.4,     // High - follower growth = conversion
    },
    'algorithm-push': {
      views: 0.35,        // High - views = algorithm signal
      saves: 0.3,         // High - saves = quality signal
      shares: 0.25,       // High - shares = viral signal
      comments: 0.2,
      completionRate: 0.35, // High - completion = engagement
      followers: 0.15,
    },
    revenue: {
      views: 0.25,
      saves: 0.3,         // High - saves = repeat = revenue
      shares: 0.2,
      comments: 0.15,
      completionRate: 0.4, // High - completion = full value
      followers: 0.2,
    },
  }

  return weights[goal] || weights.streams
}

/**
 * Calculate readiness score with goal-based weighting
 */
export function calculateGoalBasedScore(
  metrics: InstagramMetrics[],
  goal: ReleaseGoal,
  lane: ArtistLane
): number {
  if (metrics.length === 0) return 0

  const goalWeights = getGoalWeights(goal)
  const laneConfig = LANE_CONFIGS[lane]
  const latest = metrics[metrics.length - 1]

  // Normalize metrics
  const maxViews = Math.max(...metrics.map(m => m.views), 1)
  const maxSaves = Math.max(...metrics.map(m => m.saves), 1)
  const maxShares = Math.max(...metrics.map(m => m.shares), 1)
  const maxComments = Math.max(...metrics.map(m => m.comments), 1)

  const normalizedViews = latest.views / maxViews
  const normalizedSaves = latest.saves / maxSaves
  const normalizedShares = latest.shares / maxShares
  const normalizedComments = latest.comments / maxComments
  const normalizedCompletion = latest.completionRate
  const normalizedFollowers = Math.min(latest.followers / 100000, 1)

  // Combine goal weights with lane weights (50/50 blend)
  const combinedWeights = {
    views: (goalWeights.views + laneConfig.views) / 2,
    saves: (goalWeights.saves + laneConfig.saves) / 2,
    shares: (goalWeights.shares + laneConfig.shares) / 2,
    comments: (goalWeights.comments + laneConfig.comments) / 2,
    completionRate: (goalWeights.completionRate + laneConfig.completionRate) / 2,
    followers: (goalWeights.followers + laneConfig.followers) / 2,
  }

  return (
    normalizedViews * combinedWeights.views +
    normalizedSaves * combinedWeights.saves +
    normalizedShares * combinedWeights.shares +
    normalizedComments * combinedWeights.comments +
    normalizedCompletion * combinedWeights.completionRate +
    normalizedFollowers * combinedWeights.followers
  )
}

// ============================================================================
// 6. "WHY THIS MATTERS" HUMAN-READABLE EXPLANATIONS
// ============================================================================

export function generateWhyThisMatters(
  state: ReadinessState,
  window: ReleaseWindowInfo,
  heat: HeatScores,
  speed: MomentumSpeedInfo,
  riskTolerance: RiskTolerance
): string {
  if (state === 'ready') {
    if (window.window === '24-48-hour-peak') {
      return 'Dropping now means maximum visibility — your audience is actively checking in and ready to engage. Wait 2 days and you\'ll miss the peak.'
    } else if (window.window === 'fading') {
      return 'Your momentum is fading — act now before the window closes completely. Every day you wait, fewer people will see the post.'
    } else if (window.window === '3-5-day-window') {
      return 'Your audience is paying attention and engagement is strong — perfect time to convert that attention into streams. Don\'t wait too long or momentum will fade.'
    } else {
      return 'You\'re in a good position — audience is engaged and ready. Timing is flexible but don\'t delay unnecessarily.'
    }
  } else if (state === 'building') {
    if (heat.audienceHeat > 70 && heat.contentHeat < 50) {
      return 'Your audience is hot but content isn\'t landing — push a teaser NOW to test response before full drop.'
    } else if (heat.contentHeat > 70 && heat.audienceHeat < 50) {
      return 'One piece of content is viral but your fanbase is quiet — tease the song, don\'t drop yet. Build anticipation first.'
    } else {
      return 'Engagement is steady but not peaking yet — tease, don\'t drop. Your audience needs more time to build anticipation.'
    }
  } else {
    // cooling
    if (riskTolerance.canDropAtCooling) {
      return 'Not optimal, but acceptable for your lane if you have strong narrative or context. Otherwise, wait and rebuild.'
    } else {
      return 'Dropping now means fewer people will even see the post. Wait and rebuild engagement first — protect your music from dying on arrival.'
    }
  }
}

// ============================================================================
// 7. FALSE GREEN PROTECTION
// ============================================================================

export interface FalseGreenCheck {
  isFalseGreen: boolean
  confidence: 'high' | 'medium' | 'low'
  reason: string
  recommendation: string
}

/**
 * Check if "ready" state is false green (spike-driven)
 */
export function checkFalseGreen(
  metrics: InstagramMetrics[],
  momentum: MomentumResult,
  state: ReadinessState
): FalseGreenCheck {
  if (state !== 'ready') {
    return {
      isFalseGreen: false,
      confidence: 'high',
      reason: 'Not in ready state',
      recommendation: '',
    }
  }

  // Need at least 2-3 data points to confirm
  if (metrics.length < 2) {
    return {
      isFalseGreen: true,
      confidence: 'high',
      reason: 'Only one data point — need 2-3 to confirm momentum',
      recommendation: 'Wait for another post to confirm this isn\'t a spike. Green, but spike-driven — confirm with another post.',
    }
  }

  // Check if recent spike is outlier
  const recent = metrics.slice(-3)
  if (recent.length >= 2) {
    const latest = recent[recent.length - 1]
    const previous = recent[recent.length - 2]
    
    // If latest is >50% higher than previous, might be spike
    const spikeRatio = latest.views / Math.max(previous.views, 1)
    if (spikeRatio > 1.5 && recent.length < 3) {
      return {
        isFalseGreen: true,
        confidence: 'medium',
        reason: 'Recent spike detected — need more data points to confirm',
        recommendation: 'Green, but spike-driven — confirm with another post before dropping.',
      }
    }
  }

  // Check momentum consistency
  if (momentum.confidence < 0.5) {
    return {
      isFalseGreen: true,
      confidence: 'medium',
      reason: 'Low confidence in momentum calculation — insufficient data',
      recommendation: 'Wait for more consistent data points before confirming ready state.',
    }
  }

  return {
    isFalseGreen: false,
    confidence: 'high',
    reason: 'Multiple data points confirm sustained momentum',
    recommendation: '',
  }
}

// ============================================================================
// 8. TIKTOK → RELEASE SYNC
// ============================================================================

export interface TikTokSyncAnalysis {
  tikTokSpikeBeforeIG: boolean
  tikTokSpikeAfterIG: boolean
  tikTokStableHigh: boolean
  recommendation: string
  urgency: 'high' | 'medium' | 'low'
}

/**
 * Analyze TikTok data relative to Instagram for release timing
 */
export function analyzeTikTokSync(
  tikTokMetrics: TikTokMetrics[],
  tikTokSongViews: TikTokSongViews[],
  instagramMetrics: InstagramMetrics[]
): TikTokSyncAnalysis {
  if (tikTokMetrics.length === 0 && tikTokSongViews.length === 0) {
    return {
      tikTokSpikeBeforeIG: false,
      tikTokSpikeAfterIG: false,
      tikTokStableHigh: false,
      recommendation: 'No TikTok data available — rely on Instagram metrics only.',
      urgency: 'low',
    }
  }

  // Check TikTok song views for spikes
  const recentTikTokViews = tikTokSongViews
    .sort((a, b) => new Date(b.metricDate).getTime() - new Date(a.metricDate).getTime())
    .slice(0, 3)

  if (recentTikTokViews.length >= 2) {
    const latest = recentTikTokViews[0]
    const previous = recentTikTokViews[1]
    const tikTokSpike = latest.views > previous.views * 1.5

    // Compare TikTok spike timing to Instagram metrics
    const latestIG = instagramMetrics[instagramMetrics.length - 1]
    const tikTokDate = new Date(latest.metricDate)
    const igDate = new Date(latestIG.metricDate)

    if (tikTokSpike && tikTokDate < igDate) {
      // TikTok spiked BEFORE Instagram
      return {
        tikTokSpikeBeforeIG: true,
        tikTokSpikeAfterIG: false,
        tikTokStableHigh: false,
        recommendation: 'TikTok sound spiked BEFORE Instagram engagement — delay drop, push snippet to capitalize on TikTok momentum first.',
        urgency: 'high',
      }
    } else if (tikTokSpike && tikTokDate > igDate) {
      // TikTok spiked AFTER Instagram
      return {
        tikTokSpikeBeforeIG: false,
        tikTokSpikeAfterIG: true,
        tikTokStableHigh: false,
        recommendation: 'TikTok sound spiked AFTER Instagram — accelerate release to ride both waves simultaneously.',
        urgency: 'high',
      }
    }
  }

  // Check for stable high TikTok saves (if available in metrics)
  const stableHighSaves = tikTokMetrics.length > 0 && 
    tikTokMetrics.every(m => m.views > 10000) // Threshold for "high"

  if (stableHighSaves) {
    return {
      tikTokSpikeBeforeIG: false,
      tikTokSpikeAfterIG: false,
      tikTokStableHigh: true,
      recommendation: 'TikTok views are stable but high — perfect long-tail drop timing. Release now for sustained growth.',
      urgency: 'medium',
    }
  }

  return {
    tikTokSpikeBeforeIG: false,
    tikTokSpikeAfterIG: false,
    tikTokStableHigh: false,
    recommendation: 'TikTok data available but no significant patterns detected — follow Instagram readiness guidance.',
    urgency: 'low',
  }
}

// ============================================================================
// 9. STAFF OVERRIDE WITH MEMORY
// ============================================================================

export interface StaffOverride {
  id: string
  artistId: string
  overriddenState: ReadinessState
  originalState: ReadinessState
  reason: string
  overriddenBy: string
  overriddenAt: string
  releaseDate?: string
  outcome?: {
    streams?: number
    performance?: 'exceeded' | 'met' | 'below' | 'significantly_below'
    notes?: string
    evaluatedAt?: string
  }
}

// ============================================================================
// 10. FATIGUE DETECTION
// ============================================================================

export interface FatigueAnalysis {
  hasFatigue: boolean
  fatigueTypes: Array<{
    type: 'overposting' | 'same-format' | 'audience-mismatch'
    severity: 'low' | 'medium' | 'high'
    description: string
    recommendation: string
  }>
  overallRecommendation: string
}

/**
 * Detect fatigue patterns in metrics
 */
export function detectFatigue(metrics: InstagramMetrics[]): FatigueAnalysis {
  if (metrics.length < 3) {
    return {
      hasFatigue: false,
      fatigueTypes: [],
      overallRecommendation: 'Insufficient data to detect fatigue patterns',
    }
  }

  const recent = metrics.slice(-7) // Last 7 data points
  const fatigueTypes: FatigueAnalysis['fatigueTypes'] = []

  // 1. Overposting fatigue: Too many posts, engagement thinning
  const postsPerDay = recent.length / 7
  const avgEngagement = recent.reduce((sum, m) => sum + (m.comments + m.shares + m.saves), 0) / recent.length
  const earlyEngagement = recent.slice(0, 3).reduce((sum, m) => sum + (m.comments + m.shares + m.saves), 0) / 3
  const lateEngagement = recent.slice(-3).reduce((sum, m) => sum + (m.comments + m.shares + m.saves), 0) / 3

  if (postsPerDay > 1.5 && lateEngagement < earlyEngagement * 0.7) {
    const severity = postsPerDay > 2 ? 'high' : postsPerDay > 1.5 ? 'medium' : 'low'
    fatigueTypes.push({
      type: 'overposting',
      severity,
      description: `Posting ${postsPerDay.toFixed(1)}x per day, but engagement dropped ${((1 - lateEngagement / earlyEngagement) * 100).toFixed(0)}%`,
      recommendation: 'Take 48 hours off posting, come back with a new format.',
    })
  }

  // 2. Same-format fatigue: Consistent metrics suggest same content style
  const engagementVariance = recent.reduce((sum, m, i) => {
    if (i === 0) return sum
    const prev = recent[i - 1]
    const variance = Math.abs((m.comments + m.shares) - (prev.comments + prev.shares)) / Math.max(prev.comments + prev.shares, 1)
    return sum + variance
  }, 0) / (recent.length - 1)

  if (engagementVariance < 0.15 && recent.length >= 5) {
    fatigueTypes.push({
      type: 'same-format',
      severity: 'medium',
      description: 'Engagement patterns are too consistent — likely posting same format repeatedly',
      recommendation: 'Switch up content format: try reels if doing posts, try stories if doing reels, change visual style.',
    })
  }

  // 3. Audience mismatch: High views but low engagement
  const avgViews = recent.reduce((sum, m) => sum + m.views, 0) / recent.length
  const avgEngagementRate = (recent.reduce((sum, m) => sum + (m.comments + m.shares + m.saves), 0) / recent.length) / avgViews

  if (avgViews > 1000 && avgEngagementRate < 0.02) {
    fatigueTypes.push({
      type: 'audience-mismatch',
      severity: 'high',
      description: 'High views but low engagement — audience is watching but not reacting',
      recommendation: 'Audience active but not connecting — change content approach to match what they actually want.',
    })
  }

  let overallRecommendation = ''
  if (fatigueTypes.length > 0) {
    const highSeverity = fatigueTypes.filter(f => f.severity === 'high')
    if (highSeverity.length > 0) {
      overallRecommendation = highSeverity[0].recommendation
    } else {
      overallRecommendation = fatigueTypes[0].recommendation
    }
  }

  return {
    hasFatigue: fatigueTypes.length > 0,
    fatigueTypes,
    overallRecommendation: overallRecommendation || 'No fatigue detected',
  }
}

// ============================================================================
// 11. PRE-RELEASE SIMULATION
// ============================================================================

export interface ReleaseSimulation {
  highChance: string
  moderateChance: string
  lowChance: string
  bestCase: string
  worstCase: string
  confidence: 'low' | 'medium' | 'high'
}

/**
 * Simulate release outcomes based on current readiness
 */
export function simulateReleaseOutcome(
  readiness: EnhancedReadinessResult,
  goal: ReleaseGoal
): ReleaseSimulation {
  const { state, heat, momentumSpeed, window, riskTolerance } = readiness
  const combinedHeat = heat.combinedHeat
  const momentumVelocity = momentumSpeed.velocity

  let highChance = ''
  let moderateChance = ''
  let lowChance = ''
  let bestCase = ''
  let worstCase = ''
  let confidence: 'low' | 'medium' | 'high' = 'medium'

  if (state === 'ready' && combinedHeat > 70 && momentumVelocity > 15) {
    highChance = 'High chance of strong initial reach and sustained engagement'
    moderateChance = 'Moderate chance of breakout if content resonates'
    lowChance = 'Low chance of underperformance — conditions are optimal'
    bestCase = 'Viral potential: 10k+ streams in first week, playlist adds, TikTok traction'
    worstCase = 'Solid start: 2-5k streams, steady growth, fan conversion'
    confidence = 'high'
  } else if (state === 'ready' && combinedHeat > 50) {
    highChance = 'High chance of solid start with core audience'
    moderateChance = 'Moderate chance of breakout if momentum continues'
    lowChance = 'Low chance of low reach — good conditions but not peak'
    bestCase = 'Strong start: 5-10k streams, good engagement, playlist consideration'
    worstCase = 'Decent start: 1-3k streams, steady but not explosive'
    confidence = 'medium'
  } else if (state === 'building' && riskTolerance.canDropAtBuilding) {
    highChance = 'High chance of core fan engagement'
    moderateChance = 'Moderate chance of discovery if content is strong'
    lowChance = 'Low chance of wide reach — audience not fully warmed up'
    bestCase = 'Core fan success: 2-5k streams, strong fan reaction, building momentum'
    worstCase = 'Quiet start: 500-2k streams, needs more promotion'
    confidence = 'medium'
  } else if (state === 'building') {
    highChance = 'High chance of low initial reach'
    moderateChance = 'Moderate chance of steady growth over time'
    lowChance = 'Low chance of breakout — timing not optimal'
    bestCase = 'Slow burn: 1-3k streams, builds over weeks'
    worstCase = 'Underperformance: <1k streams, needs relaunch later'
    confidence = 'high'
  } else {
    // Cooling
    highChance = 'High chance of low reach and minimal engagement'
    moderateChance = 'Moderate chance of core fan support only'
    lowChance = 'Low chance of discovery or growth'
    bestCase = 'Core fans only: 500-1k streams, minimal impact'
    worstCase = 'Dying on arrival: <500 streams, wasted release'
    confidence = 'high'
  }

  // Adjust based on goal
  if (goal === 'discovery') {
    if (state !== 'ready') {
      highChance = 'High chance of low discovery — audience not primed for new listeners'
    }
  } else if (goal === 'revenue') {
    if (combinedHeat < 60) {
      highChance = 'High chance of low revenue — engagement not strong enough for repeat streams'
    }
  }

  return {
    highChance,
    moderateChance,
    lowChance,
    bestCase,
    worstCase,
    confidence,
  }
}

// ============================================================================
// 12. AUDIENCE SEGMENTATION AWARENESS
// ============================================================================

export interface AudienceSegmentation {
  coreFans: number      // % of engagement from repeat viewers
  casualFollowers: number // % from occasional engagers
  newViewers: number    // % from new audience
  insight: string
  recommendation: string
}

/**
 * Analyze audience segmentation (simplified - would need more data in production)
 */
export function analyzeAudienceSegmentation(metrics: InstagramMetrics[]): AudienceSegmentation {
  if (metrics.length < 3) {
    return {
      coreFans: 0,
      casualFollowers: 0,
      newViewers: 0,
      insight: 'Insufficient data for segmentation',
      recommendation: 'Need more data points to analyze audience segments',
    }
  }

  const recent = metrics.slice(-5)
  const latest = recent[recent.length - 1]

  // Estimate segmentation based on engagement patterns
  // High completion rate + saves = core fans
  // High views + low engagement = new viewers
  // Moderate everything = casual followers

  const completionScore = latest.completionRate
  const saveRate = latest.views > 0 ? latest.saves / latest.views : 0
  const engagementRate = latest.views > 0 ? (latest.comments + latest.shares) / latest.views : 0

  // Core fans: high completion + saves
  const coreFans = Math.min((completionScore * 0.5 + saveRate * 50) * 100, 100)
  
  // New viewers: high views, low engagement
  const newViewers = latest.views > 1000 && engagementRate < 0.02 ? 60 : 20
  
  // Casual: the rest
  const casualFollowers = 100 - coreFans - newViewers

  let insight = ''
  let recommendation = ''

  if (newViewers > 50 && coreFans < 30) {
    insight = 'Engagement rising, but mostly from new viewers — audience expanding but not converting'
    recommendation = 'Drop a teaser, not the full song. Convert new viewers to engaged fans first.'
  } else if (coreFans > 50) {
    insight = 'Strong core fan engagement — audience is loyal and ready'
    recommendation = 'Core fans are active — full drop recommended, they\'ll carry it.'
  } else if (casualFollowers > 60) {
    insight = 'Casual follower engagement — audience is present but not deeply connected'
    recommendation = 'Build deeper connection before drop — engage with comments, create anticipation.'
  } else {
    insight = 'Balanced audience mix — good foundation for release'
    recommendation = 'Audience mix is healthy — proceed with release strategy.'
  }

  return {
    coreFans: Math.round(coreFans),
    casualFollowers: Math.round(casualFollowers),
    newViewers: Math.round(newViewers),
    insight,
    recommendation,
  }
}

// ============================================================================
// 13. CONTENT-TO-SONG MATCH SCORE
// ============================================================================

export interface ContentSongMatch {
  matchScore: number    // 0-100
  moodMatch: number
  tempoMatch: number
  messageMatch: number
  visualEnergyMatch: number
  mismatch: boolean
  recommendation: string
}

/**
 * Rate how well recent content matches song characteristics
 * Note: This requires song metadata (readinessTags) to compare
 */
export function calculateContentSongMatch(
  metrics: InstagramMetrics[],
  songTags?: {
    energy?: 'low' | 'medium' | 'high'
    emotion?: string
    contentFit?: string
  }
): ContentSongMatch {
  if (!songTags) {
    return {
      matchScore: 50,
      moodMatch: 50,
      tempoMatch: 50,
      messageMatch: 50,
      visualEnergyMatch: 50,
      mismatch: false,
      recommendation: 'No song metadata available — cannot calculate match score',
    }
  }

  const recent = metrics.slice(-3)
  const latest = recent[recent.length - 1]

  // Analyze content characteristics from metrics
  // High completion + saves = deep/emotional content
  // High shares = energetic/viral content
  // High comments = engaging/relatable content

  const isEnergetic = latest.shares > latest.saves * 1.5
  const isEmotional = latest.completionRate > 0.7 && latest.saves > latest.shares
  const isEngaging = latest.comments > latest.shares

  // Match against song tags
  let moodMatch = 50
  let tempoMatch = 50
  let messageMatch = 50
  let visualEnergyMatch = 50

  if (songTags.energy === 'high' && isEnergetic) {
    visualEnergyMatch = 90
    tempoMatch = 85
  } else if (songTags.energy === 'high' && !isEnergetic) {
    visualEnergyMatch = 30
    tempoMatch = 25
  } else if (songTags.energy === 'low' && !isEnergetic) {
    visualEnergyMatch = 85
    tempoMatch = 80
  }

  if (songTags.emotion && isEmotional) {
    moodMatch = 85
    messageMatch = 80
  } else if (songTags.emotion && !isEmotional) {
    moodMatch = 35
    messageMatch = 30
  }

  const matchScore = (moodMatch + tempoMatch + messageMatch + visualEnergyMatch) / 4
  const mismatch = matchScore < 50

  let recommendation = ''
  if (mismatch) {
    recommendation = `Your audience warmed up to ${isEnergetic ? 'energetic' : 'emotional'} content — song is ${songTags.energy === 'high' ? 'high energy' : 'low energy'}. Re-align content before drop.`
  } else {
    recommendation = 'Content matches song energy — audience is primed for this release.'
  }

  return {
    matchScore: Math.round(matchScore),
    moodMatch: Math.round(moodMatch),
    tempoMatch: Math.round(tempoMatch),
    messageMatch: Math.round(messageMatch),
    visualEnergyMatch: Math.round(visualEnergyMatch),
    mismatch,
    recommendation,
  }
}

// ============================================================================
// 14. DROP TYPE RECOMMENDATION
// ============================================================================

export type DropType = 
  | 'soft-drop'        // Quiet release, no big announcement
  | 'midnight-drop'    // Traditional midnight release
  | 'visual-first'     // Visual/artwork first, then audio
  | 'snippet-only'     // Just a snippet/teaser
  | 'tiktok-first'     // TikTok sound first, then full
  | 'surprise-drop'    // No warning, just drop
  | 'announced-drop'   // Full campaign, announced date

export interface DropTypeRecommendation {
  recommendedType: DropType
  alternatives: DropType[]
  reasoning: string
  timing: string
}

/**
 * Recommend drop type based on readiness and momentum
 */
export function recommendDropType(
  readiness: EnhancedReadinessResult,
  heat: HeatScores
): DropTypeRecommendation {
  const { state, window, momentumSpeed, lane, riskTolerance } = readiness

  let recommendedType: DropType = 'announced-drop'
  const alternatives: DropType[] = []
  let reasoning = ''
  let timing = ''

  if (state === 'ready' && window.window === '24-48-hour-peak') {
    recommendedType = 'surprise-drop'
    alternatives.push('midnight-drop', 'tiktok-first')
    reasoning = 'Peak momentum — capitalize immediately with surprise drop'
    timing = 'Drop within 24-48 hours'
  } else if (state === 'ready' && heat.contentHeat > 70 && heat.audienceHeat < 50) {
    recommendedType = 'visual-first'
    alternatives.push('snippet-only', 'tiktok-first')
    reasoning = 'Content is viral but audience needs warming — lead with visuals'
    timing = 'Drop visual/artwork first, audio 24-48h later'
  } else if (state === 'ready' && heat.audienceHeat > 70 && heat.contentHeat < 50) {
    recommendedType = 'snippet-only'
    alternatives.push('soft-drop', 'tiktok-first')
    reasoning = 'Audience is hot but content isn\'t landing — test with snippet first'
    timing = 'Drop snippet/teaser, gauge response before full release'
  } else if (momentumSpeed.speed === 'rising-fast') {
    recommendedType = 'tiktok-first'
    alternatives.push('surprise-drop', 'midnight-drop')
    reasoning = 'Fast-rising momentum — TikTok-first to maximize viral potential'
    timing = 'Drop TikTok sound immediately, full release 24-48h later'
  } else if (lane === 'underground' || lane === 'creative') {
    recommendedType = 'surprise-drop'
    alternatives.push('soft-drop', 'visual-first')
    reasoning = `${lane} lane rewards mystery and surprise drops`
    timing = 'Drop unannounced when ready'
  } else if (state === 'building' && riskTolerance.canDropAtBuilding) {
    recommendedType = 'soft-drop'
    alternatives.push('snippet-only', 'announced-drop')
    reasoning = 'Building phase — soft drop to test waters without big commitment'
    timing = 'Drop quietly, build organically'
  } else if (state === 'ready' && window.window === 'extended') {
    recommendedType = 'announced-drop'
    alternatives.push('midnight-drop', 'visual-first')
    reasoning = 'Extended window — time to build anticipation with announcement'
    timing = 'Announce 3-5 days out, drop at optimal time'
  } else {
    recommendedType = 'midnight-drop'
    alternatives.push('announced-drop')
    reasoning = 'Standard release timing — traditional midnight drop'
    timing = 'Schedule for Friday midnight release'
  }

  return {
    recommendedType,
    alternatives,
    reasoning,
    timing,
  }
}

// ============================================================================
// 15. POST-DROP HEALTH MONITOR
// ============================================================================
// Note: PostDropHealth interface is defined in storage.ts and imported above

// ============================================================================
// 16. NARRATIVE CONTINUITY TRACKER
// ============================================================================

export interface NarrativeContinuity {
  hasContinuity: boolean
  continuityScore: number  // 0-100
  narrativeStrength: 'strong' | 'moderate' | 'weak' | 'none'
  recommendation: string
}

/**
 * Track if artist has been telling a story (simplified - would need content analysis in production)
 */
export function analyzeNarrativeContinuity(metrics: InstagramMetrics[]): NarrativeContinuity {
  if (metrics.length < 5) {
    return {
      hasContinuity: false,
      continuityScore: 0,
      narrativeStrength: 'none',
      recommendation: 'Need more data to analyze narrative continuity',
    }
  }

  // Analyze engagement consistency as proxy for narrative
  // Consistent high engagement = strong narrative
  // Erratic engagement = random posting

  const recent = metrics.slice(-7)
  const engagementValues = recent.map(m => m.comments + m.shares + m.saves)
  const avgEngagement = engagementValues.reduce((a, b) => a + b, 0) / engagementValues.length
  
  // Calculate consistency (lower variance = more consistent = stronger narrative)
  const variance = engagementValues.reduce((sum, val) => {
    return sum + Math.pow(val - avgEngagement, 2)
  }, 0) / engagementValues.length
  const stdDev = Math.sqrt(variance)
  const coefficientOfVariation = avgEngagement > 0 ? stdDev / avgEngagement : 1

  // Low variance + high completion = strong narrative
  const completionAvg = recent.reduce((sum, m) => sum + m.completionRate, 0) / recent.length
  const continuityScore = Math.max(0, 100 - (coefficientOfVariation * 100) + (completionAvg * 30))

  let narrativeStrength: 'strong' | 'moderate' | 'weak' | 'none' = 'none'
  let recommendation = ''

  if (continuityScore > 70 && completionAvg > 0.6) {
    narrativeStrength = 'strong'
    recommendation = 'Momentum supported by strong narrative — green light for release.'
  } else if (continuityScore > 50) {
    narrativeStrength = 'moderate'
    recommendation = 'Some narrative continuity — consider linking next post to song\'s story.'
  } else if (continuityScore > 30) {
    narrativeStrength = 'weak'
    recommendation = 'Audience attention scattered — anchor next post to the song\'s story before dropping.'
  } else {
    narrativeStrength = 'none'
    recommendation = 'Random posting detected — create narrative continuity before release to maximize impact.'
  }

  return {
    hasContinuity: continuityScore > 50,
    continuityScore: Math.round(continuityScore),
    narrativeStrength,
    recommendation,
  }
}

// ============================================================================
// 17. MARKET NOISE AWARENESS
// ============================================================================

export interface MarketNoise {
  hasNoise: boolean
  noiseTypes: Array<{
    type: 'competing-release' | 'cultural-moment' | 'platform-dip'
    severity: 'low' | 'medium' | 'high'
    description: string
  }>
  recommendation: string
}

/**
 * Check for market noise (simplified - would need external data in production)
 */
export function checkMarketNoise(releaseDate?: string): MarketNoise {
  // In production, this would check:
  // - Major artist releases on same day
  // - Cultural events/holidays
  // - Platform-wide engagement dips
  
  // For now, simplified version that checks day of week
  const today = new Date()
  const dayOfWeek = today.getDay()
  
  // Friday/Saturday = more competition
  // Monday/Tuesday = less competition
  const noiseTypes: MarketNoise['noiseTypes'] = []
  
  if (dayOfWeek === 5 || dayOfWeek === 6) { // Friday/Saturday
    noiseTypes.push({
      type: 'competing-release',
      severity: 'high',
      description: 'Weekend releases — high competition from major artists',
    })
  }

  // Check if release date is near major holidays (simplified)
  const month = today.getMonth()
  const date = today.getDate()
  if ((month === 11 && date >= 20) || (month === 0 && date <= 5)) { // Late Dec/Early Jan
    noiseTypes.push({
      type: 'cultural-moment',
      severity: 'medium',
      description: 'Holiday season — audience attention may be split',
    })
  }

  let recommendation = ''
  if (noiseTypes.length > 0) {
    const highSeverity = noiseTypes.find(n => n.severity === 'high')
    if (highSeverity) {
      recommendation = 'Audience attention split today — delay 24 hours for better visibility.'
    } else {
      recommendation = 'Some market noise detected — consider timing, but not critical.'
    }
  } else {
    recommendation = 'No significant market noise detected — good timing for release.'
  }

  return {
    hasNoise: noiseTypes.length > 0,
    noiseTypes,
    recommendation,
  }
}

// ============================================================================
// 18. CONFIDENCE INDEX
// ============================================================================

export interface ConfidenceIndex {
  level: 'low' | 'medium' | 'high'
  score: number  // 0-100
  factors: string[]
  message: string
}

/**
 * Calculate confidence index based on data consistency and reactions
 */
export function calculateConfidenceIndex(
  metrics: InstagramMetrics[],
  momentum: MomentumResult,
  falseGreen: FalseGreenCheck
): ConfidenceIndex {
  if (metrics.length < 3) {
    return {
      level: 'low',
      score: 30,
      factors: ['Insufficient data points'],
      message: 'Low confidence — need more data before making release decision',
    }
  }

  let score = 50
  const factors: string[] = []

  // Data consistency
  if (metrics.length >= 5) {
    score += 20
    factors.push('Multiple data points confirm trend')
  }

  // Momentum confidence
  if (momentum.confidence > 0.7) {
    score += 15
    factors.push('Strong momentum signal')
  } else if (momentum.confidence < 0.5) {
    score -= 15
    factors.push('Weak momentum signal')
  }

  // False green protection
  if (!falseGreen.isFalseGreen) {
    score += 15
    factors.push('Sustained momentum confirmed')
  } else {
    score -= 20
    factors.push('Potential false positive detected')
  }

  // Engagement consistency
  const recent = metrics.slice(-3)
  const engagementVariance = recent.reduce((sum, m, i) => {
    if (i === 0) return sum
    const prev = recent[i - 1]
    const change = Math.abs((m.comments + m.shares) - (prev.comments + prev.shares)) / Math.max(prev.comments + prev.shares, 1)
    return sum + change
  }, 0) / (recent.length - 1)

  if (engagementVariance < 0.3) {
    score += 10
    factors.push('Consistent engagement patterns')
  }

  score = Math.max(0, Math.min(100, score))

  let level: 'low' | 'medium' | 'high' = 'medium'
  let message = ''

  if (score >= 70) {
    level = 'high'
    message = 'High conviction — this is alignment, not hype. Strong data supports release decision.'
  } else if (score >= 50) {
    level = 'medium'
    message = 'Moderate confidence — data supports decision but monitor closely.'
  } else {
    level = 'low'
    message = 'Low confidence — data is inconsistent or insufficient. Wait for stronger signals.'
  }

  return {
    level,
    score,
    factors,
    message,
  }
}

// ============================================================================
// 19. RELEASE MEMORY
// ============================================================================

/**
 * Calculate release memory from historical data
 * This analyzes past releases and their outcomes to learn what works best
 * Note: ReleaseMemory interface is defined in storage.ts and imported above
 */
export function calculateReleaseMemory(
  artistId: string,
  historicalOverrides: StaffOverride[],
  historicalHealth: PostDropHealth[],
  catalog: any[]
): ReleaseMemory | null {
  // Filter to this artist's data
  const artistOverrides = historicalOverrides.filter(o => o.artistId === artistId)
  const artistHealth = historicalHealth.filter(h => h.artistId === artistId)
  
  if (artistOverrides.length === 0 && artistHealth.length === 0) {
    return null // No historical data
  }

  // Analyze successful vs failed states
  const successfulStates: ReleaseMemory['successfulStates'] = []
  const failedStates: ReleaseMemory['failedStates'] = []
  
  // Group by state and analyze outcomes
  const stateOutcomes: Record<string, { streams: number[], success: boolean[] }> = {}
  
  artistOverrides.forEach(override => {
    if (override.outcome) {
      const state = override.overriddenState
      if (!stateOutcomes[state]) {
        stateOutcomes[state] = { streams: [], success: [] }
      }
      if (override.outcome.streams) {
        stateOutcomes[state].streams.push(override.outcome.streams)
      }
      if (override.outcome.performance) {
        const isSuccess = override.outcome.performance === 'exceeded' || override.outcome.performance === 'met'
        stateOutcomes[state].success.push(isSuccess)
      }
    }
  })

  // Process post-drop health data
  // Note: Would need to track readiness state at release time for full analysis
  // For now, we primarily use override outcomes which include state information
  artistHealth.forEach(health => {
    if (health.health72h) {
      // Future enhancement: correlate health status with release readiness state
      // This would require storing readiness state at release time
    }
  })

  // Build successful/failed states
  Object.entries(stateOutcomes).forEach(([state, data]) => {
    const avgStreams = data.streams.length > 0 
      ? data.streams.reduce((a, b) => a + b, 0) / data.streams.length 
      : 0
    const successRate = data.success.length > 0
      ? data.success.filter(s => s).length / data.success.length
      : 0
    
    const stateData = {
      state: state as 'cooling' | 'building' | 'ready',
      count: data.success.length,
      avgStreams,
      successRate,
    }
    
    if (successRate >= 0.6) {
      successfulStates.push(stateData)
    } else {
      failedStates.push(stateData)
    }
  })

  // Determine lane rules from success patterns
  const canDropAtBuilding = successfulStates.some(s => s.state === 'building')
  const canDropAtCooling = successfulStates.some(s => s.state === 'cooling')
  const totalReleases = successfulStates.reduce((sum, s) => sum + s.count, 0) + 
                        failedStates.reduce((sum, s) => sum + s.count, 0)
  const overallSuccessRate = totalReleases > 0
    ? successfulStates.reduce((sum, s) => sum + s.count, 0) / totalReleases
    : 0

  // Find optimal patterns
  const bestState = successfulStates.length > 0
    ? successfulStates.reduce((best, current) => 
        current.successRate > best.successRate ? current : best
      )
    : null

  const insights: string[] = []
  if (bestState) {
    insights.push(`Best performance when releasing in "${bestState.state}" state (${(bestState.successRate * 100).toFixed(0)}% success rate)`)
  }
  if (canDropAtBuilding) {
    insights.push('Can successfully drop during Building phase')
  }
  if (canDropAtCooling) {
    insights.push('Can successfully drop during Cooling phase (unusual)')
  }
  if (totalReleases >= 3) {
    insights.push(`Based on ${totalReleases} historical releases`)
  }

  return {
    id: `rm_${artistId}`,
    artistId,
    successfulStates,
    failedStates,
    laneRules: {
      canDropAtBuilding,
      canDropAtCooling,
      successRate: overallSuccessRate,
      totalReleases,
    },
    personalRhythm: {
      optimalWindow: bestState?.state === 'ready' ? '24-48 hour peak' : 
                     bestState?.state === 'building' ? 'Extended window' : undefined,
      bestDropType: undefined, // Would need more data
      avgTimeToPeak: undefined, // Would need more data
      bestPerformingGoal: undefined, // Would need more data
    },
    insights,
    lastUpdated: new Date().toISOString(),
  }
}

export interface EnhancedReadinessResult {
  // Core state
  state: ReadinessState
  window: ReleaseWindowInfo
  
  // Heat scores
  heat: HeatScores
  
  // Momentum
  momentum: MomentumResult
  momentumSpeed: MomentumSpeedInfo
  
  // Lane & risk
  lane: ArtistLane
  riskTolerance: RiskTolerance
  
  // Goal-based scoring
  goalScores: Record<ReleaseGoal, number>
  
  // Human-readable
  whyThisMatters: string
  
  // Safety checks
  falseGreen: FalseGreenCheck
  
  // TikTok sync
  tikTokSync?: TikTokSyncAnalysis
  
  // NEW FEATURES
  fatigue?: FatigueAnalysis
  simulation?: ReleaseSimulation
  audienceSegmentation?: AudienceSegmentation
  contentSongMatch?: ContentSongMatch
  dropTypeRecommendation?: DropTypeRecommendation
  narrativeContinuity?: NarrativeContinuity
  marketNoise?: MarketNoise
  confidenceIndex?: ConfidenceIndex
  
  // Recommendations
  recommendations: string[]
}

/**
 * Calculate enhanced readiness with all features
 */
export function calculateEnhancedReadiness(
  instagramMetrics: InstagramMetrics[],
  tikTokMetrics: TikTokMetrics[],
  tikTokSongViews: TikTokSongViews[],
  user: User,
  releaseGoal: ReleaseGoal = 'streams',
  songId?: string,
  songTags?: {
    energy?: 'low' | 'medium' | 'high'
    emotion?: string
    contentFit?: string
  }
): EnhancedReadinessResult {
  // Basic momentum and state
  const momentum = calculateMomentum(instagramMetrics)
  const lane = getDefaultLane(user)
  const baseState = resolveReadinessState(momentum.direction, instagramMetrics, user)
  
  // Enhanced features
  const window = calculateReleaseWindow(momentum, instagramMetrics, baseState)
  const heat = calculateHeatScores(instagramMetrics)
  const momentumSpeed = calculateMomentumSpeed(momentum, instagramMetrics)
  const riskTolerance = getLaneRiskTolerance(lane)
  
  // Goal-based scores for all goals
  const goalScores: Record<ReleaseGoal, number> = {
    streams: calculateGoalBasedScore(instagramMetrics, 'streams', lane),
    discovery: calculateGoalBasedScore(instagramMetrics, 'discovery', lane),
    'fan-conversion': calculateGoalBasedScore(instagramMetrics, 'fan-conversion', lane),
    'algorithm-push': calculateGoalBasedScore(instagramMetrics, 'algorithm-push', lane),
    revenue: calculateGoalBasedScore(instagramMetrics, 'revenue', lane),
  }
  
  // Human-readable explanation
  const whyThisMatters = generateWhyThisMatters(baseState, window, heat, momentumSpeed, riskTolerance)
  
  // False green protection
  const falseGreen = checkFalseGreen(instagramMetrics, momentum, baseState)
  
  // TikTok sync
  const tikTokSync = analyzeTikTokSync(tikTokMetrics, tikTokSongViews, instagramMetrics)
  
  // NEW ANALYSES
  const fatigue = detectFatigue(instagramMetrics)
  const audienceSegmentation = analyzeAudienceSegmentation(instagramMetrics)
  const narrativeContinuity = analyzeNarrativeContinuity(instagramMetrics)
  const marketNoise = checkMarketNoise()
  const confidenceIndex = calculateConfidenceIndex(instagramMetrics, momentum, falseGreen)
  
  // Build partial result for simulation and drop type (need state/window/heat/momentumSpeed/riskTolerance)
  const partialResult: Partial<EnhancedReadinessResult> = {
    state: baseState,
    window,
    heat,
    momentumSpeed,
    riskTolerance,
  }
  
  const simulation = simulateReleaseOutcome(partialResult as EnhancedReadinessResult, releaseGoal)
  const dropTypeRecommendation = recommendDropType(partialResult as EnhancedReadinessResult, heat)
  
  // Content-to-song match (if song tags provided)
  const contentSongMatch = songTags 
    ? calculateContentSongMatch(instagramMetrics, songTags)
    : undefined

  // Build recommendations
  const recommendations: string[] = []
  recommendations.push(momentumSpeed.recommendation)
  if (window.urgency === 'critical') {
    recommendations.push(`Window urgency: ${window.description}`)
  }
  if (heat.audienceHeat > 70 && heat.contentHeat < 50) {
    recommendations.push('Audience is hot but content needs work — push teaser, not full drop')
  } else if (heat.contentHeat > 70 && heat.audienceHeat < 50) {
    recommendations.push('Content is viral but audience is quiet — build anticipation first')
  }
  if (falseGreen.isFalseGreen) {
    recommendations.push(falseGreen.recommendation)
  }
  if (tikTokSync.urgency === 'high') {
    recommendations.push(tikTokSync.recommendation)
  }
  if (!riskTolerance.requiresReady && baseState === 'building') {
    recommendations.push(`Your lane allows drops during Building phase: ${riskTolerance.explanation}`)
  }
  
  // Add new feature recommendations
  if (fatigue.hasFatigue) {
    recommendations.push(fatigue.overallRecommendation)
  }
  if (audienceSegmentation.newViewers > 50) {
    recommendations.push(audienceSegmentation.recommendation)
  }
  if (narrativeContinuity.narrativeStrength === 'weak' || narrativeContinuity.narrativeStrength === 'none') {
    recommendations.push(narrativeContinuity.recommendation)
  }
  if (marketNoise.hasNoise && marketNoise.noiseTypes.some(n => n.severity === 'high')) {
    recommendations.push(marketNoise.recommendation)
  }
  recommendations.push(dropTypeRecommendation.reasoning)

  return {
    state: baseState,
    window,
    heat,
    momentum,
    momentumSpeed,
    lane,
    riskTolerance,
    goalScores,
    whyThisMatters,
    falseGreen,
    tikTokSync,
    fatigue,
    simulation,
    audienceSegmentation,
    contentSongMatch,
    dropTypeRecommendation,
    narrativeContinuity,
    marketNoise,
    confidenceIndex,
    recommendations,
  }
}

// Helper function to resolve state (from readinessEngine.ts)
function resolveReadinessState(
  momentum: MomentumDirection,
  metrics: InstagramMetrics[],
  user: User
): ReadinessState {
  const lane = getDefaultLane(user)
  const config = LANE_CONFIGS[lane]

  let state: ReadinessState = 'building'

  if (momentum === 'rising') {
    state = 'ready'
  } else if (momentum === 'falling') {
    state = 'cooling'
  } else {
    // For steady momentum, check weighted score
    const weightedScore = applyLaneWeights(metrics, lane)
    if (weightedScore > 0.7) {
      state = 'ready'
    } else {
      state = 'building'
    }
  }

  return state
}

// Helper function to apply lane weights (from readinessEngine.ts)
function applyLaneWeights(metrics: InstagramMetrics[], lane: ArtistLane): number {
  if (metrics.length === 0) return 0

  const config = LANE_CONFIGS[lane]
  const latest = metrics[metrics.length - 1]

  const maxViews = Math.max(...metrics.map(m => m.views), 1)
  const maxSaves = Math.max(...metrics.map(m => m.saves), 1)
  const maxShares = Math.max(...metrics.map(m => m.shares), 1)
  const maxComments = Math.max(...metrics.map(m => m.comments), 1)

  const normalizedViews = latest.views / maxViews
  const normalizedSaves = latest.saves / maxSaves
  const normalizedShares = latest.shares / maxShares
  const normalizedComments = latest.comments / maxComments
  const normalizedCompletion = latest.completionRate
  const normalizedFollowers = Math.min(latest.followers / 100000, 1)

  return (
    normalizedViews * config.views +
    normalizedSaves * config.saves +
    normalizedShares * config.shares +
    normalizedComments * config.comments +
    normalizedCompletion * config.completionRate +
    normalizedFollowers * config.followers
  )
}
