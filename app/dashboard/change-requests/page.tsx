'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { FileText, Check, X, AlertCircle, Link as LinkIcon } from 'lucide-react'
import Link from 'next/link'

interface ChangeRequest {
  id: string
  songId: string
  songName: string
  artistName: string
  requestedBy: string
  requestedByName: string
  requestedAt: string
  changes: string
  status: 'pending' | 'approved' | 'denied'
  reviewedBy?: string
  reviewedAt?: string
}

export default function ChangeRequestsPage() {
  const { user } = useAuth()
  const [requests, setRequests] = useState<ChangeRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'denied'>('pending')
  const canReview = user?.role === 'admin' || user?.role === 'manager'

  useEffect(() => {
    if (!user?.id) return
    fetchRequests()
  }, [user?.id, filter])

  const fetchRequests = async () => {
    if (!user?.id) return
    setIsLoading(true)
    try {
      const statusParam = filter !== 'all' ? `&status=${filter}` : ''
      const res = await fetch(`/api/catalog-change-requests?userId=${user.id}${statusParam}`)
      const data = await res.json()
      if (data.success) {
        setRequests(data.requests || [])
      }
    } catch (error) {
      console.error('Failed to fetch change requests:', error)
      setRequests([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleReview = async (id: string, status: 'approved' | 'denied') => {
    if (!user?.id) return
    try {
      const res = await fetch('/api/catalog-change-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, reviewedBy: user.id, userId: user.id }),
      })
      const data = await res.json()
      if (data.success) {
        fetchRequests()
      }
    } catch (error) {
      console.error('Failed to review:', error)
    }
  }

  if (!user) return null
  if (!canReview && requests.length === 0 && !isLoading) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-2xl mx-auto text-center py-16">
          <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Change Requests</h1>
          <p className="text-slate-400">You have no change requests. Staff can request catalog changes from the Catalog page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <AlertCircle className="w-7 h-7 text-amber-500" />
            Change Requests
          </h1>
          {canReview && (
            <div className="flex gap-2">
              {(['pending', 'all', 'approved', 'denied'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    filter === f
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="text-slate-400 text-sm">
          {canReview
            ? 'Staff submit catalog change requests here. Approve or deny each request.'
            : 'Your submitted change requests.'}
        </p>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/50 rounded-xl border border-slate-800">
            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No change requests found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => (
              <div
                key={req.id}
                className="bg-slate-900/50 rounded-xl p-4 border border-slate-800"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/dashboard/catalog/${encodeURIComponent(req.songId)}`}
                        className="text-white font-medium hover:text-amber-400 transition"
                      >
                        {req.songName}
                      </Link>
                      <span className="text-slate-500">·</span>
                      <span className="text-slate-400">{req.artistName}</span>
                    </div>
                    <p className="text-slate-400 text-sm mt-2 whitespace-pre-wrap">{req.changes}</p>
                    <p className="text-slate-500 text-xs mt-2">
                      Requested by {req.requestedByName} on {new Date(req.requestedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`px-3 py-1 rounded text-xs font-medium ${
                        req.status === 'pending'
                          ? 'bg-amber-500/20 text-amber-400'
                          : req.status === 'approved'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {req.status}
                    </span>
                    {canReview && req.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleReview(req.id, 'approved')}
                          className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg transition"
                          title="Approve"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleReview(req.id, 'denied')}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition"
                          title="Deny"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}
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
