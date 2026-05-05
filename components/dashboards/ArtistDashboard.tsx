'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { TrendingUp, Music, DollarSign, Users, Calendar } from 'lucide-react'
import Chart from '@/components/Chart'

export default function ArtistDashboard() {
  const { user } = useAuth()
  const [artistData, setArtistData] = useState<any>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchArtistData()
      fetchTasks()
    }
  }, [user])

  const fetchArtistData = async () => {
    try {
      const res = await fetch(`/api/get-artist-data?artist=${encodeURIComponent(user?.name || '')}`)
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

  const fetchTasks = async () => {
    try {
      const res = await fetch(`/api/tasks?assignedTo=${user?.id}`)
      const data = await res.json()
      if (data.success) {
        setTasks(data.tasks)
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
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

  const monthlyStreams = artistData?.songs.slice(0, 5).map((song: any, idx: number) => ({
    month: song.name || `Song ${idx + 1}`,
    streams: song.streams || 0,
  })) || []

  const platformData = artistData?.songs.reduce((acc: any, song: any) => {
    song.platforms.forEach((platform: string) => {
      if (!acc[platform]) acc[platform] = 0
      acc[platform] += song.streams || 0
    })
    return acc
  }, {}) || {}

  const revenueData = Object.entries(platformData).map(([platform, streams]: [string, any]) => ({
    name: platform,
    value: streams,
  }))

  const completedTasks = tasks.filter(t => t.completed).length
  const totalTasks = tasks.length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">
          Welcome back, {user?.name}!
        </h1>
        <p className="text-slate-400">
          Here&apos;s your performance overview
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500/20 rounded-lg">
              <Music className="w-6 h-6 text-green-400" />
            </div>
            <span className="text-sm text-green-400 font-medium flex items-center">
              <TrendingUp className="w-4 h-4 mr-1" />
              {songCount > 0 ? 'Active' : 'No Data'}
            </span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">
            {totalStreams.toLocaleString()}
          </h3>
          <p className="text-sm text-slate-400">Total Streams</p>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-500/20 rounded-lg">
              <Users className="w-6 h-6 text-red-400" />
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
              <DollarSign className="w-6 h-6 text-purple-400" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">
            ${((totalStreams * 0.003).toLocaleString())}
          </h3>
          <p className="text-sm text-slate-400">Estimated Revenue</p>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-500/20 rounded-lg">
              <Calendar className="w-6 h-6 text-red-400" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">
            {completedTasks}/{totalTasks}
          </h3>
          <p className="text-sm text-slate-400">Tasks Completed</p>
        </div>
      </div>

      {/* Charts Row */}
      {monthlyStreams.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
            <h2 className="text-xl font-semibold text-white mb-4">
              Top Songs Performance
            </h2>
            <div className="h-64">
              <Chart
                data={monthlyStreams}
                type="bar"
                dataKey="streams"
                nameKey="month"
                    bars={[
                  { dataKey: 'streams', name: 'Streams', color: '#ef4444' },
                ]}
              />
            </div>
          </div>

          {revenueData.length > 0 && (
            <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
              <h2 className="text-xl font-semibold text-white mb-4">
                Platform Distribution
              </h2>
              <div className="h-64">
                <Chart
                  data={revenueData}
                  type="pie"
                  dataKey="value"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tasks */}
      {tasks.length > 0 && (
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-4">Your Tasks</h2>
          <div className="space-y-3">
            {tasks.slice(0, 5).map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700"
              >
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={task.completed}
                    readOnly
                    className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-red-400"
                  />
                  <div>
                    <h3 className={`font-medium ${task.completed ? 'line-through text-slate-500' : 'text-white'}`}>
                      {task.title}
                    </h3>
                    <p className="text-sm text-slate-400">{task.description}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Due: {new Date(task.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
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
