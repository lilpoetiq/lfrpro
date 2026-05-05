'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Music, TrendingUp, BarChart3, Eye } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface CatalogItem {
  id: string
  song: string
  artist: string
  totalStreams: number
  releaseDate?: string
  credits?: Array<{
    role: string
    name: string
  }>
  songs?: Array<{
    song: string
    credits?: Array<{
      role: string
      name: string
    }>
  }>
}

export default function ProducerDashboard() {
  const { user } = useAuth()
  const router = useRouter()
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalStreams, setTotalStreams] = useState(0)
  const [songCount, setSongCount] = useState(0)

  useEffect(() => {
    fetchCatalog()
  }, [])

  const fetchCatalog = async () => {
    try {
      setIsLoading(true)
      const res = await fetch(`/api/catalog?userId=${user?.id}`)
      const data = await res.json()
      if (data.success && data.catalog) {
        setCatalog(data.catalog)
        
        // Calculate totals
        const streams = data.catalog.reduce((sum: number, item: CatalogItem) => {
          return sum + (item.totalStreams || 0)
        }, 0)
        setTotalStreams(streams)
        setSongCount(data.catalog.length)
      }
    } catch (error) {
      console.error('Failed to fetch catalog:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Producer Dashboard</h1>
        <p className="text-slate-400 text-sm sm:text-base">
          Read-only access to analytics for songs you&apos;ve produced
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <Music className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{songCount}</h3>
          <p className="text-slate-400 text-sm">Songs Produced</p>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">
            {totalStreams.toLocaleString()}
          </h3>
          <p className="text-slate-400 text-sm">Total Streams</p>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <Eye className="w-8 h-8 text-blue-500" />
          </div>
          <h3 className="text-sm font-semibold text-white mb-1">Read-Only Access</h3>
          <p className="text-slate-400 text-sm">View analytics only</p>
        </div>
      </div>

      {/* Songs List */}
      <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl border border-slate-800 shadow-lg">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-semibold text-white">Your Produced Songs</h2>
          <p className="text-slate-400 text-sm mt-1">
            Click on any song to view detailed analytics (read-only)
          </p>
        </div>

        {catalog.length === 0 ? (
          <div className="p-12 text-center">
            <Music className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 mb-2">No songs found</p>
            <p className="text-sm text-slate-500">
              Songs you&apos;ve produced will appear here once credits are added
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {catalog.map((item) => (
              <div
                key={item.id}
                onClick={() => router.push(`/dashboard/catalog/${encodeURIComponent(item.id)}`)}
                className="p-6 hover:bg-slate-800/50 transition cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">{item.song}</h3>
                    <p className="text-slate-400 text-sm mb-2">by {item.artist}</p>
                    {item.releaseDate && (
                      <p className="text-slate-500 text-xs">
                        Released: {new Date(item.releaseDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-white">
                      {item.totalStreams?.toLocaleString() || 0}
                    </p>
                    <p className="text-slate-400 text-xs">streams</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
