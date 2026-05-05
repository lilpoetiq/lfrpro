'use client'

import { useState, useEffect } from 'react'
import {
  CheckCircle,
  Calendar,
  TrendingUp,
  Video,
  Link as LinkIcon,
  Edit,
  Save,
  X,
  Plus,
  BarChart3,
  Lightbulb,
  ExternalLink,
} from 'lucide-react'

const CAMPAIGN_STEPS = [
  { key: 'announcement', label: 'Announcement post', order: 0 },
  { key: 'snippet', label: 'Snippet drop', order: 1 },
  { key: 'release', label: 'Release day', order: 2 },
  { key: '48hr_push', label: '48hr push', order: 3 },
  { key: 'week1_recap', label: 'Week 1 recap', order: 4 },
  { key: 'music_video', label: 'Music video drop', order: 5 },
  { key: 'playlist_push', label: 'Playlist push', order: 6 },
]

const STATUS_COLORS: Record<string, string> = {
  upcoming: 'bg-blue-500/30 text-blue-400 border-blue-500/50',
  active: 'bg-green-500/30 text-green-400 border-green-500/50',
  completed: 'bg-amber-500/30 text-amber-400 border-amber-500/50',
  archived: 'bg-slate-500/30 text-slate-400 border-slate-500/50',
}

interface CatalogItem {
  id: string
  song: string
  artist: string
  releaseDate?: string
  releaseDateRequested?: string
  albumCover?: string
  totalStreams?: number
  campaignStatus?: string
  campaignEndDate?: string
  performanceMetrics?: {
    week1Streams?: number
    month1Streams?: number
    totalStreams?: number
    engagementPercent?: number
    topPerformingContent?: string
    bestPostingDay?: string
    highestPerformingPlatform?: string
  }
  campaignWins?: string
  pastContentLinks?: Array<{
    id: string
    url: string
    platform?: string
    date?: string
    notes?: string
  }>
}

interface TimelineEvent {
  id: string
  date: string
  title: string
  eventType: string
  campaignStep?: string
  linkedMediaUrl?: string
  linkedSnippetUrl?: string
  linkedDriveUrl?: string
  notes?: string
  status?: string
}

interface SongCampaignSectionProps {
  song: CatalogItem
  songId: string
  canEdit: boolean
  userId: string
  onRefresh: () => void
}

export default function SongCampaignSection({
  song,
  songId,
  canEdit,
  userId,
  onRefresh,
}: SongCampaignSectionProps) {
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([])
  const [editingWins, setEditingWins] = useState(false)
  const [winsText, setWinsText] = useState(song.campaignWins || '')
  const [editingMetrics, setEditingMetrics] = useState(false)
  const [metricsForm, setMetricsForm] = useState({
    week1Streams: song.performanceMetrics?.week1Streams ?? '',
    month1Streams: song.performanceMetrics?.month1Streams ?? '',
    totalStreams: song.performanceMetrics?.totalStreams ?? song.totalStreams ?? '',
    engagementPercent: song.performanceMetrics?.engagementPercent ?? '',
    topPerformingContent: song.performanceMetrics?.topPerformingContent ?? '',
    bestPostingDay: song.performanceMetrics?.bestPostingDay ?? '',
    highestPerformingPlatform: song.performanceMetrics?.highestPerformingPlatform ?? '',
  })
  const [isSaving, setIsSaving] = useState(false)

  const status = song.campaignStatus || 'upcoming'
  const isPast = song.releaseDate && new Date(song.releaseDate) <= new Date()
  const isCompleted = status === 'completed' || status === 'archived'

  useEffect(() => {
    fetch(`/api/label-calendar?songId=${encodeURIComponent(songId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.events) {
          setTimelineEvents(d.events)
        }
      })
      .catch(() => {})
  }, [songId])

  useEffect(() => {
    setWinsText(song.campaignWins || '')
    setMetricsForm({
      week1Streams: song.performanceMetrics?.week1Streams ?? '',
      month1Streams: song.performanceMetrics?.month1Streams ?? '',
      totalStreams: song.performanceMetrics?.totalStreams ?? song.totalStreams ?? '',
      engagementPercent: song.performanceMetrics?.engagementPercent ?? '',
      topPerformingContent: song.performanceMetrics?.topPerformingContent ?? '',
      bestPostingDay: song.performanceMetrics?.bestPostingDay ?? '',
      highestPerformingPlatform: song.performanceMetrics?.highestPerformingPlatform ?? '',
    })
  }, [song])

  const buildTimeline = () => {
    const byStep: Record<string, TimelineEvent[]> = {}
    timelineEvents.forEach((e) => {
      const step = e.campaignStep || e.eventType || 'other'
      if (!byStep[step]) byStep[step] = []
      byStep[step].push(e)
    })
    const ordered: { step: typeof CAMPAIGN_STEPS[0]; events: TimelineEvent[] }[] = []
    CAMPAIGN_STEPS.forEach((s) => {
      const events = byStep[s.key] || []
      if (events.length > 0) {
        ordered.push({ step: s, events: events.sort((a, b) => a.date.localeCompare(b.date)) })
      }
    })
    const otherEvents = timelineEvents.filter((e) => !CAMPAIGN_STEPS.some((s) => s.key === (e.campaignStep || e.eventType)))
    if (otherEvents.length > 0) {
      ordered.push({
        step: { key: 'other', label: 'Other', order: 99 },
        events: otherEvents.sort((a, b) => a.date.localeCompare(b.date)),
      })
    }
    return ordered.sort((a, b) => a.step.order - b.step.order)
  }

  const handleSaveWins = async () => {
    if (!canEdit) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/catalog/${songId}/campaign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          campaignWins: winsText.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setEditingWins(false)
        onRefresh()
      } else {
        alert(data.error || 'Failed to save')
      }
    } catch (e) {
      alert('Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveMetrics = async () => {
    if (!canEdit) return
    setIsSaving(true)
    try {
      const performanceMetrics = {
        week1Streams: metricsForm.week1Streams ? Number(metricsForm.week1Streams) : undefined,
        month1Streams: metricsForm.month1Streams ? Number(metricsForm.month1Streams) : undefined,
        totalStreams: metricsForm.totalStreams ? Number(metricsForm.totalStreams) : undefined,
        engagementPercent: metricsForm.engagementPercent ? Number(metricsForm.engagementPercent) : undefined,
        topPerformingContent: metricsForm.topPerformingContent.trim() || undefined,
        bestPostingDay: metricsForm.bestPostingDay.trim() || undefined,
        highestPerformingPlatform: metricsForm.highestPerformingPlatform.trim() || undefined,
      }
      const res = await fetch(`/api/catalog/${songId}/campaign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          performanceMetrics,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setEditingMetrics(false)
        onRefresh()
      } else {
        alert(data.error || 'Failed to save')
      }
    } catch (e) {
      alert('Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  const timeline = buildTimeline()

  return (
    <div className="space-y-6">
      {/* Section 1 — Overview */}
      <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
        <h3 className="text-lg font-semibold text-white mb-4">Campaign Overview</h3>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            {song.albumCover && (
              <img
                src={song.albumCover.startsWith('http') || song.albumCover.startsWith('//') ? song.albumCover : `${typeof window !== 'undefined' ? window.location.origin : ''}${song.albumCover.startsWith('/') ? song.albumCover : '/' + song.albumCover}`}
                alt="Cover"
                className="w-16 h-16 rounded-lg object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            )}
            <div>
              <p className="text-white font-medium">{song.song}</p>
              <p className="text-slate-400 text-sm">{song.artist}</p>
              {song.releaseDate && (
                <p className="text-slate-500 text-xs mt-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Release: {new Date(song.releaseDate).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[status] || STATUS_COLORS.upcoming}`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
          {isCompleted && song.campaignEndDate && (
            <span className="text-slate-500 text-sm">
              Campaign ended: {new Date(song.campaignEndDate).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {/* Section 2 — Campaign Timeline */}
      <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
        <h3 className="text-lg font-semibold text-white mb-4">Campaign Timeline</h3>
        {timeline.length === 0 ? (
          <p className="text-slate-500 text-sm">No campaign events linked yet. Add events from the calendar.</p>
        ) : (
          <div className="relative pl-6 border-l border-slate-700 space-y-4">
            {timeline.map(({ step, events }) =>
              events.map((ev) => (
                <div key={ev.id} className="relative -ml-6">
                  <div className="absolute left-0 w-3 h-3 rounded-full bg-red-500 -translate-x-[5px] mt-1.5" />
                  <div className="pl-4 pb-4">
                    <p className="text-white font-medium text-sm">{step.label}</p>
                    <p className="text-slate-500 text-xs">
                      {ev.date} {ev.title && `· ${ev.title}`}
                    </p>
                    {ev.notes && <p className="text-slate-400 text-xs mt-1">{ev.notes}</p>}
                    {(ev.linkedMediaUrl || ev.linkedSnippetUrl || ev.linkedDriveUrl) && (
                      <a
                        href={ev.linkedMediaUrl || ev.linkedSnippetUrl || ev.linkedDriveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-red-400 text-xs mt-1 hover:underline"
                      >
                        <Video className="w-3 h-3" /> Media
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Section 3 — Performance Breakdown (for completed/active) */}
      {(isCompleted || status === 'active') && (
        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-red-400" />
            Performance Breakdown
          </h3>
          {editingMetrics && canEdit ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Week 1 streams</label>
                  <input
                    type="number"
                    value={metricsForm.week1Streams}
                    onChange={(e) => setMetricsForm((m) => ({ ...m, week1Streams: e.target.value }))}
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Month 1 streams</label>
                  <input
                    type="number"
                    value={metricsForm.month1Streams}
                    onChange={(e) => setMetricsForm((m) => ({ ...m, month1Streams: e.target.value }))}
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Total streams</label>
                  <input
                    type="number"
                    value={metricsForm.totalStreams}
                    onChange={(e) => setMetricsForm((m) => ({ ...m, totalStreams: e.target.value }))}
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Engagement %</label>
                  <input
                    type="number"
                    value={metricsForm.engagementPercent}
                    onChange={(e) => setMetricsForm((m) => ({ ...m, engagementPercent: e.target.value }))}
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Top performing content</label>
                <input
                  value={metricsForm.topPerformingContent}
                  onChange={(e) => setMetricsForm((m) => ({ ...m, topPerformingContent: e.target.value }))}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Best posting day</label>
                  <input
                    value={metricsForm.bestPostingDay}
                    onChange={(e) => setMetricsForm((m) => ({ ...m, bestPostingDay: e.target.value }))}
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Highest platform</label>
                  <input
                    value={metricsForm.highestPerformingPlatform}
                    onChange={(e) => setMetricsForm((m) => ({ ...m, highestPerformingPlatform: e.target.value }))}
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveMetrics}
                  disabled={isSaving}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm"
                >
                  <Save className="w-4 h-4" /> Save
                </button>
                <button onClick={() => setEditingMetrics(false)} className="px-3 py-1.5 bg-slate-700 rounded text-sm">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(song.performanceMetrics?.week1Streams ?? song.performanceMetrics?.totalStreams ?? song.totalStreams) && (
                  <div className="p-2 bg-slate-800/50 rounded">
                    <p className="text-slate-500 text-xs">Week 1</p>
                    <p className="text-white font-medium">
                      {(song.performanceMetrics?.week1Streams ?? song.performanceMetrics?.totalStreams ?? song.totalStreams)?.toLocaleString()}
                    </p>
                  </div>
                )}
                {song.performanceMetrics?.month1Streams && (
                  <div className="p-2 bg-slate-800/50 rounded">
                    <p className="text-slate-500 text-xs">Month 1</p>
                    <p className="text-white font-medium">{song.performanceMetrics.month1Streams.toLocaleString()}</p>
                  </div>
                )}
                {(song.performanceMetrics?.totalStreams ?? song.totalStreams) && (
                  <div className="p-2 bg-slate-800/50 rounded">
                    <p className="text-slate-500 text-xs">Total</p>
                    <p className="text-white font-medium">
                      {(song.performanceMetrics?.totalStreams ?? song.totalStreams)?.toLocaleString()}
                    </p>
                  </div>
                )}
                {song.performanceMetrics?.engagementPercent && (
                  <div className="p-2 bg-slate-800/50 rounded">
                    <p className="text-slate-500 text-xs">Engagement</p>
                    <p className="text-white font-medium">{song.performanceMetrics.engagementPercent}%</p>
                  </div>
                )}
              </div>
              {(song.performanceMetrics?.topPerformingContent ||
                song.performanceMetrics?.bestPostingDay ||
                song.performanceMetrics?.highestPerformingPlatform) && (
                <div className="text-slate-400 text-sm space-y-1">
                  {song.performanceMetrics.topPerformingContent && (
                    <p>Top content: {song.performanceMetrics.topPerformingContent}</p>
                  )}
                  {song.performanceMetrics.bestPostingDay && (
                    <p>Best day: {song.performanceMetrics.bestPostingDay}</p>
                  )}
                  {song.performanceMetrics.highestPerformingPlatform && (
                    <p>Best platform: {song.performanceMetrics.highestPerformingPlatform}</p>
                  )}
                </div>
              )}
              {canEdit && (
                <button
                  onClick={() => setEditingMetrics(true)}
                  className="flex items-center gap-1 text-slate-400 hover:text-white text-sm"
                >
                  <Edit className="w-4 h-4" /> Edit metrics
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Campaign Wins */}
      {isCompleted && (
        <div className="bg-slate-900/50 rounded-xl p-4 border border-amber-500/30">
          <h3 className="text-lg font-semibold text-amber-400 mb-3 flex items-center gap-2">
            <Lightbulb className="w-5 h-5" />
            Campaign Wins
          </h3>
          <p className="text-slate-400 text-xs mb-2">What worked, what didn&apos;t, what to repeat next time.</p>
          {editingWins && canEdit ? (
            <div>
              <textarea
                value={winsText}
                onChange={(e) => setWinsText(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                placeholder="Log learnings..."
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleSaveWins}
                  disabled={isSaving}
                  className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 rounded text-sm"
                >
                  <Save className="w-4 h-4" /> Save
                </button>
                <button onClick={() => setEditingWins(false)} className="px-3 py-1.5 bg-slate-700 rounded text-sm">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              {song.campaignWins ? (
                <p className="text-slate-300 text-sm whitespace-pre-wrap">{song.campaignWins}</p>
              ) : (
                <p className="text-slate-500 text-sm italic">No learnings logged yet.</p>
              )}
              {canEdit && (
                <button
                  onClick={() => setEditingWins(true)}
                  className="flex items-center gap-1 text-amber-400 hover:text-amber-300 text-sm mt-2"
                >
                  <Edit className="w-4 h-4" /> {song.campaignWins ? 'Edit' : 'Add learnings'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Past content links (for Import Past Campaign) */}
      {song.pastContentLinks && song.pastContentLinks.length > 0 && (
        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800">
          <h3 className="text-sm font-semibold text-white mb-2">Past Content</h3>
          <ul className="space-y-2">
            {song.pastContentLinks.map((link) => (
              <li key={link.id} className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-slate-500" />
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-red-400 hover:underline text-sm truncate max-w-[200px]"
                >
                  {link.platform || link.url}
                </a>
                {link.date && <span className="text-slate-500 text-xs">{link.date}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
