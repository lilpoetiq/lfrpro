'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { AlertCircle, CheckCircle2, XCircle, Info, Filter, Search, Check, X, RefreshCw } from 'lucide-react'
import { ErrorCode } from '@/lib/errorLogger'

interface ErrorLogEntry {
  id: string
  timestamp: string
  errorCode: string
  type: string
  message: string
  userId?: string
  userName?: string
  userRole?: string
  endpoint?: string
  method?: string
  details: Record<string, any>
  stack?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  resolved: boolean
  resolvedAt?: string
  resolvedBy?: string
  notes?: string
}

interface ErrorStats {
  total: number
  bySeverity: Record<string, number>
  byErrorCode: Record<string, number>
  unresolved: number
  recent24h: number
}

export default function ErrorLogsPage() {
  const { user } = useAuth()
  const [logs, setLogs] = useState<ErrorLogEntry[]>([])
  const [stats, setStats] = useState<ErrorStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    severity: '',
    errorCode: '',
    resolved: '',
    search: '',
  })
  const [selectedLog, setSelectedLog] = useState<ErrorLogEntry | null>(null)
  const [resolveNotes, setResolveNotes] = useState('')

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchLogs()
    }
  }, [user, filters])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.severity) params.append('severity', filters.severity)
      if (filters.errorCode) params.append('errorCode', filters.errorCode)
      if (filters.resolved !== '') params.append('resolved', filters.resolved)
      params.append('limit', '200')

      const res = await fetch(`/api/error-logs?${params}`)
      const data = await res.json()
      
      if (data.success) {
        let filteredLogs = data.logs
        
        // Apply search filter
        if (filters.search) {
          const searchLower = filters.search.toLowerCase()
          filteredLogs = filteredLogs.filter((log: ErrorLogEntry) =>
            log.message.toLowerCase().includes(searchLower) ||
            log.errorCode.toLowerCase().includes(searchLower) ||
            log.type.toLowerCase().includes(searchLower) ||
            log.userName?.toLowerCase().includes(searchLower) ||
            log.endpoint?.toLowerCase().includes(searchLower)
          )
        }
        
        setLogs(filteredLogs)
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch error logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleResolve = async (logId: string) => {
    try {
      const res = await fetch('/api/error-logs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errorId: logId,
          notes: resolveNotes || undefined,
          userId: user?.id,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setSelectedLog(null)
        setResolveNotes('')
        fetchLogs()
      }
    } catch (error) {
      console.error('Failed to resolve error:', error)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-500 bg-red-500/10 border-red-500/20'
      case 'high':
        return 'text-orange-500 bg-orange-500/10 border-orange-500/20'
      case 'medium':
        return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20'
      case 'low':
        return 'text-blue-500 bg-blue-500/10 border-blue-500/20'
      default:
        return 'text-slate-500 bg-slate-500/10 border-slate-500/20'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-4 h-4" />
      case 'high':
        return <AlertCircle className="w-4 h-4" />
      case 'medium':
        return <Info className="w-4 h-4" />
      case 'low':
        return <CheckCircle2 className="w-4 h-4" />
      default:
        return <Info className="w-4 h-4" />
    }
  }

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">Admin access required</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Error Logs</h1>
          <p className="text-slate-400">Monitor and investigate system errors</p>
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-4 border border-slate-800">
            <div className="text-slate-400 text-sm mb-1">Total Errors</div>
            <div className="text-2xl font-bold text-white">{stats.total}</div>
          </div>
          <div className="bg-gradient-to-br from-red-900/20 to-black rounded-xl p-4 border border-red-500/20">
            <div className="text-red-400 text-sm mb-1">Critical</div>
            <div className="text-2xl font-bold text-red-500">{stats.bySeverity.critical || 0}</div>
          </div>
          <div className="bg-gradient-to-br from-orange-900/20 to-black rounded-xl p-4 border border-orange-500/20">
            <div className="text-orange-400 text-sm mb-1">High</div>
            <div className="text-2xl font-bold text-orange-500">{stats.bySeverity.high || 0}</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-900/20 to-black rounded-xl p-4 border border-yellow-500/20">
            <div className="text-yellow-400 text-sm mb-1">Unresolved</div>
            <div className="text-2xl font-bold text-yellow-500">{stats.unresolved}</div>
          </div>
          <div className="bg-gradient-to-br from-blue-900/20 to-black rounded-xl p-4 border border-blue-500/20">
            <div className="text-blue-400 text-sm mb-1">Last 24h</div>
            <div className="text-2xl font-bold text-blue-500">{stats.recent24h}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-4 border border-slate-800">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Severity</label>
            <select
              value={filters.severity}
              onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
            >
              <option value="">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">Error Code</label>
            <input
              type="text"
              value={filters.errorCode}
              onChange={(e) => setFilters({ ...filters, errorCode: e.target.value })}
              placeholder="e.g. UPLOAD_1001"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">Status</label>
            <select
              value={filters.resolved}
              onChange={(e) => setFilters({ ...filters, resolved: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
            >
              <option value="">All</option>
              <option value="false">Unresolved</option>
              <option value="true">Resolved</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Search errors..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-3 py-2 text-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Error List */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-slate-400">No errors found</div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              onClick={() => setSelectedLog(log)}
              className={`bg-gradient-to-br from-slate-900 to-black rounded-xl p-4 border cursor-pointer transition hover:border-slate-600 ${
                log.resolved ? 'border-slate-700 opacity-60' : getSeverityColor(log.severity).split(' ')[2]
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className={getSeverityColor(log.severity).split(' ')[0]}>
                      {getSeverityIcon(log.severity)}
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${getSeverityColor(log.severity)}`}>
                      {log.severity.toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">{log.errorCode}</span>
                    {log.resolved && (
                      <span className="text-xs text-green-500 flex items-center space-x-1">
                        <Check className="w-3 h-3" />
                        <span>Resolved</span>
                      </span>
                    )}
                  </div>
                  <div className="text-white font-semibold mb-1">{log.message}</div>
                  <div className="text-sm text-slate-400">
                    {log.type} • {log.endpoint && `${log.method} ${log.endpoint}`}
                    {log.userName && ` • ${log.userName}`}
                    {log.timestamp && ` • ${new Date(log.timestamp).toLocaleString()}`}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl border border-slate-800 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Error Details</h2>
                <button
                  onClick={() => {
                    setSelectedLog(null)
                    setResolveNotes('')
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-sm text-slate-400 mb-1">Error Code</div>
                  <div className="text-white font-mono">{selectedLog.errorCode}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-400 mb-1">Message</div>
                  <div className="text-white">{selectedLog.message}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-400 mb-1">Type</div>
                  <div className="text-white">{selectedLog.type}</div>
                </div>
                {selectedLog.endpoint && (
                  <div>
                    <div className="text-sm text-slate-400 mb-1">Endpoint</div>
                    <div className="text-white font-mono">{selectedLog.method} {selectedLog.endpoint}</div>
                  </div>
                )}
                {selectedLog.userName && (
                  <div>
                    <div className="text-sm text-slate-400 mb-1">User</div>
                    <div className="text-white">{selectedLog.userName} ({selectedLog.userRole})</div>
                  </div>
                )}
                <div>
                  <div className="text-sm text-slate-400 mb-1">Timestamp</div>
                  <div className="text-white">{new Date(selectedLog.timestamp).toLocaleString()}</div>
                </div>
                {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                  <div>
                    <div className="text-sm text-slate-400 mb-1">Details</div>
                    <pre className="bg-slate-800 rounded-lg p-4 text-sm text-white overflow-x-auto">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                )}
                {selectedLog.stack && (
                  <div>
                    <div className="text-sm text-slate-400 mb-1">Stack Trace</div>
                    <pre className="bg-slate-800 rounded-lg p-4 text-sm text-white overflow-x-auto max-h-64 overflow-y-auto">
                      {selectedLog.stack}
                    </pre>
                  </div>
                )}
                {selectedLog.resolved && (
                  <div>
                    <div className="text-sm text-slate-400 mb-1">Resolved</div>
                    <div className="text-white">
                      {selectedLog.resolvedBy} on {selectedLog.resolvedAt && new Date(selectedLog.resolvedAt).toLocaleString()}
                      {selectedLog.notes && (
                        <div className="mt-2 text-slate-300">{selectedLog.notes}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {!selectedLog.resolved && (
                <div className="mt-6 pt-6 border-t border-slate-800">
                  <div className="mb-4">
                    <label className="block text-sm text-slate-400 mb-2">Resolution Notes (Optional)</label>
                    <textarea
                      value={resolveNotes}
                      onChange={(e) => setResolveNotes(e.target.value)}
                      placeholder="Add notes about how this error was resolved..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white min-h-[100px]"
                    />
                  </div>
                  <button
                    onClick={() => handleResolve(selectedLog.id)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition"
                  >
                    Mark as Resolved
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
