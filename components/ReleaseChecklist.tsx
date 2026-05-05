'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, Circle, MessageSquare, User, Calendar, X, CheckSquare, ExternalLink } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface ChecklistItem {
  id: string
  songId: string
  task: string
  section: string
  category: 'mandatory' | 'optional'
  completed: boolean
  assignedTo?: string
  assignedToName?: string
  comment?: string
  dueDate?: string
  completedAt?: string
  completedBy?: string
  createdAt: string
  updatedAt: string
  hasNotification?: boolean
  notificationMessage?: string
  status?: 'pending' | 'in_progress' | 'completed'
  startedAt?: string
  timeSpent?: number
  adminNotes?: string
  linkUrl?: string
}

// Map checklist tasks to their external URLs
const getTaskLink = (task: string): string | null => {
  const taskLower = task.toLowerCase()
  
  if (taskLower.includes('ascap') && taskLower.includes('register')) {
    return 'https://www.ascap.com/member-access#dashboard'
  }
  if (taskLower.includes('mlc') && taskLower.includes('register')) {
    return 'https://portal.themlc.com/member/15478171/summary'
  }
  if (taskLower.includes('empire') || (taskLower.includes('distributor') && taskLower.includes('empire'))) {
    return 'https://labels.empi.re/backstage/products/?label_id=&include_sub_labels=1&sort_by=album_id&genre_id=&subgenre_id=&limit=500&sort_order=desc&product_type=1&search=&include_sub_labels=1'
  }
  if (taskLower.includes('musixmatch') || taskLower.includes('lyrics')) {
    return 'https://pro.musixmatch.com'
  }
  if (taskLower.includes('identifyy') || taskLower.includes('youtube')) {
    return 'https://dashboard.identifyy.com'
  }
  
  return null
}

interface CatalogItem {
  id: string
  song: string
  artist: string
  artistId?: string
  artistIds?: string[]
  releaseType?: 'single' | 'ep' | 'album'
  albumCover?: string
  fileUrl?: string
  songs?: Array<{
    id: string
    song: string
    audioUrl?: string
    streams?: number
    isrc?: string
  }>
}

interface ReleaseChecklistProps {
  songId: string
  songName: string
  song?: CatalogItem | null
}

export default function ReleaseChecklist({ songId, songName, song }: ReleaseChecklistProps) {
  const [mounted, setMounted] = useState(false)
  const { user } = useAuth()
  const isStaff = user?.role === 'artist' && Array.isArray(user?.staffPermissions) && user.staffPermissions.length > 0
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Helper function to check if a user can manage a specific catalog item
  // Staff users cannot manage their own items (self-lock)
  const canManageItem = (item: CatalogItem | null | undefined): boolean => {
    if (!user || !item) return false
    if (user.role === 'admin') return true
    if (user.role === 'manager') {
      // Managers can manage items in their linkedArtistIds scope
      const linkedIds = user.linkedArtistIds || []
      if (item.artistId && linkedIds.includes(item.artistId)) return true
      if (item.artistIds && item.artistIds.some(id => linkedIds.includes(id))) return true
      return false
    }
    if (isStaff) {
      // Staff users can manage items in their staffManagedArtistIds scope, BUT NOT their own items
      const managedIds = user.staffManagedArtistIds || []
      // Check if item belongs to the staff user themselves
      const itemBelongsToStaff = (item.artistId === user.id) || 
                                 (item.artistIds && item.artistIds.includes(user.id))
      if (itemBelongsToStaff) return false // Self-lock: cannot manage own items
      // Check if item is in their managed scope
      if (item.artistId && managedIds.includes(item.artistId)) return true
      if (item.artistIds && item.artistIds.some(id => managedIds.includes(id))) return true
      return false
    }
    return false
  }
  
  const canManage = canManageItem(song)
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
  const [hasNotification, setHasNotification] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState('')
  const [activeTimers, setActiveTimers] = useState<Record<string, number>>({})
  const [showNotification, setShowNotification] = useState<{itemId: string; message: string} | null>(null)

  useEffect(() => {
    fetchChecklist()
    fetchUsers()
  }, [songId])

  // Update timers for in-progress items (items that are checked but not yet completed)
  useEffect(() => {
    const interval = setInterval(() => {
      const inProgressItems = items.filter(item => 
        !item.completed && 
        (item.status === 'in_progress' || (item.startedAt && !item.completed))
      )
      const newTimers: Record<string, number> = {}
      
      inProgressItems.forEach(item => {
        if (item.startedAt) {
          const elapsed = Math.floor((Date.now() - new Date(item.startedAt).getTime()) / 1000)
          newTimers[item.id] = elapsed
        }
      })
      
      setActiveTimers(newTimers)
    }, 1000)

    return () => clearInterval(interval)
  }, [items])

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    }
    return `${minutes}m ${secs}s`
  }

  const getEncouragementMessage = (itemId: string) => {
    const encouragements = [
      "Timer started! Let's knock it out! 💪",
      "You got this! Timer's running ⏱️",
      "Let's get it done! Timer started 🚀",
      "Time to shine! Timer's on ⭐",
      "Crushing it! Timer started 🔥",
      "Let's go! Timer's running 🎯",
      "You're on fire! Timer started 🔥",
      "Making moves! Timer's on 💫",
      "Let's finish strong! Timer started 💪",
      "Time to get it done! ⏱️",
      "You're doing great! Timer running 🌟",
      "Keep pushing! Timer started 🚀"
    ]
    // Use itemId to get consistent message per item
    const index = parseInt(itemId.slice(-2) || '0', 36) % encouragements.length
    return encouragements[index]
  }

  // Check if item is in progress - matches the checkbox yellow condition
  const isInProgress = (item: ChecklistItem) => {
    // Match exactly what makes the checkbox yellow
    return item.status === 'in_progress'
  }


  const fetchChecklist = async () => {
    try {
      const res = await fetch(`/api/checklist?songId=${songId}`)
      const data = await res.json()
      if (data.success) {
        // Ensure status is set correctly
        const itemsWithStatus = data.items.map((item: ChecklistItem) => ({
          ...item,
          status: item.status || (item.completed ? 'completed' : item.startedAt ? 'in_progress' : 'pending'),
        }))
        setItems(itemsWithStatus)
      }
    } catch (error) {
      console.error('Failed to fetch checklist:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      if (data.success) {
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  const toggleItem = async (itemId: string, currentCompleted: boolean) => {
    // Check if user can manage this song's checklist
    if (!canManage) {
      alert('You do not have permission to modify this checklist')
      return
    }

    if (!user?.id) {
      alert('User ID required for checklist')
      return
    }

    const item = items.find(i => i.id === itemId)
    // Determine current status: prioritize status field, fallback to completed flag
    const currentStatus = item?.status || (item?.completed ? 'completed' : 'pending')
    
    // Validate data exists for specific checklist items before allowing completion
    if (currentStatus === 'in_progress' && !currentCompleted) {
      // When trying to complete an item, check if required data exists
      if (item?.task.toLowerCase().includes('cover art') || item?.task.toLowerCase().includes('cover')) {
        if (song && !song.albumCover) {
          if (!confirm('Album cover not found. Mark as complete anyway?')) {
            return
          }
        }
      }
      if (item?.task.toLowerCase().includes('master') || item?.task.toLowerCase().includes('audio') || item?.task.toLowerCase().includes('wav') || item?.task.toLowerCase().includes('mp3')) {
        const hasAudio = song && (
          (song.releaseType === 'single' && (song.songs?.[0]?.audioUrl || song.fileUrl)) ||
          ((song.releaseType === 'album' || song.releaseType === 'ep') && song.songs && song.songs.some((s: any) => s.audioUrl))
        )
        if (!hasAudio) {
          if (!confirm('Audio file(s) not found. Mark as complete anyway?')) {
            return
          }
        }
      }
    }

    try {
      // Three-step process: pending → in_progress → completed → pending (uncheck)
      if (currentStatus === 'pending' || (!currentStatus && !item?.completed)) {
        // First click: Start timer (yellow/in progress)
        const startRes = await fetch('/api/checklist', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ songId, itemId, action: 'start', userId: user?.id }),
        })
        
        const startData = await startRes.json()
        if (startData.success) {
          // Show notification if item has one
          if (item?.hasNotification && item.notificationMessage) {
            setShowNotification({ itemId: item.id, message: item.notificationMessage })
            setTimeout(() => setShowNotification(null), 10000) // Auto-dismiss after 10 seconds
          }
          // Force immediate update to show encouragement message
          setItems(prev => prev.map(i => 
            i.id === itemId 
              ? { ...i, status: 'in_progress', startedAt: startData.item?.startedAt || new Date().toISOString() }
              : i
          ))
          fetchChecklist()
        }
      } else if (currentStatus === 'in_progress') {
        // Second click: Complete (green/completed)
        // Note: If user wants to go back to pending, they can click again after completing
        const completeRes = await fetch('/api/checklist', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ songId, itemId, action: 'complete', completedBy: user?.id, userId: user?.id }),
        })
        
        const completeData = await completeRes.json()
        if (completeData.success) {
          // Mark as completed with user info
          await fetch('/api/checklist', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              songId,
              itemId,
              userRole: user?.role,
              userId: user?.id,
              updates: {
                completed: true,
                completedBy: user?.id,
                completedAt: completeData.item?.completedAt || new Date().toISOString(),
              },
            }),
          })
          fetchChecklist()
        }
      } else if (currentStatus === 'completed' || item?.completed) {
        // Third click: Reset to pending (uncheck)
        // Update UI immediately for better UX
        setItems(prev => prev.map(i => 
          i.id === itemId 
            ? { 
                ...i, 
                completed: false,
                status: 'pending',
                completedAt: undefined,
                completedBy: undefined,
                startedAt: undefined,
                timeSpent: undefined
              }
            : i
        ))
        
        const uncheckRes = await fetch('/api/checklist', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            songId,
            itemId,
            userRole: user?.role,
            userId: user?.id,
            updates: {
              completed: false,
              completedBy: undefined,
              completedAt: undefined,
              status: 'pending',
              startedAt: undefined,
              timeSpent: undefined,
            },
          }),
        })
        
        const uncheckData = await uncheckRes.json()
        if (uncheckData.success) {
          // Refresh to ensure consistency
          fetchChecklist()
        } else {
          // Revert UI change on error
          fetchChecklist()
          alert(uncheckData.error || 'Failed to uncheck item')
        }
      }
    } catch (error) {
      console.error('Failed to update checklist item:', error)
      alert('Failed to update checklist item')
    }
  }

  const saveItemDetails = async (itemId: string) => {
    // Check if user can manage this song's checklist
    if (!canManage) {
      alert('You do not have permission to modify this checklist')
      return
    }

    if (!user?.id) {
      alert('User ID required for checklist')
      return
    }

    try {
      const res = await fetch('/api/checklist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          songId,
          itemId,
          userRole: user?.role,
          userId: user?.id,
          updates: {
            comment: comment || undefined,
            assignedTo: assignedTo || undefined,
            dueDate: dueDate || undefined,
            adminNotes: canManage && adminNotes ? adminNotes : undefined,
            hasNotification: canManage ? hasNotification : undefined,
            notificationMessage: canManage && hasNotification && notificationMessage ? notificationMessage : undefined,
          },
        }),
      })

      const data = await res.json()
      if (data.success) {
        setEditingItem(null)
        setComment('')
        setAssignedTo('')
        setDueDate('')
        setAdminNotes('')
        setHasNotification(false)
        setNotificationMessage('')
        fetchChecklist()
      } else {
        alert(data.error || 'Failed to update checklist item')
      }
    } catch (error) {
      console.error('Failed to update checklist item:', error)
      alert('Failed to update checklist item')
    }
  }

  const toggleAllItems = async () => {
    // Check if user can manage this song's checklist
    if (!canManage) {
      alert('You do not have permission to modify this checklist')
      return
    }

    if (!user?.id) {
      alert('User ID required for checklist')
      return
    }

    if (items.length === 0) return

    // Check if all items are completed
    const allCompleted = items.every(item => item.completed)
    const newCompletedState = !allCompleted

    // Show confirmation for checking all items
    if (newCompletedState && !confirm(`Mark all ${items.length} items as ${newCompletedState ? 'completed' : 'incomplete'}?`)) {
      return
    }

    try {
      // Update all items in parallel
      const updatePromises = items.map(item => 
        fetch('/api/checklist', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            songId,
            itemId: item.id,
            userRole: user?.role,
            userId: user?.id,
            updates: {
              completed: newCompletedState,
              completedBy: newCompletedState ? user?.id : undefined,
            },
          }),
        })
      )

      await Promise.all(updatePromises)
      fetchChecklist()
    } catch (error) {
      console.error('Failed to toggle all items:', error)
      alert('Failed to update all items. Please try again.')
    }
  }

  const openEditModal = (item: ChecklistItem) => {
    setEditingItem(item.id)
    setComment(item.comment || '')
    setAssignedTo(item.assignedTo || '')
    setDueDate(item.dueDate ? item.dueDate.split('T')[0] : '')
    setAdminNotes(item.adminNotes || '')
    setHasNotification(item.hasNotification || false)
    setNotificationMessage(item.notificationMessage || '')
  }

  // Group items by section
  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.section]) {
      acc[item.section] = { mandatory: [], optional: [] }
    }
    if (item.category === 'mandatory') {
      acc[item.section].mandatory.push(item)
    } else {
      acc[item.section].optional.push(item)
    }
    return acc
  }, {} as Record<string, { mandatory: ChecklistItem[]; optional: ChecklistItem[] }>)

  const mandatoryItems = items.filter(item => item.category === 'mandatory')
  const optionalItems = items.filter(item => item.category === 'optional')
  const completedMandatory = mandatoryItems.filter(item => item.completed).length
  const completedOptional = optionalItems.filter(item => item.completed).length
  const totalMandatory = mandatoryItems.length
  const totalOptional = optionalItems.length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  const allCompleted = items.length > 0 && items.every(item => item.completed)

  // Prevent SSR issues
  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Release Checklist</h2>
          <p className="text-slate-400 text-sm">
            Mandatory: {completedMandatory}/{totalMandatory} • Optional: {completedOptional}/{totalOptional}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {canManage && (
            <button
              onClick={toggleAllItems}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition border border-slate-600"
              title={allCompleted ? 'Uncheck all items' : 'Check all items (for old releases)'}
            >
              <CheckSquare className="w-4 h-4" />
              <span>{allCompleted ? 'Uncheck All' : 'Check All'}</span>
            </button>
          )}
        <div className="text-right">
          <div className="text-2xl font-bold text-red-500">
            {totalMandatory > 0 ? Math.round((completedMandatory / totalMandatory) * 100) : 0}%
          </div>
          <p className="text-xs text-slate-500">Mandatory Complete</p>
          </div>
        </div>
      </div>

      <div className="space-y-6 max-h-[700px] overflow-y-auto">
        {Object.entries(groupedItems).map(([sectionTitle, { mandatory, optional }]) => (
          <div key={sectionTitle} className="border-b border-slate-800 pb-4 last:border-b-0">
            <h3 className="text-lg font-semibold text-white mb-3">{sectionTitle}</h3>
            
            {/* Mandatory Tasks */}
            {mandatory.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-red-400 mb-2">Mandatory Tasks</h4>
                <div className="space-y-2">
                  {mandatory.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start space-x-3 p-3 bg-slate-800/30 rounded-lg hover:bg-slate-800/50 transition border-l-2 border-red-500/50"
                    >
                      <button
                        onClick={() => toggleItem(item.id, item.completed)}
                        className="mt-0.5 flex-shrink-0"
                        disabled={!canManage}
                        title={!canManage ? 'You do not have permission to modify this checklist' : undefined}
                      >
                        {item.status === 'completed' || item.completed ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : item.status === 'in_progress' ? (
                          <Circle className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-500" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p
                            className={`text-sm ${
                              item.completed || item.status === 'completed'
                                ? 'line-through text-slate-500'
                                : 'text-white'
                            }`}
                          >
                            {item.task}
                          </p>
                          {(() => {
                            const linkUrl = item.linkUrl || getTaskLink(item.task)
                            if (linkUrl && (isStaff || user?.role === 'admin' || user?.role === 'manager')) {
                              return (
                                <a
                                  href={linkUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex-shrink-0 p-1 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition"
                                  title="Open in new tab"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )
                            }
                            return null
                          })()}
                        </div>
                        
                        {/* Encouragement message when in progress */}
                        {isInProgress(item) && (
                          <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs">
                            <div className="flex items-center space-x-2 text-yellow-400">
                              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                              <span className="font-medium">{getEncouragementMessage(item.id)}</span>
                              <span className="text-yellow-500/70 font-mono ml-auto">
                                {formatTime(activeTimers[item.id] || 0)}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {(item.assignedToName || item.comment || item.dueDate || item.completedAt) && (
                          <div className="mt-2 space-y-1">
                            {item.assignedToName && (
                              <div className="flex items-center space-x-1 text-xs text-red-400">
                                <User className="w-3 h-3" />
                                <span>Assigned to: {item.assignedToName}</span>
                              </div>
                            )}
                            {item.dueDate && (
                              <div className="flex items-center space-x-1 text-xs text-slate-400">
                                <Calendar className="w-3 h-3" />
                                <span>Due: {new Date(item.dueDate).toLocaleDateString()}</span>
                              </div>
                            )}
                            {item.completedAt && (
                              <div className="mt-2 p-2 bg-green-500/10 border border-green-500/30 rounded text-xs">
                                <div className="flex items-center space-x-1 text-green-400 mb-1">
                                  <CheckCircle className="w-3 h-3" />
                                  <span className="font-semibold">Completed</span>
                                </div>
                                <div className="text-slate-300 space-y-1">
                                  <div>Date: {new Date(item.completedAt).toLocaleDateString()} {new Date(item.completedAt).toLocaleTimeString()}</div>
                                  {item.completedBy && (
                                    <div>By: {users.find(u => u.id === item.completedBy)?.name || 'Unknown'}</div>
                                  )}
                                  {item.timeSpent && item.timeSpent > 0 && (
                                    <div>Time spent: {formatTime(item.timeSpent)}</div>
                                  )}
                                </div>
                              </div>
                            )}
                            {item.comment && (
                              <div className="mt-1 p-2 bg-slate-700/50 rounded text-xs text-slate-300">
                                {item.comment}
                              </div>
                            )}
                          </div>
                        )}
                        {editingItem === item.id && (
                          <div className="mt-3 space-y-2 p-3 bg-slate-700/50 rounded border border-slate-600">
                            <textarea
                              value={comment}
                              onChange={(e) => setComment(e.target.value)}
                              placeholder="Add comment (e.g., music video date, analytics reports)..."
                              className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-sm text-white placeholder-slate-400"
                              rows={2}
                            />
                            <select
                              value={assignedTo}
                              onChange={(e) => setAssignedTo(e.target.value)}
                              className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-sm text-white"
                            >
                              <option value="">-- Assign to --</option>
                              {users.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                              ))}
                            </select>
                            <input
                              type="date"
                              value={dueDate}
                              onChange={(e) => setDueDate(e.target.value)}
                              className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-sm text-white"
                              placeholder="Due date (optional)"
                            />
                            {canManage && (
                              <>
                                <div className="opacity-60 hover:opacity-100 transition-opacity">
                                  <label className="block text-xs text-slate-400 mb-1">
                                    Admin Notes (hidden)
                                  </label>
                                  <input
                                    type="text"
                                    value={adminNotes}
                                    onChange={(e) => setAdminNotes(e.target.value)}
                                    placeholder="Internal notes (not displayed publicly)"
                                    className="w-full p-2 bg-slate-800/50 border border-slate-600/50 rounded text-xs text-slate-300"
                                  />
                                </div>
                                <div>
                                  <label className="flex items-center space-x-2 text-xs text-slate-400 mb-1">
                                    <input
                                      type="checkbox"
                                      checked={hasNotification}
                                      onChange={(e) => setHasNotification(e.target.checked)}
                                      className="rounded"
                                    />
                                    <span>Show notification when started</span>
                                  </label>
                                </div>
                                {hasNotification && (
                                  <div>
                                    <label className="block text-xs text-slate-400 mb-1">
                                      Notification Message
                                    </label>
                                    <textarea
                                      value={notificationMessage}
                                      onChange={(e) => setNotificationMessage(e.target.value)}
                                      rows={2}
                                      placeholder="e.g., Style One's name might be Crystal Marie Ashley on the MLC but Style One on ASCAP"
                                      className="w-full p-2 bg-slate-800/50 border border-slate-600/50 rounded text-xs text-slate-300"
                                    />
                                  </div>
                                )}
                              </>
                            )}
                            <div className="flex space-x-2">
                              <button
                                onClick={() => saveItemDetails(item.id)}
                                className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditingItem(null)
                                  setComment('')
                                  setAssignedTo('')
                                  setDueDate('')
                                  setAdminNotes('')
                                  setHasNotification(false)
                                  setNotificationMessage('')
                                }}
                                className="px-3 py-1 bg-slate-700 text-white text-xs rounded hover:bg-slate-600"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      {canManage && (
                      <button
                        onClick={() => editingItem === item.id ? setEditingItem(null) : openEditModal(item)}
                        className="flex-shrink-0 p-1 text-slate-400 hover:text-red-500 transition"
                        title="Add comment or assign"
                      >
                        {editingItem === item.id ? (
                          <X className="w-4 h-4" />
                        ) : (
                          <MessageSquare className="w-4 h-4" />
                        )}
                      </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Optional Tasks */}
            {optional.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-blue-400 mb-2">Optional Tasks</h4>
                <div className="space-y-2">
                  {optional.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start space-x-3 p-3 bg-slate-800/20 rounded-lg hover:bg-slate-800/40 transition border-l-2 border-blue-500/30"
                    >
                      <button
                        onClick={() => toggleItem(item.id, item.completed)}
                        className="mt-0.5 flex-shrink-0"
                        disabled={!canManage}
                        title={!canManage ? 'You do not have permission to modify this checklist' : undefined}
                      >
                        {item.status === 'completed' || item.completed ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : item.status === 'in_progress' ? (
                          <Circle className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-500" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p
                            className={`text-sm ${
                              item.completed || item.status === 'completed'
                                ? 'line-through text-slate-500'
                                : 'text-slate-300'
                            }`}
                          >
                            {item.task}
                          </p>
                          {(() => {
                            const linkUrl = item.linkUrl || getTaskLink(item.task)
                            if (linkUrl && (isStaff || user?.role === 'admin' || user?.role === 'manager')) {
                              return (
                                <a
                                  href={linkUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex-shrink-0 p-1 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition"
                                  title="Open in new tab"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )
                            }
                            return null
                          })()}
                        </div>
                        
                        {/* Encouragement message when in progress */}
                        {isInProgress(item) && (
                          <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs">
                            <div className="flex items-center space-x-2 text-yellow-400">
                              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                              <span className="font-medium">{getEncouragementMessage(item.id)}</span>
                              <span className="text-yellow-500/70 font-mono ml-auto">
                                {formatTime(activeTimers[item.id] || 0)}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {(item.assignedToName || item.comment || item.dueDate || item.completedAt) && (
                          <div className="mt-2 space-y-1">
                            {item.assignedToName && (
                              <div className="flex items-center space-x-1 text-xs text-blue-400">
                                <User className="w-3 h-3" />
                                <span>Assigned to: {item.assignedToName}</span>
                              </div>
                            )}
                            {item.dueDate && (
                              <div className="flex items-center space-x-1 text-xs text-slate-400">
                                <Calendar className="w-3 h-3" />
                                <span>Due: {new Date(item.dueDate).toLocaleDateString()}</span>
                              </div>
                            )}
                            {item.completedAt && (
                              <div className="mt-2 p-2 bg-green-500/10 border border-green-500/30 rounded text-xs">
                                <div className="flex items-center space-x-1 text-green-400 mb-1">
                                  <CheckCircle className="w-3 h-3" />
                                  <span className="font-semibold">Completed</span>
                                </div>
                                <div className="text-slate-300 space-y-1">
                                  <div>Date: {new Date(item.completedAt).toLocaleDateString()} {new Date(item.completedAt).toLocaleTimeString()}</div>
                                  {item.completedBy && (
                                    <div>By: {users.find(u => u.id === item.completedBy)?.name || 'Unknown'}</div>
                                  )}
                                  {item.timeSpent && item.timeSpent > 0 && (
                                    <div>Time spent: {formatTime(item.timeSpent)}</div>
                                  )}
                                </div>
                              </div>
                            )}
                            {item.comment && (
                              <div className="mt-1 p-2 bg-slate-700/50 rounded text-xs text-slate-300">
                                {item.comment}
                              </div>
                            )}
                          </div>
                        )}
                        {editingItem === item.id && (
                          <div className="mt-3 space-y-2 p-3 bg-slate-700/50 rounded border border-slate-600">
                            <textarea
                              value={comment}
                              onChange={(e) => setComment(e.target.value)}
                              placeholder="Add comment..."
                              className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-sm text-white placeholder-slate-400"
                              rows={2}
                            />
                            <select
                              value={assignedTo}
                              onChange={(e) => setAssignedTo(e.target.value)}
                              className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-sm text-white"
                            >
                              <option value="">-- Assign to --</option>
                              {users.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                              ))}
                            </select>
                            <input
                              type="date"
                              value={dueDate}
                              onChange={(e) => setDueDate(e.target.value)}
                              className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-sm text-white"
                              placeholder="Due date (optional)"
                            />
                            {canManage && (
                              <>
                                <div className="opacity-60 hover:opacity-100 transition-opacity">
                                  <label className="block text-xs text-slate-400 mb-1">
                                    Admin Notes (hidden)
                                  </label>
                                  <input
                                    type="text"
                                    value={adminNotes}
                                    onChange={(e) => setAdminNotes(e.target.value)}
                                    placeholder="Internal notes (not displayed publicly)"
                                    className="w-full p-2 bg-slate-800/50 border border-slate-600/50 rounded text-xs text-slate-300"
                                  />
                                </div>
                                <div>
                                  <label className="flex items-center space-x-2 text-xs text-slate-400 mb-1">
                                    <input
                                      type="checkbox"
                                      checked={hasNotification}
                                      onChange={(e) => setHasNotification(e.target.checked)}
                                      className="rounded"
                                    />
                                    <span>Show notification when started</span>
                                  </label>
                                </div>
                                {hasNotification && (
                                  <div>
                                    <label className="block text-xs text-slate-400 mb-1">
                                      Notification Message
                                    </label>
                                    <textarea
                                      value={notificationMessage}
                                      onChange={(e) => setNotificationMessage(e.target.value)}
                                      rows={2}
                                      placeholder="e.g., Style One's name might be Crystal Marie Ashley on the MLC but Style One on ASCAP"
                                      className="w-full p-2 bg-slate-800/50 border border-slate-600/50 rounded text-xs text-slate-300"
                                    />
                                  </div>
                                )}
                              </>
                            )}
                            <div className="flex space-x-2">
                              <button
                                onClick={() => saveItemDetails(item.id)}
                                className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditingItem(null)
                                  setComment('')
                                  setAssignedTo('')
                                  setDueDate('')
                                  setAdminNotes('')
                                  setHasNotification(false)
                                  setNotificationMessage('')
                                }}
                                className="px-3 py-1 bg-slate-700 text-white text-xs rounded hover:bg-slate-600"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      {canManage && (
                      <button
                        onClick={() => editingItem === item.id ? setEditingItem(null) : openEditModal(item)}
                        className="flex-shrink-0 p-1 text-slate-400 hover:text-red-500 transition"
                        title="Add comment or assign"
                      >
                        {editingItem === item.id ? (
                          <X className="w-4 h-4" />
                        ) : (
                          <MessageSquare className="w-4 h-4" />
                        )}
                      </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Notification Modal */}
      {showNotification && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border-2 border-yellow-500 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold">!</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-2">Checklist Notification</h3>
                <p className="text-slate-300 whitespace-pre-line">{showNotification.message}</p>
              </div>
              <button
                onClick={() => setShowNotification(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
