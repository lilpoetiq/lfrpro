/**
 * Notification System
 * Includes both browser notifications and trigger-ready notifications
 */

import { TriggerReadyMatch } from './triggerReady'

// ============================================================================
// Browser Notifications (Web API)
// ============================================================================

/**
 * Check if browser supports notifications
 */
export function checkNotificationSupport(): boolean {
  if (typeof window === 'undefined') return false
  return 'Notification' in window
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!checkNotificationSupport()) {
    return 'denied'
  }

  if (Notification.permission === 'granted') {
    return 'granted'
  }

  if (Notification.permission === 'denied') {
    return 'denied'
  }

  // Request permission
  const permission = await Notification.requestPermission()
  return permission
}

/**
 * Show a browser notification (prefers service worker for background support)
 */
export async function showNotification(
  title: string,
  options?: NotificationOptions
): Promise<Notification | null> {
  if (!checkNotificationSupport()) {
    console.warn('Notifications not supported in this browser')
    return null
  }

  if (Notification.permission !== 'granted') {
    console.warn('Notification permission not granted')
    return null
  }

  try {
    // Try to use service worker first (works in background)
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready
        await registration.showNotification(title, {
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          ...options,
        })
        return null // Service worker handles it
      } catch (swError) {
        console.log('[Notifications] Service worker not available, falling back to regular notifications')
      }
    }

    // Fallback to regular notifications
    const notification = new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options,
    })

    // Handle click to navigate if link provided
    if (options?.data?.link) {
      notification.onclick = () => {
        window.focus()
        if (options.data?.link) {
          window.location.href = options.data.link
        }
        notification.close()
      }
    }

    // Auto-close after 5 seconds
    setTimeout(() => {
      notification.close()
    }, 5000)

    return notification
  } catch (error) {
    console.error('Failed to show notification:', error)
    return null
  }
}

// ============================================================================
// Trigger-Ready Notifications (Internal System)
// ============================================================================

export interface TriggerReadyNotification {
  id: string
  artistId: string
  artistName: string
  songId: string
  songName: string
  matchScore: number
  readinessState: 'cooling' | 'building' | 'ready'
  recommendedAction: 'release_now' | 'wait_for_better_timing' | 'build_momentum_first'
  matchReasons: string[]
  createdAt: string
  acknowledged: boolean
  acknowledgedBy?: string
  acknowledgedAt?: string
}

/**
 * Create a notification for a trigger-ready song
 */
export function createTriggerReadyNotification(
  match: TriggerReadyMatch
): TriggerReadyNotification {
  return {
    id: `trn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    artistId: match.artistId,
    artistName: match.artistName,
    songId: match.songId,
    songName: match.songName,
    matchScore: match.matchScore,
    readinessState: match.readinessState,
    recommendedAction: match.recommendedAction,
    matchReasons: match.matchReasons,
    createdAt: new Date().toISOString(),
    acknowledged: false,
  }
}

/**
 * Format notification message for display/alert
 */
export function formatTriggerReadyMessage(notification: TriggerReadyNotification): string {
  const stateEmoji = {
    ready: '🟩',
    building: '🟨',
    cooling: '🟥',
  }

  const actionMessages = {
    release_now: 'Ready to release now',
    build_momentum_first: 'Build momentum first',
    wait_for_better_timing: 'Wait for better timing',
  }
  
  return `${stateEmoji[notification.readinessState]} ${notification.artistName} - "${notification.songName}" is Trigger-Ready (${notification.matchScore}% match). ${actionMessages[notification.recommendedAction]}.`
}

/**
 * Format short notification (for SMS/quick alerts)
 */
export function formatShortNotification(notification: TriggerReadyNotification): string {
  const stateEmoji = {
    ready: '🟩',
    building: '🟨',
    cooling: '🟥',
  }
  if (notification.recommendedAction === 'release_now') {
    return `${stateEmoji[notification.readinessState]} ${notification.artistName} hot. "${notification.songName}" ready.`
  } else if (notification.recommendedAction === 'build_momentum_first') {
    return `${stateEmoji[notification.readinessState]} ${notification.artistName} warming up. "${notification.songName}" could work.`
  } else {
    return `${stateEmoji[notification.readinessState]} ${notification.artistName} cooling. Don't drop "${notification.songName}" yet.`
  }
}
