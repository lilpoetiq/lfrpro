'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Calendar, Check, X, Clock, AlertCircle, List, Grid, CalendarDays, Music, TrendingUp, AlertTriangle, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { parseLocalDate, formatLocalDateString } from '@/lib/utils'

interface ReleaseScheduleItem {
  id: string
  song: string
  artist: string
  releaseDate?: string
  releaseDateRequested?: string
  approvalStatus?: 'pending' | 'approved' | 'denied'
  releaseApprovalNotes?: string
  releaseType: string
  albumCover?: string
  totalStreams?: number
  artistId?: string
  artistIds?: string[]
  isUnreleased?: boolean
}

interface AvailableDate {
  date: string
  day: string
  isWeekend: boolean
  weeksOut: number
}

type ReleaseTab = 'released' | 'scheduled' | 'unreleased'

export default function ReleaseSchedulePage() {
  const { user, staffViewMode } = useAuth()
  const router = useRouter()
  const isStaff = user?.role === 'artist' && Array.isArray(user?.staffPermissions) && user.staffPermissions.length > 0
  const canApproveOrDeny =
    user?.role === 'admin' ||
    user?.role === 'manager' ||
    (isStaff && staffViewMode === 'staff' && Array.isArray(user?.staffPermissions) && user.staffPermissions.includes('staff:releases:approve'))
  const [pendingReleases, setPendingReleases] = useState<ReleaseScheduleItem[]>([])
  const [upcomingReleases, setUpcomingReleases] = useState<ReleaseScheduleItem[]>([])
  const [allReleases, setAllReleases] = useState<ReleaseScheduleItem[]>([])
  const [availableDates, setAvailableDates] = useState<AvailableDate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedRelease, setSelectedRelease] = useState<ReleaseScheduleItem | null>(null)
  const [approvalNotes, setApprovalNotes] = useState('')
  const [approvedDate, setApprovedDate] = useState('')
  const [editingReleaseId, setEditingReleaseId] = useState<string | null>(null)
  const [editingReleaseDate, setEditingReleaseDate] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'timeline'>('list')
  const [activeTab, setActiveTab] = useState<ReleaseTab>('scheduled')
  
  // Helper function to convert relative URLs to absolute URLs
  const getAbsoluteUrl = (url: string | undefined | null): string => {
    if (!url || !url.trim()) return ''
    const trimmedUrl = url.trim()
    if (trimmedUrl.startsWith('http') || trimmedUrl.startsWith('//')) return trimmedUrl
    if (typeof window !== 'undefined') {
      if (trimmedUrl.startsWith('/')) {
        return `${window.location.origin}${trimmedUrl}`
      } else {
        return `${window.location.origin}/${trimmedUrl}`
      }
    }
    return trimmedUrl
  }
  
  // Calculate days until release
  const getDaysUntilRelease = (releaseDate?: string): number | null => {
    if (!releaseDate) return null
    const date = new Date(releaseDate)
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    date.setHours(0, 0, 0, 0)
    const diffTime = date.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }
  
  // Detect clashes - songs releasing on same or nearby dates
  const detectClashes = (releases: ReleaseScheduleItem[]): Map<string, ReleaseScheduleItem[]> => {
    const clashes = new Map<string, ReleaseScheduleItem[]>()
    const dateGroups = new Map<string, ReleaseScheduleItem[]>()
    
    releases.forEach(release => {
      const date = release.releaseDate || release.releaseDateRequested
      if (!date) return
      
      const dateKey = date.split('T')[0]
      if (!dateGroups.has(dateKey)) {
        dateGroups.set(dateKey, [])
      }
      dateGroups.get(dateKey)!.push(release)
    })
    
    // Find dates with multiple releases (clashes)
    dateGroups.forEach((releasesOnDate, dateKey) => {
      if (releasesOnDate.length > 1) {
        clashes.set(dateKey, releasesOnDate)
      }
    })
    
    return clashes
  }

  useEffect(() => {
    fetchSchedule()
  }, [user])

  const fetchSchedule = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/release-schedule')
      const data = await res.json()
      
      if (data.success) {
        setAvailableDates(data.availableDates || [])
        
        // Fetch catalog to get pending releases
        const shouldScope = user?.role === 'manager' || (isStaff && staffViewMode !== 'staff')
        const scopeParam = shouldScope && user?.id ? `?userId=${encodeURIComponent(user.id)}` : ''
        const catalogRes = await fetch(`/api/catalog${scopeParam}`)
        const catalogData = await catalogRes.json()
        
        if (catalogData.success) {
          const catalog = catalogData.catalog || []
          const now = new Date()
          const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
          
          // Sort pending releases by date requested (oldest to newest)
          const pending = catalog
            .filter((item: any) => {
              return item.releaseApprovalStatus === 'pending' || 
              (item.releaseDateRequested && !item.releaseDate)
            })
            .sort((a: any, b: any) => {
              const dateA = new Date(a.releaseDateRequested || a.releaseDate || 0).getTime()
              const dateB = new Date(b.releaseDateRequested || b.releaseDate || 0).getTime()
              return dateA - dateB // Oldest first
            })
          
          // Sort upcoming releases by date (oldest to newest)
          // Include unreleased songs and songs with future release dates
          const upcoming = catalog
            .filter((item: any) => {
              const date = item.releaseDate || item.releaseDateRequested
              if (!date) {
                // Include unreleased songs without dates
                return item.isUnreleased === true
              }
              const releaseDate = new Date(date)
              // Include if:
              // 1. It's unreleased (regardless of date)
              // 2. Release date is in the future AND more than 3 days away
              return item.isUnreleased === true || (releaseDate > now && releaseDate > threeDaysFromNow)
            })
            .sort((a: any, b: any) => {
              const dateA = new Date(a.releaseDate || a.releaseDateRequested || 0).getTime()
              const dateB = new Date(b.releaseDate || b.releaseDateRequested || 0).getTime()
              return dateA - dateB // Oldest first
            })
          
          // Store all releases for filtering by tabs
          // Include unreleased songs and upcoming releases
          const allReleasesForSchedule = catalog
            .filter((item: any) => {
              const date = item.releaseDate || item.releaseDateRequested
              if (!date) {
                // Include unreleased songs without dates
                return item.isUnreleased === true
              }
              const releaseDate = new Date(date)
              // Include if:
              // 1. It's unreleased (regardless of date)
              // 2. Release date is in the future AND more than 3 days away
              return item.isUnreleased === true || (releaseDate > now && releaseDate > threeDaysFromNow)
            })
            .map((item: any) => ({
              id: item.id,
              song: item.song,
              artist: item.artist,
              releaseDate: item.releaseDate,
              releaseDateRequested: item.releaseDateRequested,
              approvalStatus: item.releaseApprovalStatus || (item.releaseDate ? 'approved' : 'pending'),
              releaseApprovalNotes: item.releaseApprovalNotes,
              releaseType: item.releaseType || 'single',
              isUnreleased: item.isUnreleased || false,
              albumCover: item.albumCover,
              totalStreams: item.totalStreams || 0,
              artistId: item.artistId,
              artistIds: item.artistIds,
            }))
          setAllReleases(allReleasesForSchedule)
          
          setPendingReleases(pending || [])
          setUpcomingReleases(upcoming || [])
        } else {
          setPendingReleases([])
          setUpcomingReleases([])
          setAllReleases([])
        }
      } else {
        setPendingReleases([])
        setUpcomingReleases([])
      }
    } catch (error) {
      console.error('Failed to fetch schedule:', error)
      setPendingReleases([])
      setUpcomingReleases([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!selectedRelease) return
    
    const finalDate = approvedDate || selectedRelease.releaseDateRequested
    if (!finalDate) {
      alert('Please select or confirm a release date')
      return
    }

    // Admins can approve any date (including past dates)
    // Only validate for non-admin users (but this is admin-only page, so skip validation)

    try {
      const res = await fetch('/api/release-schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          songId: selectedRelease.id,
          approvalStatus: 'approved',
          notes: approvalNotes,
          approvedDate: finalDate,
          adminUserId: user?.id,
          adminUserName: user?.name,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}: ${res.statusText}` }))
        console.error('API error response:', errorData)
        alert('Failed to approve release: ' + (errorData.error || errorData.details || `HTTP ${res.status}`))
        return
      }

      const data = await res.json()
      
      if (data.success) {
        setSelectedRelease(null)
        setApprovalNotes('')
        setApprovedDate('')
        fetchSchedule()
      } else {
        console.error('Approval failed:', data)
        alert('Failed to approve release: ' + (data.error || data.details || 'Unknown error'))
      }
    } catch (error: any) {
      console.error('Failed to approve release:', error)
      alert('Failed to approve release: ' + (error.message || 'Network error'))
    }
  }

  const handleDeny = async () => {
    if (!selectedRelease) return

    if (!approvalNotes.trim()) {
      alert('Please provide a reason for denial')
      return
    }

    try {
      const res = await fetch('/api/release-schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          songId: selectedRelease.id,
          approvalStatus: 'denied',
          notes: approvalNotes,
          adminUserId: user?.id,
          adminUserName: user?.name,
        }),
      })

      const data = await res.json()
      
      if (data.success) {
        setSelectedRelease(null)
        setApprovalNotes('')
        setApprovedDate('')
        fetchSchedule()
      } else {
        alert('Failed to deny release: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to deny release:', error)
      alert('Failed to deny release')
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Not set'
    const date = parseLocalDate(dateStr)
    if (!date) return 'Not set'
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  if (!user) {
    return (
      <div className="p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  if (user.role !== 'admin' && user.role !== 'manager') {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-white mb-4">Access Denied</h1>
        <p className="text-slate-400">You don't have permission to view this page.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
        <p className="text-slate-400 mt-4 text-center">Loading release schedule...</p>
      </div>
    )
  }

  // Filter releases based on active tab
  const getFilteredReleases = () => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    switch (activeTab) {
      case 'released':
        return allReleases.filter(item => {
          // Released means: past release date OR scheduled (sent out)
          const releaseDate = item.releaseDate || item.releaseDateRequested
          const isPastDate = releaseDate && new Date(releaseDate) <= now
          const isScheduled = item.approvalStatus === 'approved' && releaseDate && new Date(releaseDate) > now
          return isPastDate || isScheduled
        }).sort((a, b) => {
          const dateA = new Date(a.releaseDate || a.releaseDateRequested || 0).getTime()
          const dateB = new Date(b.releaseDate || b.releaseDateRequested || 0).getTime()
          return dateB - dateA // Newest first
        })
      
      case 'scheduled':
        return allReleases.filter(item => {
          // "Scheduled" means approved and has a release date (sent out)
          const releaseDate = item.releaseDate || item.releaseDateRequested
          return item.approvalStatus === 'approved' && releaseDate && new Date(releaseDate) > now
        }).sort((a, b) => {
          const dateA = new Date(a.releaseDate || a.releaseDateRequested || 0).getTime()
          const dateB = new Date(b.releaseDate || b.releaseDateRequested || 0).getTime()
          return dateA - dateB // Oldest first
        })
      
      case 'unreleased':
        return allReleases.filter(item => {
          // Unreleased means no release date set
          return !item.releaseDate && !item.releaseDateRequested
        }).sort((a, b) => {
          // Sort by song name alphabetically
          return a.song.localeCompare(b.song)
        })
      
      default:
        return []
    }
  }

  const filteredReleases = getFilteredReleases()
  const clashes = detectClashes(filteredReleases)
  
  // Get clash info for a specific release
  const getClashInfo = (release: ReleaseScheduleItem): ReleaseScheduleItem[] | null => {
    const date = release.releaseDate || release.releaseDateRequested
    if (!date) return null
    const dateKey = date.split('T')[0]
    const clashGroup = clashes.get(dateKey)
    if (clashGroup && clashGroup.length > 1) {
      return clashGroup.filter(r => r.id !== release.id)
    }
    return null
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Release Schedule</h1>
          <p className="text-slate-400">Manage upcoming releases and track release dates</p>
        </div>
      </div>
      
      {/* Clash Warning Banner */}
      {clashes.size > 0 && (
        <div className="mb-6 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-yellow-400 font-semibold mb-1">Release Date Conflicts Detected</h3>
              <p className="text-slate-300 text-sm mb-2">
                {clashes.size} date{clashes.size > 1 ? 's' : ''} have multiple releases scheduled. Consider spacing them out for better promotion.
              </p>
              <div className="space-y-1">
                {Array.from(clashes.entries()).map(([date, releases]) => (
                  <div key={date} className="text-xs text-slate-400">
                    <span className="font-medium text-yellow-400">{new Date(date).toLocaleDateString()}:</span>{' '}
                    {releases.map(r => r.song).join(', ')}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-slate-700">
        <div className="flex space-x-1">
          {(['released', 'scheduled', 'unreleased'] as ReleaseTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium transition ${
                activeTab === tab
                  ? 'text-red-500 border-b-2 border-red-500'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)} ({filteredReleases.length})
            </button>
          ))}
        </div>
      </div>

      {/* Pending Approvals - Only show on scheduled tab */}
      {activeTab === 'scheduled' && pendingReleases.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <AlertCircle className="w-5 h-5 text-yellow-500" />
            <h2 className="text-xl font-semibold text-white">Pending Approvals ({pendingReleases.length})</h2>
          </div>
          <div className="grid gap-4">
            {pendingReleases.map((release) => (
              <div
                key={release.id}
                className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-red-500 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">{release.song}</h3>
                    <p className="text-slate-400 text-sm">by {release.artist} • {release.releaseType}</p>
                    <div className="mt-2 flex items-center space-x-4 text-sm">
                      <span className="text-slate-300">
                        Requested: {formatDate(release.releaseDateRequested)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedRelease(release)
                      setApprovedDate(release.releaseDateRequested || '')
                    }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                  >
                    Review
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Releases List - Show filtered releases based on active tab */}
      <div className="mb-8">
        <div className="flex items-center space-x-2 mb-4">
          <Calendar className="w-5 h-5 text-red-500" />
          <h2 className="text-xl font-semibold text-white">
            {activeTab === 'released' && 'Released'}
            {activeTab === 'scheduled' && 'Scheduled'}
            {activeTab === 'unreleased' && 'Unreleased'}
            {' '}({filteredReleases.length})
          </h2>
        </div>
        
        {/* Calendar View */}
        {viewMode === 'calendar' && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <div className="grid grid-cols-7 gap-2 mb-4">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-slate-400 text-sm font-semibold py-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {(() => {
                const today = new Date()
                const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
                const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
                const startDate = new Date(firstDay)
                startDate.setDate(startDate.getDate() - startDate.getDay())
                
                const days: JSX.Element[] = []
                const currentDate = new Date(startDate)
                
                for (let i = 0; i < 42; i++) {
                  const dateStr = formatLocalDateString(currentDate)
                  const isCurrentMonth = currentDate.getMonth() === today.getMonth()
                  const todayStr = formatLocalDateString(today)
                  const isToday = dateStr === todayStr
                  const isPast = currentDate < today
                  
                  const releasesOnDate = filteredReleases.filter(r => {
                    const releaseDate = r.releaseDate || r.releaseDateRequested
                    return releaseDate && releaseDate.split('T')[0] === dateStr
                  })
                  
                  days.push(
                    <div
                      key={dateStr}
                      className={`min-h-[80px] p-2 rounded border ${
                        isCurrentMonth
                          ? isToday
                            ? 'bg-red-600/20 border-red-500'
                            : isPast
                            ? 'bg-slate-900/50 border-slate-700'
                            : 'bg-slate-800 border-slate-700'
                          : 'bg-slate-900/30 border-slate-800'
                      }`}
                    >
                      <div className={`text-sm mb-1 ${isCurrentMonth ? 'text-white' : 'text-slate-600'}`}>
                        {currentDate.getDate()}
                      </div>
                      {releasesOnDate.map(release => (
                        <div
                          key={release.id}
                          className="text-xs bg-red-600/30 text-red-300 px-1 py-0.5 rounded mb-1 truncate"
                          title={`${release.song} by ${release.artist}`}
                        >
                          {release.song}
                        </div>
                      ))}
                    </div>
                  )
                  
                  currentDate.setDate(currentDate.getDate() + 1)
                }
                
                return days
              })()}
            </div>
          </div>
        )}
        
        {/* Timeline View */}
        {viewMode === 'timeline' && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <div className="relative">
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-red-600"></div>
              <div className="space-y-6">
                {filteredReleases.map((release, index) => {
                  const releaseDate = release.releaseDate || release.releaseDateRequested
                  const date = releaseDate ? new Date(releaseDate) : null
                  const daysUntil = date ? Math.ceil((date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null
                  
                  return (
                    <div key={release.id} className="relative pl-16">
                      <div className="absolute left-6 w-4 h-4 bg-red-600 rounded-full border-2 border-slate-800"></div>
                      <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-white">{release.song}</h3>
                            <p className="text-slate-400 text-sm">by {release.artist} • {release.releaseType}</p>
                            {date && (
                              <p className="text-slate-300 text-sm mt-2">
                                {date.toLocaleDateString('en-US', { 
                                  weekday: 'long', 
                                  year: 'numeric', 
                                  month: 'long', 
                                  day: 'numeric' 
                                })}
                                {daysUntil !== null && (
                                  <span className="text-slate-500 ml-2">
                                    ({daysUntil > 0 ? `${daysUntil} days` : daysUntil === 0 ? 'Today' : `${Math.abs(daysUntil)} days ago`})
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                          {release.approvalStatus && (
                            <span className={`px-2 py-1 text-xs rounded ${
                              release.approvalStatus === 'approved' ? 'bg-green-600/20 text-green-400' :
                              release.approvalStatus === 'denied' ? 'bg-red-600/20 text-red-400' :
                              'bg-yellow-600/20 text-yellow-400'
                            }`}>
                              {release.approvalStatus}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
        
        {/* Card Grid View (Default) */}
        {viewMode === 'list' && (
          <>
          {filteredReleases.length === 0 ? (
            <div className="text-center py-16 bg-gradient-to-br from-slate-900 to-black rounded-xl border border-slate-800">
              <Music className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Upcoming Releases</h3>
              <p className="text-slate-400">All releases are either in the catalog or have already been released.</p>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredReleases.map((release) => {
            const releaseDate = release.releaseDate || release.releaseDateRequested
            const daysUntil = getDaysUntilRelease(releaseDate)
            const clashReleases = getClashInfo(release)
            const isEditingDate = editingReleaseId === release.id
            
            // Color coding based on days until release
            const getUrgencyColor = (days: number | null): string => {
              if (days === null) return 'bg-slate-500/20 text-slate-400'
              if (days < 0) return 'bg-slate-500/20 text-slate-400'
              if (days <= 3) return 'bg-red-500/20 text-red-400'
              if (days <= 7) return 'bg-orange-500/20 text-orange-400'
              if (days <= 14) return 'bg-yellow-500/20 text-yellow-400'
              return 'bg-blue-500/20 text-blue-400'
            }
            
            const handleDateChange = async () => {
              if (!editingReleaseDate) return
              
              try {
                const res = await fetch('/api/release-schedule', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    songId: release.id,
                    approvalStatus: 'approved',
                    approvedDate: editingReleaseDate,
                  }),
                })

                const data = await res.json()
                
                if (data.success) {
                  setEditingReleaseId(null)
                  setEditingReleaseDate('')
                  fetchSchedule()
                } else {
                  alert('Failed to update date: ' + data.error)
                }
              } catch (error) {
                console.error('Failed to update date:', error)
                alert('Failed to update date')
              }
            }
            
            return (
              <div
                key={release.id}
                onClick={() => router.push(`/dashboard/catalog/${encodeURIComponent(release.id)}`)}
                className="group bg-gradient-to-br from-slate-900 to-black rounded-xl border border-slate-800 hover:border-red-500/50 transition-all cursor-pointer overflow-hidden shadow-lg hover:shadow-xl"
              >
                {/* Album Cover */}
                <div className="relative aspect-square bg-slate-800 overflow-hidden">
                  {release.albumCover ? (
                    <img
                      src={getAbsoluteUrl(release.albumCover)}
                      alt={release.song}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                      <Music className="w-16 h-16 text-slate-600" />
                    </div>
                  )}
                  {/* Days Until Badge */}
                  {daysUntil !== null && (
                    <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm ${getUrgencyColor(daysUntil)}`}>
                      {daysUntil < 0 ? `${Math.abs(daysUntil)}d ago` : daysUntil === 0 ? 'Today' : `${daysUntil}d`}
                    </div>
                  )}
                  {/* Clash Warning */}
                  {clashReleases && clashReleases.length > 0 && (
                    <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-yellow-500/90 text-yellow-900 text-xs font-semibold backdrop-blur-sm flex items-center space-x-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>{clashReleases.length} clash{clashReleases.length > 1 ? 'es' : ''}</span>
                    </div>
                  )}
                </div>
                
                {/* Content */}
                <div className="p-4">
                  <div className="mb-2">
                    <h3 className="text-white font-semibold text-lg mb-1 line-clamp-1 group-hover:text-red-400 transition">
                      {release.song}
                    </h3>
                    <p className="text-slate-400 text-sm line-clamp-1">{release.artist}</p>
                  </div>
                  
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-1 rounded capitalize">
                      {release.releaseType || 'single'}
                    </span>
                    {release.totalStreams !== undefined && release.totalStreams > 0 && (
                      <div className="flex items-center space-x-1 text-slate-400 text-xs">
                        <TrendingUp className="w-3 h-3" />
                        <span>{release.totalStreams.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Release Date */}
                  {releaseDate ? (
                    <div className="mb-2">
                      {isEditingDate ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="date"
                            value={editingReleaseDate}
                            onChange={(e) => setEditingReleaseDate(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleDateChange()
                              if (e.key === 'Escape') {
                                setEditingReleaseId(null)
                                setEditingReleaseDate('')
                              }
                            }}
                            className="flex-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            autoFocus
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDateChange()
                            }}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <p className="text-slate-300 text-sm">
                            {new Date(releaseDate).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </p>
                          {canApproveOrDeny && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingReleaseId(release.id)
                                setEditingReleaseDate(releaseDate.split('T')[0])
                              }}
                              className="text-slate-500 hover:text-white text-xs"
                              title="Edit release date"
                            >
                              <Clock className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-xs italic">No release date set</p>
                  )}
                  
                  {/* Clash Details */}
                  {clashReleases && clashReleases.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-800">
                      <p className="text-xs text-yellow-400 mb-1 font-medium">Also releasing:</p>
                      <div className="space-y-1">
                        {clashReleases.slice(0, 2).map((clash) => (
                          <p key={clash.id} className="text-xs text-slate-400 line-clamp-1">
                            {clash.song} by {clash.artist}
                          </p>
                        ))}
                        {clashReleases.length > 2 && (
                          <p className="text-xs text-slate-500">+{clashReleases.length - 2} more</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          </div>
          )}
          </>
        )}
      </div>

      {/* Available Weekend Dates - For Choosing */}
      {availableDates.filter(d => d.isWeekend).length > 0 && (
        <div>
          <div className="flex items-center space-x-2 mb-4">
            <Clock className="w-5 h-5 text-blue-500" />
            <h2 className="text-xl font-semibold text-white">Available Weekend Dates</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {availableDates
              .filter(d => d.isWeekend)
              .slice(0, 12)
              .map((date) => (
                <div
                  key={date.date}
                  className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-center hover:border-blue-500 transition cursor-pointer"
                  title="Click to use this date"
                >
                  <div className="text-white font-semibold">{date.day}</div>
                  <div className="text-slate-400 text-sm">
                    {new Date(date.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{date.weeksOut} weeks</div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {selectedRelease && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-2xl w-full mx-4">
            <h2 className="text-2xl font-bold text-white mb-4">
              Review Release: {selectedRelease.song}
            </h2>
            <div className="space-y-4 mb-6">
              <div>
                <p className="text-slate-400 text-sm">Artist</p>
                <p className="text-white">{selectedRelease.artist}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Release Type</p>
                <p className="text-white capitalize">{selectedRelease.releaseType}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Requested Date</p>
                <p className="text-white">{formatDate(selectedRelease.releaseDateRequested)}</p>
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">
                  Approved Release Date (minimum 3 days from today)
                </label>
                <input
                  type="date"
                  value={approvedDate}
                  onChange={(e) => setApprovedDate(e.target.value)}
                  min={new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Minimum 3 days required for proper preparation
                </p>
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">
                  Notes (optional for approval, required for denial)
                </label>
                <textarea
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  placeholder="Add any notes about this release..."
                />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {canApproveOrDeny ? (
                <>
                  <button
                    onClick={handleApprove}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition flex items-center justify-center space-x-2"
                  >
                    <Check className="w-5 h-5" />
                    <span>Approve</span>
                  </button>
                  <button
                    onClick={handleDeny}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition flex items-center justify-center space-x-2"
                  >
                    <X className="w-5 h-5" />
                    <span>Deny</span>
                  </button>
                </>
              ) : (
                <div className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg">
                  You don’t have permission to approve/deny releases.
                </div>
              )}
              <button
                onClick={() => {
                  setSelectedRelease(null)
                  setApprovalNotes('')
                  setApprovedDate('')
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

