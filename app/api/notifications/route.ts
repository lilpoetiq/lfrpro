import { NextRequest, NextResponse } from 'next/server'
import { getMessages, getUsers, getNotificationReadStates, markNotificationRead as markRead, getNotificationDeletedStates, markNotificationDeleted, getGuides } from '@/lib/storage'
import { getCatalog } from '@/lib/storage'
import { getActivityLogs } from '@/lib/activityLog'
import { formatLocalDate } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const userRole = searchParams.get('role')
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/738e3ff4-c1bc-4f87-8364-ca554946b59d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notifications/route.ts:6',message:'Notification API called',data:{userId,userRole},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    const notifications: Array<{
      id: string
      type: 'message' | 'release_pending' | 'release_approved' | 'release_denied' | 'guide_assigned'
      title: string
      message: string
      timestamp: string
      read: boolean
      link?: string
      metadata?: any
    }> = []
    
    // Get ALL messages first, then filter by userId
    const allMessages = getMessages() // Get all messages without filtering
    const users = getUsers()
    const catalog = getCatalog() // Load catalog early so we can check release status
    const { getGuides } = await import('@/lib/storage')
    const guides = getGuides()
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/738e3ff4-c1bc-4f87-8364-ca554946b59d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notifications/route.ts:25',message:'Loaded all messages',data:{totalMessages:allMessages.length,allMessageIds:allMessages.map(m=>m.id),allMessageTos:allMessages.map(m=>({id:m.id,to:m.to,subject:m.subject,read:m.read}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    // Get read notification states for this user
    const readStates = userId ? getNotificationReadStates(userId) : new Set<string>()
    
    // Get deleted notification states for this user
    const deletedStates = userId ? getNotificationDeletedStates(userId) : new Set<string>()
    
    // Debug: log read states
    if (userId && readStates.size > 0) {
      console.log(`[NOTIFICATIONS] User ${userId} has ${readStates.size} read notifications:`, Array.from(readStates).slice(0, 10))
    }
    
    if (userId) {
      // Get unread messages sent TO this user (not from them)
      const allMessagesToUser = allMessages.filter(m => m.to === userId)
      const userMessages = allMessagesToUser.filter(m => !m.read)
      const releaseRequestMessages = allMessagesToUser.filter(m => m.subject?.includes('Release Approval Request'))
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/738e3ff4-c1bc-4f87-8364-ca554946b59d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notifications/route.ts:32',message:'Filtered messages for user',data:{userId,totalMessages:allMessages.length,allMessagesToUserCount:allMessagesToUser.length,unreadMessagesCount:userMessages.length,releaseRequestCount:releaseRequestMessages.length,releaseRequestDetails:releaseRequestMessages.map(m=>({id:m.id,to:m.to,subject:m.subject,read:m.read,from:m.from}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      console.log('Notification API - User messages check:', {
        userId,
        totalMessages: allMessages.length,
        userMessages: userMessages.length,
        allMessagesToUser: allMessagesToUser.length,
        allUnreadToUser: userMessages.length,
        releaseRequestMessages: releaseRequestMessages.length,
        sampleMessages: allMessagesToUser.slice(0, 5).map(m => ({
          id: m.id,
          to: m.to,
          read: m.read,
          subject: m.subject,
          fromName: m.fromName,
          createdAt: m.createdAt
        }))
      })
      userMessages.forEach(msg => {
        const notificationId = `message_${msg.id}`
        // Check both message read status and notification read state
        const isRead = msg.read || readStates.has(notificationId) || readStates.has(msg.id)
        
        // Check if this is a release request message
        const isReleaseRequest = msg.subject?.includes('Release Approval Request') || msg.subject?.includes('Release Request')
        
        // Check if this is a guide assignment message
        const isGuideAssignment = msg.subject?.includes('📚') || msg.subject?.includes('guide assigned') || msg.subject?.toLowerCase().includes('guide')
        
        // If it's a release request, check if the release has been handled
        if (isReleaseRequest && msg.songId) {
          const catalogItem = catalog.find(item => item.id === msg.songId)
          
          // Skip notification if release has been approved or denied
          if (catalogItem) {
            if (catalogItem.releaseApprovalStatus === 'approved' || catalogItem.releaseApprovalStatus === 'denied') {
              return // Skip this notification - release has been handled
            }
            // Also skip if it has a releaseDate (approved) even without explicit status
            if (catalogItem.releaseDate && catalogItem.releaseApprovalStatus !== 'pending') {
              return // Skip - already handled
            }
          }
        }
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/738e3ff4-c1bc-4f87-8364-ca554946b59d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notifications/route.ts:48',message:'Processing message for notification',data:{messageId:msg.id,to:msg.to,from:msg.from,subject:msg.subject,read:msg.read,isRead,isReleaseRequest,notificationId,readStatesSize:readStates.size,readStatesHasNotificationId:readStates.has(notificationId),readStatesHasMessageId:readStates.has(msg.id)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
        // Determine the best link and extract guide ID if it's a guide assignment
        let notificationLink = isReleaseRequest ? `/dashboard/release-schedule` : `/dashboard/communication`
        let guideId: string | undefined = undefined
        
        if (msg.songId) {
          notificationLink = `/dashboard/catalog/${encodeURIComponent(msg.songId)}`
        } else if (isGuideAssignment) {
          // Extract guide ID from message or find by title
          const guides = getGuides()
          // Try to extract guide title from subject (format: "📚 New guide assigned: {title}")
          const guideTitleMatch = msg.subject.match(/guide assigned:\s*(.+)/i) || msg.subject.match(/📚\s*(.+)/i)
          if (guideTitleMatch) {
            const guideTitle = guideTitleMatch[1].trim()
            const guide = guides.find((g: any) => g.title === guideTitle || g.title.includes(guideTitle))
            if (guide) {
              guideId = guide.id
              notificationLink = `/dashboard/guides`
            }
          }
        }
        
        // Create detailed notification message
        let notificationTitle = ''
        let notificationMessage = ''
        
        if (isReleaseRequest) {
          const songName = msg.subject.replace('Release Approval Request: ', '').replace('Release Request: ', '')
          notificationTitle = `Release approval needed: ${songName}`
          notificationMessage = msg.message.length > 150 
            ? `${msg.message.substring(0, 150)}...` 
            : msg.message
        } else if (isGuideAssignment) {
          // Enhanced guide assignment notification
          const guideTitleMatch = msg.subject.match(/guide assigned:\s*(.+)/i) || msg.subject.match(/📚\s*(.+)/i)
          const guideTitle = guideTitleMatch ? guideTitleMatch[1].trim() : msg.subject
          notificationTitle = `📚 New Guide Assigned: ${guideTitle}`
          // Include full message with context
          notificationMessage = msg.message || `You have been assigned a guide to study: "${guideTitle}"`
        } else {
          notificationTitle = `New message from ${msg.fromName}`
          // Include subject and preview of message
          notificationMessage = msg.subject
          if (msg.message && msg.message.length > 0) {
            const preview = msg.message.substring(0, 100)
            notificationMessage += `\n${preview}${msg.message.length > 100 ? '...' : ''}`
          }
        }
        
        notifications.push({
          id: notificationId,
          type: isReleaseRequest ? 'release_pending' : 'message',
          title: notificationTitle,
          message: notificationMessage,
          timestamp: msg.createdAt,
          read: isRead,
          link: notificationLink,
          metadata: { 
            messageId: msg.id, 
            from: msg.from, 
            fromName: msg.fromName,
            fullMessage: msg.message, // Include full message content for AI context
            subject: msg.subject,
            songId: msg.songId, // Include songId if it's a release request
            guideId: guideId, // Include guideId if it's a guide assignment
          },
        })
      })
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/738e3ff4-c1bc-4f87-8364-ca554946b59d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'notifications/route.ts:75',message:'Finished processing user messages',data:{notificationsCount:notifications.length,notificationTypes:notifications.map(n=>({id:n.id,type:n.type,read:n.read}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
    }
    
    // Get diagnostic notifications for admins
    if (userRole === 'admin' && userId) {
      try {
        // Import diagnostics check functions directly
        const { existsSync } = await import('fs')
        const { readFileSync } = await import('fs')
        const path = await import('path')
        const ERROR_LOG_FILE = path.join(process.cwd(), 'data', 'error-log.json')
        
        // Load recent errors
        let recentErrors: any[] = []
        try {
          if (existsSync(ERROR_LOG_FILE)) {
            const errorLog = JSON.parse(readFileSync(ERROR_LOG_FILE, 'utf-8'))
            recentErrors = errorLog.errors
              .filter((e: any) => !e.fixed)
              .slice(-10)
              .map((e: any) => ({
                id: e.id,
                severity: 'high' as const,
                title: `${e.type} Error`,
                description: e.message,
                timestamp: e.timestamp,
                fixed: false,
              }))
          }
        } catch (error) {
          // Silent fail
        }
        
        // Check for critical configuration issues
        const criticalIssues: any[] = []
        
        // Check OpenAI API key
        const openaiKey = process.env.OPENAI_API_KEY
        if (!openaiKey || openaiKey.length < 20) {
          criticalIssues.push({
            id: 'openai_key_missing',
            severity: 'high' as const,
            title: 'OpenAI API key missing or invalid',
            description: 'The OpenAI API key is missing or appears to be invalid. AI features may not work.',
            timestamp: new Date().toISOString(),
            fixed: false,
          })
        }
        
        // Combine and add as notifications
        const allCriticalIssues = [...criticalIssues, ...recentErrors.filter((e: any) => e.severity === 'critical' || e.severity === 'high')]
        
        allCriticalIssues.slice(0, 5).forEach((issue: any) => {
          const notificationId = `diagnostic_${issue.id}`
          if (!readStates.has(notificationId)) {
            notifications.push({
              id: notificationId,
              type: 'message',
              title: `🚨 ${issue.severity === 'critical' ? 'Critical' : 'High Priority'} Issue: ${issue.title}`,
              message: issue.description,
              timestamp: issue.timestamp,
              read: false,
              link: '/dashboard',
              metadata: { 
                issueId: issue.id,
                issueType: issue.type || 'error',
                severity: issue.severity,
              },
            })
          }
        })
      } catch (error) {
        // Silent fail - diagnostics are optional
        console.error('Failed to load diagnostics for notifications:', error)
      }
    }
    
    // Get release-related notifications
    if (userRole === 'admin' || userRole === 'manager') {
      // First, check activity log for release requests (fallback if catalog/messages fail)
      const recentActivity = getActivityLogs(100) // Get last 100 activities
      const releaseRequestActivities = recentActivity.filter(activity => 
        activity.action === 'Release Request Created' && 
        activity.category === 'catalog'
      )
      
      console.log('[NOTIFICATIONS] Release requests from activity log:', releaseRequestActivities.length)
      
      releaseRequestActivities.forEach(activity => {
        const songId = activity.details?.songId
        const songName = activity.details?.songName || 'Unknown Song'
        const artist = activity.details?.artist || activity.user
        const requestedDate = activity.details?.requestedDate || activity.timestamp
        
        // Check if this release has already been handled (approved or denied)
        const catalogItem = catalog.find(item => item.id === songId)
        
        // Skip if release has been approved or denied
        if (catalogItem) {
          if (catalogItem.releaseApprovalStatus === 'approved' || catalogItem.releaseApprovalStatus === 'denied') {
            return // Skip this notification - release has been handled
          }
          // Also skip if it has a releaseDate (approved) even without explicit status
          if (catalogItem.releaseDate && !catalogItem.releaseDateRequested) {
            return // Skip - already released
          }
        }
        
        // Check if we already have a notification for this (from catalog/messages)
        const existingNotification = notifications.find(n => 
          n.metadata?.songId === songId && n.type === 'release_pending'
        )
        
        if (!existingNotification && songId) {
          const notificationId = `activity_release_${songId}_${activity.id}`
          const isRead = userId ? readStates.has(notificationId) : false
          
          const dateStr = requestedDate 
            ? new Date(requestedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : 'date TBD'
          
          // Link directly to the song page if songId exists
          const notificationLink = songId ? `/dashboard/catalog/${encodeURIComponent(songId)}` : `/dashboard/release-schedule`
          
          notifications.push({
            id: notificationId,
            type: 'release_pending',
            title: `Release approval needed: ${songName}`,
            message: `${artist} requested release on ${dateStr}`,
            timestamp: activity.timestamp,
            read: isRead,
            link: notificationLink,
            metadata: { 
              songId: songId, 
              song: songName, 
              artist: artist, 
              requestedDate: requestedDate,
              fromActivityLog: true // Flag to indicate this came from activity log
            },
          })
        }
      })
      
      console.log('[NOTIFICATIONS] Checking catalog for pending releases:', {
        totalCatalogItems: catalog.length,
        catalogItemsWithStatus: catalog.filter(i => i.releaseApprovalStatus).length,
        catalogItemsWithRequestedDate: catalog.filter(i => i.releaseDateRequested).length,
      })
      
      // Find all pending releases - check multiple conditions
      // IMPORTANT: Exclude releases that have been approved or denied
      const pendingReleases = catalog.filter(item => {
        // Skip if already approved or denied
        if (item.releaseApprovalStatus === 'approved' || item.releaseApprovalStatus === 'denied') {
          return false
        }
        
        // Has requested date but no approved date
        if (item.releaseDateRequested && !item.releaseDate) return true
        // Has pending status
        if (item.releaseApprovalStatus === 'pending') return true
        // Has requested date and status is undefined (new request)
        if (item.releaseDateRequested && !item.releaseApprovalStatus) return true
        return false
      })
      
      console.log('[NOTIFICATIONS] Pending releases found:', pendingReleases.length, pendingReleases.map(r => ({ 
        id: r.id,
        song: r.song, 
        artist: r.artist, 
        status: r.releaseApprovalStatus, 
        requested: r.releaseDateRequested,
        approved: r.releaseDate
      })))
      
      pendingReleases.forEach(item => {
        const requestedDate = item.releaseDateRequested
        const dateStr = requestedDate 
          ? new Date(requestedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : 'date TBD'
        
        // Find the activity log entry for this release request to get the actual creation timestamp
        const releaseActivity = recentActivity.find(activity => 
          activity.action === 'Release Request Created' && 
          activity.details?.songId === item.id
        )
        
        // Use activity log timestamp (when request was created) instead of release date (which is in the future)
        const notificationTimestamp = releaseActivity?.timestamp || item.releaseDateRequested || item.releaseDate || new Date().toISOString()
        
        const notificationId = `release_${item.id}`
        // Link directly to the song page
        const notificationLink = `/dashboard/catalog/${encodeURIComponent(item.id)}`
        
        notifications.push({
          id: notificationId,
          type: 'release_pending',
          title: `Release approval needed: ${item.song}`,
          message: `${item.artist} requested release on ${dateStr}`,
          timestamp: notificationTimestamp,
          read: userId ? readStates.has(notificationId) : false,
          link: notificationLink,
          metadata: { songId: item.id, song: item.song, artist: item.artist, requestedDate: requestedDate },
        })
      })
    } else if (userId) {
      // For artists/managers, show their release status updates
      const catalog = getCatalog()
      const userReleases = catalog.filter(item => {
        // Match by artist name or artistId if available
        const user = users.find(u => u.id === userId)
        return item.artistId === userId || 
               (user && item.artist.toLowerCase().includes(user.name?.toLowerCase() || ''))
      })
      
      userReleases.forEach(item => {
        if (item.releaseApprovalStatus === 'approved' && item.releaseDate) {
          // Check if this was recently approved (within last 7 days)
          const approvalDate = new Date(item.releaseDate)
          const daysSinceApproval = (Date.now() - approvalDate.getTime()) / (1000 * 60 * 60 * 24)
          
          if (daysSinceApproval <= 7) {
            const notificationId = `release_approved_${item.id}`
            const notificationLink = `/dashboard/catalog/${encodeURIComponent(item.id)}`
            notifications.push({
              id: notificationId,
              type: 'release_approved',
              title: `Release approved: ${item.song}`,
              message: `Your release "${item.song}" has been approved for ${formatLocalDate(item.releaseDate)}`,
              timestamp: item.releaseDate,
              read: readStates.has(notificationId),
              link: notificationLink,
              metadata: { songId: item.id, song: item.song, releaseDate: item.releaseDate },
            })
          }
        } else if (item.releaseApprovalStatus === 'denied') {
          // Check if this was recently denied (within last 7 days)
          // Find activity log entry for when this was denied
          const deniedActivity = getActivityLogs(100).find(activity => 
            (activity.action === 'Release Request Denied' || activity.action === 'Release Denied') &&
            activity.details?.songId === item.id
          )
          
          // Use denial timestamp from activity log, or fall back to requested date
          const deniedTimestamp = deniedActivity?.timestamp || item.releaseDateRequested || new Date().toISOString()
          const deniedDate = new Date(deniedTimestamp)
          const daysSinceDenial = (Date.now() - deniedDate.getTime()) / (1000 * 60 * 60 * 24)
          
          if (daysSinceDenial <= 7) {
            const notificationId = `release_denied_${item.id}`
            const notificationLink = `/dashboard/catalog/${encodeURIComponent(item.id)}`
            notifications.push({
              id: notificationId,
              type: 'release_denied',
              title: `Release request denied: ${item.song}`,
              message: item.releaseApprovalNotes || 'Your release request was denied. Please contact admin for more information.',
              timestamp: deniedTimestamp,
              read: readStates.has(notificationId),
              link: notificationLink,
              metadata: { songId: item.id, song: item.song, notes: item.releaseApprovalNotes },
            })
          }
        }
      })
    }
    
    // Check for guide assignments
    if (userId) {
      const userGuides = guides.filter(guide => 
        guide.isActive && guide.assignedTo.includes(userId)
      )
      
      userGuides.forEach(guide => {
        const notificationId = `guide_${guide.id}_${userId}`
        const isRead = readStates.has(notificationId)
        
        // Only show notification if guide was recently assigned (within last 30 days)
        const assignedDate = new Date(guide.updatedAt || guide.createdAt)
        const daysSinceAssigned = (Date.now() - assignedDate.getTime()) / (1000 * 60 * 60 * 24)
        
        if (daysSinceAssigned <= 30) {
          const creator = users.find(u => u.id === guide.createdBy)
          const creatorName = creator?.name || 'Admin'
          
          // Create a more detailed notification message
          const guidePreview = guide.content.length > 100 
            ? `${guide.content.substring(0, 100)}...` 
            : guide.content
          
          notifications.push({
            id: notificationId,
            type: 'guide_assigned',
            title: `📚 New guide assigned: ${guide.title}`,
            message: `You have been assigned a guide to study: "${guide.title}"\n\nAssigned by: ${creatorName}\n\nPreview: ${guidePreview}\n\nClick to view and study this guide.`,
            timestamp: guide.updatedAt || guide.createdAt,
            read: isRead,
            link: '/dashboard/guides',
            metadata: {
              guideId: guide.id,
              guideTitle: guide.title,
              assignedBy: creatorName,
              assignedByUserId: guide.createdBy,
              guideContent: guide.content, // Include full content for reference
            },
          })
        }
      })
    }
    
    // Filter out deleted notifications
    const activeNotifications = notifications.filter(n => !deletedStates.has(n.id))
    
    // Sort by timestamp (newest first)
    activeNotifications.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime()
      const timeB = new Date(b.timestamp).getTime()
      // Handle invalid dates
      if (isNaN(timeA) && isNaN(timeB)) return 0
      if (isNaN(timeA)) return 1
      if (isNaN(timeB)) return -1
      return timeB - timeA
    })
    
    const unreadCount = activeNotifications.filter(n => !n.read).length
    
    console.log('Notifications API - Total:', activeNotifications.length, 'Unread:', unreadCount, 'User:', userId, 'Role:', userRole)
    
    return NextResponse.json({
      success: true,
      notifications: activeNotifications,
      unreadCount,
    })
  } catch (error: any) {
    console.error('Get notifications error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notifications', details: error.message },
      { status: 500 }
    )
  }
}

// Mark notification as read
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { notificationId, type } = body
    
    if (!notificationId || !type) {
      return NextResponse.json({ error: 'Notification ID and type required' }, { status: 400 })
    }
    
    const { userId } = body
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }
    
    if (type === 'message') {
      // Extract message ID from notification ID (format: message_<id>)
      const messageId = notificationId.startsWith('message_') 
        ? notificationId.replace('message_', '')
        : notificationId
      
      // Update message as read
      const { markMessageRead } = await import('@/lib/storage')
      const success = markMessageRead(messageId)
      
      if (!success) {
        console.warn(`Message ${messageId} not found, but continuing to mark notification as read`)
      }
    }
    
    // Mark notification as read in persistent storage
    markRead(userId, notificationId, type)
    
    // Verify it was marked
    const readStatesAfter = getNotificationReadStates(userId)
    const wasMarked = readStatesAfter.has(notificationId)
    
    console.log(`Marked notification as read: ${notificationId} (type: ${type}) for user: ${userId}`, {
      wasMarked,
      readStatesSize: readStatesAfter.size,
      readStatesHasId: readStatesAfter.has(notificationId)
    })
    
    return NextResponse.json({ success: true, marked: wasMarked })
  } catch (error: any) {
    console.error('Update notification error:', error)
    return NextResponse.json(
      { error: 'Failed to update notification', details: error.message },
      { status: 500 }
    )
  }
}

// Delete notification
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { notificationId } = body
    
    if (!notificationId) {
      return NextResponse.json({ error: 'Notification ID required' }, { status: 400 })
    }
    
    const { userId } = body
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }
    
    // Mark notification as deleted
    markNotificationDeleted(userId, notificationId)
    
    console.log(`Deleted notification: ${notificationId} for user: ${userId}`)
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete notification error:', error)
    return NextResponse.json(
      { error: 'Failed to delete notification', details: error.message },
      { status: 500 }
    )
  }
}