'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { TrendingUp, Users, CheckCircle, MessageSquare } from 'lucide-react'
import Chart from '@/components/Chart'
import ManagerSuggestions from '@/components/ManagerSuggestions'

export default function ManagerDashboard() {
  const { user } = useAuth()
  const [artists, setArtists] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [artistsRes, tasksRes] = await Promise.all([
        fetch('/api/get-artists'),
        fetch('/api/tasks'),
      ])

      const artistsData = await artistsRes.json()
      const tasksData = await tasksRes.json()

      if (artistsData.success) {
        setArtists(artistsData.artists)
      }
      if (tasksData.success) {
        setTasks(tasksData.tasks)
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const totalStreams = artists.reduce(
    (sum, artist) => sum + artist.songs.reduce((s: number, song: any) => s + (song.streams || 0), 0),
    0
  )

  const completedTasks = tasks.filter((t) => t.completed).length
  const totalTasks = tasks.length

  const artistPerformance = artists.slice(0, 3).map((artist) => ({
    name: artist.name,
    streams: artist.songs.reduce((sum: number, song: any) => sum + (song.streams || 0), 0),
  }))

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
        <h1 className="text-3xl font-bold text-white mb-2">
          Manager Dashboard
        </h1>
        <p className="text-slate-400">
          Overview of all your artists and team activities
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-500/20 rounded-lg">
              <Users className="w-6 h-6 text-red-400" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">
            {artists.length}
          </h3>
          <p className="text-sm text-slate-400">Total Artists</p>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500/20 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-400" />
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
              <CheckCircle className="w-6 h-6 text-purple-400" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">
            {completedTasks}/{totalTasks}
          </h3>
          <p className="text-sm text-slate-400">Tasks Completed</p>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-500/20 rounded-lg">
              <MessageSquare className="w-6 h-6 text-red-400" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">
            {tasks.filter(t => !t.completed).length}
          </h3>
          <p className="text-sm text-slate-400">Pending Tasks</p>
        </div>
      </div>

      {/* Charts Row */}
      {artistPerformance.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
            <h2 className="text-xl font-semibold text-white mb-4">
              Artist Performance Comparison
            </h2>
            <div className="h-64">
              <Chart
                data={artistPerformance}
                type="bar"
                dataKey="streams"
                nameKey="name"
                    bars={[
                  { dataKey: 'streams', name: 'Streams', color: '#ef4444' },
                ]}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tasks and Checklist Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-4">
            Recent Tasks
          </h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {tasks.slice(0, 5).map((task) => (
              <div
                key={task.id}
                className="flex items-start space-x-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700"
              >
                <input
                  type="checkbox"
                  checked={task.completed}
                  readOnly
                  className="mt-1 w-5 h-5 rounded border-slate-600 bg-slate-800 text-red-400"
                />
                <div className="flex-1">
                  <h3 className={`font-medium ${task.completed ? 'line-through text-slate-500' : 'text-white'}`}>
                    {task.title}
                  </h3>
                  <p className="text-sm text-slate-400">{task.description}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Assigned to: {task.assignedToName} • Due: {new Date(task.dueDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
            {tasks.length === 0 && (
              <p className="text-slate-400 text-center py-8">No tasks assigned</p>
            )}
          </div>
        </div>
      </div>

      {/* Manager Suggestions */}
      <ManagerSuggestions />
    </div>
  )
}

