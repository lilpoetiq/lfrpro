'use client'

import { useAuth } from '@/contexts/AuthContext'
import { Music, Lock } from 'lucide-react'

export default function BrowseBeatsPage() {
  const { user } = useAuth()

  if (!user) {
    return (
      <div className="p-8">
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
          <p className="text-red-400">Please log in to browse beats.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <Music className="w-24 h-24 text-slate-600" />
              <Lock className="w-8 h-8 text-slate-500 absolute -bottom-2 -right-2 bg-slate-900 rounded-full p-1.5" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Browse Beats</h1>
          <p className="text-2xl text-slate-400 mb-2">Coming Soon</p>
          <p className="text-slate-500 text-sm">
            This feature is currently under development. Check back soon!
          </p>
        </div>
      </div>
    </div>
  )
}
