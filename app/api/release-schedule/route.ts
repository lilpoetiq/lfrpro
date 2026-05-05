import { NextRequest, NextResponse } from 'next/server'
import { getCatalog, updateCatalogItem, getUsers, addMessage } from '@/lib/storage'
import { logActivity, getActivityLogs } from '@/lib/activityLog'
import { notifyReleaseApproved, notifyReleaseDenied } from '@/lib/aiNotifications'
import { formatLocalDate, formatLocalDateString, parseLocalDate } from '@/lib/utils'

function hasStaffPermission(user: any, perm: string): boolean {
  return Array.isArray(user?.staffPermissions) && user.staffPermissions.includes(perm)
}

function isStaffUser(user: any): boolean {
  return user?.role === 'artist' && Array.isArray(user?.staffPermissions) && user.staffPermissions.length > 0
}

function intersects(a: string[] | undefined, b: string[] | undefined): boolean {
  if (!a || !b || a.length === 0 || b.length === 0) return false
  const setB = new Set(b)
  return a.some(x => setB.has(x))
}

// Get available release dates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const preferredDate = searchParams.get('preferredDate') // Optional preferred date
    
    const catalog = getCatalog()
    const scheduledDates = new Set<string>()
    
    // Get all scheduled release dates (approved or pending)
    catalog.forEach(item => {
      if (item.releaseDate) {
        const date = parseLocalDate(item.releaseDate)
        if (date) {
          scheduledDates.add(formatLocalDateString(date))
        }
      }
      if (item.releaseDateRequested) {
        const date = parseLocalDate(item.releaseDateRequested)
        if (date) {
          scheduledDates.add(formatLocalDateString(date))
        }
      }
    })
    
    // Find available dates (prefer weekends: Fri, Sat, Sun)
    const today = new Date()
    const availableDates: Array<{ date: string; day: string; isWeekend: boolean; weeksOut: number }> = []
    
    // Check from 3 days to 6 weeks out
    for (let i = 3; i <= 42; i++) { // Minimum 3 days, up to 6 weeks out
      const checkDate = new Date(today)
      checkDate.setDate(today.getDate() + i)
      const dateStr = formatLocalDateString(checkDate)
      const dayOfWeek = checkDate.getDay()
      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0 // Fri, Sat, Sun
      
      if (!scheduledDates.has(dateStr)) {
        availableDates.push({
          date: dateStr,
          day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek],
          isWeekend: isWeekend,
          weeksOut: Math.ceil(i / 7),
        })
      }
    }
    
    // Sort: weekends first, then by date
    availableDates.sort((a, b) => {
      if (a.isWeekend && !b.isWeekend) return -1
      if (!a.isWeekend && b.isWeekend) return 1
      return a.date.localeCompare(b.date)
    })
    
    // Get upcoming releases from catalog
    // Include unreleased songs and songs with future release dates (more than 3 days away)
    const threeDaysFromNow = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)
    let upcomingReleases = catalog
      .filter(item => {
        const date = item.releaseDate || item.releaseDateRequested
        if (!date) {
          // Include unreleased songs without dates
          return item.isUnreleased === true
        }
        const releaseDate = new Date(date)
        // Include if:
        // 1. It's unreleased (regardless of date)
        // 2. Release date is in the future AND more than 3 days away
        return item.isUnreleased === true || (releaseDate > today && releaseDate > threeDaysFromNow)
      })
      .map(item => ({
        id: item.id,
        song: item.song,
        artist: item.artist,
        releaseDate: item.releaseDate || item.releaseDateRequested,
        approvalStatus: item.releaseApprovalStatus || 'approved',
        releaseType: item.releaseType,
        releaseDateRequested: item.releaseDateRequested,
        isUnreleased: item.isUnreleased || false,
      }))
      .sort((a, b) => {
        // Sort unreleased items first, then by date
        if (a.isUnreleased && !b.isUnreleased) return -1
        if (!a.isUnreleased && b.isUnreleased) return 1
        return new Date(a.releaseDate!).getTime() - new Date(b.releaseDate!).getTime()
      })
    
    // Also check activity log for pending release requests not in catalog
    const recentActivity = getActivityLogs(200)
    const pendingReleaseRequests = recentActivity.filter(activity => 
      activity.action === 'Release Request Created' &&
      activity.category === 'catalog'
    )
    
    // Add pending requests from activity log that aren't already in upcoming releases
    pendingReleaseRequests.forEach(activity => {
      const songId = activity.details?.songId
      const requestedDate = activity.details?.requestedDate || activity.timestamp
      
      // Check if this is already in upcoming releases
      const alreadyIncluded = upcomingReleases.find(r => r.id === songId)
      
      if (!alreadyIncluded && songId && new Date(requestedDate) > today) {
        upcomingReleases.push({
          id: songId,
          song: activity.details?.songName || 'Unknown Song',
          artist: activity.details?.artist || activity.user,
          releaseDate: requestedDate,
          approvalStatus: 'pending',
          releaseType: 'single',
          releaseDateRequested: requestedDate,
          isUnreleased: true,
        })
      }
    })
    
    // Re-sort after adding activity log entries and limit to 20
    upcomingReleases.sort((a, b) => new Date(a.releaseDate!).getTime() - new Date(b.releaseDate!).getTime())
    upcomingReleases = upcomingReleases.slice(0, 20) // Keep top 20
    
    return NextResponse.json({
      success: true,
      availableDates: availableDates.slice(0, 30), // Top 30 available dates
      upcomingReleases,
      scheduledDates: Array.from(scheduledDates),
    })
  } catch (error: any) {
    console.error('Get release schedule error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch release schedule', details: error.message },
      { status: 500 }
    )
  }
}

// Request a release date
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { songId, requestedDate, artistName, songName } = body

    if (!songId || !requestedDate) {
      return NextResponse.json({ error: 'Song ID and requested date are required' }, { status: 400 })
    }

    // Validate date is at least 3 days out
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Reset to start of day for accurate comparison
    const requestDate = new Date(requestedDate)
    requestDate.setHours(0, 0, 0, 0)
    const daysDiff = Math.ceil((requestDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysDiff < 3) {
      return NextResponse.json(
        { error: 'Release date must be at least 3 days in advance', daysUntil: daysDiff },
        { status: 400 }
      )
    }

    const success = updateCatalogItem(songId, {
      releaseDateRequested: requestedDate,
      releaseApprovalStatus: 'pending',
    })

    if (!success) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Release date requested. Waiting for admin approval.',
    })
  } catch (error: any) {
    console.error('Request release date error:', error)
    return NextResponse.json(
      { error: 'Failed to request release date', details: error.message },
      { status: 500 }
    )
  }
}

// Approve or deny release date (admin only)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { songId, approvalStatus, notes, approvedDate, adminUserId, adminUserName } = body

    if (!songId || !approvalStatus) {
      return NextResponse.json({ error: 'Song ID and approval status are required' }, { status: 400 })
    }

    if (!['approved', 'denied'].includes(approvalStatus)) {
      return NextResponse.json({ error: 'Invalid approval status' }, { status: 400 })
    }

    // Authorization (do not trust the client calling this "admin")
    if (!adminUserId) {
      return NextResponse.json({ error: 'adminUserId required' }, { status: 400 })
    }
    const actor = getUsers().find(u => u.id === adminUserId)
    if (!actor) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const actorIsAdmin = actor.role === 'admin'
    const actorIsManager = actor.role === 'manager'
    const actorIsStaff = isStaffUser(actor)
    const canApprove =
      actorIsAdmin ||
      actorIsManager ||
      (actorIsStaff && hasStaffPermission(actor, 'staff:releases:approve'))
    if (!canApprove) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get song details - first try catalog, then fall back to activity log
    const catalog = getCatalog()
    let song = catalog.find(item => item.id === songId)
    let artistUserId: string | undefined
    let artistName: string | undefined
    let needsCreation = false
    let releaseRequestDetails: any = null
    
    // If song not found in catalog, check activity log for release request
    if (!song) {
      console.log('[RELEASE APPROVAL] Song not found in catalog, checking activity log...')
      const recentActivity = getActivityLogs(200)
      const releaseRequestActivity = recentActivity.find(activity => 
        activity.action === 'Release Request Created' &&
        activity.details?.songId === songId
      )
      
      if (releaseRequestActivity) {
        // Store details to create catalog item if approved
        releaseRequestDetails = releaseRequestActivity.details
        artistUserId = releaseRequestActivity.userId
        artistName = releaseRequestActivity.user
        
        // If approving, we'll create the catalog item
        if (approvalStatus === 'approved') {
          needsCreation = true
          song = {
            id: songId,
            song: releaseRequestDetails?.songName || 'Unknown Song',
            artist: releaseRequestDetails?.artist || releaseRequestActivity.user,
            releaseType: releaseRequestDetails?.releaseType || 'single',
            releaseDateRequested: releaseRequestDetails?.releaseDateRequested,
            fileUrl: releaseRequestDetails?.masterFileUrl,
            albumCover: releaseRequestDetails?.coverFileUrl,
            songs: releaseRequestDetails?.songs,
            promoNotes: releaseRequestDetails?.promoIdeas || releaseRequestDetails?.description,
            genre: releaseRequestDetails?.genre,
            collaborators: releaseRequestDetails?.collaborators,
            socialMediaHandles: releaseRequestDetails?.socialMedia,
          } as any
        } else {
          // For denied, just return error since we can't update non-existent item
          return NextResponse.json({ error: 'Song not found in catalog. Cannot deny a non-existent release request.' }, { status: 404 })
        }
        
        console.log('[RELEASE APPROVAL] Found release request in activity log:', {
          songId,
          songName: song?.song || 'Unknown',
          artist: song?.artist || 'Unknown',
          artistUserId,
          needsCreation,
        })
      } else {
        return NextResponse.json({ error: 'Song not found in catalog or activity log' }, { status: 404 })
      }
    } else {
      // Song exists in catalog - get artist info from it
      artistUserId = song.artistId
      artistName = song.artist
    }
    
    // Ensure song is defined before proceeding
    if (!song) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 })
    }
    
    // Find artist user IDs from song - parse collaborative artist names and match to individual accounts
    const users = getUsers()
    const { getArtistUserMappings } = await import('@/lib/storage')
    const { parseArtistsFromString, matchArtistsToUsers } = await import('@/lib/artistParser')
    
    // Get manual mappings
    const mappings = getArtistUserMappings()
    const manualMappings: Record<string, string> = {}
    mappings.forEach(m => {
      manualMappings[m.artistName.toLowerCase()] = m.userId
    })
    
    // Parse collaborative artist names (e.g., "Style One & Lilpoetiq" -> ["Style One", "Lilpoetiq"])
    const parsedArtists = parseArtistsFromString(song.artist)
    
    // Match each parsed artist to user accounts
    let artistUserIds = matchArtistsToUsers(parsedArtists, users, manualMappings)
    
    // If no matches found from parsing, try fallback methods
    if (artistUserIds.length === 0) {
      if (artistUserId) {
        // Use the artistUserId from activity log if available
        artistUserIds = [artistUserId]
      } else {
        // Try exact match
        const artistUser = users.find(u => 
          u.id === song.artistId || 
          u.artistName === song.artist ||
          u.name === song.artist
        )
        if (artistUser?.id) {
          artistUserIds = [artistUser.id]
          artistUserId = artistUser.id
          // Use artistName (display name) if available, otherwise use name
          artistName = artistUser.artistName || artistUser.name || song.artist
        } else {
          artistName = song.artist
        }
      }
    } else {
      // Use first matched user for backward compatibility
      if (!artistUserId) {
        artistUserId = artistUserIds[0]
        const firstUser = users.find(u => u.id === artistUserId)
        // Use artistName (display name) if available, otherwise use name
        // This ensures "555wick" is used instead of "zion johnson"
        artistName = firstUser?.artistName || firstUser?.name || song.artist
      } else {
        // Get the user to use their artistName
        const userObj = users.find(u => u.id === artistUserId)
        if (userObj) {
          artistName = userObj.artistName || userObj.name || song.artist
        }
      }
    }

    // Staff self-lock: cannot approve/deny anything tied to their own artist account (including collabs)
    if (actorIsStaff && artistUserIds.includes(actor.id)) {
      return NextResponse.json(
        { error: 'Forbidden: staff cannot approve/deny their own releases' },
        { status: 403 }
      )
    }

    // Scope enforcement:
    // - managers: must be linked to at least one of the artists on the release
    // - staff: must be allowed to manage at least one of the artists on the release
    if (!actorIsAdmin) {
      const scopeIds = actorIsManager ? (actor.linkedArtistIds || []) : (actor.staffManagedArtistIds || [])
      if (!intersects(artistUserIds, scopeIds)) {
        return NextResponse.json({ error: 'Forbidden: out of scope' }, { status: 403 })
      }
    }

    const updates: any = {
      releaseApprovalStatus: approvalStatus,
      releaseApprovalNotes: notes || undefined,
    }

    if (approvalStatus === 'approved') {
      const requested = approvedDate || body.requestedDate || song.releaseDateRequested
      
      // Admin rule: approval should NEVER fail due to date being "too soon" or already past.
      // If the provided date is in the past (or today), bump it forward and pick the next free day.
        const today = new Date()
        today.setHours(0, 0, 0, 0)

      // Build set of already-used dates (approved + requested) to avoid collisions
      const scheduledDates = new Set<string>()
      catalog.forEach(item => {
        if (item.releaseDate) {
          const d = parseLocalDate(item.releaseDate)
          if (d) scheduledDates.add(formatLocalDateString(d))
        }
        if (item.releaseDateRequested) {
          const d = parseLocalDate(item.releaseDateRequested)
          if (d) scheduledDates.add(formatLocalDateString(d))
        }
      })

      const requestedDateObj = requested ? new Date(requested) : null
      if (requestedDateObj) requestedDateObj.setHours(0, 0, 0, 0)

      // Start searching from tomorrow if the requested date is <= today; otherwise from requested date.
      const startDate = new Date(today)
      if (requestedDateObj && requestedDateObj.getTime() > today.getTime()) {
        startDate.setTime(requestedDateObj.getTime())
      } else {
        startDate.setDate(startDate.getDate() + 1)
      }

      // Find the next available date (up to ~1 year out, should never hit the cap)
      let scheduledDateStr: string | null = null
      for (let i = 0; i < 365; i++) {
        const d = new Date(startDate)
        d.setDate(startDate.getDate() + i)
        const ds = formatLocalDateString(d)
        if (!scheduledDates.has(ds)) {
          scheduledDateStr = ds
          break
        }
      }
      
      // Fallback: if somehow everything is booked, just use the startDate
      updates.releaseDate = scheduledDateStr || formatLocalDateString(startDate)
      updates.releaseDateRequested = undefined // Clear requested date
    } else {
      // If denied, keep requested date but mark as denied
      // Note: Denied releases will be filtered out from catalog display
      updates.releaseDate = undefined
    }

    // When approving, ensure all fields are properly set for the catalog
    if (approvalStatus === 'approved') {
      // Get full release request details from activity log if needed
      const recentActivity = getActivityLogs(200)
      const releaseRequestActivity = recentActivity.find(activity => 
        activity.action === 'Release Request Created' &&
        activity.details?.songId === songId
      )
      
      if (releaseRequestActivity && releaseRequestActivity.details) {
        const details = releaseRequestActivity.details
        
        // Ensure all metadata is included in updates
        if (details.genre && !updates.genre) {
          updates.genre = details.genre
        }
        if (details.collaborators && !updates.collaborators) {
          updates.collaborators = details.collaborators
        }
        if (details.promoIdeas && !updates.promoNotes) {
          updates.promoNotes = details.promoIdeas
        }
        if (details.socialMedia && !updates.socialMediaHandles) {
          updates.socialMediaHandles = details.socialMedia
        }
        // Ensure songs array is preserved for albums/EPs
        if (song.songs && song.songs.length > 0) {
          updates.songs = song.songs
        }
      }
      
      // Update artist name to use artistName (display name) instead of real name
      // Get the user to use their artistName field (e.g., "555wick" instead of "zion johnson")
      if (artistUserId) {
        const userObj = users.find(u => u.id === artistUserId)
        if (userObj && userObj.artistName) {
          // Use artistName (display name) like "555wick" instead of real name "zion johnson"
          updates.artist = userObj.artistName
          console.log('[RELEASE APPROVAL] Updated artist name:', {
            from: song.artist,
            to: userObj.artistName,
            userId: artistUserId,
          })
        }
      }
      
      // Ensure artist linking is set
      if (artistUserIds.length > 0) {
        updates.artistIds = artistUserIds
        updates.artistId = artistUserIds[0]
      }
      
      // Mark as manually added (not from CSV)
      updates.manuallyAdded = true
      updates.fromCSV = false
    }

    // Try to update catalog (may fail if catalog update isn't working)
    const catalogUpdateSuccess = updateCatalogItem(songId, updates)
    
    if (!catalogUpdateSuccess) {
      console.log('[RELEASE APPROVAL] Catalog update failed, but continuing with activity log and notification...')
    } else if (approvalStatus === 'approved') {
      console.log('[RELEASE APPROVAL] Successfully added approved release to catalog:', {
        songId,
        songName: song.song,
        releaseDate: updates.releaseDate,
        artistIds: updates.artistIds,
      })
    }

    // Notify AI server of approval/denial (will text admins) - non-blocking
    try {
      if (approvalStatus === 'approved') {
        await notifyReleaseApproved({
          songName: song.song,
          artistName: song.artist,
          releaseDate: updates.releaseDate,
          approvedBy: adminUserName || 'Admin',
          songId: songId,
          userId: artistUserId || song.artistId,
          releaseType: song.releaseType || 'single',
        })
      } else {
        await notifyReleaseDenied({
          songName: song.song,
          artistName: song.artist,
          reason: notes,
          deniedBy: adminUserName || 'Admin',
          songId: songId,
          userId: artistUserId || song.artistId,
          releaseDate: song.releaseDateRequested,
          releaseType: song.releaseType || 'single',
        })
      }
    } catch (error) {
      console.error('[PUT /api/release-schedule] Error notifying AI (non-critical):', error)
      // Continue - don't fail the request
    }

    // Log release approval/denial activity
    logActivity({
      action: approvalStatus === 'approved' 
        ? 'Release Request Approved - Added to Catalog' 
        : 'Release Request Denied',
      user: adminUserName || 'Admin',
      userId: adminUserId,
      details: {
        songId: songId,
        songName: song.song,
        artist: song.artist,
        artistUserId: artistUserId,
        artistIds: artistUserIds,
        approvalStatus: approvalStatus,
        releaseDate: approvalStatus === 'approved' ? updates.releaseDate : undefined,
        releaseDateRequested: song.releaseDateRequested,
        releaseType: song.releaseType,
        notes: notes || undefined,
        deniedReason: approvalStatus === 'denied' ? (notes || 'No reason provided') : undefined,
        addedToCatalog: approvalStatus === 'approved' && catalogUpdateSuccess,
      },
      category: 'release',
    })

    // Notify all artists involved in the collaboration
    if (artistUserIds.length > 0) {
      try {
        const users = getUsers()
        const messageSubject = approvalStatus === 'approved' 
          ? `Release Approved: ${song.song}`
          : `Release Denied: ${song.song}`
        
        const messageBody = approvalStatus === 'approved'
          ? `Your release request for "${song.song}" has been approved!${updates.releaseDate ? ` Release date: ${formatLocalDate(updates.releaseDate)}` : ''}${notes ? `\n\nNotes: ${notes}` : ''}`
          : `Your release request for "${song.song}" has been denied.${notes ? `\n\nReason: ${notes}` : '\n\nPlease contact admin for more details.'}`
        
        // Send message to all matched artists
        for (const userId of artistUserIds) {
          const user = users.find(u => u.id === userId)
          if (user) {
            addMessage({
              from: adminUserId || 'admin',
              fromName: adminUserName || 'Admin',
              to: userId,
              toName: user.name || song.artist,
              subject: messageSubject,
              message: messageBody,
              songId: songId,
            })
          }
        }
        
        console.log('[RELEASE APPROVAL] Notifications sent to artists:', {
          artistUserIds,
          artistNames: artistUserIds.map(id => {
            const user = users.find(u => u.id === id)
            return user?.name || 'Unknown'
          }),
          approvalStatus,
        })
      } catch (msgError) {
        console.error('[RELEASE APPROVAL] Failed to send notifications to artists:', msgError)
        // Don't fail the whole request if notification fails
      }
    }

    // Get updated catalog item to return
    const updatedCatalog = getCatalog()
    const updatedItem = updatedCatalog.find(item => item.id === songId)
    
    return NextResponse.json({
      success: true,
      message: approvalStatus === 'approved' 
        ? `Release approved and added to catalog for ${updates.releaseDate}` 
        : 'Release denied',
      catalogUpdated: catalogUpdateSuccess,
      catalogItem: updatedItem,
    })
  } catch (error: any) {
    console.error('Update release approval error:', error)
    return NextResponse.json(
      { error: 'Failed to update release approval', details: error.message },
      { status: 500 }
    )
  }
}

