'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Users, Music, TrendingUp, Calendar, ArrowRight, Settings } from 'lucide-react'

interface Artist {
  id: string
  name: string
  artistName?: string
  email: string
  role: 'artist'
  totalStreams?: number
  songCount?: number
  upcomingReleases?: number
}

export default function ManagerArtistsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [linkedArtists, setLinkedArtists] = useState<Artist[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchLinkedArtists()
    }
  }, [user])

  const fetchLinkedArtists = async () => {
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      
      if (data.success) {
        // Get artists linked to this manager
        const manager = data.users.find((u: any) => u.id === user?.id)
        const linkedIds = manager?.linkedArtistIds || []
        
        // Get catalog to calculate stats
        const catalogRes = await fetch('/api/catalog')
        const catalogData = await catalogRes.json()
        const catalog = catalogData.success ? catalogData.catalog : []
        
        // Filter artists and calculate stats
        const artists = data.users
          .filter((u: any) => u.role === 'artist' && linkedIds.includes(u.id))
          .map((artist: any) => {
            const artistCatalog = catalog.filter((item: any) => 
              item.artistId === artist.id || 
              item.artistIds?.includes(artist.id) ||
              item.artist === artist.name ||
              item.artist === artist.artistName
            )
            
            const totalStreams = artistCatalog.reduce((sum: number, item: any) => 
              sum + (item.totalStreams || 0), 0
            )
            
            const upcomingReleases = artistCatalog.filter((item: any) => {
              const releaseDate = item.releaseDate || item.releaseDateRequested
              return releaseDate && new Date(releaseDate) > new Date() && 
                     item.releaseApprovalStatus === 'approved'
            }).length
            
            return {
              ...artist,
              totalStreams,
              songCount: artistCatalog.length,
              upcomingReleases,
            }
          })
        
        setLinkedArtists(artists)
      }
    } catch (error) {
      console.error('Failed to fetch linked artists:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  if (!user || user.role !== 'manager') {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-white mb-4">Access Denied</h1>
        <p className="text-slate-400">You must be a manager to access this page.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">My Artists</h1>
          <p className="text-slate-400">Manage your linked artists and their content</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/users')}
          className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
        >
          <Settings className="w-5 h-5" />
          <span>Manage Links</span>
        </button>
      </div>

      {linkedArtists.length === 0 ? (
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-12 border border-slate-800 text-center">
          <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Linked Artists</h3>
          <p className="text-slate-400 mb-4">You don't have any artists linked to your account yet.</p>
          <p className="text-sm text-slate-500">Contact an admin to link artists to your manager account.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {linkedArtists.map((artist) => (
            <div
              key={artist.id}
              onClick={() => router.push(`/dashboard/artists/${encodeURIComponent(artist.name)}`)}
              className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 hover:border-red-500/50 cursor-pointer transition group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center">
                    <Music className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white group-hover:text-red-500 transition">
                      {artist.artistName || artist.name}
                    </h3>
                    <p className="text-sm text-slate-400">{artist.name}</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-red-500 transition" />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-slate-400">
                    <Music className="w-4 h-4" />
                    <span className="text-sm">Songs</span>
                  </div>
                  <span className="text-white font-semibold">{artist.songCount || 0}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-slate-400">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm">Total Streams</span>
                  </div>
                  <span className="text-white font-semibold">
                    {(artist.totalStreams || 0).toLocaleString()}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-slate-400">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm">Upcoming Releases</span>
                  </div>
                  <span className="text-white font-semibold">{artist.upcomingReleases || 0}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-800">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    router.push(`/dashboard/artists/${encodeURIComponent(artist.name)}`)
                  }}
                  className="w-full bg-red-600/20 hover:bg-red-600/30 text-red-400 py-2 rounded-lg transition text-sm font-medium"
                >
                  View Artist Page →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

