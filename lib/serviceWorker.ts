/**
 * Service Worker Registration for Background Notifications
 * Enables notifications even when the app is closed
 */

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('Service workers not supported')
    return null
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    })

    console.log('[SW] Service worker registered:', registration)

    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready
    console.log('[SW] Service worker ready')

    return registration
  } catch (error) {
    console.error('[SW] Service worker registration failed:', error)
    return null
  }
}

export async function showNotificationViaSW(
  title: string,
  options?: NotificationOptions
): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  try {
    const registration = await navigator.serviceWorker.ready

    // Check if we have permission
    if (Notification.permission !== 'granted') {
      console.warn('[SW] Notification permission not granted')
      return
    }

    // Show notification via service worker
    await registration.showNotification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options,
    })
  } catch (error) {
    console.error('[SW] Failed to show notification:', error)
  }
}

export async function setupBackgroundSync(userId: string): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  try {
    const registration = await navigator.serviceWorker.ready

    // Register background sync (if supported)
    if ('sync' in registration) {
      // @ts-ignore - sync may not be in types
      await registration.sync.register('check-notifications')
      console.log('[SW] Background sync registered')
    }
  } catch (error) {
    console.error('[SW] Failed to setup background sync:', error)
  }
}
