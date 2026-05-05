'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { DollarSign, TrendingUp, BarChart3 } from 'lucide-react'
import Chart from '@/components/Chart'

export default function RevenuePage() {
  const { user } = useAuth()
  const [artistData, setArtistData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user])

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/get-artist-data?artist=${encodeURIComponent(user?.name || '')}`)
      const data = await res.json()
      if (data.success) {
        setArtistData(data)
      }
    } catch (error) {
      console.error('Failed to fetch revenue data:', error)
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

  const totalStreams = artistData?.songs.reduce((sum: number, song: any) => sum + (song.streams || 0), 0) || 0
  const estimatedRevenue = totalStreams * 0.003 // Rough estimate: $0.003 per stream

  const platformRevenue = artistData?.songs.reduce((acc: any, song: any) => {
    song.platforms.forEach((platform: string) => {
      if (!acc[platform]) acc[platform] = { streams: 0, revenue: 0 }
      acc[platform].streams += song.streams || 0
      acc[platform].revenue += (song.streams || 0) * 0.003
    })
    return acc
  }, {}) || {}

  const revenueData = Object.entries(platformRevenue).map(([platform, data]: [string, any]) => ({
    platform,
    revenue: data.revenue,
    streams: data.streams,
  }))

  const songRevenue = artistData?.songs
    .map((song: any) => ({
      name: song.name.length > 20 ? song.name.substring(0, 20) + '...' : song.name,
      revenue: (song.streams || 0) * 0.003,
    }))
    .sort((a: any, b: any) => b.revenue - a.revenue)
    .slice(0, 10) || []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Revenue</h1>
        <p className="text-slate-400">Estimated revenue breakdown</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500/20 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-400" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">
            ${estimatedRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          <p className="text-sm text-slate-400">Estimated Total Revenue</p>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-500/20 rounded-lg">
              <BarChart3 className="w-6 h-6 text-red-500" />
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
              <TrendingUp className="w-6 h-6 text-purple-400" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">
            ${(estimatedRevenue / (artistData?.songs.length || 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          <p className="text-sm text-slate-400">Avg per Song</p>
        </div>
      </div>

      {/* Charts */}
      {revenueData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
            <h2 className="text-xl font-semibold text-white mb-4">Revenue by Platform</h2>
            <div className="h-64">
              <Chart
                data={revenueData}
                type="bar"
                dataKey="revenue"
                nameKey="platform"
                bars={[
                  { dataKey: 'revenue', name: 'Revenue ($)', color: '#ef4444' },
                ]}
              />
            </div>
          </div>

          {songRevenue.length > 0 && (
            <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
              <h2 className="text-xl font-semibold text-white mb-4">Top Earning Songs</h2>
              <div className="h-64">
                <Chart
                  data={songRevenue}
                  type="bar"
                  dataKey="revenue"
                  nameKey="name"
                  bars={[
                    { dataKey: 'revenue', name: 'Revenue ($)', color: '#10b981' },
                  ]}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {!artistData && (
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-12 border border-slate-800 text-center">
          <DollarSign className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Data Available</h3>
          <p className="text-slate-400">Upload CSV data to see revenue estimates</p>
        </div>
      )}
    </div>
  )
}

