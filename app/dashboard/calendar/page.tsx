'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Calendar, CheckCircle, Music, FileText, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Plus, Edit, Trash2, X, Bot, Lightbulb, AlertTriangle, Video, Link as LinkIcon, BarChart3, Package, Mic, Maximize2, Minimize2, Smartphone, Copy, Check } from 'lucide-react'
import Link from 'next/link'
import EventDetailModal from '@/components/calendar/EventDetailModal'

// Artist color system: consistent mapping, dark base + accent only
const ARTIST_PALETTE = [
  { bg: 'bg-violet-500/8', border: 'border-l-violet-500', badge: 'bg-violet-500 text-white' },
  { bg: 'bg-blue-500/8', border: 'border-l-blue-500', badge: 'bg-blue-500 text-white' },
  { bg: 'bg-emerald-500/8', border: 'border-l-emerald-500', badge: 'bg-emerald-500 text-white' },
  { bg: 'bg-amber-500/8', border: 'border-l-amber-500', badge: 'bg-amber-500 text-white' },
  { bg: 'bg-rose-500/8', border: 'border-l-rose-500', badge: 'bg-rose-500 text-white' },
  { bg: 'bg-cyan-500/8', border: 'border-l-cyan-500', badge: 'bg-cyan-500 text-white' },
]
function getArtistKey(ev: { artistName?: string; subtitle?: string; type: string }): string {
  if (ev.artistName) return ev.artistName
  if (ev.type === 'release' && ev.subtitle) return ev.subtitle
  return 'Other'
}
function getArtistInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2)
  return name.slice(0, 2).toUpperCase()
}
function getArtistColorIndex(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h << 5) - h + name.charCodeAt(i)
  return Math.abs(h) % ARTIST_PALETTE.length
}
function formatTime(t?: string): string {
  if (!t) return '—'
  const [h, m] = t.split(':')
  const hour = parseInt(h || '0', 10)
  if (hour === 0) return '12a'
  if (hour === 12) return '12p'
  return hour < 12 ? `${hour}a` : `${hour - 12}p`
}

// Event type colors for calendar blocks (used for label events via eventType, fallback for type)
const EVENT_TYPE_STYLES: Record<string, { bg: string; border: string; label: string }> = {
  release: { bg: 'bg-emerald-500/20', border: 'border-l-emerald-500', label: 'Release' },
  label: { bg: 'bg-violet-500/20', border: 'border-l-violet-500', label: 'Marketing' },
  content: { bg: 'bg-violet-500/20', border: 'border-l-violet-500', label: 'Content' },
  task: { bg: 'bg-blue-500/20', border: 'border-l-blue-500', label: 'Deadline' },
  personal: { bg: 'bg-amber-500/20', border: 'border-l-amber-500', label: 'Personal' },
  // Label event types (eventType)
  studio_session: { bg: 'bg-cyan-500/20', border: 'border-l-cyan-500', label: 'Studio' },
  label_post: { bg: 'bg-violet-500/20', border: 'border-l-violet-500', label: 'Label' },
  artist_post: { bg: 'bg-fuchsia-500/20', border: 'border-l-fuchsia-500', label: 'Artist' },
  collab_post: { bg: 'bg-pink-500/20', border: 'border-l-pink-500', label: 'Collab' },
  meeting: { bg: 'bg-sky-500/20', border: 'border-l-sky-500', label: 'Meeting' },
  promo: { bg: 'bg-violet-500/20', border: 'border-l-violet-500', label: 'Promo' },
  announcement: { bg: 'bg-indigo-500/20', border: 'border-l-indigo-500', label: 'Announce' },
  snippet: { bg: 'bg-purple-500/20', border: 'border-l-purple-500', label: 'Snippet' },
  music_video: { bg: 'bg-rose-500/20', border: 'border-l-rose-500', label: 'Video' },
  playlist_push: { bg: 'bg-teal-500/20', border: 'border-l-teal-500', label: 'Playlist' },
  content_due: { bg: 'bg-orange-500/20', border: 'border-l-orange-500', label: 'Content Due' },
  deadline: { bg: 'bg-blue-500/20', border: 'border-l-blue-500', label: 'Deadline' },
  event: { bg: 'bg-slate-500/20', border: 'border-l-slate-500', label: 'Event' },
}

const PROMOTION_BADGES: Record<string, { label: string; className: string }> = {
  label_page: { label: 'Label', className: 'bg-violet-500/30 text-violet-300' },
  artist_page: { label: 'Artist', className: 'bg-fuchsia-500/30 text-fuchsia-300' },
  both: { label: 'Both', className: 'bg-pink-500/30 text-pink-300' },
}

interface CalendarEvent {
  id: string
  type: 'task' | 'release' | 'content' | 'personal' | 'label'
  title: string
  date: string
  time?: string
  subtitle?: string
  href?: string
  status?: string
  description?: string
  notifyAt?: string
  canEdit?: boolean
  eventType?: string
  promotionTarget?: string
  artistName?: string
  songTitle?: string
  linkedMediaUrl?: string
  linkedDriveUrl?: string
  songId?: string
}

export default function MyCalendarPage() {
  const { user, staffViewMode = 'artist' } = useAuth()
  const isStaff = user?.role === 'artist' && Array.isArray(user?.staffPermissions) && user.staffPermissions.length > 0
  const isAdmin = user?.role === 'admin'
  const showStaffView = isAdmin || (isStaff && staffViewMode === 'staff')
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<CalendarEvent | null>(null)
  const [formData, setFormData] = useState({ title: '', date: '', time: '', description: '', remindMe: '' })
  const [isSaving, setIsSaving] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [aiCommand, setAiCommand] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiPreview, setAiPreview] = useState<{ interpretation?: string; actions?: any[]; suggestions?: string[]; conflicts?: string[]; clarifications?: string[] } | null>(null)
  const [aiSelectedActions, setAiSelectedActions] = useState<Set<number>>(new Set())
  const [aiConversation, setAiConversation] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [aiPanelExpanded, setAiPanelExpanded] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [needsAttention, setNeedsAttention] = useState<string[]>([])
  const [dayDetail, setDayDetail] = useState<{ date: string; events: CalendarEvent[] } | null>(null)
  const [dayDetailData, setDayDetailData] = useState<{
    groups: Array<{
      artistName: string
      artistId?: string
      campaignStatus?: 'on_track' | 'needs_content' | 'missing_assets'
      events: Array<{
        id: string
        title: string
        songTitle: string
        productType: string
        scheduledTime?: string
        igViews: number
        tiktokViews: number
        youtubeViews: number
        hasVideo: boolean
        vaultVideo?: { id: string; title: string; videoUrl: string; platform?: string }
        linkedMediaUrl?: string
        linkedDriveUrl?: string
        linkedSnippetUrl?: string
      }>
    }>
    totalEvents: number
    artistsActive: number
  } | null>(null)
  const [dayDetailLoading, setDayDetailLoading] = useState(false)
  const [drawerTab, setDrawerTab] = useState<'overview' | 'timeline' | 'analytics'>('overview')
  const [collapsedArtists, setCollapsedArtists] = useState<Set<string>>(new Set())
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [vaultModalForEvent, setVaultModalForEvent] = useState<{ eventId: string; artistName: string } | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; event: CalendarEvent } | null>(null)
  const [eventFilters, setEventFilters] = useState({
    releases: true,
    studio: true,
    marketing: true,
    deadlines: true,
    contracts: true,
    distribution: true,
    tasks: true,
    personal: true,
    // Breakdown: where posts go (all on = show everything)
    labelPage: true,
    artistPage: true,
    collabPosts: true,
    // Event type breakdown
    meetings: true,
    contentDue: true,
  })
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month')
  const [showAddLabelModal, setShowAddLabelModal] = useState(false)
  const [addLabelDate, setAddLabelDate] = useState<string>('')
  const [draggingEvent, setDraggingEvent] = useState<CalendarEvent | null>(null)
  const [showSubscribeModal, setShowSubscribeModal] = useState(false)
  const [feedUrlCopied, setFeedUrlCopied] = useState(false)
  const [labelEventForm, setLabelEventForm] = useState<{
    artistId: string
    songId: string
    productType: string
    contentType: string
    vaultVideoId: string
    rolloutPhase: string
    platform: string
    title: string
    date: string
    scheduledTime: string
    eventType: string
    promotionTarget: 'artist_page' | 'label_page' | 'both'
  }>({
    artistId: '',
    songId: '',
    productType: '',
    contentType: '',
    vaultVideoId: '',
    rolloutPhase: '',
    platform: '',
    title: '',
    date: '',
    scheduledTime: '',
    eventType: 'artist_post',
    promotionTarget: 'both',
  })

  const fetchCalendarData = useCallback(async () => {
    if (!user?.id) return
    setIsLoading(true)
    try {
      const allEvents: CalendarEvent[] = []

      // Fetch tasks: staff/admin see all, others see only assigned to them
      const tasksUrl = showStaffView ? '/api/tasks' : `/api/tasks?assignedTo=${user.id}`
      const tasksRes = await fetch(tasksUrl)
      const tasksData = await tasksRes.json()
      if (tasksData.success && tasksData.tasks) {
        tasksData.tasks.forEach((t: any) => {
          if (t.dueDate) {
            allEvents.push({
              id: `task_${t.id}`,
              type: 'task',
              title: t.title,
              date: t.dueDate.split('T')[0],
              subtitle: t.completed ? 'Completed' : (t.assignedToName ? `${t.assignedToName} · ` : '') + (t.status || 'Pending'),
              href: '/dashboard/tasks',
              status: t.completed ? 'completed' : 'pending',
              canEdit: false,
            })
          }
        })
      }

      // Personal calendar events
      const monthStart = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}-01`
      const lastDay = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate()
      const monthEnd = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      const personalRes = await fetch(`/api/personal-calendar?userId=${user.id}&startDate=${monthStart}&endDate=${monthEnd}`)
      const personalData = await personalRes.json()
      if (personalData.success && personalData.events) {
        personalData.events.forEach((e: any) => {
          allEvents.push({
            id: e.id,
            type: 'personal',
            title: e.title,
            date: e.date,
            time: e.time,
            subtitle: e.description,
            description: e.description,
            notifyAt: e.notifyAt,
            canEdit: true,
          })
        })
      }

      // Catalog/releases: staff/admin see full catalog, artists see their own
      const catalogUrl = showStaffView
        ? `/api/catalog?userId=${encodeURIComponent(user.id)}&includeArchived=true`
        : `/api/catalog?userId=${encodeURIComponent(user.id)}`
      const catalogRes = await fetch(catalogUrl)
      const catalogData = await catalogRes.json()
      if (catalogData.success && catalogData.catalog) {
        catalogData.catalog.forEach((item: any) => {
          const date = item.releaseDate || item.releaseDateRequested
          if (date) {
            allEvents.push({
              id: `release_${item.id}`,
              type: 'release',
              title: `${item.song}${item.releaseType ? ` (${item.releaseType})` : ''}`,
              date: date.split('T')[0],
              subtitle: item.artist,
              href: `/dashboard/catalog/${encodeURIComponent(item.id)}`,
              status: item.releaseApprovalStatus,
              canEdit: false,
            })
          }
        })
      }

      // Content calendar: artists see their own; staff see content for managed artists only
      const artistIdsToFetch: string[] = []
      if (user.role === 'artist' && !showStaffView) {
        artistIdsToFetch.push(user.id)
      } else if (showStaffView && user.staffManagedArtistIds?.length) {
        artistIdsToFetch.push(...user.staffManagedArtistIds)
      }
      for (const artistId of artistIdsToFetch) {
        const contentRes = await fetch(`/api/growth-analytics?artistId=${artistId}&type=content`)
        const contentData = await contentRes.json()
        const contentCal = contentData.data?.contentCalendar || contentData.contentCalendar
        if (contentCal && Array.isArray(contentCal)) {
          contentCal.forEach((item: any) => {
            if (item.scheduledDate) {
              allEvents.push({
                id: `content_${item.id}`,
                type: 'content',
                title: item.title || 'Content',
                date: item.scheduledDate.split('T')[0],
                subtitle: item.contentType || item.status,
                status: item.status,
                canEdit: false,
              })
            }
          })
        }
      }

      // Label calendar events (unified scheduling)
      const labelRes = await fetch(`/api/label-calendar?startDate=${monthStart}&endDate=${monthEnd}`)
      const labelData = await labelRes.json()
      if (labelData.success && labelData.events) {
        labelData.events.forEach((e: any) => {
          allEvents.push({
            id: e.id,
            type: 'label',
            title: e.title,
            date: e.date,
            time: e.scheduledTime,
            subtitle: e.artistName,
            eventType: e.eventType,
            promotionTarget: e.promotionTarget,
            artistName: e.artistName,
            songTitle: e.songTitle,
            linkedMediaUrl: e.linkedMediaUrl,
            linkedDriveUrl: e.linkedDriveUrl,
            songId: e.songId,
            status: e.status,
            canEdit: showStaffView && !e.locked,
          })
        })
      }

      setEvents(allEvents)
    } catch (error) {
      console.error('Failed to fetch calendar:', error)
      setEvents([])
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, user?.role, user?.staffManagedArtistIds, showStaffView, viewMonth.year, viewMonth.month])

  useEffect(() => {
    if (!user?.id) return
    fetchCalendarData()
  }, [user?.id, fetchCalendarData])

  useEffect(() => {
    if (!showStaffView) return
    fetch('/api/label-calendar/insights')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setSuggestions(d.suggestions || [])
          setNeedsAttention(d.needsAttention || [])
        }
      })
      .catch(() => {})
  }, [showStaffView, events])

  useEffect(() => {
    if (!dayDetail?.date) {
      setDayDetailData(null)
      return
    }
    setDayDetailLoading(true)
    setDayDetailData(null)
    fetch(`/api/calendar/day-detail?date=${dayDetail.date}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.groups?.length) {
          setDayDetailData({
            groups: d.groups,
            totalEvents: d.totalEvents ?? 0,
            artistsActive: d.artistsActive ?? 0,
          })
        } else {
          setDayDetailData(null)
        }
      })
      .catch(() => setDayDetailData(null))
      .finally(() => setDayDetailLoading(false))
  }, [dayDetail?.date])

  const handleAiCommand = async (isFollowUp = false) => {
    if (!aiCommand.trim() || aiLoading || !user?.id) return
    setAiLoading(true)
    if (!isFollowUp) setAiPreview(null)
    try {
      const body: { command: string; userId: string; conversationHistory?: { role: string; content: string }[] } = {
        command: aiCommand.trim(),
        userId: user.id,
      }
      if (isFollowUp && aiConversation.length > 0) {
        body.conversationHistory = aiConversation
      }
      const res = await fetch('/api/ai-calendar-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        const actions = data.actions || []
        setAiPreview({
          interpretation: data.interpretation,
          actions,
          suggestions: data.suggestions,
          conflicts: data.conflicts,
          clarifications: data.clarifications,
        })
        setAiSelectedActions(new Set(actions.map((_: any, i: number) => i)))
        if (isFollowUp) {
          setAiConversation((prev) => [
            ...prev,
            { role: 'user', content: aiCommand.trim() },
            { role: 'assistant', content: data.interpretation || '' },
          ])
        } else {
          setAiConversation([{ role: 'user', content: aiCommand.trim() }, { role: 'assistant', content: data.interpretation || '' }])
        }
        setAiCommand('') // Clear so user can type reply when AI has clarifications
      }
    } catch (e) {
      console.error(e)
    } finally {
      setAiLoading(false)
    }
  }

  const handleApplyAiPreview = async () => {
    if (!aiPreview?.actions?.length || !user?.id) return
    const toApply = aiPreview.actions.filter((_, i) => aiSelectedActions.has(i))
    if (toApply.length === 0) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/label-calendar/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: toApply.map((a: any) => ({
            date: a.date,
            eventType: a.eventType || 'event',
            promotionTarget: a.promotionTarget || 'artist_page',
            title: a.title,
            artistId: a.artistId,
            songId: a.songId,
            notes: a.notes,
            createdBy: 'ai',
            userId: user.id,
          })),
          createdBy: 'ai',
          userId: user.id,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setAiPreview(null)
        setAiConversation([])
        setAiCommand('')
        fetchCalendarData()
      }
    } finally {
      setAiLoading(false)
    }
  }

  const handleAddEvent = async () => {
    if (!user?.id || !formData.title.trim() || !formData.date) return
    setIsSaving(true)
    try {
      const res = await fetch('/api/personal-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          title: formData.title.trim(),
          date: formData.date,
          time: formData.time || undefined,
          description: formData.description.trim() || undefined,
          notifyAt: formData.remindMe || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setShowAddModal(false)
        setFormData({ title: '', date: '', time: '', description: '', remindMe: '' })
        setSelectedDate(null)
        fetchCalendarData()
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateEvent = async () => {
    if (!user?.id || !editingEvent || editingEvent.type !== 'personal' || !formData.title.trim() || !formData.date) return
    setIsSaving(true)
    try {
      const res = await fetch('/api/personal-calendar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingEvent.id,
          userId: user.id,
          title: formData.title.trim(),
          date: formData.date,
          time: formData.time || undefined,
          description: formData.description.trim() || undefined,
          notifyAt: formData.remindMe || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setEditingEvent(null)
        setFormData({ title: '', date: '', time: '', description: '', remindMe: '' })
        fetchCalendarData()
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteEvent = async () => {
    if (!user?.id || !showDeleteConfirm || showDeleteConfirm.type !== 'personal') return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/personal-calendar?id=${showDeleteConfirm.id}&userId=${user.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setShowDeleteConfirm(null)
        fetchCalendarData()
      }
    } finally {
      setIsSaving(false)
    }
  }

  const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate()
  const firstDay = new Date(viewMonth.year, viewMonth.month, 1).getDay()
  const monthName = new Date(viewMonth.year, viewMonth.month).toLocaleString('default', { month: 'long', year: 'numeric' })

  const prevMonth = () => {
    if (viewMode === 'week') {
      setViewMonth((m) => {
        const d = new Date(m.year, m.month, 1)
        d.setDate(d.getDate() - 7)
        return { year: d.getFullYear(), month: d.getMonth() }
      })
    } else if (viewMode === 'day') {
      setViewMonth((m) => {
        const d = new Date(m.year, m.month, 1)
        d.setDate(d.getDate() - 1)
        return { year: d.getFullYear(), month: d.getMonth() }
      })
    } else {
      setViewMonth((m) => (m.month === 0 ? { year: m.year - 1, month: 11 } : { year: m.year, month: m.month - 1 }))
    }
  }
  const nextMonth = () => {
    if (viewMode === 'week') {
      setViewMonth((m) => {
        const d = new Date(m.year, m.month, 1)
        d.setDate(d.getDate() + 7)
        return { year: d.getFullYear(), month: d.getMonth() }
      })
    } else if (viewMode === 'day') {
      setViewMonth((m) => {
        const d = new Date(m.year, m.month, 1)
        d.setDate(d.getDate() + 1)
        return { year: d.getFullYear(), month: d.getMonth() }
      })
    } else {
      setViewMonth((m) => (m.month === 11 ? { year: m.year + 1, month: 0 } : { year: m.year, month: m.month + 1 }))
    }
  }

  const getEventStyle = (ev: CalendarEvent) => {
    if (ev.type === 'label' && ev.eventType && EVENT_TYPE_STYLES[ev.eventType]) {
      return EVENT_TYPE_STYLES[ev.eventType]
    }
    return EVENT_TYPE_STYLES[ev.type] || EVENT_TYPE_STYLES.personal
  }

  const filterEvents = (e: CalendarEvent) => {
    if (e.type === 'release' && !eventFilters.releases) return false
    if (e.type === 'task' && !eventFilters.deadlines) return false
    if (e.type === 'personal' && !eventFilters.personal) return false
    // Label/content: check event type breakdown
    if (e.type === 'label') {
      const et = e.eventType || 'event'
      if (et === 'studio_session' && !eventFilters.studio) return false
      if (et === 'meeting' && !eventFilters.meetings) return false
      if (et === 'content_due' && !eventFilters.contentDue) return false
      if (['artist_post', 'label_post', 'collab_post', 'promo', 'snippet', 'announcement', 'music_video', 'playlist_push', 'release'].includes(et) && !eventFilters.marketing) return false
      // Promotion target breakdown (missing = show when any is on)
      const pt = (e.promotionTarget || 'both') as keyof typeof PROMOTION_BADGES
      if (pt === 'label_page' && !eventFilters.labelPage) return false
      if (pt === 'artist_page' && !eventFilters.artistPage) return false
      if (pt === 'both' && !eventFilters.collabPosts) return false
    }
    if (e.type === 'content' && !eventFilters.marketing) return false
    return true
  }
  const getEventsForDate = (day: number) => {
    const dateStr = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter((e) => e.date === dateStr && filterEvents(e))
  }
  const getEventsForDateStr = (dateStr: string) => {
    return events.filter((e) => e.date === dateStr && filterEvents(e))
  }

  const upcomingEvents = events
    .filter((e) => e.date >= new Date().toISOString().split('T')[0] && filterEvents(e))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))
    .slice(0, 10)

  const labelReleases = showStaffView
    ? events
        .filter((e) => e.type === 'release' && e.date >= new Date().toISOString().split('T')[0])
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 15)
    : []

  const openAddModal = (dateStr?: string, suggestedTitle?: string) => {
    setFormData({
      title: suggestedTitle || '',
      date: dateStr || new Date().toISOString().split('T')[0],
      time: '',
      description: '',
      remindMe: '',
    })
    setSelectedDate(dateStr || null)
    setShowAddModal(true)
  }

  const openAddLabelModal = (dateStr?: string, preset?: { promotionTarget?: 'artist_page' | 'label_page' | 'both'; eventType?: string }) => {
    const date = dateStr || new Date().toISOString().split('T')[0]
    setAddLabelDate(date)
    setLabelEventForm({
      artistId: '',
      songId: '',
      productType: '',
      contentType: preset?.eventType === 'snippet' ? 'reel' : '',
      vaultVideoId: '',
      rolloutPhase: '',
      platform: '',
      title: preset?.eventType ? (preset.eventType === 'label_post' ? 'Label IG: ' : preset.eventType === 'artist_post' ? 'Artist post: ' : 'Collab post: ') : '',
      date,
      scheduledTime: '',
      eventType: preset?.eventType || 'artist_post',
      promotionTarget: preset?.promotionTarget || 'both',
    })
    setShowAddLabelModal(true)
  }

  const openEditModal = (ev: CalendarEvent) => {
    if (ev.type !== 'personal' || !ev.canEdit) return
    setEditingEvent(ev)
    setFormData({
      title: ev.title,
      date: ev.date,
      time: ev.time || '',
      description: ev.description || '',
      remindMe: ev.notifyAt || '',
    })
  }

  const openDayDetail = (dateStr: string) => {
    const dayEvents = events.filter((e) => e.date === dateStr)
    setDayDetail({ date: dateStr, events: dayEvents })
  }

  const handleMoveEvent = async (ev: CalendarEvent, newDate: string) => {
    if (ev.date === newDate) return
    try {
      if (ev.type === 'label') {
        const res = await fetch('/api/label-calendar', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: ev.id, date: newDate }),
        })
        if (res.ok) fetchCalendarData()
      } else if (ev.type === 'personal') {
        const res = await fetch('/api/personal-calendar', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: ev.id, userId: user?.id, date: newDate, title: ev.title, time: ev.time, description: ev.description }),
        })
        if (res.ok) fetchCalendarData()
      } else if (ev.type === 'task') {
        const taskId = ev.id.replace('task_', '')
        const res = await fetch('/api/tasks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: taskId, dueDate: newDate }),
        })
        if (res.ok) fetchCalendarData()
      }
    } catch (e) {
      console.error('Move event error:', e)
    }
  }

  const artistColorMap = useMemo(() => {
    const m = new Map<string, number>()
    events.forEach((ev) => {
      const key = getArtistKey(ev)
      if (!m.has(key)) m.set(key, getArtistColorIndex(key))
    })
    return m
  }, [events])

  if (!user) return null

  return (
    <div className={`bg-black text-white transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-50 p-4 sm:p-6 overflow-auto' : 'min-h-screen p-4 sm:p-6'}`}>
      <div className={`mx-auto space-y-6 transition-opacity duration-200 ${isFullscreen ? 'max-w-full' : 'max-w-7xl'} ${dayDetail ? 'opacity-50' : 'opacity-100'}`}>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-7 h-7 text-red-500" />
            My Calendar
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSubscribeModal(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title="Subscribe in Apple Calendar"
            >
              <Smartphone className="w-4 h-4" />
              <span className="hidden sm:inline text-sm">Apple Calendar</span>
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title={isFullscreen ? 'Exit fullscreen' : 'Expand to fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            {showStaffView && (
              <button
                onClick={() => openAddLabelModal()}
                className="flex items-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg transition"
              >
                <FileText className="w-4 h-4" />
                Add Label Event
              </button>
            )}
            <button
              onClick={() => openAddModal()}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
            >
              <Plus className="w-4 h-4" />
              Add Event
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600" />
          </div>
        ) : (
          <div className={`grid gap-6 ${isFullscreen ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3'}`}>
            <div className={isFullscreen ? 'space-y-6' : 'lg:col-span-2 space-y-6'}>
            <div className={`bg-slate-900/50 rounded-xl p-4 border border-slate-800 ${isFullscreen ? 'min-h-[calc(100vh-10rem)]' : ''}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-800 transition">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-lg font-semibold text-white min-w-[180px] text-center">
                  {viewMode === 'month' ? monthName :
                    viewMode === 'week' ? (() => {
                      const d = new Date(viewMonth.year, viewMonth.month, 1)
                      const sun = new Date(d)
                      sun.setDate(d.getDate() - d.getDay())
                      const sat = new Date(sun)
                      sat.setDate(sun.getDate() + 6)
                      return `${sun.toLocaleDateString('short')} – ${sat.toLocaleDateString('short')}`
                    })() :
                    new Date(viewMonth.year, viewMonth.month, 1).toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </h2>
                  <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-800 transition">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex gap-1 p-1 bg-slate-800/60 rounded-lg">
                  {(['month', 'week', 'day'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={`px-3 py-1 rounded text-xs font-medium capitalize transition ${viewMode === mode ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
              {/* Smart filters */}
              <div className="flex flex-wrap gap-2 mb-3">
                {[
                  { key: 'releases', label: 'Releases', color: 'emerald' },
                  { key: 'marketing', label: 'Marketing', color: 'violet' },
                  { key: 'studio', label: 'Studio', color: 'cyan' },
                  { key: 'deadlines', label: 'Deadlines', color: 'blue' },
                  { key: 'personal', label: 'Personal', color: 'amber' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={eventFilters[key as keyof typeof eventFilters]}
                      onChange={(e) => setEventFilters((f) => ({ ...f, [key]: e.target.checked }))}
                      className="rounded border-slate-600 bg-slate-800 text-red-500"
                    />
                    <span className="text-xs text-slate-400">{label}</span>
                  </label>
                ))}
                <span className="text-slate-600 mx-1">|</span>
                <span className="text-xs text-slate-500">Where:</span>
                {[
                  { key: 'labelPage', label: 'Label' },
                  { key: 'artistPage', label: 'Artist' },
                  { key: 'collabPosts', label: 'Both' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={eventFilters[key as keyof typeof eventFilters]}
                      onChange={(e) => setEventFilters((f) => ({ ...f, [key]: e.target.checked }))}
                      className="rounded border-slate-600 bg-slate-800 text-red-500"
                    />
                    <span className="text-xs text-slate-400">{label}</span>
                  </label>
                ))}
                <span className="text-slate-600 mx-1">|</span>
                {[
                  { key: 'meetings', label: 'Meetings' },
                  { key: 'contentDue', label: 'Content Due' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={eventFilters[key as keyof typeof eventFilters]}
                      onChange={(e) => setEventFilters((f) => ({ ...f, [key]: e.target.checked }))}
                      className="rounded border-slate-600 bg-slate-800 text-red-500"
                    />
                    <span className="text-xs text-slate-400">{label}</span>
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-sm">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="text-slate-500 font-medium py-1">{d}</div>
                ))}
                {viewMode === 'day' ? (
                  (() => {
                    const d = new Date(viewMonth.year, viewMonth.month, 1)
                    const dateStr = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                    const dayEvents = getEventsForDateStr(dateStr)
                    const isToday = dateStr === new Date().toISOString().split('T')[0]
                    return (
                      <>
                        {Array.from({ length: 6 }, (_, i) => (
                          <div key={`empty-${i}`} className={isFullscreen ? 'min-h-[80px]' : 'min-h-[60px]'} />
                        ))}
                        <div
                          onClick={() => openDayDetail(dateStr)}
                          onDragOver={(e) => { e.preventDefault(); if (draggingEvent) e.dataTransfer.dropEffect = 'move' }}
                          onDrop={(e) => {
                            e.preventDefault()
                            if (draggingEvent) {
                              handleMoveEvent(draggingEvent, dateStr)
                              setDraggingEvent(null)
                            }
                          }}
                          className={`col-span-7 ${isFullscreen ? 'min-h-[400px]' : 'min-h-[300px]'} p-4 rounded-lg border ${isToday ? 'border-red-500 bg-red-500/10' : 'border-slate-800 bg-slate-800/30'}`}
                        >
                          <p className="text-slate-400 text-sm mb-4">{new Date(dateStr + 'T12:00:00').toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                          <div className="space-y-2">
                            {dayEvents.length === 0 ? (
                              <p className="text-slate-500 text-sm">No events. Click + to add.</p>
                            ) : (
                              dayEvents.map((ev) => {
                                const typeStyle = getEventStyle(ev)
                                const promoBadge = ev.type === 'label' && ev.promotionTarget && PROMOTION_BADGES[ev.promotionTarget]
                                return (
                                  <div
                                    key={ev.id}
                                    onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev) }}
                                    onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, event: ev }) }}
                                    className={`p-3 rounded-lg border-l-4 cursor-pointer hover:opacity-90 ${typeStyle.border} ${typeStyle.bg}`}
                                  >
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-[10px] font-medium text-slate-400 uppercase">{typeStyle.label}</span>
                                      {promoBadge && <span className={`px-1.5 py-0.5 rounded text-[9px] ${promoBadge.className}`}>{promoBadge.label}</span>}
                                    </div>
                                    <p className="text-white font-medium">{ev.title}</p>
                                    {ev.subtitle && <p className="text-slate-500 text-sm">{ev.subtitle}</p>}
                                    {ev.time && <p className="text-slate-400 text-xs mt-1">{ev.time}</p>}
                                  </div>
                                )
                              })
                            )}
                          </div>
                        </div>
                      </>
                    )
                  })()
                ) : viewMode === 'week' ? (
                  (() => {
                    const d = new Date(viewMonth.year, viewMonth.month, 1)
                    const sun = new Date(d)
                    sun.setDate(d.getDate() - d.getDay())
                    const weekDays = Array.from({ length: 7 }, (_, i) => {
                      const dayDate = new Date(sun)
                      dayDate.setDate(sun.getDate() + i)
                      return dayDate
                    })
return (
                          <>
                            {weekDays.map((dayDate) => {
                              const day = dayDate.getDate()
                              const dateStr = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                              const dayEvents = getEventsForDateStr(dateStr)
                          const isToday = dateStr === new Date().toISOString().split('T')[0]
                          const isCurrentMonth = dayDate.getMonth() === viewMonth.month
                          return (
                            <div
                              key={dateStr}
                              onClick={() => openDayDetail(dateStr)}
                              onDragOver={(e) => { e.preventDefault(); if (draggingEvent) e.dataTransfer.dropEffect = 'move' }}
                              onDrop={(e) => { e.preventDefault(); if (draggingEvent) { handleMoveEvent(draggingEvent, dateStr); setDraggingEvent(null) } }}
                              className={`${isFullscreen ? 'min-h-[120px]' : 'min-h-[100px]'} p-1 rounded-lg border cursor-pointer hover:border-slate-600 transition ${isToday ? 'border-red-500 bg-red-500/10' : 'border-slate-800 bg-slate-800/30'} ${!isCurrentMonth ? 'opacity-50' : ''}`}
                            >
                              <span className="text-slate-300">{day}</span>
                              <div className="mt-0.5 space-y-0.5">
                                {dayEvents.slice(0, 4).map((ev) => {
                                  const typeStyle = getEventStyle(ev)
                                  const promoBadge = ev.type === 'label' && ev.promotionTarget && PROMOTION_BADGES[ev.promotionTarget]
                                  return (
                                    <div
                                      key={ev.id}
                                      draggable={ev.type === 'label' || ev.type === 'personal' || ev.type === 'task'}
                                      onDragStart={(e) => { setDraggingEvent(ev); e.dataTransfer.setData('text/plain', ev.id); e.dataTransfer.effectAllowed = 'move' }}
                                      onDragEnd={() => setDraggingEvent(null)}
                                      onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev) }}
                                      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, event: ev }) }}
                                      className={`text-[10px] px-1.5 py-1 rounded border-l-2 cursor-pointer truncate flex items-center gap-1 ${typeStyle.border} ${typeStyle.bg}`}
                                    >
                                      {promoBadge && <span className={`flex-shrink-0 px-1 rounded text-[8px] ${promoBadge.className}`}>{promoBadge.label}</span>}
                                      <span className="min-w-0 truncate">{ev.title}</span>
                                    </div>
                                  )
                                })}
                                {dayEvents.length > 4 && <span className="text-xs text-slate-500">+{dayEvents.length - 4}</span>}
                              </div>
                            </div>
                          )
                        })}
                      </>
                    )
                  })()
                ) : (
                <>
                {Array.from({ length: firstDay }, (_, i) => (
                  <div key={`empty-${i}`} className={isFullscreen ? 'min-h-[80px]' : 'min-h-[60px]'} />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1
                  const dayEvents = getEventsForDate(day)
                  const dateStr = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const isToday = dateStr === new Date().toISOString().split('T')[0]
                  return (
                    <div
                      key={day}
                      onClick={() => openDayDetail(dateStr)}
                      onDragOver={(e) => { e.preventDefault(); if (draggingEvent) e.dataTransfer.dropEffect = 'move' }}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (draggingEvent) {
                          handleMoveEvent(draggingEvent, dateStr)
                          setDraggingEvent(null)
                        }
                      }}
                      className={`${isFullscreen ? 'min-h-[80px]' : 'min-h-[60px]'} p-1 rounded-lg border cursor-pointer hover:border-slate-600 transition ${
                        isToday ? 'border-red-500 bg-red-500/10' : 'border-slate-800 bg-slate-800/30'
                      } ${draggingEvent ? 'ring-1 ring-red-500/50' : ''}`}
                    >
                      <span className="text-slate-300">{day}</span>
                      <div className="mt-0.5 space-y-0.5">
                        {dayEvents.slice(0, 3).map((ev) => {
                          const typeStyle = getEventStyle(ev)
                          const timeStr = formatTime(ev.time || (ev as any).scheduledTime)
                          const canDrag = ev.type === 'label' || ev.type === 'personal' || ev.type === 'task'
                          const promoBadge = ev.type === 'label' && ev.promotionTarget && PROMOTION_BADGES[ev.promotionTarget]
                          return (
                            <div
                              key={ev.id}
                              draggable={canDrag}
                              onDragStart={(e) => { if (canDrag) { setDraggingEvent(ev); e.dataTransfer.setData('text/plain', ev.id); e.dataTransfer.effectAllowed = 'move' } }}
                              onDragEnd={() => setDraggingEvent(null)}
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedEvent(ev)
                              }}
                              onContextMenu={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setContextMenu({ x: e.clientX, y: e.clientY, event: ev })
                              }}
                              className={`text-[10px] flex items-center gap-1 px-1.5 py-1 rounded border-l-2 cursor-pointer hover:opacity-90 transition ${typeStyle.border} ${typeStyle.bg} ${draggingEvent?.id === ev.id ? 'opacity-50' : ''}`}
                              title={`${typeStyle.label}${promoBadge ? ` · ${promoBadge.label}` : ''} – ${ev.title}`}
                            >
                              <span className="text-slate-400 flex-shrink-0 font-mono">{timeStr}</span>
                              {promoBadge && <span className={`flex-shrink-0 px-1 rounded text-[9px] ${promoBadge.className}`}>{promoBadge.label}</span>}
                              <span className="flex-1 min-w-0 truncate text-slate-200">{ev.title}</span>
                            </div>
                          )
                        })}
                        {dayEvents.length > 3 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openDayDetail(dateStr) }}
                            className="text-xs text-slate-500 hover:text-slate-300 w-full text-left px-1"
                          >
                            +{dayEvents.length - 3} more
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
                </>
                )}
              </div>
            </div>

            {showStaffView && (
              <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-700">
                <h3 className="text-sm font-semibold text-white mb-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-red-400" />
                    AI Command
                  </span>
                  {aiPreview && (
                    <button
                      onClick={() => setAiPanelExpanded(true)}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
                      title="Open full view"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  )}
                </h3>
                <p className="text-slate-400 text-xs mb-2">e.g. &quot;add paris, od, 555 to the schedule have them post often give each their own label day&quot;</p>
                <div className="flex gap-2">
                  <input
                    value={aiCommand}
                    onChange={(e) => setAiCommand(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAiCommand()}
                    placeholder="Type your scheduling command..."
                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500"
                  />
                  <button onClick={() => handleAiCommand()} disabled={aiLoading || !aiCommand.trim()} className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg">
                    {aiLoading ? '…' : 'Parse'}
                  </button>
                </div>
                {aiPreview && (
                  <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700 space-y-3">
                    <p className="text-slate-300 text-sm">{aiPreview.interpretation}</p>
                    {aiPreview.conflicts?.length ? (
                      <div className="space-y-1">
                        {aiPreview.conflicts.map((c, i) => (
                          <p key={i} className="text-amber-400 text-xs flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> {c}
                          </p>
                        ))}
                      </div>
                    ) : null}
                    {aiPreview.suggestions?.length ? (
                      <div className="space-y-1">
                        {aiPreview.suggestions.slice(0, 3).map((s, i) => (
                          <p key={i} className="text-slate-400 text-xs">• {s}</p>
                        ))}
                      </div>
                    ) : null}
                    {(aiPreview.clarifications?.length ?? 0) > 0 && (
                      <div className="space-y-2">
                        <p className="text-amber-400 text-xs font-medium">AI has questions:</p>
                        <ul className="space-y-1">
                          {aiPreview.clarifications!.map((q, i) => (
                            <li key={i} className="text-slate-400 text-xs">• {q}</li>
                          ))}
                        </ul>
                        <p className="text-slate-500 text-[10px]">Type your reply below and click Reply to continue.</p>
                      </div>
                    )}
                    {aiPreview.actions && aiPreview.actions.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-slate-400 text-xs font-medium">Events to add (uncheck to exclude):</p>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {aiPreview.actions.map((a: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={aiSelectedActions.has(i)}
                                onChange={() => {
                                  setAiSelectedActions((s) => {
                                    const next = new Set(s)
                                    if (next.has(i)) next.delete(i)
                                    else next.add(i)
                                    return next
                                  })
                                }}
                                className="rounded border-slate-600 bg-slate-800 text-red-500"
                              />
                              <span className="flex-1 text-slate-300 truncate">{a.title} — {a.date}</span>
                              <button
                                onClick={() => setAiSelectedActions((s) => { const n = new Set(s); n.delete(i); return n })}
                                className="p-1 text-slate-500 hover:text-red-400"
                                title="Remove"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => handleApplyAiPreview()} disabled={aiLoading || aiSelectedActions.size === 0} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded text-sm">
                        Apply ({aiSelectedActions.size} events)
                      </button>
                      {(aiPreview.clarifications?.length ?? 0) > 0 && (
                        <button onClick={() => handleAiCommand(true)} disabled={aiLoading || !aiCommand.trim()} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm">
                          Reply &amp; Continue
                        </button>
                      )}
                      <button onClick={() => { setAiPreview(null); setAiConversation([]); setAiCommand('') }} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
              <h3 className="text-lg font-semibold text-white mb-4">Upcoming</h3>
              {upcomingEvents.length === 0 ? (
                <p className="text-slate-500 text-sm">No upcoming events. Click &quot;Add Event&quot; or a day to add one.</p>
              ) : (
                <div className="space-y-2">
                  {upcomingEvents.map((ev) => {
                    const typeStyle = getEventStyle(ev)
                    const promoBadge = ev.type === 'label' && ev.promotionTarget && PROMOTION_BADGES[ev.promotionTarget]
                    return (
                    <div
                      key={ev.id}
                      onClick={() => setSelectedEvent(ev)}
                      className={`flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border-l-2 border border-slate-700 hover:border-slate-600 cursor-pointer transition group ${typeStyle.border}`}
                    >
                      {ev.type === 'task' ? (
                        <CheckCircle className="w-5 h-5 text-blue-400 flex-shrink-0" />
                      ) : ev.type === 'release' ? (
                        <Music className="w-5 h-5 text-green-400 flex-shrink-0" />
                      ) : ev.type === 'content' ? (
                        <FileText className="w-5 h-5 text-purple-400 flex-shrink-0" />
                      ) : ev.type === 'label' ? (
                        <FileText className="w-5 h-5 text-pink-400 flex-shrink-0" />
                      ) : (
                        <Calendar className="w-5 h-5 text-amber-400 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] text-slate-500 uppercase">{typeStyle.label}</span>
                          {promoBadge && <span className={`text-[9px] px-1.5 py-0.5 rounded ${promoBadge.className}`}>{promoBadge.label}</span>}
                        </div>
                        <p className="text-white font-medium truncate">{ev.title}</p>
                        {ev.subtitle && <p className="text-slate-500 text-sm truncate">{ev.subtitle}</p>}
                      </div>
                      <span className="text-slate-400 text-sm flex-shrink-0">
                        {new Date(ev.date).toLocaleDateString('default', { month: 'short', day: 'numeric' })}{ev.time ? ` · ${ev.time}` : ''}
                      </span>
                      {ev.href && (
                        <Link href={ev.href} className="text-red-500 hover:text-red-400 text-sm flex-shrink-0">
                          View
                        </Link>
                      )}
                      {ev.canEdit && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button onClick={() => openEditModal(ev)} className="p-1.5 text-slate-400 hover:text-white rounded">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => setShowDeleteConfirm(ev)} className="p-1.5 text-red-400 hover:text-red-300 rounded">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                  })}
                </div>
              )}
            </div>

            {showStaffView && (
              <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Music className="w-5 h-5 text-green-400" />
                  Label Schedule
                </h3>
                {labelReleases.length === 0 ? (
                  <p className="text-slate-500 text-sm">No upcoming releases in the catalog.</p>
                ) : (
                  <div className="space-y-2">
                    {labelReleases.map((ev) => {
                      const songId = String(ev.id).replace('release_', '')
                      const rolloutCount = events.filter((e) => e.type === 'label' && (e as any).songId === songId).length
                      return (
                        <Link
                          key={ev.id}
                          href={ev.href || '#'}
                          className="flex flex-col gap-1 p-3 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-green-500/50 transition"
                        >
                          <div className="flex items-center gap-3">
                            <Music className="w-5 h-5 text-green-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-medium truncate">{ev.title}</p>
                              {ev.subtitle && <p className="text-slate-500 text-sm truncate">{ev.subtitle}</p>}
                            </div>
                            <span className="text-slate-400 text-sm flex-shrink-0">
                              {new Date(ev.date).toLocaleDateString()}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${
                              ev.status === 'approved' ? 'bg-green-500/30 text-green-400' :
                              ev.status === 'denied' ? 'bg-red-500/30 text-red-400' :
                              'bg-amber-500/30 text-amber-400'
                            }`}>
                              {ev.status || 'pending'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 ml-8">
                            <span className={`text-[10px] px-2 py-0.5 rounded ${
                              rolloutCount > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                            }`}>
                              {rolloutCount > 0 ? `Rollout: ${rolloutCount} post(s) scheduled` : 'No rollout yet'}
                            </span>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            </div>

            {!isFullscreen && (
            <div className="space-y-6">
              {showStaffView && (
                <>
                  <div className="bg-slate-900/50 rounded-xl p-4 border border-amber-500/30">
                    <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
                      <Lightbulb className="w-4 h-4" />
                      AI Suggestions
                    </h3>
                    {suggestions.length === 0 ? (
                      <p className="text-slate-500 text-xs">No suggestions. Schedule looks good.</p>
                    ) : (
                      <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                        {suggestions.slice(0, 8).map((s, i) => (
                          <li key={i} className="text-slate-400 text-xs">{s}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {needsAttention.length > 0 && (
                    <div className="bg-slate-900/50 rounded-xl p-4 border border-red-500/30">
                      <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Needs Attention
                      </h3>
                      <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                        {needsAttention.map((n, i) => (
                          <li key={i} className="text-slate-400 text-xs">{n}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
              <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
                <h3 className="text-sm font-semibold text-white mb-3">Quick Add</h3>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => openAddModal(undefined, 'Meeting')} className="px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs">+ Meeting</button>
                  <button onClick={() => openAddModal(undefined, 'Studio session')} className="px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs">+ Studio</button>
                  <button onClick={() => openAddModal(undefined, 'Content deadline')} className="px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs">+ Deadline</button>
                </div>
                {showStaffView && (
                  <>
                    <p className="text-xs text-slate-500 mt-3 mb-1.5">Social posts</p>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => openAddLabelModal(undefined, { promotionTarget: 'label_page', eventType: 'label_post' })} className="px-2 py-1.5 rounded bg-violet-800/50 hover:bg-violet-700/50 text-violet-300 text-xs">+ Label</button>
                      <button onClick={() => openAddLabelModal(undefined, { promotionTarget: 'artist_page', eventType: 'artist_post' })} className="px-2 py-1.5 rounded bg-fuchsia-800/50 hover:bg-fuchsia-700/50 text-fuchsia-300 text-xs">+ Artist</button>
                      <button onClick={() => openAddLabelModal(undefined, { promotionTarget: 'both', eventType: 'collab_post' })} className="px-2 py-1.5 rounded bg-pink-800/50 hover:bg-pink-700/50 text-pink-300 text-xs">+ Both</button>
                    </div>
                  </>
                )}
              </div>
            </div>
            )}
          </div>
        )}
      </div>

      {/* Add Event Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Add Event</h2>
              <button onClick={() => { setShowAddModal(false); setFormData({ title: '', date: '', time: '', description: '', remindMe: '' }) }} className="p-2 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Title *</label>
                <input
                  value={formData.title}
                  onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Event title"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Date *</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData((f) => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Time (optional)</label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData((f) => ({ ...f, time: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Description (optional)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Add details..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Remind me</label>
                <select
                  value={formData.remindMe}
                  onChange={(e) => setFormData((f) => ({ ...f, remindMe: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                >
                  <option value="">No reminder</option>
                  <option value="15min">15 minutes before</option>
                  <option value="1hr">1 hour before</option>
                  <option value="1day">1 day before</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => { setShowAddModal(false); setFormData({ title: '', date: '', time: '', description: '', remindMe: '' }) }} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg">
                  Cancel
                </button>
                <button onClick={handleAddEvent} disabled={!formData.title.trim() || !formData.date || isSaving} className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg">
                  {isSaving ? 'Adding…' : 'Add Event'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Label Event Modal - Smart prompts */}
      {showAddLabelModal && user && (
        <AddLabelEventModal
          userId={user.id}
          initialDate={addLabelDate}
          form={labelEventForm}
          setForm={setLabelEventForm}
          onClose={() => setShowAddLabelModal(false)}
          onSave={async () => {
            if (!labelEventForm.title.trim() || !labelEventForm.date) return
            setIsSaving(true)
            try {
              const res = await fetch('/api/label-calendar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  date: labelEventForm.date,
                  scheduledTime: labelEventForm.scheduledTime || undefined,
                  artistId: labelEventForm.artistId || undefined,
                  songId: labelEventForm.songId || undefined,
                  productType: labelEventForm.productType || undefined,
                  contentType: labelEventForm.contentType || undefined,
                  vaultVideoId: labelEventForm.vaultVideoId || undefined,
                  rolloutPhase: labelEventForm.rolloutPhase || undefined,
                  eventType: labelEventForm.eventType || 'artist_post',
                  promotionTarget: labelEventForm.promotionTarget || 'both',
                  title: labelEventForm.title,
                  createdBy: 'user',
                  userId: user?.id,
                }),
              })
              const data = await res.json()
              if (data.success) {
                setShowAddLabelModal(false)
                fetchCalendarData()
                if (dayDetail?.date === labelEventForm.date) {
                  const d = await fetch(`/api/calendar/day-detail?date=${dayDetail.date}`).then((r) => r.json())
                  if (d.success) setDayDetailData({ groups: d.groups, totalEvents: d.totalEvents, artistsActive: d.artistsActive })
                }
              }
            } finally {
              setIsSaving(false)
            }
          }}
          isSaving={isSaving}
        />
      )}

      {/* Edit Event Modal */}
      {editingEvent && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Edit Event</h2>
              <button onClick={() => { setEditingEvent(null); setFormData({ title: '', date: '', time: '', description: '', remindMe: '' }) }} className="p-2 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Title *</label>
                <input
                  value={formData.title}
                  onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Date *</label>
                  <input type="date" value={formData.date} onChange={(e) => setFormData((f) => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Time</label>
                  <input type="time" value={formData.time} onChange={(e) => setFormData((f) => ({ ...f, time: e.target.value }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))} rows={2} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Remind me</label>
                <select value={formData.remindMe} onChange={(e) => setFormData((f) => ({ ...f, remindMe: e.target.value }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white">
                  <option value="">No reminder</option>
                  <option value="15min">15 minutes before</option>
                  <option value="1hr">1 hour before</option>
                  <option value="1day">1 day before</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => { setEditingEvent(null) }} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg">Cancel</button>
                <button onClick={handleUpdateEvent} disabled={!formData.title.trim() || !formData.date || isSaving} className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg">
                  {isSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onEdit={selectedEvent.canEdit && selectedEvent.type === 'personal' ? () => { setSelectedEvent(null); openEditModal(selectedEvent) } : undefined}
          onDelete={selectedEvent.canEdit && selectedEvent.type === 'personal' ? () => { setSelectedEvent(null); setShowDeleteConfirm(selectedEvent) } : undefined}
          canEdit={!!(selectedEvent.canEdit && selectedEvent.type === 'personal')}
        />
      )}

      {/* Right-click context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-[55]" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-[56] bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button onClick={() => { setSelectedEvent(contextMenu.event); setContextMenu(null) }} className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700">
              Open
            </button>
            {contextMenu.event.canEdit && contextMenu.event.type === 'personal' && (
              <button onClick={() => { openEditModal(contextMenu.event); setContextMenu(null) }} className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700">
                Edit
              </button>
            )}
            <button onClick={() => { openDayDetail(contextMenu.event.date); setContextMenu(null) }} className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700">
              View Day
            </button>
            {(contextMenu.event.type === 'label' || contextMenu.event.type === 'personal' || contextMenu.event.type === 'task') && (
              <button
                onClick={() => {
                  const newDate = prompt('Move to date (YYYY-MM-DD):', contextMenu.event.date)
                  if (newDate && /^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
                    handleMoveEvent(contextMenu.event, newDate)
                  }
                  setContextMenu(null)
                }}
                className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700"
              >
                Move Date
              </button>
            )}
            {contextMenu.event.canEdit && contextMenu.event.type === 'personal' && (
              <button onClick={() => { setShowDeleteConfirm(contextMenu.event); setContextMenu(null) }} className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700">
                Delete
              </button>
            )}
          </div>
        </>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-white mb-2">Delete Event?</h3>
            <p className="text-slate-400 text-sm mb-4">Are you sure you want to delete &quot;{showDeleteConfirm.title}&quot;? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteConfirm(null)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg">
                Cancel
              </button>
              <button onClick={handleDeleteEvent} disabled={isSaving} className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg">
                {isSaving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscribe to Apple Calendar */}
      {showSubscribeModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowSubscribeModal(false)}>
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-red-500" />
              Subscribe in Apple Calendar
            </h3>
            <p className="text-slate-400 text-sm mb-4">
              Add your label calendar to Apple Calendar so releases, sessions, marketing drops, and deadlines sync to your Mac and iPhone.
            </p>
            <div className="flex gap-2 mb-4">
              <input
                readOnly
                value={typeof window !== 'undefined' ? `${window.location.origin}/calendar.ics` : '/calendar.ics'}
                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm font-mono"
              />
              <button
                onClick={() => {
                  const url = typeof window !== 'undefined' ? `${window.location.origin}/calendar.ics` : '/calendar.ics'
                  navigator.clipboard.writeText(url)
                  setFeedUrlCopied(true)
                  setTimeout(() => setFeedUrlCopied(false), 2000)
                }}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white flex items-center gap-2"
              >
                {feedUrlCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {feedUrlCopied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <ol className="text-slate-400 text-sm space-y-2 list-decimal list-inside mb-4">
              <li>Open <strong className="text-slate-300">Apple Calendar</strong> on your Mac</li>
              <li>Go to <strong className="text-slate-300">File → New Calendar Subscription</strong></li>
              <li>Paste the URL above and click Subscribe</li>
              <li>Set refresh to <strong className="text-slate-300">Every 5 minutes</strong></li>
            </ol>
            <p className="text-slate-500 text-xs mb-4">
              Includes: releases, label events, marketing drops, studio sessions, deadlines, tasks, and personal events.
            </p>
            <button onClick={() => setShowSubscribeModal(false)} className="w-full py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white">
              Done
            </button>
          </div>
        </div>
      )}

      {/* AI Command - Full expanded view */}
      {aiPanelExpanded && aiPreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 sm:p-6" onClick={() => setAiPanelExpanded(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-700 flex justify-between items-center flex-shrink-0">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Bot className="w-5 h-5 text-red-400" />
                AI Command — Full View
              </h3>
              <button onClick={() => setAiPanelExpanded(false)} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
                <Minimize2 className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <p className="text-slate-300 text-sm">{aiPreview.interpretation}</p>
              {aiPreview.conflicts?.length ? (
                <div className="space-y-1">
                  {aiPreview.conflicts.map((c, i) => (
                    <p key={i} className="text-amber-400 text-xs flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> {c}
                    </p>
                  ))}
                </div>
              ) : null}
              {aiPreview.suggestions?.length ? (
                <div className="space-y-1">
                  {aiPreview.suggestions.map((s, i) => (
                    <p key={i} className="text-slate-400 text-xs">• {s}</p>
                  ))}
                </div>
              ) : null}
              {(aiPreview.clarifications?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <p className="text-amber-400 text-xs font-medium">AI has questions:</p>
                  <ul className="space-y-1">
                    {aiPreview.clarifications!.map((q, i) => (
                      <li key={i} className="text-slate-400 text-xs">• {q}</li>
                    ))}
                  </ul>
                  <p className="text-slate-500 text-[10px]">Type your reply below and click Reply to continue.</p>
                  <div className="flex gap-2 pt-2">
                    <input
                      value={aiCommand}
                      onChange={(e) => setAiCommand(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAiCommand(true)}
                      placeholder="Type your reply..."
                      className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm"
                    />
                    <button onClick={() => handleAiCommand(true)} disabled={aiLoading || !aiCommand.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm">
                      {aiLoading ? '…' : 'Reply &amp; Continue'}
                    </button>
                  </div>
                </div>
              )}
              {aiPreview.actions && aiPreview.actions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-slate-400 text-xs font-medium">Events to add (uncheck to exclude):</p>
                  <div className="space-y-1.5 max-h-96 overflow-y-auto">
                    {aiPreview.actions.map((a: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={aiSelectedActions.has(i)}
                          onChange={() => {
                            setAiSelectedActions((s) => {
                              const next = new Set(s)
                              if (next.has(i)) next.delete(i)
                              else next.add(i)
                              return next
                            })
                          }}
                          className="rounded border-slate-600 bg-slate-800 text-red-500"
                        />
                        <span className="flex-1 text-slate-300">{a.title} — {a.date}</span>
                        <button
                          onClick={() => setAiSelectedActions((s) => { const n = new Set(s); n.delete(i); return n })}
                          className="p-1 text-slate-500 hover:text-red-400"
                          title="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-700 flex flex-wrap gap-2 flex-shrink-0">
              <button onClick={() => { handleApplyAiPreview(); setAiPanelExpanded(false); }} disabled={aiLoading || aiSelectedActions.size === 0} className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg text-sm">
                Apply ({aiSelectedActions.size} events)
              </button>
              <button onClick={() => setAiPanelExpanded(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Detail Panel (Day Drawer) - Vertical expansion, time spine */}
      {dayDetail && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setDayDetail(null)}>
          <div className="flex-1 bg-black/60" />
          <div
            className="w-full max-w-md bg-slate-900 border-l border-slate-700 overflow-y-auto shadow-2xl flex"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Vertical time spine */}
            <div className="w-10 flex-shrink-0 border-r border-slate-700/60 flex flex-col items-center py-4">
              <div className="w-px flex-1 min-h-[40px] bg-gradient-to-b from-transparent via-slate-600/40 to-transparent" />
              {['12a', '6a', '12p', '6p'].map((t) => (
                <div key={t} className="text-[9px] text-slate-600 font-mono py-0.5">{t}</div>
              ))}
              <div className="w-px flex-1 min-h-[40px] bg-gradient-to-b from-transparent via-slate-600/40 to-transparent" />
            </div>
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex-shrink-0">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {new Date(dayDetail.date + 'T12:00:00').toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </h3>
                  <div className="flex gap-4 mt-1 text-sm text-slate-400">
                    <span>Total Events: {dayDetail.events.length}</span>
                    {(dayDetailData?.artistsActive ?? 0) > 0 && (
                      <span>Artists Active: {dayDetailData?.artistsActive}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { (showStaffView ? openAddLabelModal : openAddModal)(dayDetail.date); if (!showStaffView) setDayDetail(null) }} className="p-2 bg-red-600 hover:bg-red-700 rounded-lg">
                    <Plus className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDayDetail(null)} className="p-2 text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {/* Tab toggle */}
              <div className="flex gap-1 mt-3 p-1 bg-slate-800/60 rounded-lg">
                {(['overview', 'timeline', 'analytics'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setDrawerTab(tab)}
                    className={`flex-1 py-1.5 rounded text-xs font-medium capitalize transition ${
                      drawerTab === tab ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4 space-y-6 overflow-y-auto flex-1">
              {dayDetail.events.length === 0 ? (
                <p className="text-slate-500 text-sm">No events. Click + to add.</p>
              ) : (
                <>
                  {drawerTab === 'overview' && (
                    <>
                      {/* Campaign blocks by artist - collapsible */}
                      {dayDetailLoading ? (
                        <p className="text-slate-500 text-sm">Loading campaign details…</p>
                      ) : dayDetailData?.groups && dayDetailData.groups.length > 0 ? (
                        dayDetailData.groups.map((group, idx) => {
                          const artistColors = [
                            { text: 'text-violet-400', bg: 'bg-violet-500/8', border: 'border-l-violet-500' },
                            { text: 'text-blue-400', bg: 'bg-blue-500/8', border: 'border-l-blue-500' },
                            { text: 'text-emerald-400', bg: 'bg-emerald-500/8', border: 'border-l-emerald-500' },
                            { text: 'text-amber-400', bg: 'bg-amber-500/8', border: 'border-l-amber-500' },
                            { text: 'text-rose-400', bg: 'bg-rose-500/8', border: 'border-l-rose-500' },
                          ]
                          const c = artistColors[idx % artistColors.length]
                          const isCollapsed = collapsedArtists.has(group.artistName)
                          const statusBadge = (group as any).campaignStatus === 'on_track'
                            ? { label: 'On Track', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' }
                            : (group as any).campaignStatus === 'needs_content'
                              ? { label: 'Needs Content', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/40' }
                              : { label: 'Missing Assets', cls: 'bg-red-500/20 text-red-400 border-red-500/40' }
                          return (
                            <div key={group.artistName} className={`rounded-xl border border-slate-700 overflow-hidden ${c.bg}`}>
                              <div
                                className={`px-4 py-2.5 font-bold ${c.text} border-b border-slate-700/80 flex items-center justify-between cursor-pointer`}
                                onClick={() => setCollapsedArtists((s) => {
                                  const next = new Set(s)
                                  if (next.has(group.artistName)) next.delete(group.artistName)
                                  else next.add(group.artistName)
                                  return next
                                })}
                              >
                                <span>{group.artistName.toUpperCase()}</span>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${statusBadge.cls}`}>
                                    {statusBadge.label}
                                  </span>
                                  {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                                </div>
                              </div>
                              {!isCollapsed && (
                                <div className="p-4 space-y-3">
                                  {(group as any).upcomingMilestones?.length > 0 && (
                                    <div className="mb-3 pb-3 border-b border-slate-700/60">
                                      <p className="text-slate-500 text-[10px] font-medium uppercase tracking-wider mb-1.5">Upcoming Milestones</p>
                                      <ul className="space-y-1">
                                        {(group as any).upcomingMilestones.map((m: any, i: number) => (
                                          <li key={i} className="flex items-center gap-2 text-slate-400 text-xs">
                                            {m.type === 'drop' ? <Music className="w-3 h-3 text-slate-500" /> : <Mic className="w-3 h-3 text-slate-500" />}
                                            {m.type === 'drop' ? 'Drop' : 'Show'} – {m.label}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {group.events.map((ev) => {
                                    const isEvExpanded = expandedEvents.has(ev.id)
                                    const contentType = (ev as any).contentType || (ev.productType?.toLowerCase().includes('reel') ? 'Reel' : ev.productType || 'Post')
                                    const phase = (ev as any).rolloutPhase ? String((ev as any).rolloutPhase).replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : null
                                    return (
                                      <div
                                        key={ev.id}
                                        onClick={() => setExpandedEvents((s) => {
                                          const next = new Set(s)
                                          if (next.has(ev.id)) next.delete(ev.id)
                                          else next.add(ev.id)
                                          return next
                                        })}
                                        className={`rounded-lg border-l-4 ${c.border} bg-slate-900/60 cursor-pointer transition-all ${isEvExpanded ? 'p-3' : 'p-2'}`}
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-slate-500 text-xs font-mono flex-shrink-0">{ev.scheduledTime || '—'}</span>
                                            <span className="text-slate-400">—</span>
                                            <span className="text-white text-sm font-medium truncate">{contentType}</span>
                                          </div>
                                          {isEvExpanded ? <ChevronUp className="w-4 h-4 text-slate-500 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />}
                                        </div>
                                        {isEvExpanded && (
                                          <div className="mt-3 pt-3 border-t border-slate-700/60 space-y-2 text-sm">
                                            <p className="text-slate-400">Song: {ev.songTitle || 'N/A'}</p>
                                            {phase && <p className="text-slate-400">Campaign Phase: {phase}</p>}
                                            <div className="flex items-center gap-2">
                                              <Video className="w-3.5 h-3.5 text-slate-500" />
                                              {ev.vaultVideo ? (
                                                <span className="text-emerald-400">Attached (Vault #{ev.vaultVideo.id.slice(-6)})</span>
                                              ) : ev.hasVideo ? (
                                                <span className="text-emerald-400">Vault Connected</span>
                                              ) : (
                                                <span className="text-amber-500 flex items-center gap-1">Missing <AlertTriangle className="w-3 h-3" /></span>
                                              )}
                                            </div>
                                            {ev.vaultVideo && (
                                              <a href={ev.vaultVideo.videoUrl} target="_blank" rel="noopener noreferrer" className="text-red-400 text-xs hover:underline">{ev.vaultVideo.title}</a>
                                            )}
                                            {(ev.linkedMediaUrl || ev.linkedDriveUrl || ev.linkedSnippetUrl) && !ev.vaultVideo && (
                                              <a href={ev.linkedMediaUrl || ev.linkedDriveUrl || ev.linkedSnippetUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-red-400 hover:underline text-xs">View media</a>
                                            )}
                                            {showStaffView && !ev.hasVideo && !ev.vaultVideo && (
                                              <button onClick={(e) => { e.stopPropagation(); setVaultModalForEvent({ eventId: ev.id, artistName: group.artistName }) }} className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300">
                                                Select from Vault
                                              </button>
                                            )}
                                            <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-1">
                                              <div><span className="text-slate-500">IG:</span> {ev.igViews ? ev.igViews.toLocaleString() : '—'}</div>
                                              <div><span className="text-slate-500">TikTok:</span> {ev.tiktokViews ? ev.tiktokViews.toLocaleString() : '—'}</div>
                                              <div><span className="text-slate-500">YT:</span> {ev.youtubeViews ? ev.youtubeViews.toLocaleString() : '—'}</div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })
                      ) : null}

                      {/* Other events */}
                      {(() => {
                        const hasCampaignBlocks = dayDetailData?.groups && dayDetailData.groups.length > 0
                        const otherEvents = hasCampaignBlocks ? dayDetail.events.filter((e) => e.type !== 'label') : dayDetail.events
                        if (otherEvents.length === 0) return null
                        return (
                          <div className="rounded-xl bg-slate-800/40 border border-slate-700">
                            <div className="px-4 py-2.5 font-semibold text-slate-400 bg-slate-800/60 border-b border-slate-700">
                              {hasCampaignBlocks ? 'Other' : 'Events'}
                            </div>
                            <div className="p-4 space-y-3">
                              {otherEvents.map((ev) => {
                                const isPastRelease = ev.type === 'release' && ev.date < new Date().toISOString().split('T')[0]
                                return (
                                  <div key={ev.id} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                                    <div className="flex items-start gap-2">
                                      {ev.type === 'task' ? <CheckCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" /> :
                                        ev.type === 'release' ? <Music className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" /> :
                                        ev.type === 'label' ? <FileText className="w-4 h-4 text-pink-400 mt-0.5 flex-shrink-0" /> :
                                        <Calendar className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />}
                                      <div className="flex-1 min-w-0">
                                        {isPastRelease && (
                                          <span className="inline-block px-2 py-0.5 rounded text-xs bg-amber-500/30 text-amber-400 border border-amber-500/50 mb-1">Campaign Completed</span>
                                        )}
                                        <p className="text-white font-medium">{ev.title}</p>
                                        {ev.subtitle && <p className="text-slate-500 text-sm">{ev.subtitle}</p>}
                                        {(ev as any).songTitle && <p className="text-slate-400 text-xs">Song: {(ev as any).songTitle}</p>}
                                        {((ev as any).linkedMediaUrl || (ev as any).linkedDriveUrl) && (
                                          <a href={(ev as any).linkedMediaUrl || (ev as any).linkedDriveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-red-400 text-xs mt-1 hover:underline">
                                            <Video className="w-3 h-3" /> Media
                                          </a>
                                        )}
                                        {ev.time && <p className="text-slate-500 text-xs">Scheduled: {ev.time}</p>}
                                        {ev.href && (
                                          <Link href={ev.href} className="inline-flex items-center gap-1 text-red-400 text-xs mt-1 hover:underline">
                                            <LinkIcon className="w-3 h-3" /> {isPastRelease ? 'View Results' : 'View'}
                                          </Link>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })()}
                    </>
                  )}

                  {drawerTab === 'timeline' && (
                    <div className="space-y-2">
                      <p className="text-slate-500 text-sm mb-4">Vertical hour breakdown for {dayDetail.date}</p>
                      {(() => {
                        const allEvents = dayDetailData?.groups?.flatMap((g) => g.events.map((e: any) => ({ ...e, artistName: g.artistName }))) || []
                        const withTime = allEvents.filter((e: any) => e.scheduledTime).sort((a: any, b: any) => (a.scheduledTime || '').localeCompare(b.scheduledTime || ''))
                        const noTime = allEvents.filter((e: any) => !e.scheduledTime)
                        return (
                          <div className="space-y-1">
                            {noTime.length > 0 && (
                              <div className="py-2 border-b border-slate-700/50">
                                <span className="text-slate-500 text-xs">No time set</span>
                                <div className="mt-1 space-y-1">
                                  {noTime.map((e: any) => (
                                    <div key={e.id} className="text-slate-300 text-sm flex justify-between">
                                      <span>{e.title}</span>
                                      <span className="text-slate-500 text-xs">{e.artistName}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {withTime.map((e: any) => (
                              <div key={e.id} className="flex gap-3 py-2 border-b border-slate-700/50">
                                <span className="text-slate-500 text-xs w-14 flex-shrink-0 font-mono">{e.scheduledTime}</span>
                                <div className="flex-1">
                                  <p className="text-white text-sm">{e.title}</p>
                                  <p className="text-slate-500 text-xs">{e.artistName}</p>
                                </div>
                              </div>
                            ))}
                            {allEvents.length === 0 && <p className="text-slate-500 text-sm">No campaign events for this day.</p>}
                          </div>
                        )
                      })()}
                    </div>
                  )}

                  {drawerTab === 'analytics' && (
                    <div className="space-y-4">
                      <p className="text-slate-500 text-sm">Performance comparison for the day</p>
                      {dayDetailData?.groups && dayDetailData.groups.length > 0 ? (
                        <div className="space-y-3">
                          {dayDetailData.groups.map((g) => {
                            const totalIg = g.events.reduce((s: number, e: any) => s + (e.igViews || 0), 0)
                            const totalTt = g.events.reduce((s: number, e: any) => s + (e.tiktokViews || 0), 0)
                            const totalYt = g.events.reduce((s: number, e: any) => s + (e.youtubeViews || 0), 0)
                            return (
                              <div key={g.artistName} className="p-3 rounded-lg bg-slate-800/60 border border-slate-700">
                                <p className="font-semibold text-white mb-2">{g.artistName}</p>
                                <div className="grid grid-cols-3 gap-2 text-sm">
                                  <div><span className="text-slate-500">IG</span> {totalIg.toLocaleString()}</div>
                                  <div><span className="text-slate-500">TikTok</span> {totalTt.toLocaleString()}</div>
                                  <div><span className="text-slate-500">YouTube</span> {totalYt.toLocaleString()}</div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-slate-500 text-sm">No campaign data for this day.</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Video Vault Select Modal */}
      {vaultModalForEvent && (
        <VaultSelectModal
          eventId={vaultModalForEvent.eventId}
          onSelect={async (videoId) => {
            try {
              const res = await fetch('/api/label-calendar', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: vaultModalForEvent.eventId, vaultVideoId: videoId }),
              })
              if (res.ok) {
                setVaultModalForEvent(null)
                if (dayDetail?.date) {
                  const d = await fetch(`/api/calendar/day-detail?date=${dayDetail.date}`).then((r) => r.json())
                  if (d.success) setDayDetailData({ groups: d.groups, totalEvents: d.totalEvents, artistsActive: d.artistsActive })
                }
                fetchCalendarData()
              }
            } catch (e) { console.error(e) }
          }}
          onClose={() => setVaultModalForEvent(null)}
        />
      )}
    </div>
  )
}

function AddLabelEventModal({
  userId,
  initialDate,
  form,
  setForm,
  onClose,
  onSave,
  isSaving,
}: {
  userId: string
  initialDate: string
  form: {
    artistId: string
    songId: string
    productType: string
    contentType: string
    vaultVideoId: string
    rolloutPhase: string
    platform: string
    title: string
    date: string
    scheduledTime: string
    eventType: string
    promotionTarget: 'artist_page' | 'label_page' | 'both'
  }
  setForm: React.Dispatch<React.SetStateAction<typeof form>>
  onClose: () => void
  onSave: () => void | Promise<void>
  isSaving: boolean
}) {
  const [artists, setArtists] = useState<{ id: string; artistName?: string; name?: string }[]>([])
  const [catalog, setCatalog] = useState<{ id: string; song: string; artist: string; releaseType?: string }[]>([])
  const [vaultItems, setVaultItems] = useState<{ id: string; title: string }[]>([])
  const [showVaultSelect, setShowVaultSelect] = useState(false)

  useEffect(() => {
    setForm((f) => ({ ...f, date: initialDate }))
  }, [initialDate, setForm])

  useEffect(() => {
    Promise.all([
      fetch('/api/users').then((r) => r.json()),
      fetch(`/api/catalog?userId=${encodeURIComponent(userId)}&includeArchived=true`).then((r) => r.json()),
      fetch('/api/video-vault').then((r) => r.json()),
    ]).then(([u, c, v]) => {
      if (u.users) setArtists(u.users.filter((x: any) => x.role === 'artist'))
      if (c.success && c.catalog) setCatalog(c.catalog)
      if (v.success && v.items) setVaultItems(v.items)
    })
  }, [userId])

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-900">
          <h2 className="text-xl font-bold text-white">Add Label Event</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-slate-400 text-sm">What product is this promoting? Do we have a video? Which platform?</p>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Title *</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Daily Post for Paris"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Time</label>
              <input
                type="time"
                value={form.scheduledTime}
                onChange={(e) => setForm((f) => ({ ...f, scheduledTime: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Artist</label>
            <select
              value={form.artistId}
              onChange={(e) => setForm((f) => ({ ...f, artistId: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
            >
              <option value="">Select artist</option>
              {artists.map((a) => (
                <option key={a.id} value={a.id}>{a.artistName || a.name || a.id}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Product Type</label>
            <select
              value={form.productType}
              onChange={(e) => setForm((f) => ({ ...f, productType: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
            >
              <option value="">Select type</option>
              <option value="single">Single</option>
              <option value="ep">EP</option>
              <option value="album">Album</option>
              <option value="merch">Merch</option>
              <option value="general_post">General Post</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Product from Catalog (optional)</label>
            <select
              value={form.songId}
              onChange={(e) => setForm((f) => ({ ...f, songId: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
            >
              <option value="">None</option>
              {catalog.map((s) => (
                <option key={s.id} value={s.id}>{s.song} – {s.artist}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Content Type</label>
            <select
              value={form.contentType}
              onChange={(e) => setForm((f) => ({ ...f, contentType: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
            >
              <option value="">Select</option>
              <option value="reel">Reel</option>
              <option value="post">Post</option>
              <option value="story">Story</option>
              <option value="carousel">Carousel</option>
              <option value="video">Video</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Attach video from vault?</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowVaultSelect(true)}
                className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700"
              >
                {form.vaultVideoId ? vaultItems.find((v) => v.id === form.vaultVideoId)?.title || 'Selected' : 'Select from Vault'}
              </button>
              {form.vaultVideoId && (
                <button type="button" onClick={() => setForm((f) => ({ ...f, vaultVideoId: '' }))} className="px-3 py-2 rounded-lg bg-red-900/30 text-red-400 text-sm">Clear</button>
              )}
            </div>
            {!form.vaultVideoId && <p className="text-amber-500 text-xs mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> No video attached</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Platform</label>
            <select
              value={form.platform}
              onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
            >
              <option value="">Select</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="youtube">YouTube</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Rollout Phase</label>
            <select
              value={form.rolloutPhase}
              onChange={(e) => setForm((f) => ({ ...f, rolloutPhase: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
            >
              <option value="">Select</option>
              <option value="tease">Tease</option>
              <option value="build">Build</option>
              <option value="drop">Drop</option>
              <option value="post_drop">Post-drop</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Where to post</label>
            <div className="flex gap-2">
              {[
                { value: 'label_page' as const, label: 'Label', className: 'bg-violet-800/50 hover:bg-violet-700/50 text-violet-300 border-violet-600' },
                { value: 'artist_page' as const, label: 'Artist', className: 'bg-fuchsia-800/50 hover:bg-fuchsia-700/50 text-fuchsia-300 border-fuchsia-600' },
                { value: 'both' as const, label: 'Both', className: 'bg-pink-800/50 hover:bg-pink-700/50 text-pink-300 border-pink-600' },
              ].map(({ value, label, className }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, promotionTarget: value }))}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition ${form.promotionTarget === value ? className : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-slate-500 text-xs mt-1">Label = LFR pages · Artist = artist accounts · Both = collab</p>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg">Cancel</button>
            <button onClick={onSave} disabled={!form.title.trim() || !form.date || isSaving} className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg">
              {isSaving ? 'Adding…' : 'Add Label Event'}
            </button>
          </div>
        </div>
      </div>
      {showVaultSelect && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4" onClick={() => setShowVaultSelect(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-sm w-full max-h-80 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-800">
              <h3 className="font-bold text-white">Select Video</h3>
            </div>
            <div className="p-4 space-y-2">
              {vaultItems.map((v) => (
                <button
                  key={v.id}
                  onClick={() => { setForm((f) => ({ ...f, vaultVideoId: v.id })); setShowVaultSelect(false) }}
                  className="w-full text-left p-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700"
                >
                  {v.title}
                </button>
              ))}
              {vaultItems.length === 0 && <p className="text-slate-500 text-sm">No videos in vault.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function VaultSelectModal({ eventId, onSelect, onClose }: { eventId: string; onSelect: (videoId: string) => void | Promise<void>; onClose: () => void }) {
  const [items, setItems] = useState<{ id: string; title: string; videoUrl: string; platform?: string }[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch('/api/video-vault')
      .then((r) => r.json())
      .then((d) => { if (d.success) setItems(d.items || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h3 className="text-lg font-bold text-white">Attach Video from Vault</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 overflow-y-auto max-h-96">
          {loading ? (
            <p className="text-slate-500 text-sm">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-slate-500 text-sm">No videos in vault. Add videos in Vault → Videos first.</p>
          ) : (
            <div className="space-y-2">
              {items.map((v) => (
                <button
                  key={v.id}
                  onClick={() => onSelect(v.id)}
                  className="w-full text-left p-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center gap-3"
                >
                  <Video className="w-5 h-5 text-slate-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{v.title}</p>
                    {v.platform && <p className="text-slate-500 text-xs">{v.platform}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
