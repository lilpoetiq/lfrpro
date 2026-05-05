import { NextRequest, NextResponse } from 'next/server'
import { readJsonFile, writeJsonFile, getCatalog, getUsers } from '@/lib/storage'
import { TriggerReadyNotification, createTriggerReadyNotification, formatTriggerReadyMessage } from '@/lib/notifications'
import { findTriggerReadySongs } from '@/lib/triggerReady'

const NOTIFICATIONS_FILE = 'triggerReadyNotifications.json'

/**
 * GET /api/notifications/trigger-ready
 * Get all trigger-ready notifications
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const artistId = searchParams.get('artistId')
    const acknowledged = searchParams.get('acknowledged') // 'true' | 'false' | null

    let notifications = readJsonFile<TriggerReadyNotification>(NOTIFICATIONS_FILE)

    // Filter by artist if provided
    if (artistId) {
      notifications = notifications.filter(n => n.artistId === artistId)
    }

    // Filter by acknowledged status if provided
    if (acknowledged === 'true') {
      notifications = notifications.filter(n => n.acknowledged)
    } else if (acknowledged === 'false') {
      notifications = notifications.filter(n => !n.acknowledged)
    }

    // Sort by created date (newest first)
    notifications.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    return NextResponse.json({
      success: true,
      notifications,
      unacknowledged: notifications.filter(n => !n.acknowledged).length,
    })
  } catch (error: any) {
    console.error('Get trigger-ready notifications error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notifications', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/notifications/trigger-ready/check
 * Check for new trigger-ready songs and create notifications
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { artistId, userId } = body

    if (!artistId) {
      return NextResponse.json(
        { error: 'Artist ID is required' },
        { status: 400 }
      )
    }

    // Get unreleased songs
    const catalog = getCatalog()
    const unreleasedSongs = catalog.filter(item => {
      const isUnreleased = item.isUnreleased === true || !item.releaseDate
      const belongsToArtist = item.artistId === artistId || 
                             (item.artistIds && item.artistIds.includes(artistId))
      return isUnreleased && belongsToArtist
    })

    // Find trigger-ready matches
    const matches = findTriggerReadySongs(artistId, unreleasedSongs)

    // Filter for high-scoring matches that should trigger notifications
    const highScoreMatches = matches.filter(m => 
      m.matchScore >= 60 && m.recommendedAction === 'release_now'
    )

    // Load existing notifications
    let notifications = readJsonFile<TriggerReadyNotification>(NOTIFICATIONS_FILE)

    // Create new notifications for matches that don't already exist
    const newNotifications: TriggerReadyNotification[] = []
    for (const match of highScoreMatches) {
      const exists = notifications.some(n => 
        n.songId === match.songId && 
        n.artistId === match.artistId &&
        !n.acknowledged
      )

      if (!exists) {
        const notification = createTriggerReadyNotification(match)
        notifications.push(notification)
        newNotifications.push(notification)
      }
    }

    // Save notifications
    writeJsonFile(NOTIFICATIONS_FILE, notifications)

    return NextResponse.json({
      success: true,
      checked: matches.length,
      newNotifications: newNotifications.length,
      notifications: newNotifications.map(n => ({
        ...n,
        message: formatTriggerReadyMessage(n),
      })),
    })
  } catch (error: any) {
    console.error('Check trigger-ready error:', error)
    return NextResponse.json(
      { error: 'Failed to check trigger-ready songs', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/notifications/trigger-ready/:id
 * Acknowledge a notification
 */
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const notificationId = searchParams.get('id')
    const body = await request.json()
    const { acknowledged, userId } = body

    if (!notificationId) {
      return NextResponse.json(
        { error: 'Notification ID is required' },
        { status: 400 }
      )
    }

    let notifications = readJsonFile<TriggerReadyNotification>(NOTIFICATIONS_FILE)
    const index = notifications.findIndex(n => n.id === notificationId)

    if (index === -1) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      )
    }

    notifications[index] = {
      ...notifications[index],
      acknowledged: acknowledged !== false,
      acknowledgedBy: userId,
      acknowledgedAt: new Date().toISOString(),
    }

    writeJsonFile(NOTIFICATIONS_FILE, notifications)

    return NextResponse.json({
      success: true,
      notification: notifications[index],
    })
  } catch (error: any) {
    console.error('Acknowledge notification error:', error)
    return NextResponse.json(
      { error: 'Failed to acknowledge notification', details: error.message },
      { status: 500 }
    )
  }
}
