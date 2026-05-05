import { NextRequest, NextResponse } from 'next/server'
import {
  getCatalog,
  getReleaseReadinessByArtistId,
  getSpotifySnapshots,
  getPostReleaseEvaluations,
  addPostReleaseEvaluation,
  getReadinessExplanations,
} from '@/lib/storage'
import { evaluateRelease, generateCorrelationNotes } from '@/lib/postReleaseEvaluation'

/**
 * POST /api/post-release-evaluation
 * Evaluate a release after it's been out for a period
 * Compares readiness state at release time with Spotify snapshot outcomes
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { releaseId, artistId, releaseDate, evaluatedBy } = body

    if (!releaseId || !artistId || !releaseDate) {
      return NextResponse.json(
        { error: 'Missing required fields: releaseId, artistId, releaseDate' },
        { status: 400 }
      )
    }

    // Get release from catalog
    const catalog = getCatalog()
    const release = catalog.find(r => r.id === releaseId)

    if (!release) {
      return NextResponse.json(
        { error: 'Release not found' },
        { status: 404 }
      )
    }

    // Get readiness state at release time (or closest available)
    const releaseDateObj = new Date(releaseDate)
    const readinessData = getReleaseReadinessByArtistId(artistId)
    
    // Get explanations around release time
    const explanations = getReadinessExplanations(artistId)
    const releaseTimeExplanation = explanations
      .filter(e => {
        const explanationDate = new Date(e.generatedAt)
        const daysDiff = Math.abs((releaseDateObj.getTime() - explanationDate.getTime()) / (1000 * 60 * 60 * 24))
        return daysDiff <= 7 // Within 7 days of release
      })
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())[0]

    // Get Spotify snapshots for this release
    const spotifySnapshots = getSpotifySnapshots(artistId, releaseId)

    if (spotifySnapshots.length === 0) {
      return NextResponse.json(
        { 
          error: 'No Spotify snapshots available for this release',
          details: 'Please upload Spotify screenshots before evaluating',
        },
        { status: 400 }
      )
    }

    // Determine readiness state at release
    const readinessAtRelease = {
      state: readinessData?.state || 'building' as const,
      momentum: 'steady' as const, // Default if not available
      weightedScore: 0.5, // Default
      explanation: releaseTimeExplanation?.explanationText,
    }

    // If we have calculated readiness data, use it
    // (This would require storing historical readiness states - for now use current)
    // TODO: Store readiness state snapshots at release time

    // Generate internal notes
    const week1Streams = spotifySnapshots
      .filter(s => {
        const snapshotDate = new Date(s.weekStart)
        const week1End = new Date(releaseDateObj.getTime() + 7 * 24 * 60 * 60 * 1000)
        return snapshotDate >= releaseDateObj && snapshotDate <= week1End
      })
      .reduce((sum, s) => sum + s.streams, 0)

    const week1Listeners = Math.max(
      ...spotifySnapshots
        .filter(s => {
          const snapshotDate = new Date(s.weekStart)
          const week1End = new Date(releaseDateObj.getTime() + 7 * 24 * 60 * 60 * 1000)
          return snapshotDate >= releaseDateObj && snapshotDate <= week1End
        })
        .map(s => s.listeners),
      0
    )

    const correlationNotes = generateCorrelationNotes(
      readinessAtRelease.state,
      week1Streams,
      week1Listeners
    )

    const internalNotes: {
      performanceRating: 'exceeded' | 'met' | 'below' | 'significantly_below'
      keyFindings: string[]
      recommendations: string[]
      correlationNotes: string
    } = {
      performanceRating: 'met',
      keyFindings: [],
      recommendations: [],
      correlationNotes,
    }

    // Determine performance rating and generate findings
    if (readinessAtRelease.state === 'ready' && week1Streams >= 10000) {
      internalNotes.performanceRating = 'exceeded'
      internalNotes.keyFindings.push('Release exceeded expectations for "ready" state')
      internalNotes.recommendations.push('Continue using readiness system for future releases')
    } else if (readinessAtRelease.state === 'ready' && week1Streams < 5000) {
      internalNotes.performanceRating = 'below'
      internalNotes.keyFindings.push('Release underperformed despite "ready" state')
      internalNotes.recommendations.push('Review promotional strategy and playlist placement')
    } else if (readinessAtRelease.state === 'building' && week1Streams >= 5000) {
      internalNotes.performanceRating = 'exceeded'
      internalNotes.keyFindings.push('Performance exceeded expectations for "building" state')
      internalNotes.recommendations.push('Strong promotional support may have compensated for lower readiness')
    } else if (readinessAtRelease.state === 'cooling' && week1Streams >= 3000) {
      internalNotes.performanceRating = 'exceeded'
      internalNotes.keyFindings.push('Performance significantly exceeded expectations for "cooling" state')
      internalNotes.recommendations.push('Viral factor or strong promotion overcame lower readiness metrics')
    }

    // Create evaluation
    const evaluation = evaluateRelease(
      releaseId,
      artistId,
      releaseDate,
      readinessAtRelease,
      spotifySnapshots,
      internalNotes
    )

    // Add evaluator info
    if (evaluatedBy) {
      evaluation.evaluatedBy = evaluatedBy
    }

    // Save evaluation
    const savedEvaluation = addPostReleaseEvaluation(evaluation)

    return NextResponse.json({
      success: true,
      evaluation: savedEvaluation,
    })
  } catch (error: any) {
    console.error('Post-release evaluation error:', error)
    return NextResponse.json(
      { error: 'Failed to evaluate release', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/post-release-evaluation?releaseId=xxx&artistId=xxx
 * Get post-release evaluations
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const releaseId = searchParams.get('releaseId')
    const artistId = searchParams.get('artistId')

    const evaluations = getPostReleaseEvaluations(
      releaseId || undefined,
      artistId || undefined
    )

    return NextResponse.json({
      success: true,
      evaluations,
      count: evaluations.length,
    })
  } catch (error: any) {
    console.error('Get post-release evaluations error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch evaluations', details: error.message },
      { status: 500 }
    )
  }
}
