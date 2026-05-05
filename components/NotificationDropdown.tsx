'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Bell, MessageSquare, Calendar, CheckCircle2, X, AlertCircle, ChevronDown, Trash2 } from 'lucide-react'

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

interface NotificationDropdownProps {
  onNotificationClick: (notification: Notification) => void
}

export default function NotificationDropdown({ onNotificationClick }: NotificationDropdownProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (user) {
      fetchNotifications()
      const interval = setInterval(fetchNotifications, 30000)
      return () => clearInterval(interval)
    }
  }, [user])

  // Refresh when dropdown opens
  useEffect(() => {
    if (isOpen && user) {
      fetchNotifications()
    }
  }, [isOpen, user])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`/api/notifications?userId=${user?.id}&role=${user?.role}`)
      const data = await res.json()
      
      if (data.success) {
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
        console.log('Notifications fetched:', data.notifications?.length || 0, 'unread:', data.unreadCount || 0)
      } else {
        console.error('Notifications API error:', data.error)
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if not already read
    if (!notification.read && user) {
      try {
        const response = await fetch('/api/notifications', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notificationId: notification.id,
            type: notification.type,
            userId: user.id,
          }),
        })
        
        const data = await response.json()
        
        if (data.success) {
          // Refetch notifications to get accurate read state from server
          await fetchNotifications()
        } else {
          console.error('Failed to mark notification as read:', data.error)
        }
      } catch (error) {
        console.error('Failed to mark notification as read:', error)
      }
    }
    
    setIsOpen(false)
    
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
    
    onNotificationClick(notification)
  }

  const handleDeleteNotification = async (notification: Notification, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering handleNotificationClick
    
    if (!confirm('Are you sure you want to delete this notification?')) {
      return
    }
    
    if (!user) return
    
    try {
      const response = await fetch('/api/notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId: notification.id,
          userId: user.id,
        }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Refetch notifications to get updated list
        await fetchNotifications()
      } else {
        console.error('Failed to delete notification:', data.error)
      }
    } catch (error) {
      console.error('Failed to delete notification:', error)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message':
        return <MessageSquare className="w-4 h-4 text-blue-500" />
      case 'release_pending':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />
      case 'release_approved':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'release_denied':
        return <X className="w-4 h-4 text-red-500" />
      default:
        return <Bell className="w-4 h-4 text-slate-400" />
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

  return (
    <div className="relative md:relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center p-2 sm:px-3 sm:py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-lg transition shadow-lg"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] sm:text-xs rounded-full min-w-[18px] h-[18px] sm:w-5 sm:h-5 flex items-center justify-center font-bold px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[90vw] sm:w-96 max-w-sm bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 max-h-[80vh] overflow-hidden flex flex-col">
          <div className="p-3 sm:p-4 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
            <h3 className="text-white font-semibold text-sm sm:text-base">Notifications</h3>
            {unreadCount > 0 && (
              <span className="text-xs sm:text-sm text-slate-400 bg-red-500/20 text-red-400 px-2 py-1 rounded-full">
                {unreadCount} unread
              </span>
            )}
          </div>
          
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="p-6 sm:p-8 text-center">
                <Bell className="w-10 h-10 sm:w-12 sm:h-12 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400 text-sm sm:text-base">No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="relative group"
                  >
                    <div
                      onClick={() => handleNotificationClick(notification)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleNotificationClick(notification)
                        }
                      }}
                      className={`w-full text-left p-3 sm:p-4 hover:bg-slate-800/50 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                        notification.read ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h4 className={`text-xs sm:text-sm font-semibold truncate ${
                                notification.read ? 'text-slate-400' : 'text-white'
                              }`}>
                                {notification.title}
                              </h4>
                              <p className={`text-xs mt-1 line-clamp-2 ${
                                notification.read ? 'text-slate-500' : 'text-slate-300'
                              }`}>
                                {notification.message}
                              </p>
                            </div>
                            {!notification.read && (
                              <div className="flex-shrink-0 mt-1">
                                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                              </div>
                            )}
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <p className="text-xs text-slate-500">
                              {formatTime(notification.timestamp)}
                            </p>
                            <div
                              onClick={(e) => handleDeleteNotification(notification, e)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  handleDeleteNotification(notification, e as any)
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition opacity-0 group-hover:opacity-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500/50"
                              title="Delete notification"
                            >
                              <Trash2 className="w-3 h-3" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

