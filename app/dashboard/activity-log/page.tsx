'use client'

import { useState, useEffect } from 'react'
import { Activity, Filter, Calendar, User, Tag, AlertCircle, XCircle, AlertTriangle, Info } from 'lucide-react'

interface ActivityLogEntry {
  id: string
  timestamp: string
  action: string
  user: string
  userId?: string
  details: Record<string, any>
  category: 'catalog' | 'upload' | 'analysis' | 'user' | 'task' | 'checklist' | 'vault' | 'system' | 'chat' | 'auth' | 'beats' | 'release' | 'error'
}

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [limit, setLimit] = useState(100)

  useEffect(() => {
    fetchLogs()
  }, [filter, limit])

  const fetchLogs = async () => {
    try {
      const url = `/api/activity-log?limit=${limit}${filter !== 'all' ? `&category=${filter}` : ''}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        setLogs(data.logs)
      }
    } catch (error) {
      console.error('Failed to fetch activity log:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const categories: Array<{ value: string; label: string; color: string }> = [
    { value: 'all', label: 'All', color: 'slate' },
    { value: 'catalog', label: 'Catalog', color: 'blue' },
    { value: 'upload', label: 'Uploads', color: 'green' },
    { value: 'analysis', label: 'Analysis', color: 'purple' },
    { value: 'task', label: 'Tasks', color: 'yellow' },
    { value: 'checklist', label: 'Checklist', color: 'red' },
    { value: 'vault', label: 'Vault', color: 'orange' },
    { value: 'system', label: 'System', color: 'gray' },
    { value: 'chat', label: 'AI Chat', color: 'cyan' },
    { value: 'auth', label: 'Login/Logout', color: 'pink' },
    { value: 'error', label: 'Errors', color: 'red' },
    { value: 'release', label: 'Releases', color: 'indigo' },
  ]

  const getCategoryColor = (category: string) => {
    const cat = categories.find(c => c.value === category)
    return cat?.color || 'slate'
  }

  const formatDetails = (details: Record<string, any>) => {
    return Object.entries(details)
      .filter(([key]) => key !== 'songId' && key !== 'id' && key !== 'errorCode' && key !== 'errorType' && key !== 'severity' && key !== 'resolved')
      .map(([key, value]) => {
        if (typeof value === 'object') {
          return `${key}: ${JSON.stringify(value)}`
        }
        return `${key}: ${value}`
      })
      .join(', ')
  }

  const getSeverityIcon = (severity?: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'high':
        return <AlertCircle className="w-4 h-4 text-orange-500" />
      case 'medium':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />
      case 'low':
        return <Info className="w-4 h-4 text-blue-500" />
      default:
        return null
    }
  }

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'critical':
        return 'border-red-500 bg-red-500/10'
      case 'high':
        return 'border-orange-500 bg-orange-500/10'
      case 'medium':
        return 'border-yellow-500 bg-yellow-500/10'
      case 'low':
        return 'border-blue-500 bg-blue-500/10'
      default:
        return 'border-slate-700 bg-slate-800/30'
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Activity Log</h1>
          <p className="text-slate-400">Track all system activities and changes</p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value))}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
          >
            <option value={50}>Last 50</option>
            <option value={100}>Last 100</option>
            <option value={250}>Last 250</option>
            <option value={500}>Last 500</option>
          </select>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-2 flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setFilter(cat.value)}
            className={`px-4 py-2 rounded-lg transition ${
              filter === cat.value
                ? `bg-${cat.color}-600 text-white`
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Logs */}
      <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl border border-slate-800 shadow-lg">
        <div className="p-6">
          {logs.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No activity logs found</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {logs.map((log) => {
                const isError = log.category === 'error'
                const severity = log.details?.severity
                const errorCode = log.details?.errorCode
                const errorType = log.details?.errorType
                const isResolved = log.details?.resolved === true
                
                return (
                  <div
                    key={log.id}
                    className={`p-4 rounded-lg border transition ${
                      isError 
                        ? getSeverityColor(severity)
                        : 'bg-slate-800/30 border-slate-700 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          {isError && getSeverityIcon(severity)}
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold bg-${getCategoryColor(log.category)}-600/20 text-${getCategoryColor(log.category)}-400`}
                          >
                            {log.category}
                            {isError && severity && ` (${severity})`}
                            {isResolved && ' [Resolved]'}
                          </span>
                          <h3 className={`font-semibold ${isError ? 'text-red-300' : 'text-white'}`}>
                            {log.action}
                          </h3>
                        </div>
                        {isError && errorCode && (
                          <div className="mb-2">
                            <span className="text-xs text-slate-400 font-mono bg-slate-900/50 px-2 py-1 rounded">
                              {errorCode}
                              {errorType && ` - ${errorType}`}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center space-x-4 text-sm text-slate-400 mb-2">
                          <div className="flex items-center space-x-1">
                            <User className="w-4 h-4" />
                            <span>{log.user}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(log.timestamp).toLocaleString()}</span>
                          </div>
                          {log.details?.endpoint && (
                            <div className="flex items-center space-x-1">
                              <Tag className="w-4 h-4" />
                              <span className="text-xs">{log.details.method} {log.details.endpoint}</span>
                            </div>
                          )}
                        </div>
                        {Object.keys(log.details).length > 0 && (
                          <div className={`mt-2 p-2 rounded text-xs ${
                            isError ? 'bg-slate-900/70 text-slate-200' : 'bg-slate-900/50 text-slate-300'
                          }`}>
                            <p>{formatDetails(log.details)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

