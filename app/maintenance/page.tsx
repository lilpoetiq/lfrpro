'use client'

import { useState, useEffect } from 'react'
import { Loader2, Wrench, Clock, AlertCircle, Phone, FileText } from 'lucide-react'
import { SUPPORT_PHONE, CATALOG_BACKUP_URL } from '@/lib/errorRecovery'

interface MaintenanceInfo {
  isActive: boolean
  estimatedDuration?: string // e.g., "30 minutes", "2 hours"
  estimatedEndTime?: string // ISO timestamp
  updateDescription?: string // What's being updated
  startedAt?: string // ISO timestamp
}

export default function MaintenancePage() {
  const [maintenanceInfo, setMaintenanceInfo] = useState<MaintenanceInfo | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchMaintenanceInfo()
    // Check every 30 seconds for updates
    const interval = setInterval(fetchMaintenanceInfo, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (maintenanceInfo?.estimatedEndTime) {
      const updateTimeRemaining = () => {
        const now = new Date().getTime()
        const endTime = new Date(maintenanceInfo.estimatedEndTime!).getTime()
        const diff = endTime - now

        if (diff <= 0) {
          setTimeRemaining('Maintenance should be complete soon')
          return
        }

        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((diff % (1000 * 60)) / 1000)

        if (hours > 0) {
          setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`)
        } else if (minutes > 0) {
          setTimeRemaining(`${minutes}m ${seconds}s`)
        } else {
          setTimeRemaining(`${seconds}s`)
        }
      }

      updateTimeRemaining()
      const interval = setInterval(updateTimeRemaining, 1000)
      return () => clearInterval(interval)
    }
  }, [maintenanceInfo?.estimatedEndTime])

  const fetchMaintenanceInfo = async () => {
    try {
      const res = await fetch('/api/maintenance')
      const data = await res.json()
      setMaintenanceInfo(data)
      
      // If maintenance is no longer active, redirect to home
      if (!data.isActive) {
        window.location.href = '/'
      }
    } catch (error) {
      console.error('Failed to fetch maintenance info:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-red-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  const startedAt = maintenanceInfo?.startedAt 
    ? new Date(maintenanceInfo.startedAt).toLocaleString()
    : 'Recently'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-black flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-500/20 rounded-full mb-4">
            <Wrench className="w-10 h-10 text-red-400 animate-pulse" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Under Maintenance</h1>
          <p className="text-slate-400">We're currently updating the system to serve you better</p>
        </div>

        <div className="space-y-6">
          {maintenanceInfo?.updateDescription && (
            <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-700">
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-blue-400" />
                <span>What's Being Updated</span>
              </h2>
              <p className="text-slate-300 leading-relaxed">{maintenanceInfo.updateDescription}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {maintenanceInfo?.estimatedDuration && (
              <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-700">
                <div className="flex items-center space-x-2 mb-2">
                  <Clock className="w-5 h-5 text-yellow-400" />
                  <h3 className="text-sm font-medium text-slate-400">Estimated Duration</h3>
                </div>
                <p className="text-2xl font-bold text-white">{maintenanceInfo.estimatedDuration}</p>
              </div>
            )}

            {timeRemaining && (
              <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-700">
                <div className="flex items-center space-x-2 mb-2">
                  <Clock className="w-5 h-5 text-green-400" />
                  <h3 className="text-sm font-medium text-slate-400">Time Remaining</h3>
                </div>
                <p className="text-2xl font-bold text-white">{timeRemaining}</p>
              </div>
            )}
          </div>

          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
            <p className="text-sm text-slate-400">
              Maintenance started: <span className="text-white font-medium">{startedAt}</span>
            </p>
          </div>

          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 space-y-3">
            <p className="text-sm text-slate-400">Need help? Contact:</p>
            <a href={`tel:${SUPPORT_PHONE}`} className="inline-flex items-center gap-2 text-red-400 font-semibold hover:text-red-300">
              <Phone className="w-4 h-4" />
              {SUPPORT_PHONE}
            </a>
            <p className="text-sm text-slate-500 pt-2">Catalog backup (if site is down):</p>
            <a
              href={CATALOG_BACKUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-sm"
            >
              <FileText className="w-4 h-4" />
              Label Catalog (Google Doc)
            </a>
          </div>

          <div className="text-center pt-4">
            <p className="text-sm text-slate-500 mb-4">
              This page will automatically refresh when maintenance is complete
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-lg transition"
            >
              <Loader2 className="w-4 h-4" />
              <span>Check Status</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}












