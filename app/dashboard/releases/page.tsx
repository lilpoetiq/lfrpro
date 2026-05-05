'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Music, Calendar, TrendingUp, Clock, CheckCircle, XCircle, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { formatLocalDate } from '@/lib/utils'

interface CatalogItem {
  id: string
  song: string
  artist: string
  releaseDate?: string
  releaseDateRequested?: string
  releaseApprovalStatus?: 'pending' | 'approved' | 'denied'
  releaseApprovalNotes?: string
  isDelayed?: boolean
  delayReason?: string
  totalStreams: number
  platforms: string[]
  releaseType?: string
}

export default function ReleasesPage() {
  const { user } = useAuth()
  const [releases, setReleases] = useState<CatalogItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchReleases()
  }, [])

  const fetchReleases = async () => {
    try {
      const isStaff = user?.role === 'artist' && Array.isArray(user?.staffPermissions) && user.staffPermissions.length > 0
      const scopeParam = (user?.role === 'manager' || isStaff) && user?.id ? `?userId=${encodeURIComponent(user.id)}` : ''
      const res = await fetch(`/api/catalog${scopeParam}`)
      const data = await res.json()
      if (data.success) {
        let filtered = data.catalog.filter((item: any) => {
          // For artists, filter by their artist name or artistId
          if (user?.role === 'artist') {
            const isMyRelease = item.artistId === user.id || 
                   item.artist === user.name ||
                   item.artist === user.artistName ||
                   (item.artistIds && item.artistIds.includes(user.id))
            
            // Show all releases including denied (artists should see their denied requests)
            return isMyRelease && (item.releaseDate || item.releaseDateRequested || item.releaseApprovalStatus)
          }
          
          // For admins/managers, show all releases
          return item.releaseDate || item.releaseDateRequested || item.releaseApprovalStatus
        })
        
        setReleases(filtered.sort((a: CatalogItem, b: CatalogItem) => {
          const dateA = a.releaseDate || a.releaseDateRequested || ''
          const dateB = b.releaseDate || b.releaseDateRequested || ''
          return new Date(dateB).getTime() - new Date(dateA).getTime()
        }))
      }
    } catch (error) {
      console.error('Failed to fetch releases:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteDenied = async (releaseId: string) => {
    if (!confirm('Are you sure you want to permanently delete this denied release request?')) {
      return
    }

    try {
      const res = await fetch(`/api/catalog?id=${releaseId}&userRole=${user?.role}&userId=${user?.id}&userName=${encodeURIComponent(user?.name || '')}`, {
        method: 'DELETE',
      })

      const data = await res.json()
      if (data.success) {
        fetchReleases()
        alert('Denied release request deleted successfully')
      } else {
        alert('Failed to delete: ' + (data.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Failed to delete denied release:', error)
      alert('Failed to delete denied release')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  // Filter releases by status
  const pending = releases.filter(r => r.releaseApprovalStatus === 'pending')
  const denied = releases.filter(r => r.releaseApprovalStatus === 'denied')
  const upcoming = releases.filter(r => {
    const releaseDate = r.releaseDate ? new Date(r.releaseDate) : null
    const now = new Date()
    return r.releaseApprovalStatus === 'approved' && releaseDate && releaseDate > now
  })
  const released = releases.filter(r => {
    const releaseDate = r.releaseDate ? new Date(r.releaseDate) : null
    return releaseDate && releaseDate <= new Date()
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Releases</h1>
        <p className="text-slate-400">Track your upcoming and past releases</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-500/20 rounded-lg">
              <Music className="w-6 h-6 text-red-500" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">
            {releases.length}
          </h3>
          <p className="text-sm text-slate-400">Total Releases</p>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-500/20 rounded-lg">
              <Calendar className="w-6 h-6 text-yellow-400" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">
            {upcoming.length}
          </h3>
          <p className="text-sm text-slate-400">Upcoming</p>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500/20 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-400" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">
            {released.reduce((sum, r) => sum + r.totalStreams, 0).toLocaleString()}
          </h3>
          <p className="text-sm text-slate-400">Total Streams</p>
        </div>
      </div>

      {/* Pending Requests */}
      {pending.length > 0 && (
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center space-x-2">
            <Clock className="w-5 h-5 text-yellow-400" />
            <span>Pending Requests</span>
          </h2>
          <div className="space-y-3">
            {pending.map((release) => (
              <div
                key={release.id}
                className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-yellow-500/30"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-white font-semibold">{release.song}</h3>
                    <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded font-semibold">
                      PENDING
                    </span>
                    {release.releaseType && release.releaseType !== 'single' && (
                      <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">
                        {release.releaseType.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-sm">{release.artist}</p>
                  <p className="text-slate-500 text-xs mt-1">
                    Requested: {release.releaseDateRequested ? formatLocalDate(release.releaseDateRequested) : 'N/A'}
                  </p>
                </div>
                <Link
                  href={`/dashboard/catalog/${release.id}`}
                  className="text-red-400 hover:text-red-300 transition"
                >
                  View →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Denied Requests */}
      {denied.length > 0 && (
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center space-x-2">
            <XCircle className="w-5 h-5 text-red-400" />
            <span>Denied Requests</span>
          </h2>
          <div className="space-y-3">
            {denied.map((release) => (
              <div
                key={release.id}
                className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-red-500/30"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-white font-semibold">{release.song}</h3>
                    <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded font-semibold">
                      DENIED
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm">{release.artist}</p>
                  {release.releaseApprovalNotes && (
                    <p className="text-slate-500 text-xs mt-1 italic">
                      Note: {release.releaseApprovalNotes}
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <Link
                    href={`/dashboard/catalog/${release.id}`}
                    className="text-red-400 hover:text-red-300 transition"
                  >
                    View →
                  </Link>
                  {(user?.role === 'admin' || user?.role === 'manager') && (
                    <button
                      onClick={() => handleDeleteDenied(release.id)}
                      className="text-red-500 hover:text-red-400 transition px-2 py-1 text-sm border border-red-500/30 rounded hover:bg-red-500/10"
                      title="Delete denied request (admin only)"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Releases */}
      {upcoming.length > 0 && (
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span>Upcoming Releases</span>
          </h2>
          <div className="space-y-3">
            {upcoming.map((release) => (
              <div
                key={release.id}
                className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-white font-semibold">{release.song}</h3>
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded font-semibold">
                      APPROVED
                    </span>
                    {release.isDelayed && (
                      <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded font-semibold">
                        ⚠️ DELAYED
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-sm">{release.artist}</p>
                  <p className="text-slate-500 text-xs mt-1">
                    Release: {release.releaseDate ? formatLocalDate(release.releaseDate) : 'N/A'}
                  </p>
                </div>
                <Link
                  href={`/dashboard/catalog/${release.id}`}
                  className="text-red-400 hover:text-red-300 transition"
                >
                  View →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Released */}
      <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
        <h2 className="text-xl font-semibold text-white mb-4">Released</h2>
        {released.length === 0 ? (
          <div className="text-center py-12">
            <Music className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No releases yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Song</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Artist</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Release Date</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Streams</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {released.map((release) => (
                  <tr key={release.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-white font-medium">{release.song}</span>
                        {release.isDelayed && (
                          <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded font-semibold">
                            ⚠️ DELAYED
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-400">{release.artist}</td>
                    <td className="py-3 px-4 text-slate-400">
                      {formatLocalDate(release.releaseDate)}
                    </td>
                    <td className="py-3 px-4 text-white font-semibold">
                      {release.totalStreams.toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/dashboard/catalog/${release.id}`}
                        className="text-red-400 hover:text-red-300 transition"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

