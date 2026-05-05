'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Calendar, Plus, CheckCircle, Circle, Trash2, Edit, User, Music } from 'lucide-react'
import { formatTimeAgo } from '@/lib/utils'

interface Task {
  id: string
  title: string
  description: string
  assignedTo: string
  assignedToName: string
  dueDate: string
  completed: boolean
  category: string
  songId?: string
  comments?: Array<{
    text: string
    author: string
    date: string
  }>
  createdAt: string
  hasNotification?: boolean
  notificationMessage?: string
  status?: 'pending' | 'in_progress' | 'completed'
  startedAt?: string
  timeSpent?: number
}

interface User {
  id: string
  username: string
  name: string
  role: string
}

export default function TasksPage() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [filter, setFilter] = useState<'all' | 'my' | 'completed' | 'pending'>('all')

  const [catalog, setCatalog] = useState<any[]>([])
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignedTo: '',
    assignedToName: '',
    dueDate: new Date().toISOString().split('T')[0],
    category: 'general',
    songId: '',
    hasNotification: false,
    notificationMessage: '',
  })
  const [activeTimers, setActiveTimers] = useState<Record<string, number>>({})
  const [showNotification, setShowNotification] = useState<{taskId: string; message: string} | null>(null)

  useEffect(() => {
    fetchTasks()
    fetchUsers()
    fetchCatalog()
  }, [])

  // Update timers for in-progress tasks
  useEffect(() => {
    const interval = setInterval(() => {
      const inProgressTasks = tasks.filter(t => t.status === 'in_progress' && t.startedAt)
      const newTimers: Record<string, number> = {}
      
      inProgressTasks.forEach(task => {
        if (task.startedAt) {
          const elapsed = Math.floor((Date.now() - new Date(task.startedAt).getTime()) / 1000)
          newTimers[task.id] = elapsed
        }
      })
      
      setActiveTimers(newTimers)
    }, 1000)

    return () => clearInterval(interval)
  }, [tasks])

  const fetchCatalog = async () => {
    try {
      const res = await fetch('/api/catalog')
      const data = await res.json()
      if (data.success) {
        setCatalog(data.catalog)
      }
    } catch (error) {
      console.error('Failed to fetch catalog:', error)
    }
  }

  const fetchTasks = async () => {
    try {
      const url = user?.role === 'admin' 
        ? '/api/tasks'
        : `/api/tasks?assignedTo=${user?.id}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        setTasks(data.tasks)
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
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

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    }
    return `${minutes}m ${secs}s`
  }

  const handleStartTask = async (task: Task) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, action: 'start' }),
      })

      const data = await res.json()
      if (data.success) {
        fetchTasks()
        
        // Show notification if task has one
        if (task.hasNotification && task.notificationMessage) {
          setShowNotification({ taskId: task.id, message: task.notificationMessage })
          setTimeout(() => setShowNotification(null), 10000) // Auto-dismiss after 10 seconds
        }
      }
    } catch (error) {
      console.error('Failed to start task:', error)
    }
  }

  const handleCompleteTask = async (task: Task) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, action: 'complete' }),
      })

      const data = await res.json()
      if (data.success) {
        fetchTasks()
      }
    } catch (error) {
      console.error('Failed to complete task:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/tasks', {
        method: editingTask ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTask 
          ? { id: editingTask.id, ...formData, songId: formData.songId || undefined }
          : { ...formData, songId: formData.songId || undefined, hasNotification: formData.hasNotification || false, notificationMessage: formData.notificationMessage || undefined }
        ),
      })

      const data = await res.json()
      if (data.success) {
        setShowAddModal(false)
        setEditingTask(null)
        setFormData({ title: '', description: '', assignedTo: '', assignedToName: '', dueDate: new Date().toISOString().split('T')[0], category: 'general', songId: '', hasNotification: false, notificationMessage: '' })
        fetchTasks()
      }
    } catch (error) {
      console.error('Failed to save task:', error)
    }
  }

  const toggleComplete = async (id: string, completed: boolean) => {
    try {
      await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, completed: !completed }),
      })
      fetchTasks()
    } catch (error) {
      console.error('Failed to update task:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return

    try {
      const res = await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        fetchTasks()
      }
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }

  const filteredTasks = tasks.filter(task => {
    if (filter === 'my') return task.assignedTo === user?.id
    if (filter === 'completed') return task.completed
    if (filter === 'pending') return !task.completed
    return true
  })

  const myTasks = tasks.filter(t => t.assignedTo === user?.id)
  const completedCount = myTasks.filter(t => t.completed).length

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
          <h1 className="text-3xl font-bold text-white mb-2">Tasks</h1>
          <p className="text-slate-400">
            {user?.role === 'admin' ? 'Manage all tasks' : `${completedCount} of ${myTasks.length} tasks completed`}
          </p>
        </div>
        {(user?.role === 'admin' || user?.role === 'manager') && (
          <button
            onClick={() => {
            setEditingTask(null)
            setFormData({ title: '', description: '', assignedTo: '', assignedToName: '', dueDate: new Date().toISOString().split('T')[0], category: 'general', songId: '', hasNotification: false, notificationMessage: '' })
            setShowAddModal(true)
            }}
            className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
          >
            <Plus className="w-5 h-5" />
            <span>Add Task</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-2 border-b border-slate-800">
        {['all', 'my', 'pending', 'completed'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`px-4 py-2 text-sm font-medium transition ${
              filter === f
                ? 'text-red-400 border-b-2 border-red-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Tasks List */}
      <div className="space-y-4">
        {filteredTasks.length === 0 ? (
          <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-12 border border-slate-800 text-center">
            <Calendar className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No tasks found</p>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div
              key={task.id}
              className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg"
            >
              <div className="flex items-start space-x-4">
                <button
                  onClick={() => toggleComplete(task.id, task.completed)}
                  className="mt-1 flex-shrink-0"
                >
                  {task.completed ? (
                    <CheckCircle className="w-6 h-6 text-green-400" />
                  ) : (
                    <Circle className="w-6 h-6 text-slate-500" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className={`text-lg font-semibold ${task.completed || task.status === 'completed' ? 'line-through text-slate-500' : 'text-white'}`}>
                        {task.title}
                      </h3>
                      <p className="text-sm text-slate-400 mt-1">{task.description}</p>
                      
                      {/* Show timer if task is in progress */}
                      {task.status === 'in_progress' && task.startedAt && (
                        <div className="mt-2 flex items-center space-x-2">
                          <div className="flex items-center space-x-1 text-green-400">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <span className="text-sm font-mono">
                              {formatTime(activeTimers[task.id] || 0)}
                            </span>
                          </div>
                          {task.timeSpent && task.timeSpent > 0 && (
                            <span className="text-xs text-slate-500">
                              (Previously: {formatTime(task.timeSpent)})
                            </span>
                          )}
                        </div>
                      )}
                      
                      {/* Show total time if completed */}
                      {task.status === 'completed' && task.timeSpent && (
                        <p className="text-xs text-slate-500 mt-1">
                          Time spent: {formatTime(task.timeSpent)}
                        </p>
                      )}
                    </div>
                    {(user?.role === 'admin' || user?.role === 'manager') && (
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => {
                            setEditingTask(task)
                            // Check if assigned user exists in users list
                            const assignedUserExists = users.some(u => u.id === task.assignedTo)
                            setFormData({
                              title: task.title,
                              description: task.description,
                              assignedTo: assignedUserExists ? task.assignedTo : '',
                              assignedToName: assignedUserExists ? task.assignedToName : '',
                              dueDate: task.dueDate.split('T')[0],
                              category: task.category,
                              songId: task.songId || '',
                              hasNotification: task.hasNotification || false,
                              notificationMessage: task.notificationMessage || '',
                            })
                            setShowAddModal(true)
                          }}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(task.id)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex items-center space-x-2 mt-3">
                    {task.status === 'pending' && !task.completed && (
                      <button
                        onClick={() => handleStartTask(task)}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition"
                      >
                        Start Task
                      </button>
                    )}
                    
                    {task.status === 'in_progress' && (
                      <button
                        onClick={() => handleCompleteTask(task)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition"
                      >
                        Complete Task
                      </button>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-4 mt-3 text-sm">
                    <div className="flex items-center space-x-1 text-slate-400">
                      <User className="w-4 h-4" />
                      <span>{task.assignedToName}</span>
                    </div>
                    <div className="flex items-center space-x-1 text-slate-400">
                      <Calendar className="w-4 h-4" />
                      <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                    </div>
                    <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">
                      {task.category}
                    </span>
                    {task.songId && (
                      <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs flex items-center space-x-1">
                        <Music className="w-3 h-3" />
                        <span>Song Task</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold text-white mb-4">
              {editingTask ? 'Edit Task' : 'Add Task'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Assign To</label>
                <select
                  value={formData.assignedTo && users.some(u => u.id === formData.assignedTo) ? formData.assignedTo : ''}
                  onChange={(e) => {
                    const selectedUser = users.find(u => u.id === e.target.value)
                    setFormData({ 
                      ...formData, 
                      assignedTo: e.target.value,
                      assignedToName: selectedUser?.name || ''
                    })
                  }}
                  required
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="">Select user...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
                {formData.assignedTo && !users.some(u => u.id === formData.assignedTo) && (
                  <p className="text-xs text-yellow-400 mt-1">
                    Selected user not found. Please select a user from the list.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Due Date</label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  required
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="general">General</option>
                  <option value="release">Release</option>
                  <option value="marketing">Marketing</option>
                  <option value="content">Content</option>
                  <option value="analytics">Analytics</option>
                </select>
              </div>
              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-slate-300 mb-2">
                  <input
                    type="checkbox"
                    checked={formData.hasNotification}
                    onChange={(e) => setFormData({ ...formData, hasNotification: e.target.checked })}
                    className="rounded"
                  />
                  <span>Show notification when task is started</span>
                </label>
              </div>
              {formData.hasNotification && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Notification Message
                  </label>
                  <textarea
                    value={formData.notificationMessage}
                    onChange={(e) => setFormData({ ...formData, notificationMessage: e.target.value })}
                    rows={3}
                    placeholder="e.g., Style One's name might be Crystal Marie Ashley on the MLC but Style One on ASCAP"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              )}
              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  {editingTask ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setEditingTask(null)
                  }}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notification Modal */}
      {showNotification && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border-2 border-yellow-500 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold">!</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-2">Task Notification</h3>
                <p className="text-slate-300 whitespace-pre-line">{showNotification.message}</p>
              </div>
              <button
                onClick={() => setShowNotification(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

