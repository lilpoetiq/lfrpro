'use client'

import { X, Edit, Trash2, Calendar, Clock, Music, Video, Link as LinkIcon } from 'lucide-react'
import Link from 'next/link'

const EVENT_TYPE_STYLES: Record<string, { bg: string; border: string; label: string }> = {
  release: { bg: 'bg-emerald-500/20', border: 'border-l-emerald-500', label: 'Release' },
  label: { bg: 'bg-violet-500/20', border: 'border-l-violet-500', label: 'Marketing' },
  content: { bg: 'bg-violet-500/20', border: 'border-l-violet-500', label: 'Content' },
  task: { bg: 'bg-blue-500/20', border: 'border-l-blue-500', label: 'Deadline' },
  personal: { bg: 'bg-amber-500/20', border: 'border-l-amber-500', label: 'Personal' },
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
  eventType?: string
  promotionTarget?: string
  artistName?: string
  songTitle?: string
  linkedMediaUrl?: string
  linkedDriveUrl?: string
  songId?: string
}

interface EventDetailModalProps {
  event: CalendarEvent
  onClose: () => void
  onEdit?: () => void
  onDelete?: () => void
  canEdit?: boolean
}

export default function EventDetailModal({ event, onClose, onEdit, onDelete, canEdit = false }: EventDetailModalProps) {
  const typeKey = event.eventType || event.type
  const style = EVENT_TYPE_STYLES[typeKey] || EVENT_TYPE_STYLES.event

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-700 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between">
          <span className={`px-2 py-1 rounded text-xs font-medium ${style.bg} ${style.border} border-l-4 text-slate-200`}>
            {style.label}
          </span>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <h2 className="text-xl font-bold text-white">{event.title}</h2>

          <div className="flex flex-wrap gap-3 text-sm text-slate-400">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            {event.time && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {event.time}
              </span>
            )}
          </div>

          {event.subtitle && (
            <p className="text-slate-300">{event.subtitle}</p>
          )}

          {event.artistName && (
            <p className="text-slate-400 text-sm flex items-center gap-1.5">
              <Music className="w-4 h-4" />
              {event.artistName}
              {event.songTitle && ` — ${event.songTitle}`}
            </p>
          )}

          {event.description && (
            <p className="text-slate-300 text-sm whitespace-pre-wrap">{event.description}</p>
          )}

          {(event.linkedMediaUrl || event.linkedDriveUrl) && (
            <div className="flex flex-wrap gap-2">
              {event.linkedMediaUrl && (
                <a
                  href={event.linkedMediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-blue-400"
                >
                  <Video className="w-4 h-4" />
                  Media
                </a>
              )}
              {event.linkedDriveUrl && (
                <a
                  href={event.linkedDriveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-blue-400"
                >
                  <LinkIcon className="w-4 h-4" />
                  Drive
                </a>
              )}
            </div>
          )}

          {event.href && event.songId && (
            <Link
              href={`/dashboard/catalog/${event.songId}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-sm text-red-400"
            >
              View in Catalog
            </Link>
          )}

          {event.status && (
            <p className="text-slate-500 text-xs">Status: {event.status}</p>
          )}
        </div>

        {canEdit && (onEdit || onDelete) && (
          <div className="p-4 border-t border-slate-700 flex gap-2">
            {onEdit && (
              <button
                onClick={onEdit}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
