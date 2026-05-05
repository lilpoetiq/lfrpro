'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Music, Upload, TrendingUp, ArrowLeft, Play, BarChart3, Merge, X, Users } from 'lucide-react'
import Chart from '@/components/Chart'
import { formatTimeAgo } from '@/lib/utils'

interface Song {
  name: string
  streams: number
  platforms: string[]
  uploads: string[]
  upc?: string
  isrc?: string
  googleDriveUrl?: string
}

interface ArtistData {
  artist: string
  totalRows: number
  songs: Song[]
  data: any[]
}

export default function ArtistPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const artistName = decodeURIComponent(params.artistName as string)
  
  const [artistData, setArtistData] = useState<ArtistData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)
  const [showMergeModal, setShowMergeModal] = useState(false)
  const [allArtists, setAllArtists] = useState<Array<{ name: string; songs?: number }>>([])
  const [selectedArtistsToMerge, setSelectedArtistsToMerge] = useState<string[]>([])
  const [mergeToUserId, setMergeToUserId] = useState<string>('')
  const [users, setUsers] = useState<any[]>([])
  const isStaff = user?.role === 'artist' && Array.isArray(user?.staffPermissions) && user.staffPermissions.length > 0
  const isAdmin = user?.role === 'admin' || user?.role === 'manager' || isStaff

  useEffect(() => {
    fetchArtistData()
    if (isAdmin) {
      fetchAllArtists()
      fetchUsers()
    }
  }, [artistName, isAdmin])

  const fetchArtistData = async () => {
    try {
      const res = await fetch(`/api/get-artist-data?artist=${encodeURIComponent(artistName)}`)
      const data = await res.json()
      if (data.success) {
        setArtistData(data)
      }
    } catch (error) {
      console.error('Failed to fetch artist data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchAllArtists = async () => {
    try {
      const res = await fetch('/api/get-artists')
      const data = await res.json()
      if (data.success) {
        // Filter out the current artist from the list
        const otherArtists = data.artists
          .filter((a: any) => a.name.toLowerCase() !== artistName.toLowerCase())
          .map((a: any) => ({ name: a.name, songs: a.songs?.length || 0 }))
        setAllArtists(otherArtists)
      }
    } catch (error) {
      console.error('Failed to fetch artists:', error)
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

  const handleMergeAccounts = async () => {
    if (selectedArtistsToMerge.length === 0) {
      alert('Please select at least one artist to merge')
      return
    }

    if (!confirm(`Merge ${selectedArtistsToMerge.length} artist account(s) into "${artistName}"? This will move all their songs and data.`)) {
      return
    }

    try {
      const res = await fetch('/api/artists/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromArtistNames: selectedArtistsToMerge,
          toArtistName: artistName,
          toUserId: mergeToUserId || undefined,
          userId: user?.id,
          userName: user?.name,
        }),
      })

      const data = await res.json()
      if (data.success) {
        alert(`Successfully merged ${data.songsMerged} songs from ${selectedArtistsToMerge.length} artist(s) into "${artistName}"`)
        setShowMergeModal(false)
        setSelectedArtistsToMerge([])
        setMergeToUserId('')
        fetchArtistData()
        fetchAllArtists()
      } else {
        alert('Failed to merge: ' + (data.error || data.details || 'Unknown error'))
      }
    } catch (error: any) {
      console.error('Failed to merge artists:', error)
      alert('Failed to merge artists: ' + (error.message || 'Unknown error'))
    }
  }

  const toggleArtistSelection = (artistNameToToggle: string) => {
    setSelectedArtistsToMerge(prev => {
      if (prev.includes(artistNameToToggle)) {
        return prev.filter(name => name !== artistNameToToggle)
      } else {
        return [...prev, artistNameToToggle]
      }
    })
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setUploadStatus('Please select a valid CSV file')
      return
    }

    setCsvFile(file)
    setIsUploading(true)
    setUploadStatus('Uploading...')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('artistName', artistName)

      const res = await fetch('/api/upload-artist-csv', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (data.success) {
        setUploadStatus(`✓ CSV uploaded successfully! ${data.rowCount} rows processed.`)
        setCsvFile(null)
        fetchArtistData()
        const input = document.getElementById('artist-csv-upload') as HTMLInputElement
        if (input) input.value = ''
      } else {
        setUploadStatus(`Error: ${data.error}`)
      }
    } catch (error: any) {
      setUploadStatus(`Upload failed: ${error.message}`)
    } finally {
      setIsUploading(false)
    }
  }

  const totalStreams = artistData?.songs.reduce((sum, song) => sum + song.streams, 0) || 0
  const songChartData = artistData?.songs.slice(0, 10).map(song => ({
    name: song.name.length > 15 ? song.name.substring(0, 15) + '...' : song.name,
    streams: song.streams || 0,
  })) || []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push('/dashboard/artists')}
            className="flex items-center text-slate-400 hover:text-white mb-4 transition"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Artists
          </button>
          <h1 className="text-3xl font-bold text-white mb-2">{artistName}</h1>
          <p className="text-slate-400">Artist profile and streaming data</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setShowMergeModal(true)
              setSelectedArtistsToMerge([])
              setMergeToUserId('')
            }}
            className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition"
          >
            <Merge className="w-5 h-5" />
            <span>Merge Accounts</span>
          </button>
        )}
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
            {artistData?.songs.length || 0}
          </h3>
          <p className="text-sm text-slate-400">Songs</p>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500/20 rounded-lg">
              <Play className="w-6 h-6 text-green-400" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">
            {totalStreams.toLocaleString()}
          </h3>
          <p className="text-sm text-slate-400">Total Streams</p>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-500/20 rounded-lg">
              <BarChart3 className="w-6 h-6 text-purple-400" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">
            {artistData?.totalRows || 0}
          </h3>
          <p className="text-sm text-slate-400">Data Points</p>
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
          <Upload className="w-5 h-5 mr-2 text-red-500" />
          Upload CSV Data for {artistName}
        </h2>
        <div className="space-y-4">
          <div className="border-2 border-dashed border-slate-700 rounded-lg p-6 text-center hover:border-red-600 transition">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="artist-csv-upload"
              disabled={isUploading}
            />
            <label
              htmlFor="artist-csv-upload"
              className={`cursor-pointer flex flex-col items-center ${isUploading ? 'opacity-50' : ''}`}
            >
              <Upload className="w-12 h-12 text-slate-500 mb-4" />
              <p className="text-sm text-slate-400 mb-2">
                {isUploading ? 'Uploading...' : 'Click to upload CSV data'}
              </p>
              <p className="text-xs text-slate-500">CSV files only</p>
            </label>
          </div>
          {uploadStatus && (
            <div
              className={`p-3 rounded-lg text-sm ${
                uploadStatus.includes('✓')
                  ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                  : uploadStatus.includes('Error') || uploadStatus.includes('failed')
                  ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                  : 'bg-red-500/10 border border-red-500/20 text-red-400'
              }`}
            >
              {uploadStatus}
            </div>
          )}
        </div>
      </div>

      {/* Songs Chart */}
      {songChartData.length > 0 && (
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-4">Top Songs</h2>
          <div className="h-64">
            <Chart
              data={songChartData}
              type="bar"
              dataKey="streams"
              nameKey="name"
              bars={[
                { dataKey: 'streams', name: 'Streams', color: '#ef4444' },
              ]}
            />
          </div>
        </div>
      )}

      {/* Songs List */}
      <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
        <h2 className="text-xl font-semibold text-white mb-4">All Songs</h2>
        {!artistData || artistData.songs.length === 0 ? (
          <div className="text-center py-12">
            <Music className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No songs found. Upload CSV data to see songs.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Song</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Streams</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Platforms</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">UPC / ISRC</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Drive</th>
                </tr>
              </thead>
              <tbody>
                {artistData.songs
                  .sort((a, b) => b.streams - a.streams)
                  .map((song, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30 transition"
                    >
                      <td className="py-3 px-4 text-white font-medium">{song.name}</td>
                      <td className="py-3 px-4 text-white font-semibold">
                        {song.streams.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-2">
                          {song.platforms.map((platform, pIdx) => (
                            <span
                              key={pIdx}
                              className="text-xs bg-red-500/10 text-red-500 px-2 py-1 rounded"
                            >
                              {platform}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-sm">
                        <div className="flex flex-col space-y-1">
                          <span className="text-white font-mono text-xs">{song.upc && song.upc.toLowerCase() !== 'unknown' ? song.upc : ''}</span>
                          <span className="text-white font-mono text-xs">{song.isrc || '—'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-sm">
                        {song.googleDriveUrl ? (
                          <a
                            href={song.googleDriveUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-red-400 hover:text-red-300 underline text-xs break-all"
                          >
                            Drive Link
                          </a>
                        ) : (
                          <span className="text-slate-500 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Merge Accounts Modal */}
      {showMergeModal && isAdmin && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 max-w-2xl w-full my-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Merge Accounts into {artistName}</h2>
              <button
                onClick={() => {
                  setShowMergeModal(false)
                  setSelectedArtistsToMerge([])
                  setMergeToUserId('')
                }}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-blue-300 text-sm">
                  Select one or more artist accounts to merge into <strong>{artistName}</strong>. 
                  All songs and data from selected artists will be moved to this account.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Select Artists to Merge (Select Multiple)
                </label>
                <div className="max-h-64 overflow-y-auto border border-slate-700 rounded-lg bg-slate-800/50">
                  {allArtists.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-sm">
                      No other artists found
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-700">
                      {allArtists.map((artist) => (
                        <label
                          key={artist.name}
                          className="flex items-center space-x-3 p-3 hover:bg-slate-700/50 cursor-pointer transition"
                        >
                          <input
                            type="checkbox"
                            checked={selectedArtistsToMerge.includes(artist.name)}
                            onChange={() => toggleArtistSelection(artist.name)}
                            className="w-4 h-4 text-purple-600 bg-slate-700 border-slate-600 rounded focus:ring-purple-500"
                          />
                          <div className="flex-1">
                            <span className="text-white font-medium">{artist.name}</span>
                            <span className="text-slate-400 text-sm ml-2">
                              ({artist.songs} song{artist.songs !== 1 ? 's' : ''})
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {selectedArtistsToMerge.length > 0 && (
                  <p className="text-xs text-slate-400 mt-2">
                    {selectedArtistsToMerge.length} artist(s) selected: {selectedArtistsToMerge.join(', ')}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Link to User Account (Optional)
                </label>
                <select
                  value={mergeToUserId && users.some(u => u.id === mergeToUserId) ? mergeToUserId : ''}
                  onChange={(e) => setMergeToUserId(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                  All merged songs will be linked to this account if provided
                </p>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handleMergeAccounts}
                  disabled={selectedArtistsToMerge.length === 0}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition flex items-center justify-center space-x-2"
                >
                  <Merge className="w-5 h-5" />
                  <span>Merge {selectedArtistsToMerge.length > 0 ? `${selectedArtistsToMerge.length} ` : ''}Account{selectedArtistsToMerge.length !== 1 ? 's' : ''}</span>
                </button>
                <button
                  onClick={() => {
                    setShowMergeModal(false)
                    setSelectedArtistsToMerge([])
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
    </div>
  )
}

