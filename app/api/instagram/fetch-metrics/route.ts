import { NextRequest, NextResponse } from 'next/server'
import { getUsers, getInstagramMetrics, addInstagramMetrics, upsertReleaseReadiness, addReadinessExplanation } from '@/lib/storage'
import { fetchInstagramMetrics } from '@/lib/metaApi'
import { calculateReadinessState } from '@/lib/readinessEngine'
import { generateExplanation } from '@/lib/explanationBuilder'

/**
 * Fetch Instagram metrics for all connected artists
 * This endpoint should be called daily by a cron job
 * 
 * GET /api/instagram/fetch-metrics?artistId=xxx (optional - fetch for specific artist)
 * 
 * For cron jobs, you can protect this with a secret:
 * GET /api/instagram/fetch-metrics?secret=YOUR_CRON_SECRET
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const artistId = searchParams.get('artistId')
    const secret = searchParams.get('secret')
    
    // Optional: Verify cron secret for security
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && secret !== cronSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const users = getUsers()
    const artists = artistId
      ? users.filter(u => u.id === artistId && u.role === 'artist')
      : users.filter(u => u.role === 'artist' && u.instagramAccountId && u.instagramAccessToken)

    const results = []
    const errors = []

    for (const artist of artists) {
      if (!artist.instagramAccountId || !artist.instagramAccessToken) {
        continue
      }

      // Check if token is expired
      if (artist.instagramTokenExpiresAt) {
        const expiresAt = new Date(artist.instagramTokenExpiresAt)
        if (expiresAt < new Date()) {
          errors.push({
            artistId: artist.id,
            artistName: artist.artistName || artist.name,
            error: 'Access token expired',
          })
          continue
        }
      }

      try {
        // Fetch metrics from Meta API
        const metrics = await fetchInstagramMetrics(
          artist.instagramAccountId,
          artist.instagramAccessToken!
        )

        // Check if we already have metrics for today
        const today = new Date().toISOString().split('T')[0]
        const existingMetrics = getInstagramMetrics(artist.id)
        const todayMetrics = existingMetrics.find(
          (m: any) => m.metricDate.startsWith(today)
        )

        if (todayMetrics) {
          results.push({
            artistId: artist.id,
            artistName: artist.artistName || artist.name,
            status: 'skipped',
            reason: 'Metrics already exist for today',
          })
          continue
        }

        // Save metrics to database
        addInstagramMetrics({
          artistId: artist.id,
          metricDate: today,
          views: metrics.views,
          saves: metrics.saves,
          shares: metrics.shares,
          comments: metrics.comments,
          completionRate: metrics.completionRate / 100, // Store as decimal (0-1)
          followers: metrics.followers,
        })

        // Recalculate readiness state and generate explanation after adding new metrics
        try {
          const updatedMetrics = getInstagramMetrics(artist.id)
          if (updatedMetrics.length > 0) {
            const readinessCalc = calculateReadinessState(updatedMetrics, artist)
            
            // Generate explanation with user context
            const explanation = generateExplanation(
              readinessCalc.momentumData,
              readinessCalc.state,
              updatedMetrics,
              artist
            )

            // Persist state
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
          }
        } catch (readinessError: any) {
          console.warn(`[Fetch Metrics] Failed to calculate readiness for ${artist.id}:`, readinessError.message)
          // Don't fail the whole operation if readiness calculation fails
        }

        results.push({
          artistId: artist.id,
          artistName: artist.artistName || artist.name,
          status: 'success',
          metrics: {
            views: metrics.views,
            saves: metrics.saves,
            shares: metrics.shares,
            comments: metrics.comments,
            completionRate: metrics.completionRate,
            followers: metrics.followers,
          },
        })
      } catch (error: any) {
        console.error(`[Fetch Metrics] Error for artist ${artist.id}:`, error)
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
    console.error('Fetch Instagram metrics error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Instagram metrics', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Manual trigger endpoint (POST) - same functionality as GET
 */
export async function POST(request: NextRequest) {
  return GET(request)
}
