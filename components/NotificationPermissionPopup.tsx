'use client'

import { useState, useEffect } from 'react'
import { Bell, X, CheckCircle2 } from 'lucide-react'
import { requestNotificationPermission, checkNotificationSupport } from '@/lib/notifications'

interface NotificationPermissionPopupProps {
  trigger?: boolean // Can be triggered programmatically
  context?: string // Context message (e.g., "You received a message from AI")
  onClose?: () => void // Callback when popup is closed
}

export default function NotificationPermissionPopup({ trigger, context, onClose }: NotificationPermissionPopupProps = {}) {
  const [showPopup, setShowPopup] = useState(false)
  const [isRequesting, setIsRequesting] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default')

  useEffect(() => {
    if (!checkNotificationSupport()) return

    const currentPermission = Notification.permission
    setPermissionStatus(currentPermission)

    // If triggered programmatically (e.g., after AI notification)
    if (trigger && currentPermission !== 'granted') {
      // Check if user has already been asked (stored in localStorage)
      const hasBeenAsked = localStorage.getItem('notificationPermissionAsked')
      
      // Show if not granted and either not asked before or triggered by context
      if (currentPermission === 'default' && (!hasBeenAsked || context)) {
        setShowPopup(true)
        return
      }
    }

    // Auto-show on initial load (original behavior)
    if (!trigger) {
      const hasBeenAsked = localStorage.getItem('notificationPermissionAsked')
      
      if (currentPermission === 'default' && !hasBeenAsked) {
        // Wait a bit before showing (better UX)
        const timer = setTimeout(() => {
          setShowPopup(true)
        }, 2000) // Show after 2 seconds

        return () => clearTimeout(timer)
      }
    }
  }, [trigger, context])

  const handleAllow = async () => {
    setIsRequesting(true)
    try {
      const permission = await requestNotificationPermission()
      setPermissionStatus(permission)
      
      // Mark as asked
      localStorage.setItem('notificationPermissionAsked', 'true')
      
      if (permission === 'granted') {
        // Show success message briefly
        setTimeout(() => {
          setShowPopup(false)
          onClose?.()
        }, 1500)
      } else {
        // Permission denied or dismissed
        setShowPopup(false)
        onClose?.()
      }
    } catch (error) {
      console.error('Failed to request notification permission:', error)
      setShowPopup(false)
    } finally {
      setIsRequesting(false)
    }
  }

  const handleDismiss = () => {
    localStorage.setItem('notificationPermissionAsked', 'true')
    setShowPopup(false)
    onClose?.()
  }

  // Don't show if permission is already granted or denied, or if browser doesn't support
  if (!showPopup || !checkNotificationSupport() || permissionStatus !== 'default') {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-md w-full p-6 relative">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="bg-red-600/20 p-4 rounded-full">
            <Bell className="w-12 h-12 text-red-500" />
          </div>
        </div>

        {/* Content */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">
            Enable Notifications?
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed">
            {context || `Get notified about new messages, release approvals, and important updates. 
            You'll receive desktop notifications even when the app is closed.`}
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleAllow}
            disabled={isRequesting}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRequesting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>Requesting...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>Allow Notifications</span>
              </>
            )}
          </button>
          <button
            onClick={handleDismiss}
            disabled={isRequesting}
            className="flex-1 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Don't Allow
          </button>
        </div>

        {/* Info text */}
        <p className="text-xs text-slate-500 text-center mt-4">
          You can change this later in your browser settings
        </p>
      </div>
    </div>
  )
}

