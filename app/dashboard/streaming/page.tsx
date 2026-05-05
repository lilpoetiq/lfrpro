'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { BarChart3, TrendingUp, Music, Play } from 'lucide-react'
import Chart from '@/components/Chart'

export default function StreamingStatsPage() {
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
      console.error('Failed to fetch streaming data:', error)
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
  const songCount = artistData?.songs.length || 0

  const platformData = artistData?.songs.reduce((acc: any, song: any) => {
    song.platforms.forEach((platform: string) => {
      if (!acc[platform]) acc[platform] = 0
      acc[platform] += song.streams || 0
    })
    return acc
  }, {}) || {}

  const chartData = Object.entries(platformData).map(([platform, streams]: [string, any]) => ({
    platform,
    streams,
  }))

  const topSongs = artistData?.songs
    .sort((a: any, b: any) => b.streams - a.streams)
    .slice(0, 10)
    .map((song: any) => ({
      name: song.name,
      streams: song.streams || 0,
    })) || []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Streaming Stats</h1>
        <p className="text-slate-400">Your streaming performance across all platforms</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            <div className="p-3 bg-red-500/20 rounded-lg">
              <Music className="w-6 h-6 text-red-500" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">
            {songCount}
          </h3>
          <p className="text-sm text-slate-400">Total Songs</p>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-500/20 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-400" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">
            ${((totalStreams * 0.003).toLocaleString())}
          </h3>
          <p className="text-sm text-slate-400">Estimated Revenue</p>
        </div>
      </div>

      {/* Charts */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
            <h2 className="text-xl font-semibold text-white mb-4">Platform Distribution</h2>
            <div className="h-64">
              <Chart
                data={chartData}
                type="pie"
                dataKey="streams"
              />
            </div>
          </div>

          {topSongs.length > 0 && (
            <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
              <h2 className="text-xl font-semibold text-white mb-4">Top Songs</h2>
              <div className="h-64">
                <Chart
                  data={topSongs}
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
        </div>
      )}

      {/* Songs List */}
      {artistData?.songs && artistData.songs.length > 0 && (
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-4">All Songs</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Song</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Streams</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-400">Platforms</th>
                </tr>
              </thead>
              <tbody>
                {artistData.songs
                  .sort((a: any, b: any) => b.streams - a.streams)
                  .map((song: any, idx: number) => (
                    <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 text-white font-medium">{song.name}</td>
                      <td className="py-3 px-4 text-white font-semibold">{song.streams.toLocaleString()}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-2">
                          {song.platforms.map((platform: string, pIdx: number) => (
                            <span
                              key={pIdx}
                              className="text-xs bg-red-500/10 text-red-500 px-2 py-1 rounded"
                            >
                              {platform}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!artistData && (
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-12 border border-slate-800 text-center">
          <Music className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Data Available</h3>
          <p className="text-slate-400">Upload CSV data to see your streaming statistics</p>
        </div>
      )}
    </div>
  )
}

