import { NextRequest, NextResponse } from 'next/server'
import {
  getReleaseReadinessByArtistId,
  upsertReleaseReadiness,
  getReadinessExplanations,
  addReadinessExplanation,
  getInstagramMetrics,
  addInstagramMetrics,
  deleteInstagramMetrics,
  getTikTokMetrics,
  addTikTokMetrics,
  deleteTikTokMetrics,
  getTikTokSongViews,
  addTikTokSongViews,
  deleteTikTokSongViews,
  getSpotifySnapshots,
  addSpotifySnapshot,
  deleteSpotifySnapshot,
  getUsers,
  getStaffOverrides,
  addStaffOverride,
  getCatalog,
  getPostDropHealth,
  addPostDropHealth,
  updatePostDropHealth,
  getReleaseMemory,
  addReleaseRequest,
  updateReleaseDecision,
} from '@/lib/storage'
import { calculateReadinessState } from '@/lib/readinessEngine'
import { generateExplanation } from '@/lib/explanationBuilder'
import { calculateEnhancedReadiness, ReleaseGoal, calculateReleaseMemory } from '@/lib/enhancedReadinessEngine'
import { makeReleaseDecision } from '@/lib/releaseDecisionEngine'

function isStaffUser(user: any): boolean {
  return user?.role === 'artist' && Array.isArray(user?.staffPermissions) && user.staffPermissions.length > 0
}

function canAddManualMetrics(user: any): boolean {
  // Allow both staff and admin users to add manual metrics
  return user?.role === 'admin' || isStaffUser(user)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const artistId = searchParams.get('artistId')
    const type = searchParams.get('type') || 'all' // all, readiness, explanations, instagram, spotify
    const recalculate = searchParams.get('recalculate') === 'true'

    if (!artistId) {
      return NextResponse.json(
        { error: 'Artist ID is required' },
        { status: 400 }
      )
    }

    // Get user and metrics for calculation
    const users = getUsers()
    const user = users.find(u => u.id === artistId && u.role === 'artist')
    const instagramMetrics = getInstagramMetrics(artistId)
    const tikTokMetrics = getTikTokMetrics(artistId)
    const tikTokSongViews = getTikTokSongViews()
    const releaseGoal = (searchParams.get('goal') as ReleaseGoal) || 'streams'
    const enhanced = searchParams.get('enhanced') === 'true'
    const songId = searchParams.get('songId') || undefined

    // Calculate readiness state if we have metrics and user
    let calculatedReadiness: any = null
    let enhancedReadiness: any = null
    
    if (user && instagramMetrics.length > 0) {
      try {
        // Enhanced calculation (if requested)
        if (enhanced) {
          // Get catalog once for filtering TikTok song views and song tags
          const catalog = getCatalog()
          const artistTikTokSongViews = tikTokSongViews.filter(v => {
            const song = catalog.find(s => s.id === v.songId)
            return song?.artistId === artistId || song?.artistIds?.includes(artistId)
          })
          
          // Get song tags if songId provided
          let songTags: {
            energy?: 'low' | 'medium' | 'high'
            emotion?: string
            contentFit?: string
          } | undefined = undefined
          if (songId) {
            const song = catalog.find(s => s.id === songId)
            if (song?.readinessTags) {
              songTags = {
                energy: song.readinessTags.energy,
                emotion: song.readinessTags.emotion,
                contentFit: song.readinessTags.contentFit,
              }
            }
          }
          
          enhancedReadiness = calculateEnhancedReadiness(
            instagramMetrics,
            tikTokMetrics,
            artistTikTokSongViews,
            user,
            releaseGoal,
            songId,
            songTags
          )
        }
        
        // Basic calculation (always done for backward compatibility)
        const readinessCalc = calculateReadinessState(instagramMetrics, user)
        calculatedReadiness = {
          calculatedState: readinessCalc.state,
          momentum: readinessCalc.momentum,
          momentumData: readinessCalc.momentumData,
          lane: readinessCalc.lane,
          weightedScore: readinessCalc.weightedScore,
        }

        // Auto-persist if recalculate is true or no existing readiness state
        if (recalculate || !getReleaseReadinessByArtistId(artistId)) {
          upsertReleaseReadiness({
            artistId: artistId,
            state: readinessCalc.state,
          })

          // Generate and persist explanation
          try {
            const explanation = generateExplanation(
              readinessCalc.momentumData,
              readinessCalc.state,
              instagramMetrics,
              user
            )
            addReadinessExplanation({
              artistId: artistId,
              explanationText: explanation.explanationText,
              actionSteps: explanation.actionSteps,
              adminNotes: explanation.adminNotes,
              laneContext: explanation.laneContext,
            })
          } catch (explanationError: any) {
            console.warn('[Readiness] Explanation generation error:', explanationError)
            // Don't fail if explanation generation fails
          }
        }
      } catch (error: any) {
        console.error('[Readiness] Calculation error:', error)
      }
    } else if (!instagramMetrics || instagramMetrics.length === 0) {
      // Default to 'building' state if no readiness data exists
      const existingReadiness = getReleaseReadinessByArtistId(artistId)
      if (!existingReadiness) {
        upsertReleaseReadiness({
          artistId: artistId,
          state: 'building', // Default state
        })
      }
    }

    const result: any = {}

    if (type === 'readiness' || type === 'all') {
      const readiness = getReleaseReadinessByArtistId(artistId)
      result.readiness = {
        ...readiness,
        calculated: calculatedReadiness,
      }
      
      // Early return if only requesting readiness
      if (type === 'readiness') {
        return NextResponse.json({ 
          success: true, 
          data: result
        })
      }
    }

    if (type === 'explanations' || type === 'all') {
      result.explanations = getReadinessExplanations(artistId)
    }

    if (type === 'instagram' || type === 'all') {
      result.instagramMetrics = instagramMetrics
    }

    if (type === 'spotify' || type === 'all') {
      const releaseId = searchParams.get('releaseId')
      result.spotifySnapshots = getSpotifySnapshots(artistId, releaseId || undefined)
    }

    if (type === 'tiktok' || type === 'all') {
      result.tikTokMetrics = getTikTokMetrics(artistId)
    }

    if (type === 'tiktok-song-views' || type === 'all') {
      const songId = searchParams.get('songId')
      result.tikTokSongViews = getTikTokSongViews(songId || undefined)
    }

    if (type === 'enhanced' || (type === 'all' && enhanced)) {
      result.enhanced = enhancedReadiness
    }

    if (type === 'overrides' || type === 'all') {
      result.staffOverrides = getStaffOverrides(artistId)
    }

    if (type === 'post-drop-health' || type === 'all') {
      const releaseId = searchParams.get('releaseId')
      result.postDropHealth = getPostDropHealth(releaseId || undefined, artistId)
    }

    if (type === 'release-memory' || type === 'all') {
      if (!artistId) {
        result.releaseMemory = null
      } else {
        const existingMemory = getReleaseMemory(artistId)
        if (!existingMemory) {
          // Calculate from historical data
          const historicalOverrides = getStaffOverrides(artistId)
          const historicalHealth = getPostDropHealth(undefined, artistId)
          const catalog = getCatalog()
          const calculatedMemory = calculateReleaseMemory(
            artistId,
            historicalOverrides,
            historicalHealth,
            catalog
          )
          if (calculatedMemory) {
            // Would save this, but for now just return it
            result.releaseMemory = calculatedMemory
          } else {
            result.releaseMemory = null
          }
        } else {
          result.releaseMemory = existingMemory
        }
      }
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    console.error('Get release readiness error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch release readiness data', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, ...data } = body

    if (!type) {
      return NextResponse.json(
        { error: 'Type is required (readiness, explanation, instagram, tiktok, tiktok-song-views, spotify, override, post-drop-health, release-request)' },
        { status: 400 }
      )
    }

    if (!data.artistId) {
      return NextResponse.json(
        { error: 'Artist ID is required' },
        { status: 400 }
      )
    }

    let result: any

    switch (type) {
      case 'readiness':
        if (!data.state || !['cooling', 'building', 'ready'].includes(data.state)) {
          return NextResponse.json(
            { error: 'Valid state is required (cooling, building, ready)' },
            { status: 400 }
          )
        }
        result = upsertReleaseReadiness({
          artistId: data.artistId,
          state: data.state,
        })
        break

      case 'explanation':
        if (!data.explanationText || !Array.isArray(data.actionSteps)) {
          return NextResponse.json(
            { error: 'explanationText and actionSteps array are required' },
            { status: 400 }
          )
        }
        result = addReadinessExplanation({
          artistId: data.artistId,
          explanationText: data.explanationText,
          actionSteps: data.actionSteps,
        })
        break

      case 'instagram':
        if (!data.metricDate) {
          return NextResponse.json(
            { error: 'metricDate is required' },
            { status: 400 }
          )
        }
        
        // If manually added, verify the user is staff or admin
        if (data.manuallyAdded && data.addedBy) {
          const users = getUsers()
          const addingUser = users.find(u => u.id === data.addedBy)
          if (!addingUser || !canAddManualMetrics(addingUser)) {
            return NextResponse.json(
              { error: 'Only staff members and admins can manually add Instagram metrics' },
              { status: 403 }
            )
          }
        }
        
        result = addInstagramMetrics({
          artistId: data.artistId,
          metricDate: data.metricDate,
          views: data.views || 0,
          saves: data.saves || 0,
          shares: data.shares || 0,
          comments: data.comments || 0,
          likes: data.likes,
          completionRate: data.completionRate || 0,
          retention: data.retention,
          skipRate: data.skipRate,
          interactions: data.interactions,
          watchTime: data.watchTime,
          audience: data.audience,
          facebookVsInstagram: data.facebookVsInstagram,
          followers: data.followers || 0,
          manuallyAdded: data.manuallyAdded || false,
          addedBy: data.addedBy,
          videoTitle: data.videoTitle,
          videoLink: data.videoLink,
        })
        break

      case 'spotify':
        if (!data.weekStart) {
          return NextResponse.json(
            { error: 'weekStart is required' },
            { status: 400 }
          )
        }
        result = addSpotifySnapshot({
          artistId: data.artistId,
          releaseId: data.releaseId,
          weekStart: data.weekStart,
          streams: data.streams || 0,
          listeners: data.listeners || 0,
          saveRate: data.saveRate || 0,
          playlistAdds: data.playlistAdds || 0,
          topCities: Array.isArray(data.topCities) ? data.topCities : [],
          confidence: data.confidence || 0,
          rawImageUrl: data.rawImageUrl,
        })
        break

      case 'tiktok':
        if (!data.metricDate) {
          return NextResponse.json(
            { error: 'metricDate is required' },
            { status: 400 }
          )
        }
        
        // If manually added, verify the user is staff or admin
        if (data.manuallyAdded && data.addedBy) {
          const users = getUsers()
          const addingUser = users.find(u => u.id === data.addedBy)
          if (!addingUser || !canAddManualMetrics(addingUser)) {
            return NextResponse.json(
              { error: 'Only staff members and admins can manually add TikTok metrics' },
              { status: 403 }
            )
          }
        }
        
        result = addTikTokMetrics({
          artistId: data.artistId,
          metricDate: data.metricDate,
          views: data.views || 0,
          likes: data.likes,
          comments: data.comments,
          shares: data.shares,
          followers: data.followers || 0,
          engagementRate: data.engagementRate,
          watchTime: data.watchTime,
          retention: data.retention,
          manuallyAdded: data.manuallyAdded || false,
          addedBy: data.addedBy,
          videoTitle: data.videoTitle,
          videoLink: data.videoLink,
        })
        break

      case 'tiktok-song-views':
        if (!data.songId || !data.views || !data.metricDate) {
          return NextResponse.json(
            { error: 'songId, views, and metricDate are required' },
            { status: 400 }
          )
        }
        
        // Verify the user is staff or admin
        if (data.addedBy) {
          const users = getUsers()
          const addingUser = users.find(u => u.id === data.addedBy)
          if (!addingUser || !canAddManualMetrics(addingUser)) {
            return NextResponse.json(
              { error: 'Only staff members and admins can add TikTok song views' },
              { status: 403 }
            )
          }
        }
        
        result = addTikTokSongViews({
          songId: data.songId,
          songName: data.songName || '',
          artistName: data.artistName || '',
          views: data.views,
          metricDate: data.metricDate,
          videoUrl: data.videoUrl,
          manuallyAdded: true,
          addedBy: data.addedBy,
        })
        break

      case 'override':
        if (!data.artistId || !data.overriddenState || !data.reason || !data.overriddenBy) {
          return NextResponse.json(
            { error: 'artistId, overriddenState, reason, and overriddenBy are required' },
            { status: 400 }
          )
        }
        
        // Verify the user is staff or admin
        const overrideUsers = getUsers()
        const overridingUser = overrideUsers.find(u => u.id === data.overriddenBy)
        if (!overridingUser || !canAddManualMetrics(overridingUser)) {
          return NextResponse.json(
            { error: 'Only staff members and admins can override readiness states' },
            { status: 403 }
          )
        }
        
        // Get current state to use as originalState if not provided
        const currentReadiness = getReleaseReadinessByArtistId(data.artistId)
        const originalState = data.originalState || currentReadiness?.state || 'building'
        
        result = addStaffOverride({
          artistId: data.artistId,
          overriddenState: data.overriddenState,
          originalState: originalState,
          reason: data.reason,
          overriddenBy: data.overriddenBy,
          releaseDate: data.releaseDate,
          releaseId: data.releaseId,
        })
        
        // Update the readiness state to the overridden state
        upsertReleaseReadiness({
          artistId: data.artistId,
          state: data.overriddenState,
        })
        break

      case 'release-request':
        if (!data.releaseType || !data.intendedTimeframe || !data.assetsConfirmed) {
          return NextResponse.json(
            { error: 'releaseType, intendedTimeframe, and assetsConfirmed are required' },
            { status: 400 }
          )
        }
        
        // Create release request
        const request = addReleaseRequest({
          artistId: data.artistId,
          releaseType: data.releaseType,
          intendedTimeframe: data.intendedTimeframe,
          assetsConfirmed: data.assetsConfirmed,
        })
        
        // Get metrics and calculate decision
        const users = getUsers()
        const user = users.find(u => u.id === data.artistId && u.role === 'artist')
        const instagramMetrics = getInstagramMetrics(data.artistId)
        const tikTokMetrics = getTikTokMetrics(data.artistId)
        
        if (user && instagramMetrics.length > 0) {
          try {
            // Calculate enhanced readiness for decision
            const catalog = getCatalog()
            const tikTokSongViews = getTikTokSongViews()
            const artistTikTokSongViews = tikTokSongViews.filter(v => {
              const song = catalog.find(s => s.id === v.songId)
              return song?.artistId === data.artistId || song?.artistIds?.includes(data.artistId)
            })
            
            const enhancedReadiness = calculateEnhancedReadiness(
              instagramMetrics,
              tikTokMetrics,
              artistTikTokSongViews,
              user,
              'streams' as ReleaseGoal,
              undefined,
              undefined
            )
            
            // Make decision
            const decisionResult = makeReleaseDecision(
              instagramMetrics,
              tikTokMetrics,
              user,
              request,
              enhancedReadiness
            )
            
            // Convert to ReleaseDecision format
            const decision: any = {
              decision: decisionResult.decision,
              decidedAt: new Date().toISOString(),
              evidence: decisionResult.evidence,
            }
            
            if (decisionResult.decision === 'APPROVED') {
              decision.releaseWindow = decisionResult.releaseWindow
              decision.approvalReason = decisionResult.approvalReason
              decision.rules = decisionResult.rules
            } else if (decisionResult.decision === 'HOLD') {
              decision.holdReasons = decisionResult.holdReasons
              decision.actionableTasks = decisionResult.actionableTasks
            } else if (decisionResult.decision === 'DENIED') {
              decision.denialReason = decisionResult.denialReason
              decision.expectedOutcome = decisionResult.expectedOutcome
              decision.rebuildPlan = decisionResult.rebuildPlan
              decision.cooldownPeriodDays = decisionResult.cooldownPeriodDays
              if (decisionResult.cooldownPeriodDays) {
                decision.cooldownUntil = new Date(
                  Date.now() + decisionResult.cooldownPeriodDays * 24 * 60 * 60 * 1000
                ).toISOString()
              }
            }
            
            updateReleaseDecision(data.artistId, decision)
            result = { request, decision }
          } catch (error: any) {
            console.error('[Release Request] Decision calculation error:', error)
            // Still return the request even if decision calculation fails
            result = { request, error: 'Decision calculation failed: ' + error.message }
          }
        } else {
          // Not enough data for decision - keep as UNDER_REVIEW
          result = { request }
        }
        break

      case 'post-drop-health':
        if (!data.releaseId || !data.artistId || !data.releaseDate) {
          return NextResponse.json(
            { error: 'releaseId, artistId, and releaseDate are required' },
            { status: 400 }
          )
        }
        
        // Check if exists, update or create
        const existingHealth = getPostDropHealth(data.releaseId, data.artistId).find(
          h => h.releaseId === data.releaseId
        )
        
        if (existingHealth) {
          result = updatePostDropHealth(existingHealth.id, {
            health6h: data.health6h,
            health24h: data.health24h,
            health72h: data.health72h,
            overallClassification: data.overallClassification,
            lessonsLearned: data.lessonsLearned,
          })
        } else {
          result = addPostDropHealth({
            releaseId: data.releaseId,
            artistId: data.artistId,
            releaseDate: data.releaseDate,
            health6h: data.health6h,
            health24h: data.health24h,
            health72h: data.health72h,
            overallClassification: data.overallClassification,
            lessonsLearned: data.lessonsLearned,
          })
        }
        break

      default:
        return NextResponse.json(
          { error: 'Invalid type. Must be: readiness, explanation, instagram, tiktok, tiktok-song-views, spotify, override, post-drop-health, or release-request' },
          { status: 400 }
        )
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    console.error('Post release readiness error:', error)
    return NextResponse.json(
      { error: 'Failed to save release readiness data', details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // instagram, spotify, tiktok, tiktok-song-views
    const id = searchParams.get('id')

    if (!type) {
      return NextResponse.json(
        { error: 'Type is required (instagram, spotify, tiktok, tiktok-song-views)' },
        { status: 400 }
      )
    }

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      )
    }

    let success = false

    switch (type) {
      case 'instagram':
        success = deleteInstagramMetrics(id)
        break
      case 'spotify':
        success = deleteSpotifySnapshot(id)
        break
      case 'tiktok':
        success = deleteTikTokMetrics(id)
        break
      case 'tiktok-song-views':
        success = deleteTikTokSongViews(id)
        break
      default:
        return NextResponse.json(
          { error: 'Invalid type. Must be one of: instagram, spotify, tiktok, tiktok-song-views' },
          { status: 400 }
        )
    }

    if (!success) {
      return NextResponse.json(
        { error: 'Metric not found or could not be deleted' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, message: 'Metric deleted successfully' })
  } catch (error: any) {
    console.error('Delete metric error:', error)
    return NextResponse.json(
      { error: 'Failed to delete metric', details: error.message },
      { status: 500 }
    )
  }
}
