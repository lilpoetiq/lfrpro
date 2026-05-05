'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Users, Music, TrendingUp, Calendar, ArrowRight, Phone, Mail, User, Link2, X, Merge, Trash2, CheckSquare, Square } from 'lucide-react'
import { formatTimeAgo } from '@/lib/utils'

interface Artist {
  name: string
  uploads: number
  totalRows: number
  lastUpload: any
  songs?: Array<{
    name: string
    streams: number
    platform: string
  }>
  userId?: string
  userName?: string
  phoneNumber?: string
  email?: string
  role?: string
}

export default function AllArtistsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [artists, setArtists] = useState<Artist[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [users, setUsers] = useState<any[]>([])
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [showMergeModal, setShowMergeModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [mergeFromArtist, setMergeFromArtist] = useState<Artist | null>(null)
  const [mergeToArtistName, setMergeToArtistName] = useState<string>('')
  const [mergeToUserId, setMergeToUserId] = useState<string>('')
  const [selectedArtists, setSelectedArtists] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  
  const isStaff = user?.role === 'artist' && Array.isArray(user?.staffPermissions) && user.staffPermissions.length > 0
  const isAdmin = user?.role === 'admin' || user?.role === 'manager' || isStaff

  useEffect(() => {
    fetchArtists()
    if (isAdmin) {
      fetchUsers()
    }

    // Listen for catalog updates via BroadcastChannel
    const channel = new BroadcastChannel('catalog-updates')
    const handleCatalogUpdate = () => {
      fetchArtists()
    }
    channel.addEventListener('message', handleCatalogUpdate)

    // Refresh artists when window regains focus (user switches back from catalog page)
    const handleFocus = () => {
      fetchArtists()
    }
    window.addEventListener('focus', handleFocus)

    // Also refresh periodically (every 30 seconds) to catch catalog updates
    const interval = setInterval(() => {
      fetchArtists()
    }, 30000)

    return () => {
      channel.removeEventListener('message', handleCatalogUpdate)
      channel.close()
      window.removeEventListener('focus', handleFocus)
      clearInterval(interval)
    }
  }, [isAdmin])

  const fetchArtists = async () => {
    try {
      const res = await fetch('/api/get-artists')
      const data = await res.json()
      if (data.success) {
        setArtists(data.artists)
      }
    } catch (error) {
      console.error('Failed to fetch artists:', error)
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

  const handleLinkArtist = async () => {
    if (!selectedArtist || !selectedUserId) return

    try {
      const res = await fetch('/api/artist-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistName: selectedArtist.name,
          userId: selectedUserId,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setShowLinkModal(false)
        setSelectedArtist(null)
        setSelectedUserId('')
        fetchArtists() // Refresh artists list
      } else {
        alert('Failed to link artist: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to link artist:', error)
      alert('Failed to link artist')
    }
  }

  const handleUnlinkArtist = async (artistName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Unlink ${artistName} from their account?`)) return

    try {
      const res = await fetch(`/api/artist-mappings?artistName=${encodeURIComponent(artistName)}`, {
        method: 'DELETE',
      })

      const data = await res.json()
      if (data.success) {
        fetchArtists() // Refresh artists list
      } else {
        alert('Failed to unlink artist: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to unlink artist:', error)
      alert('Failed to unlink artist')
    }
  }

  const handleMergeArtist = async () => {
    if (!mergeFromArtist || !mergeToArtistName) return

    try {
      const res = await fetch('/api/artists/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromArtistName: mergeFromArtist.name,
          toArtistName: mergeToArtistName,
          toUserId: mergeToUserId || undefined,
          userId: user?.id,
          userName: user?.name,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || data.details || 'Failed to merge artists')
      }
      if (data.success) {
        alert(`Successfully merged ${data.songsMerged} songs from "${mergeFromArtist.name}" to "${mergeToArtistName}"`)
        setShowMergeModal(false)
        setMergeFromArtist(null)
        setMergeToArtistName('')
        setMergeToUserId('')
        fetchArtists() // Refresh artists list
      } else {
        alert('Failed to merge artists: ' + (data.error || data.details || 'Unknown error'))
      }
    } catch (error: any) {
      console.error('Failed to merge artists:', error)
      alert('Failed to merge artists: ' + (error.message || 'Unknown error'))
    }
  }

  const handleDeleteArtist = async () => {
    if (!mergeFromArtist) return

    if (!confirm(`Are you sure you want to delete "${mergeFromArtist.name}"? This will delete all their songs and data. This cannot be undone!`)) {
      return
    }

    try {
      const res = await fetch(`/api/artists/delete?artistName=${encodeURIComponent(mergeFromArtist.name)}&userId=${user?.id || ''}&userName=${encodeURIComponent(user?.name || '')}`, {
        method: 'DELETE',
      })

      const data = await res.json()
      if (data.success) {
        alert(`Successfully deleted "${mergeFromArtist.name}" and ${data.songsDeleted} songs`)
        setShowDeleteModal(false)
        setMergeFromArtist(null)
        fetchArtists() // Refresh artists list
      } else {
        alert('Failed to delete artist: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to delete artist:', error)
      alert('Failed to delete artist')
    }
  }

  const handleToggleArtistSelection = (artistName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newSelected = new Set(selectedArtists)
    if (newSelected.has(artistName)) {
      newSelected.delete(artistName)
    } else {
      newSelected.add(artistName)
    }
    setSelectedArtists(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedArtists.size === artists.length) {
      setSelectedArtists(new Set())
    } else {
      setSelectedArtists(new Set(artists.map(a => a.name)))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedArtists.size === 0) return

    const artistNames = Array.from(selectedArtists)
    const confirmMessage = `Are you sure you want to delete ${artistNames.length} artist${artistNames.length > 1 ? 's' : ''}?\n\n${artistNames.slice(0, 5).join(', ')}${artistNames.length > 5 ? ` and ${artistNames.length - 5} more` : ''}\n\nThis will delete all their songs and data. This cannot be undone!`

    if (!confirm(confirmMessage)) {
      return
    }

    setIsDeleting(true)
    const results: Array<{ name: string; success: boolean; songsDeleted?: number; error?: string }> = []

    try {
      // Delete artists one by one
      for (const artistName of artistNames) {
        try {
          const res = await fetch(`/api/artists/delete?artistName=${encodeURIComponent(artistName)}&userId=${user?.id || ''}&userName=${encodeURIComponent(user?.name || '')}`, {
            method: 'DELETE',
          })

          const data = await res.json()
          if (data.success) {
            results.push({ name: artistName, success: true, songsDeleted: data.songsDeleted })
          } else {
            results.push({ name: artistName, success: false, error: data.error || 'Unknown error' })
          }
        } catch (error: any) {
          results.push({ name: artistName, success: false, error: error.message || 'Failed to delete' })
        }
      }

      // Show results
      const successful = results.filter(r => r.success)
      const failed = results.filter(r => !r.success)
      const totalSongsDeleted = successful.reduce((sum, r) => sum + (r.songsDeleted || 0), 0)

      let message = `Bulk delete completed:\n`
      message += `✓ Successfully deleted ${successful.length} artist${successful.length !== 1 ? 's' : ''} (${totalSongsDeleted} songs)\n`
      if (failed.length > 0) {
        message += `✗ Failed to delete ${failed.length} artist${failed.length !== 1 ? 's' : ''}:\n`
        failed.forEach(f => {
          message += `  - ${f.name}: ${f.error}\n`
        })
      }

      alert(message)
      setSelectedArtists(new Set())
      fetchArtists() // Refresh artists list
    } catch (error) {
      console.error('Bulk delete error:', error)
      alert('Failed to perform bulk delete')
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">All Artists</h1>
        <p className="text-slate-400">Manage and view all label artists</p>
      </div>

      {/* Bulk Actions Bar */}
      {isAdmin && artists.length > 0 && (
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-4 border border-slate-800 shadow-lg flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleSelectAll}
              className="flex items-center space-x-2 text-slate-300 hover:text-white transition"
            >
              {selectedArtists.size === artists.length ? (
                <CheckSquare className="w-5 h-5" />
              ) : (
                <Square className="w-5 h-5" />
              )}
              <span className="text-sm font-medium">
                {selectedArtists.size === artists.length ? 'Deselect All' : 'Select All'}
              </span>
            </button>
            {selectedArtists.size > 0 && (
              <span className="text-sm text-slate-400">
                {selectedArtists.size} artist{selectedArtists.size !== 1 ? 's' : ''} selected
              </span>
            )}
          </div>
          {selectedArtists.size > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition flex items-center space-x-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>
                {isDeleting ? 'Deleting...' : `Delete ${selectedArtists.size} Artist${selectedArtists.size !== 1 ? 's' : ''}`}
              </span>
            </button>
          )}
        </div>
      )}

      {artists.length === 0 ? (
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-12 border border-slate-800 text-center">
          <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Artists Found</h3>
          <p className="text-slate-400">Upload CSV data to see artists appear here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {artists.map((artist) => (
            <div
              key={artist.name}
              onClick={() => router.push(`/dashboard/artists/${encodeURIComponent(artist.name)}`)}
              className={`bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border transition group ${
                selectedArtists.has(artist.name) 
                  ? 'border-red-500 ring-2 ring-red-500/50' 
                  : 'border-slate-800 hover:border-red-500/50'
              } cursor-pointer`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {isAdmin && (
                    <button
                      onClick={(e) => handleToggleArtistSelection(artist.name, e)}
                      className="mt-1 text-slate-400 hover:text-red-500 transition"
                    >
                      {selectedArtists.has(artist.name) ? (
                        <CheckSquare className="w-5 h-5 text-red-500" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                  )}
                  <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center">
                    <Music className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white group-hover:text-red-500 transition">
                      {artist.name}
                    </h3>
                    <p className="text-sm text-slate-400">
                      {artist.songs?.length || 0} song{(artist.songs?.length || 0) !== 1 ? 's' : ''}
                    </p>
                    {artist.userId && (
                      <div className="flex items-center space-x-2 mt-1">
                        <a
                          href={`/dashboard/users?userId=${artist.userId}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/dashboard/users?userId=${artist.userId}`)
                          }}
                          className="text-xs text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                        >
                          <User className="w-3 h-3" />
                          <span>View Account</span>
                        </a>
                        {isAdmin && (
                          <button
                            onClick={(e) => handleUnlinkArtist(artist.name, e)}
                            className="text-xs text-red-400 hover:text-red-300 flex items-center space-x-1"
                            title="Unlink account"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                    {isAdmin && (
                      <div className="flex items-center space-x-2 mt-1">
                        {!artist.userId && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedArtist(artist)
                              setShowLinkModal(true)
                            }}
                            className="text-xs text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                          >
                            <Link2 className="w-3 h-3" />
                            <span>Link Account</span>
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setMergeFromArtist(artist)
                            setShowMergeModal(true)
                          }}
                          className="text-xs text-purple-400 hover:text-purple-300 flex items-center space-x-1"
                          title="Merge songs into another artist"
                        >
                          <Merge className="w-3 h-3" />
                          <span>Merge</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setMergeFromArtist(artist)
                            setShowDeleteModal(true)
                          }}
                          className="text-xs text-red-400 hover:text-red-300 flex items-center space-x-1"
                          title="Delete artist"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-red-500 transition" />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Total Streams</span>
                  <span className="text-white font-semibold">
                    {artist.songs?.reduce((sum, song) => sum + (song.streams || 0), 0).toLocaleString() || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Data Uploads</span>
                  <span className="text-white font-semibold">{artist.uploads}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Last Updated</span>
                  <span className="text-white font-semibold">
                    {formatTimeAgo(artist.lastUpload)}
                  </span>
                </div>
                {artist.phoneNumber && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400 flex items-center space-x-1">
                      <Phone className="w-3 h-3" />
                      <span>Phone</span>
                    </span>
                    <a
                      href={`tel:${artist.phoneNumber}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-blue-400 hover:text-blue-300 font-semibold"
                    >
                      {artist.phoneNumber}
                    </a>
                  </div>
                )}
                {artist.email && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400 flex items-center space-x-1">
                      <Mail className="w-3 h-3" />
                      <span>Email</span>
                    </span>
                    <a
                      href={`mailto:${artist.email}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-blue-400 hover:text-blue-300 font-semibold truncate max-w-[150px]"
                    >
                      {artist.email}
                    </a>
                  </div>
                )}
              </div>

              {artist.songs && artist.songs.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <p className="text-xs text-slate-500 mb-2">Top Songs</p>
                  <div className="space-y-1">
                    {artist.songs.slice(0, 3).map((song, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 truncate">{song.name}</span>
                        <span className="text-slate-500">{song.streams.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Link Artist Modal */}
      {showLinkModal && selectedArtist && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Link Artist to Account</h2>
              <button
                onClick={() => {
                  setShowLinkModal(false)
                  setSelectedArtist(null)
                  setSelectedUserId('')
                }}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Artist Name
                </label>
                <input
                  type="text"
                  value={selectedArtist.name}
                  disabled
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Link to User Account
                </label>
                <select
                  value={selectedUserId && users.some(u => u.id === selectedUserId) ? selectedUserId : ''}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="">Select a user...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} {u.username ? `(@${u.username})` : ''} {u.email ? `- ${u.email}` : ''}
                    </option>
                  ))}
                </select>
                {selectedUserId && !users.some(u => u.id === selectedUserId) && (
                  <p className="text-xs text-yellow-400 mt-1">
                    Selected user not found. Please select a user from the list.
                  </p>
                )}
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handleLinkArtist}
                  disabled={!selectedUserId}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  Link Artist
                </button>
                <button
                  onClick={() => {
                    setShowLinkModal(false)
                    setSelectedArtist(null)
                    setSelectedUserId('')
                  }}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Merge Artist Modal */}
      {showMergeModal && mergeFromArtist && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Merge Artist</h2>
              <button
                onClick={() => {
                  setShowMergeModal(false)
                  setMergeFromArtist(null)
                  setMergeToArtistName('')
                  setMergeToUserId('')
                }}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Merge From (Source)
                </label>
                <input
                  type="text"
                  value={mergeFromArtist.name}
                  disabled
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 cursor-not-allowed"
                />
                <p className="text-xs text-slate-400 mt-1">
                  {mergeFromArtist.songs?.length || 0} songs will be merged
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Merge To (Target Artist Name)
                </label>
                <input
                  type="text"
                  value={mergeToArtistName}
                  onChange={(e) => setMergeToArtistName(e.target.value)}
                  placeholder="Enter target artist name..."
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Link to Account (Optional)
                </label>
                <select
                  value={mergeToUserId && users.some(u => u.id === mergeToUserId) ? mergeToUserId : ''}
                  onChange={(e) => setMergeToUserId(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="">No account link</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} {u.username ? `(@${u.username})` : ''}
                    </option>
                  ))}
                </select>
                {mergeToUserId && !users.some(u => u.id === mergeToUserId) && (
                  <p className="text-xs text-yellow-400 mt-1">
                    Selected user not found. Please select a user from the list.
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-1">
                  All songs will be moved to the target artist and linked to this account if provided
                </p>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handleMergeArtist}
                  disabled={!mergeToArtistName}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  Merge Artist
                </button>
                <button
                  onClick={() => {
                    setShowMergeModal(false)
                    setMergeFromArtist(null)
                    setMergeToArtistName('')
                    setMergeToUserId('')
                  }}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Artist Modal */}
      {showDeleteModal && mergeFromArtist && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Delete Artist</h2>
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setMergeFromArtist(null)
                }}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-400 font-semibold mb-2">Warning: This action cannot be undone!</p>
                <p className="text-slate-300 text-sm">
                  Deleting <strong>{mergeFromArtist.name}</strong> will:
                </p>
                <ul className="text-slate-400 text-sm mt-2 list-disc list-inside space-y-1">
                  <li>Delete all songs where {mergeFromArtist.name} is the only artist</li>
                  <li>Remove {mergeFromArtist.name} from collaborative songs</li>
                  <li>Delete all CSV data for this artist</li>
                  <li>Permanently remove this artist from the system</li>
                </ul>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handleDeleteArtist}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  Delete Artist
                </button>
                <button
                  onClick={() => {
                    setShowDeleteModal(false)
                    setMergeFromArtist(null)
                  }}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
