// Service Worker for Background Notifications
// This allows notifications to work even when the app is closed

const CACHE_NAME = 'lfr-dashboard-v1'
const NOTIFICATION_CHECK_INTERVAL = 60000 // Check every minute

// Install service worker
self.addEventListener('install', (event) => {
  console.log('[SW] Service worker installing...')
  self.skipWaiting() // Activate immediately
})

// Activate service worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Service worker activating...')
  event.waitUntil(self.clients.claim()) // Take control of all pages immediately
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event)
  event.notification.close()

  const notificationData = event.notification.data || {}
  let urlToOpen = notificationData.link || '/dashboard/notifications'
  
  // Handle guide-specific navigation
  if (notificationData.guideId) {
    urlToOpen = '/dashboard/guides'
  }
  
  // Handle song-specific navigation
  if (notificationData.songId) {
    urlToOpen = `/dashboard/catalog/${encodeURIComponent(notificationData.songId)}`
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window/tab open with the target URL
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i]
        // Check if URL matches (allowing for query params)
        const clientUrl = new URL(client.url)
        const targetUrl = new URL(urlToOpen, client.url)
        if (clientUrl.pathname === targetUrl.pathname && 'focus' in client) {
          // Send message to navigate to specific item if needed
          if (notificationData.guideId || notificationData.songId) {
            client.postMessage({
              type: 'NAVIGATE_TO_ITEM',
              guideId: notificationData.guideId,
              songId: notificationData.songId,
            })
          }
          return client.focus()
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen).then((windowClient) => {
          // Send navigation message after window opens
          if (windowClient && (notificationData.guideId || notificationData.songId)) {
            setTimeout(() => {
              windowClient.postMessage({
                type: 'NAVIGATE_TO_ITEM',
                guideId: notificationData.guideId,
                songId: notificationData.songId,
              })
            }, 500)
          }
        })
      }
    })
  )
})

// Background sync to check for notifications
self.addEventListener('sync', (event) => {
  if (event.tag === 'check-notifications') {
    event.waitUntil(checkForNotifications())
  }
})

// Check for notifications in the background
async function checkForNotifications() {
  try {
    // Get all clients to find the user ID
    const clients = await self.clients.matchAll()
    if (clients.length === 0) return

    // Send message to all clients to check notifications
    clients.forEach((client) => {
      client.postMessage({
        type: 'CHECK_NOTIFICATIONS',
      })
    })
  } catch (error) {
    console.error('[SW] Error checking notifications:', error)
  }
}

// Handle messages from clients
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data)
  
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data
    event.waitUntil(
      self.registration.showNotification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options,
      })
    )
  }
  
  if (event.data && event.data.type === 'CHECK_NOTIFICATIONS') {
    checkForNotifications()
  }
})
