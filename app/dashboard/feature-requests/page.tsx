'use client'

import { useState, useEffect } from 'react'
import { Lightbulb, User, Calendar } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface FeatureRequest {
  id: string
  userId: string
  userName: string
  message: string
  createdAt: string
  status: string
}

export default function FeatureRequestsPage() {
  const { user } = useAuth()
  const [requests, setRequests] = useState<FeatureRequest[]>([])
  const [loading, setLoading] = useState(true)
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    if (!user?.id) return
    const fetchRequests = async () => {
      try {
        const url = isAdmin
          ? `/api/feature-requests?userId=${user.id}&admin=true`
          : `/api/feature-requests?userId=${user.id}`
        const res = await fetch(url)
        const data = await res.json()
        if (data.success) setRequests(data.requests || [])
      } catch (e) {
        setRequests([])
      } finally {
        setLoading(false)
      }
    }
    fetchRequests()
  }, [user?.id, isAdmin])

  if (!isAdmin) {
    return (
      <div className="p-6">
        <p className="text-slate-400">You can submit feature requests from Account & Settings (click your name in the sidebar).</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Feature Requests</h1>
        <p className="text-slate-400">Suggestions from the team for things to add to the site.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-12 text-center">
          <Lightbulb className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No feature requests yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <div
              key={r.id}
              className="bg-slate-900/50 rounded-xl border border-slate-800 p-4"
            >
              <p className="text-white mb-3">{r.message}</p>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {r.userName}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(r.createdAt).toLocaleDateString()}
                </span>
                <span className="capitalize">{r.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
