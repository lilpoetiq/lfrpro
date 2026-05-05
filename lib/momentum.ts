/**
 * Momentum Calculation Engine
 * Calculates baseline (30-60 day average) vs recent window (7 day average)
 * to determine momentum direction: rising, steady, or falling
 */

import { InstagramMetrics } from './storage'

export type MomentumDirection = 'rising' | 'steady' | 'falling'

export interface MomentumResult {
  direction: MomentumDirection
  baseline: number
  recent: number
  changePercent: number
  confidence: number
}

/**
 * Calculate weighted metric score from Instagram metrics
 * Uses engagement-weighted score: (views * 0.3) + (saves * 0.3) + (shares * 0.2) + (comments * 0.2)
 */
function calculateMetricScore(metrics: InstagramMetrics): number {
  const viewsWeight = 0.3
  const savesWeight = 0.3
  const sharesWeight = 0.2
  const commentsWeight = 0.2
  
  return (
    metrics.views * viewsWeight +
    metrics.saves * savesWeight +
    metrics.shares * sharesWeight +
    metrics.comments * commentsWeight
  )
}

/**
 * Calculate rolling baseline average (30-60 days)
 * Returns average metric score over the baseline period
 */
export function calculateBaseline(
  metrics: InstagramMetrics[],
  days: number = 45  // Default to 45 days (middle of 30-60 range)
): number {
  if (metrics.length === 0) return 0

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)
  const cutoffTimestamp = cutoffDate.getTime()

  const baselineMetrics = metrics.filter(m => {
    const metricDate = new Date(m.metricDate).getTime()
    return metricDate >= cutoffTimestamp
  })

  if (baselineMetrics.length === 0) {
    // Fallback to all available metrics if none in baseline period
    const scores = metrics.map(calculateMetricScore)
    return scores.reduce((sum, score) => sum + score, 0) / scores.length
  }

  const scores = baselineMetrics.map(calculateMetricScore)
  return scores.reduce((sum, score) => sum + score, 0) / scores.length
}

/**
 * Calculate recent window average (7 days)
 * Returns average metric score over the last 7 days
 */
export function calculateRecentWindow(metrics: InstagramMetrics[]): number {
  if (metrics.length === 0) return 0

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 7)
  const cutoffTimestamp = cutoffDate.getTime()

  const recentMetrics = metrics.filter(m => {
    const metricDate = new Date(m.metricDate).getTime()
    return metricDate >= cutoffTimestamp
  })

  if (recentMetrics.length === 0) {
    // Fallback to most recent metric if none in 7-day window
    const sorted = [...metrics].sort((a, b) => 
      new Date(b.metricDate).getTime() - new Date(a.metricDate).getTime()
    )
    return sorted.length > 0 ? calculateMetricScore(sorted[0]) : 0
  }

  const scores = recentMetrics.map(calculateMetricScore)
  return scores.reduce((sum, score) => sum + score, 0) / scores.length
}

/**
 * Calculate momentum direction based on baseline vs recent window
 * 
 * Thresholds:
 * - Rising: recent > baseline * 1.1 (10% increase)
 * - Falling: recent < baseline * 0.9 (10% decrease)
 * - Steady: otherwise
 */
export function calculateMomentum(
  metrics: InstagramMetrics[],
  baselineDays: number = 45
): MomentumResult {
  const baseline = calculateBaseline(metrics, baselineDays)
  const recent = calculateRecentWindow(metrics)

  if (baseline === 0) {
    // No baseline data - default to steady
    return {
      direction: 'steady',
      baseline: 0,
      recent: recent,
      changePercent: 0,
      confidence: 0,
    }
  }

  const changePercent = ((recent - baseline) / baseline) * 100
  const threshold = 0.1 // 10% threshold

  let direction: MomentumDirection = 'steady'
  if (recent > baseline * (1 + threshold)) {
    direction = 'rising'
  } else if (recent < baseline * (1 - threshold)) {
    direction = 'falling'
  }

  // Calculate confidence based on data points available
  const recentCount = metrics.filter(m => {
    const metricDate = new Date(m.metricDate).getTime()
    const cutoffTimestamp = new Date().getTime() - (7 * 24 * 60 * 60 * 1000)
    return metricDate >= cutoffTimestamp
  }).length

  const confidence = Math.min(recentCount / 7, 1) // Max confidence with 7+ data points

  return {
    direction,
    baseline,
    recent,
    changePercent,
    confidence,
  }
}
