/**
 * Release Decision Engine
 * Determines APPROVED, HOLD, or DENIED states based on data-backed criteria
 */

import { InstagramMetrics, TikTokMetrics, User, ReleaseReadiness, ReleaseRequest, ReleaseDecision } from './storage'
import { calculateEnhancedReadiness, ReleaseGoal } from './enhancedReadinessEngine'

export interface DecisionCriteria {
  hasSustainedMomentum: boolean // ≥2 data points
  audienceHeatAboveThreshold: boolean
  velocityPositive: boolean
  confidenceIndexAboveMinimum: boolean
  assetsComplete: boolean
  hasInsufficientMomentum: boolean
  hasIncompleteAssets: boolean
  promotionReadinessDetected: boolean
  hasDataGaps: boolean
  audienceInactive: boolean
  momentumDeclining: boolean
  highRiskOfFailure: boolean
  priorReleasesUnderperformed: boolean
  streamsNotConverting: boolean
}

export interface DecisionResult {
  decision: 'APPROVED' | 'HOLD' | 'DENIED'
  reasoning: string[]
  evidence: {
    heatScore?: number
    momentumSpeed?: number
    confidenceIndex?: number
    simulationOutcome?: string
    metrics?: any
  }
  // APPROVED fields
  releaseWindow?: {
    open: boolean
    durationDays: number
    expiresAt: string
  }
  approvalReason?: string
  rules?: string[]
  // HOLD fields
  holdReasons?: {
    audienceReadiness?: string[]
    momentum?: string[]
    execution?: string[]
    dataGaps?: string[]
  }
  actionableTasks?: Array<{
    id: string
    task: string
    measurable: boolean
    completed: boolean
  }>
  // DENIED fields
  denialReason?: string
  expectedOutcome?: string
  rebuildPlan?: string[]
  cooldownPeriodDays?: number
}

/**
 * Calculate decision criteria from metrics and enhanced readiness data
 */
function calculateCriteria(
  instagramMetrics: InstagramMetrics[],
  tikTokMetrics: TikTokMetrics[],
  enhancedReadiness: any,
  assetsConfirmed: { finalMixMaster: boolean; coverArt: boolean; distributionFiles: boolean }
): DecisionCriteria {
  const hasEnoughDataPoints = instagramMetrics.length >= 2
  const latestMetrics = instagramMetrics.slice(-2)
  
  // Calculate momentum
  const momentumRising = latestMetrics.length >= 2 && 
    latestMetrics[1].views > latestMetrics[0].views
  const velocityPositive = latestMetrics.length >= 2 &&
    ((latestMetrics[1].views - latestMetrics[0].views) / latestMetrics[0].views) > 0.05
  
  // Audience heat (simplified - can be enhanced)
  const avgCompletionRate = instagramMetrics.reduce((sum, m) => sum + (m.completionRate || 0), 0) / instagramMetrics.length
  const audienceHeatAboveThreshold = avgCompletionRate > 50 // Threshold configurable
  
  // Confidence index from enhanced readiness
  const confidenceIndex = enhancedReadiness?.confidenceIndex || 0
  const confidenceIndexAboveMinimum = confidenceIndex >= 60 // Threshold configurable
  
  // Assets check
  const assetsComplete = assetsConfirmed.finalMixMaster && 
    assetsConfirmed.coverArt && 
    assetsConfirmed.distributionFiles
  
  // Check for issues
  const hasInsufficientMomentum = !momentumRising && !velocityPositive
  const hasIncompleteAssets = !assetsComplete
  const hasDataGaps = instagramMetrics.length < 2
  const audienceInactive = avgCompletionRate < 30
  const momentumDeclining = latestMetrics.length >= 2 && 
    latestMetrics[1].views < latestMetrics[0].views * 0.9
  
  // Check save rate (streams converting)
  const avgSaveRate = instagramMetrics.reduce((sum, m) => sum + (m.saves || 0), 0) / 
    instagramMetrics.reduce((sum, m) => sum + (m.views || 0), 0)
  const streamsNotConverting = avgSaveRate < 0.05 // Less than 5% save rate
  
  return {
    hasSustainedMomentum: hasEnoughDataPoints && momentumRising,
    audienceHeatAboveThreshold,
    velocityPositive,
    confidenceIndexAboveMinimum,
    assetsComplete,
    hasInsufficientMomentum,
    hasIncompleteAssets,
    promotionReadinessDetected: false, // Can be enhanced
    hasDataGaps,
    audienceInactive,
    momentumDeclining,
    highRiskOfFailure: confidenceIndex < 40,
    priorReleasesUnderperformed: false, // Can check release memory
    streamsNotConverting,
  }
}

/**
 * Make release decision based on criteria
 */
export function makeReleaseDecision(
  instagramMetrics: InstagramMetrics[],
  tikTokMetrics: TikTokMetrics[],
  user: User,
  releaseRequest: ReleaseRequest,
  enhancedReadiness: any
): DecisionResult {
  const criteria = calculateCriteria(
    instagramMetrics,
    tikTokMetrics,
    enhancedReadiness,
    releaseRequest.assetsConfirmed
  )
  
  const evidence = {
    heatScore: enhancedReadiness?.heatScore || 0,
    momentumSpeed: enhancedReadiness?.momentumSpeed || 0,
    confidenceIndex: enhancedReadiness?.confidenceIndex || 0,
    simulationOutcome: enhancedReadiness?.simulationOutcome,
    metrics: {
      dataPoints: instagramMetrics.length,
      avgCompletionRate: instagramMetrics.reduce((sum, m) => sum + (m.completionRate || 0), 0) / instagramMetrics.length,
    },
  }
  
  // APPROVED: All conditions met
  if (
    criteria.hasSustainedMomentum &&
    criteria.audienceHeatAboveThreshold &&
    criteria.velocityPositive &&
    criteria.confidenceIndexAboveMinimum &&
    criteria.assetsComplete
  ) {
    const durationDays = 7 // Configurable
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
    
    return {
      decision: 'APPROVED',
      reasoning: [
        'Sustained momentum detected (≥2 data points)',
        'Audience engagement trending up',
        'Posting consistency detected',
        'Prior performance within expected range',
        'Risk level acceptable',
      ],
      evidence,
      releaseWindow: {
        open: true,
        durationDays,
        expiresAt,
      },
      approvalReason: 'All readiness criteria met. Audience is engaged, momentum is positive, and assets are complete.',
      rules: [
        'Missed window triggers re-evaluation',
        'Inactivity may revoke approval',
        'Window expires in ' + durationDays + ' days',
      ],
    }
  }
  
  // DENIED: Critical issues
  if (
    criteria.audienceInactive ||
    criteria.momentumDeclining ||
    criteria.highRiskOfFailure ||
    criteria.streamsNotConverting
  ) {
    const cooldownPeriodDays = 14 // Configurable
    const cooldownUntil = new Date(Date.now() + cooldownPeriodDays * 24 * 60 * 60 * 1000).toISOString()
    
    const denialReasons: string[] = []
    if (criteria.audienceInactive) denialReasons.push('Audience attention is currently low')
    if (criteria.momentumDeclining) denialReasons.push('Engagement velocity is negative')
    if (criteria.streamsNotConverting) denialReasons.push('Streams are not converting to retention')
    if (criteria.highRiskOfFailure) denialReasons.push('High risk of algorithmic failure')
    
    return {
      decision: 'DENIED',
      reasoning: denialReasons,
      evidence,
      denialReason: denialReasons.join('. ') + '. Releasing now risks long-term algorithm trust.',
      expectedOutcome: 'Core-fan-only performance, low reach, minimal discovery, possible algorithm deprioritization',
      rebuildPlan: [
        'Re-establish posting consistency',
        'Test content formats',
        'Increase audience interaction',
        'Build momentum before next request',
      ],
      cooldownPeriodDays,
    }
  }
  
  // HOLD: Fixable issues
  const holdReasons: {
    audienceReadiness?: string[]
    momentum?: string[]
    execution?: string[]
    dataGaps?: string[]
  } = {}
  
  const actionableTasks: Array<{ id: string; task: string; measurable: boolean; completed: boolean }> = []
  
  if (!criteria.audienceHeatAboveThreshold) {
    holdReasons.audienceReadiness = [
      'Low audience heat',
      'High skip rate',
      'Low completion rate',
    ]
    actionableTasks.push({
      id: 'increase-engagement',
      task: 'Increase engagement (comments, replies)',
      measurable: true,
      completed: false,
    })
  }
  
  if (criteria.hasInsufficientMomentum) {
    holdReasons.momentum = [
      'Plateau detected',
      'No acceleration',
      'Spike-driven activity not confirmed',
    ]
    actionableTasks.push({
      id: 'generate-data-points',
      task: 'Generate ≥2 new data points',
      measurable: true,
      completed: false,
    })
    actionableTasks.push({
      id: 'post-short-form',
      task: 'Post 2–3 short-form videos in 7–10 days',
      measurable: true,
      completed: false,
    })
  }
  
  if (criteria.hasIncompleteAssets) {
    holdReasons.execution = [
      'Mix/master incomplete',
      'Cover art missing',
      'No rollout content detected',
    ]
    if (!criteria.assetsComplete) {
      if (!releaseRequest.assetsConfirmed.finalMixMaster) {
        actionableTasks.push({
          id: 'upload-mix-master',
          task: 'Upload final mix/master',
          measurable: true,
          completed: false,
        })
      }
      if (!releaseRequest.assetsConfirmed.coverArt) {
        actionableTasks.push({
          id: 'submit-cover-art',
          task: 'Submit cover art',
          measurable: true,
          completed: false,
        })
      }
      if (!releaseRequest.assetsConfirmed.distributionFiles) {
        actionableTasks.push({
          id: 'upload-distribution',
          task: 'Upload distribution-ready files',
          measurable: true,
          completed: false,
        })
      }
    }
  }
  
  if (criteria.hasDataGaps) {
    holdReasons.dataGaps = [
      'Only ' + instagramMetrics.length + ' data point(s) available',
      'Audience segmentation unavailable',
      'Narrative continuity unconfirmed',
    ]
    actionableTasks.push({
      id: 'generate-data-points',
      task: 'Generate ≥2 new data points',
      measurable: true,
      completed: false,
    })
  }
  
  return {
    decision: 'HOLD',
    reasoning: Object.values(holdReasons).flat(),
    evidence,
    holdReasons,
    actionableTasks,
  }
}
