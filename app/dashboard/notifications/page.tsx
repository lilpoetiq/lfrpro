'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Bell, MessageSquare, Calendar, Check, X, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Notification {
  id: string
  type: 'message' | 'release_pending' | 'release_approved' | 'release_denied'
  title: string
  message: string
  timestamp: string
  read: boolean
  link?: string
  metadata?: any
}

export default function NotificationsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (user) {
      fetchNotifications()
      // Poll for new notifications every 30 seconds
      const interval = setInterval(fetchNotifications, 30000)
      return () => clearInterval(interval)
    }
  }, [user])

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`/api/notifications?userId=${user?.id}&role=${user?.role}`)
      const data = await res.json()
      
      if (data.success) {
        setNotifications(data.notifications)
        setUnreadCount(data.unreadCount)
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const markAsRead = async (notification: Notification) => {
    if (notification.read) return
    
    try {
      const response = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId: notification.id,
          type: notification.type,
          userId: user?.id,
        }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Refetch notifications to get accurate read state from server
        await fetchNotifications()
        
        // Navigate to the relevant item based on metadata
        // Only navigate if mounted (client-side)
        if (mounted && typeof window !== 'undefined') {
          try {
            // Prioritize guideId for guide assignments
            if (notification.metadata?.guideId) {
              router.push('/dashboard/guides')
            } else if (notification.metadata?.songId) {
              router.push(`/dashboard/catalog/${encodeURIComponent(notification.metadata.songId)}`)
            } else if (notification.link) {
              router.push(notification.link)
            }
          } catch (error) {
            console.error('Navigation error:', error)
            // Fallback to window.location if router fails
            if (notification.metadata?.guideId) {
              window.location.href = '/dashboard/guides'
            } else if (notification.metadata?.songId) {
              window.location.href = `/dashboard/catalog/${encodeURIComponent(notification.metadata.songId)}`
            } else if (notification.link) {
              window.location.href = notification.link
            }
          }
        }
      } else {
        console.error('Failed to mark notification as read:', data.error)
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read)
    
    try {
      const results = await Promise.all(
        unread.map(n =>
          fetch('/api/notifications', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              notificationId: n.id,
              type: n.type,
              userId: user?.id,
            }),
          }).then(res => res.json())
        )
      )
      
      // Check if all succeeded
      const allSucceeded = results.every(r => r.success)
      
      if (allSucceeded) {
        // Refetch notifications to get accurate read state from server
        await fetchNotifications()
      } else {
        console.error('Some notifications failed to mark as read')
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  }

  const deleteNotification = async (notification: Notification, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering markAsRead
    
    if (!confirm('Are you sure you want to delete this notification?')) {
      return
    }
    
    try {
      const response = await fetch('/api/notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId: notification.id,
          userId: user?.id,
        }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Refetch notifications to get updated list
        await fetchNotifications()
      } else {
        console.error('Failed to delete notification:', data.error)
        alert('Failed to delete notification')
      }
    } catch (error) {
      console.error('Failed to delete notification:', error)
      alert('Failed to delete notification')
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message':
        return <MessageSquare className="w-5 h-5 text-blue-500" />
      case 'release_pending':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />
      case 'release_approved':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />
      case 'release_denied':
        return <X className="w-5 h-5 text-red-500" />
      default:
        return <Bell className="w-5 h-5 text-slate-400" />
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'message':
        return 'border-blue-500/50 bg-blue-500/10'
      case 'release_pending':
        return 'border-yellow-500/50 bg-yellow-500/10'
      case 'release_approved':
        return 'border-green-500/50 bg-green-500/10'
      case 'release_denied':
        return 'border-red-500/50 bg-red-500/10'
      default:
        return 'border-slate-700 bg-slate-800'
    }
  }

  const formatTime = (timestamp: string) => {
    if (!timestamp) return 'Unknown time'
    
    const date = new Date(timestamp)
    const now = new Date()
    
    // Check if date is invalid
    if (isNaN(date.getTime())) {
      return 'Invalid date'
    }
    
    const diffMs = now.getTime() - date.getTime()
    
    // Handle negative differences (future dates) or very small differences
    if (diffMs < 0) {
      // Future date - show actual date
      return date.toLocaleDateString()
    }
    
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  const unreadNotifications = notifications.filter(n => !n.read)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Notifications</h1>
          <p className="text-slate-400">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>
        {unreadNotifications.length > 0 && (
          <button
            onClick={markAllAsRead}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition text-sm"
          >
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">No notifications</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-3 sm:p-4 rounded-lg border transition hover:border-opacity-100 relative group ${
                notification.read
                  ? 'border-slate-700 bg-slate-800/50 opacity-60'
                  : getNotificationColor(notification.type)
              }`}
            >
              <div
                onClick={() => markAsRead(notification)}
                className="cursor-pointer"
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="flex-shrink-0 mt-0.5">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className={`text-sm sm:text-base font-semibold ${notification.read ? 'text-slate-400' : 'text-white'}`}>
                          {notification.title}
                        </h3>
                        <p className={`mt-1 text-xs sm:text-sm ${notification.read ? 'text-slate-500' : 'text-slate-300'} break-words`}>
                          {notification.message}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="ml-2 sm:ml-4 flex-shrink-0 mt-1">
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs text-slate-500">
                        {formatTime(notification.timestamp)}
                      </p>
                      <button
                        onClick={(e) => deleteNotification(notification, e)}
                        className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition opacity-0 group-hover:opacity-100"
                        title="Delete notification"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

