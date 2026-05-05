import { NextRequest, NextResponse } from 'next/server'
import { getUsers, getInstagramMetrics, upsertReleaseReadiness, addReadinessExplanation } from '@/lib/storage'
import { calculateReadinessState } from '@/lib/readinessEngine'
import { generateExplanation } from '@/lib/explanationBuilder'

/**
 * Calculate readiness state for all artists or a specific artist
 * GET /api/release-readiness/calculate?artistId=xxx (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const artistId = searchParams.get('artistId')

    const users = getUsers()
    const artists = artistId
      ? users.filter(u => u.id === artistId && u.role === 'artist')
      : users.filter(u => u.role === 'artist')

    const results = []
    const errors = []

    for (const artist of artists) {
      try {
        const metrics = getInstagramMetrics(artist.id)
        
        if (metrics.length === 0) {
          results.push({
            artistId: artist.id,
            artistName: artist.artistName || artist.name,
            status: 'skipped',
            reason: 'No Instagram metrics available',
          })
          continue
        }

        const readinessCalc = calculateReadinessState(metrics, artist)
        
        // Get user for lane-specific context
        const allUsers = getUsers()
        const artistUser = allUsers.find(u => u.id === artist.id)

        // Generate explanation
        const explanation = generateExplanation(
          readinessCalc.momentumData,
          readinessCalc.state,
          metrics,
          artistUser
        )

        // Persist the calculated state
        upsertReleaseReadiness({
          artistId: artist.id,
          state: readinessCalc.state,
        })

        // Persist explanation
        addReadinessExplanation({
          artistId: artist.id,
          explanationText: explanation.explanationText,
          actionSteps: explanation.actionSteps,
          adminNotes: explanation.adminNotes,
          laneContext: explanation.laneContext,
        })

        results.push({
          artistId: artist.id,
          artistName: artist.artistName || artist.name,
          status: 'success',
          state: readinessCalc.state,
          momentum: readinessCalc.momentum,
          lane: readinessCalc.lane,
          momentumData: readinessCalc.momentumData,
          weightedScore: readinessCalc.weightedScore,
          explanation: explanation.explanationText,
          actionSteps: explanation.actionSteps,
        })
      } catch (error: any) {
        console.error(`[Calculate Readiness] Error for artist ${artist.id}:`, error)
        errors.push({
          artistId: artist.id,
          artistName: artist.artistName || artist.name,
          error: error.message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: artists.length,
        successful: results.filter(r => r.status === 'success').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        errors: errors.length,
      },
      results,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    console.error('Calculate readiness error:', error)
    return NextResponse.json(
      { error: 'Failed to calculate readiness states', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST endpoint - same functionality as GET
 */
export async function POST(request: NextRequest) {
  return GET(request)
}
