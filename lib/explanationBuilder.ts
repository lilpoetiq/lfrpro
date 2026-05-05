/**
 * Explanation Builder
 * Generates human-readable explanations based on momentum direction and metrics
 */

import { MomentumDirection, MomentumResult } from './momentum'
import { InstagramMetrics, User } from './storage'
import { ReadinessState } from './readinessEngine'
import { getLaneExplanationContext, LANE_DEFINITIONS, ArtistLane as NewArtistLane } from './laneDefinitions'

export interface MetricContribution {
  metric: 'views' | 'saves' | 'shares' | 'comments' | 'completionRate' | 'followers'
  value: number
  contribution: number
  trend: 'increasing' | 'decreasing' | 'stable'
}

/**
 * Analyze metric contributions and identify strongest/weakest
 */
function analyzeMetricContributions(
  recentMetrics: InstagramMetrics[],
  baselineMetrics: InstagramMetrics[]
): {
  strongest: MetricContribution[]
  weakest: MetricContribution[]
} {
  if (recentMetrics.length === 0 || baselineMetrics.length === 0) {
    return { strongest: [], weakest: [] }
  }

  const recent = recentMetrics[recentMetrics.length - 1]
  const baselineAvg = {
    views: baselineMetrics.reduce((sum, m) => sum + m.views, 0) / baselineMetrics.length,
    saves: baselineMetrics.reduce((sum, m) => sum + m.saves, 0) / baselineMetrics.length,
    shares: baselineMetrics.reduce((sum, m) => sum + m.shares, 0) / baselineMetrics.length,
    comments: baselineMetrics.reduce((sum, m) => sum + m.comments, 0) / baselineMetrics.length,
    completionRate: baselineMetrics.reduce((sum, m) => sum + m.completionRate, 0) / baselineMetrics.length,
    followers: baselineMetrics.reduce((sum, m) => sum + m.followers, 0) / baselineMetrics.length,
  }

  const contributions: MetricContribution[] = [
    {
      metric: 'views',
      value: recent.views,
      contribution: recent.views - baselineAvg.views,
      trend: recent.views > baselineAvg.views * 1.05 ? 'increasing' : recent.views < baselineAvg.views * 0.95 ? 'decreasing' : 'stable',
    },
    {
      metric: 'saves',
      value: recent.saves,
      contribution: recent.saves - baselineAvg.saves,
      trend: recent.saves > baselineAvg.saves * 1.05 ? 'increasing' : recent.saves < baselineAvg.saves * 0.95 ? 'decreasing' : 'stable',
    },
    {
      metric: 'shares',
      value: recent.shares,
      contribution: recent.shares - baselineAvg.shares,
      trend: recent.shares > baselineAvg.shares * 1.05 ? 'increasing' : recent.shares < baselineAvg.shares * 0.95 ? 'decreasing' : 'stable',
    },
    {
      metric: 'comments',
      value: recent.comments,
      contribution: recent.comments - baselineAvg.comments,
      trend: recent.comments > baselineAvg.comments * 1.05 ? 'increasing' : recent.comments < baselineAvg.comments * 0.95 ? 'decreasing' : 'stable',
    },
    {
      metric: 'completionRate',
      value: recent.completionRate,
      contribution: recent.completionRate - baselineAvg.completionRate,
      trend: recent.completionRate > baselineAvg.completionRate * 1.05 ? 'increasing' : recent.completionRate < baselineAvg.completionRate * 0.95 ? 'decreasing' : 'stable',
    },
    {
      metric: 'followers',
      value: recent.followers,
      contribution: recent.followers - baselineAvg.followers,
      trend: recent.followers > baselineAvg.followers * 1.05 ? 'increasing' : recent.followers < baselineAvg.followers * 0.95 ? 'decreasing' : 'stable',
    },
  ]

  // Sort by absolute contribution
  const sorted = [...contributions].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
  
  const strongest = sorted.slice(0, 2).filter(c => c.contribution > 0)
  const weakest = sorted.slice(-2).filter(c => c.contribution < 0).reverse()

  return { strongest, weakest }
}

/**
 * Generate human-readable explanation text with lane-specific context
 */
export function generateExplanation(
  momentum: MomentumResult,
  state: ReadinessState,
  metrics: InstagramMetrics[],
  user?: User
): {
  explanationText: string
  actionSteps: string[]
  adminNotes: string
  laneContext?: string
} {
  const baselineMetrics = metrics.filter(m => {
    const metricDate = new Date(m.metricDate).getTime()
    const cutoffTimestamp = new Date().getTime() - (45 * 24 * 60 * 60 * 1000)
    return metricDate >= cutoffTimestamp
  })

  const recentMetrics = metrics.filter(m => {
    const metricDate = new Date(m.metricDate).getTime()
    const cutoffTimestamp = new Date().getTime() - (7 * 24 * 60 * 60 * 1000)
    return metricDate >= cutoffTimestamp
  })

  const { strongest, weakest } = analyzeMetricContributions(recentMetrics, baselineMetrics)

  // Get lane-specific context if user has a lane set
  const userLane = user?.lane as NewArtistLane | undefined
  const laneContext = userLane && Object.keys(LANE_DEFINITIONS).includes(userLane)
    ? getLaneExplanationContext(userLane)
    : null

  let explanationText = ''
  const actionSteps: string[] = []

  // Use lane-specific explanations if available, otherwise use generic
  if (laneContext) {
    // Lane-specific explanations
    if (state === 'ready') {
      explanationText = laneContext.readyExplanation
      if (momentum.direction === 'rising') {
        actionSteps.push('Your audience is paying attention — release timing is optimal')
        actionSteps.push('Maintain current content strategy — momentum is strong')
      } else {
        actionSteps.push('Your audience is engaged — this is the right moment')
        actionSteps.push('Keep content consistent to maintain engagement')
      }
    } else if (state === 'building') {
      explanationText = laneContext.buildingExplanation
      actionSteps.push('Post content that already works for your audience')
      actionSteps.push('Engage with comments and DMs')
      actionSteps.push('Let anticipation build instead of rushing')
      actionSteps.push('This stage is about setting up the moment, not forcing it')
    } else {
      // cooling
      explanationText = laneContext.coolingExplanation
      actionSteps.push('Short silence — let the audience miss you')
      actionSteps.push('Reset content style — try what worked before')
      actionSteps.push('Post less, not more — quality over quantity')
      actionSteps.push('This stage protects your music from dying on arrival')
    }
  } else {
    // Generic explanations (fallback)
    if (momentum.direction === 'rising') {
      explanationText = `Your Instagram metrics show strong positive momentum with a ${momentum.changePercent.toFixed(1)}% increase over your baseline. `
      
      if (strongest.length > 0) {
        const topMetric = strongest[0]
        const metricName = topMetric.metric === 'completionRate' ? 'completion rate' : topMetric.metric
        explanationText += `The strongest contributor is ${metricName}, which has increased significantly. `
      }

      if (state === 'ready') {
        explanationText += `You're in an optimal position for release with consistent growth across key engagement metrics.`
        actionSteps.push('Maintain current content strategy - momentum is strong')
        actionSteps.push('Consider increasing posting frequency to capitalize on growth')
        actionSteps.push('Engage with comments and DMs to boost community growth')
      } else {
        explanationText += `Continue building momentum before releasing.`
        actionSteps.push('Maintain consistent posting schedule')
        actionSteps.push('Focus on high-engagement content formats')
      }
    } else if (momentum.direction === 'falling') {
      explanationText = `Your Instagram metrics show declining momentum with a ${Math.abs(momentum.changePercent).toFixed(1)}% decrease from baseline. `
      
      if (weakest.length > 0) {
        const weakMetric = weakest[0]
        const metricName = weakMetric.metric === 'completionRate' ? 'completion rate' : weakMetric.metric
        explanationText += `The area needing attention is ${metricName}, which has decreased. `
      }

      explanationText += `It's recommended to rebuild engagement before releasing new music.`
      
      actionSteps.push('Analyze recent content performance to identify what resonates')
      actionSteps.push('Increase engagement through stories, reels, and interactive content')
      actionSteps.push('Consider collaborating with other artists or influencers')
      actionSteps.push('Review posting times and optimize for peak engagement hours')
      
      if (weakest.length > 0) {
        const weakMetric = weakest[0]
        if (weakMetric.metric === 'saves') {
          actionSteps.push('Create more save-worthy content (tutorials, quotes, behind-the-scenes)')
        } else if (weakMetric.metric === 'shares') {
          actionSteps.push('Focus on shareable content that encourages reposts')
        } else if (weakMetric.metric === 'comments') {
          actionSteps.push('Ask questions in captions and respond to all comments')
        } else if (weakMetric.metric === 'completionRate') {
          actionSteps.push('Create shorter, more engaging videos to improve completion rates')
        }
      }
    } else {
      // Steady momentum
      explanationText = `Your Instagram metrics are stable with ${momentum.changePercent.toFixed(1)}% change from baseline. `
      
      if (strongest.length > 0) {
        const topMetric = strongest[0]
        const metricName = topMetric.metric === 'completionRate' ? 'completion rate' : topMetric.metric
        explanationText += `${metricName.charAt(0).toUpperCase() + metricName.slice(1)} is performing well. `
      }

      if (state === 'ready') {
        explanationText += `You have consistent engagement and are ready for release.`
        actionSteps.push('Maintain steady content cadence')
        actionSteps.push('Plan release campaign content in advance')
      } else {
        explanationText += `Focus on building momentum through strategic content and engagement.`
        actionSteps.push('Experiment with new content formats to drive growth')
        actionSteps.push('Increase engagement with audience through stories and comments')
        actionSteps.push('Consider running a small promotional campaign to boost metrics')
      }
    }
  }

  // Add general action steps based on weakest metrics
  if (weakest.length > 0 && momentum.direction !== 'rising') {
    weakest.forEach(weak => {
      if (weak.metric === 'views' && !actionSteps.some(s => s.includes('views'))) {
        actionSteps.push('Use relevant hashtags and location tags to increase reach')
      }
      if (weak.metric === 'followers' && !actionSteps.some(s => s.includes('followers'))) {
        actionSteps.push('Engage with similar artists and potential fans to grow follower base')
      }
    })
  }

  // Add admin-focused notes for growth/falling trends
  let adminNotes = ''
  if (momentum.direction === 'falling') {
    adminNotes = `ADMIN NOTES: Artist is experiencing a ${Math.abs(momentum.changePercent).toFixed(1)}% decline in engagement. `
    if (weakest.length > 0) {
      const weakMetric = weakest[0]
      adminNotes += `Primary concern: ${weakMetric.metric} has decreased significantly. `
    }
    adminNotes += `Recommend immediate content strategy review, potential promotional campaign, or collaboration to stabilize metrics before release. Consider delaying release if trend continues.`
  } else if (momentum.direction === 'rising') {
    adminNotes = `ADMIN NOTES: Strong positive momentum (+${momentum.changePercent.toFixed(1)}%). `
    if (strongest.length > 0) {
      const strongMetric = strongest[0]
      adminNotes += `${strongMetric.metric.charAt(0).toUpperCase() + strongMetric.metric.slice(1)} is the primary driver. `
    }
    adminNotes += `Optimal timing for release. Consider accelerating release schedule to capitalize on current momentum.`
  } else {
    adminNotes = `ADMIN NOTES: Metrics are stable. Monitor for any sudden changes. Current state suggests ${state === 'ready' ? 'release-ready' : 'building phase'}.`
  }

  return {
    explanationText: explanationText.trim(),
    actionSteps: actionSteps.slice(0, 5), // Limit to 5 action steps
    adminNotes, // Include admin notes in return (can be stored separately if needed)
    laneContext: laneContext?.oneLiner, // Include lane-specific one-liner
  }
}
