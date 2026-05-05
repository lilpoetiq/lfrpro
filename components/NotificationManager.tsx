'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { showNotification, checkNotificationSupport } from '@/lib/notifications'
import { registerServiceWorker, setupBackgroundSync } from '@/lib/serviceWorker'

export default function NotificationManager() {
  const { user } = useAuth()
  const previousCountRef = useRef(0)
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null)
  const checkNotificationsRef = useRef<(() => Promise<void>) | null>(null)

  // Function to check notifications (accessible from both effects)
  const checkNotifications = useCallback(async () => {
    if (!user || !checkNotificationSupport()) return
    
    if (Notification.permission !== 'granted') {
      return
    }

    try {
      const res = await fetch(`/api/notifications?userId=${user.id}&role=${user.role}`)
      const data = await res.json()
      
      if (data.success) {
        const currentCount = data.unreadCount || 0
        const previousCount = previousCountRef.current
        
        // Show notification if count increased (or if first check and there are notifications)
        if (currentCount > previousCount || (previousCount === 0 && currentCount > 0)) {
          const allNotifications = data.notifications || []
          const unreadNotifications = allNotifications.filter((n: any) => !n.read)
          
          // Get new notifications (those we haven't seen before)
          const numNew = currentCount - previousCount
          const newNotifications = unreadNotifications.slice(0, numNew > 0 ? numNew : currentCount)
          
            newNotifications.forEach((notification: any) => {
              showNotification(notification.title, {
                body: notification.message,
                tag: notification.id,
                data: {
                  link: notification.link,
                  guideId: notification.metadata?.guideId,
                  songId: notification.metadata?.songId,
                  notificationId: notification.id,
                  type: notification.type,
                },
              })
            })
        }
        
        previousCountRef.current = currentCount
      }
    } catch (error) {
      console.error('Failed to check notifications:', error)
    }
  }, [user])

  // Store checkNotifications in ref so it can be accessed from message handler
  useEffect(() => {
    checkNotificationsRef.current = checkNotifications
  }, [checkNotifications])

  // Register service worker on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    registerServiceWorker().then((registration) => {
      if (registration) {
        swRegistrationRef.current = registration
        
        // Setup background sync if user is logged in
        if (user?.id) {
          setupBackgroundSync(user.id)
        }
      }
    })

    // Listen for messages from service worker
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'CHECK_NOTIFICATIONS') {
        if (checkNotificationsRef.current) {
          checkNotificationsRef.current()
        }
      }
    }

    navigator.serviceWorker.addEventListener('message', handleMessage)

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage)
    }
  }, [user])

  useEffect(() => {
    if (!user || !checkNotificationSupport()) return

    // Don't auto-request permission here - let the popup handle it
    // Only check if permission is already granted
    if (Notification.permission !== 'granted') {
      return
    }

    // Setup background sync when user logs in
    if (user.id && swRegistrationRef.current) {
      setupBackgroundSync(user.id)
    }

    // Check immediately and then every 30 seconds
    checkNotifications()
    const interval = setInterval(checkNotifications, 30000)

    return () => clearInterval(interval)
  }, [user, checkNotifications])

  // Handle window focus for notification clicks
  useEffect(() => {
    if (!checkNotificationSupport()) return

    // Focus window when clicking anywhere (user might click notification)
    const handleFocus = () => {
      window.focus()
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  return null
}

