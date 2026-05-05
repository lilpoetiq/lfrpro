'use client'

import { useEffect, useState } from 'react'

interface ProgressBarProps {
  isLoading: boolean
  progress?: number // 0-100
  message?: string
  estimatedTime?: number // seconds
  showTime?: boolean
}

export default function ProgressBar({ isLoading, progress, message, estimatedTime, showTime = true }: ProgressBarProps) {
  const [elapsedTime, setElapsedTime] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(estimatedTime || 0)
  const [displayProgress, setDisplayProgress] = useState(0)
  const [startTimeRef, setStartTimeRef] = useState<number | null>(null)

  useEffect(() => {
    if (!isLoading) {
      setElapsedTime(0)
      setDisplayProgress(0)
      setTimeRemaining(estimatedTime || 0)
      setStartTimeRef(null)
      return
    }

    // Initialize start time when loading begins
    if (startTimeRef === null) {
      const now = Date.now()
      setStartTimeRef(now)
    }

    const initialEstimated = estimatedTime || 35
    setTimeRemaining(initialEstimated)
    
    const interval = setInterval(() => {
      const startTime = startTimeRef || Date.now()
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      setElapsedTime(elapsed)
      
      // Calculate remaining time based on elapsed time - this updates the countdown
      if (initialEstimated) {
        const remaining = Math.max(0, initialEstimated - elapsed)
        setTimeRemaining(remaining)
      }
      
      // Use provided progress if available, otherwise simulate based on elapsed time
      if (progress !== undefined && progress > 0) {
        // Use provided progress, but also sync with elapsed time for countdown
        setDisplayProgress(progress)
      } else {
        // Simulate progress based on elapsed time and estimated time
        if (initialEstimated) {
          const simulatedProgress = Math.min(95, (elapsed / initialEstimated) * 100)
          setDisplayProgress(simulatedProgress)
        } else {
          // Indeterminate progress
          setDisplayProgress((prev) => (prev >= 90 ? 10 : prev + 2))
        }
      }
    }, 100) // Update every 100ms for smooth countdown

    return () => clearInterval(interval)
  }, [isLoading, progress, estimatedTime, startTimeRef])

  if (!isLoading) return null

  const formatTime = (seconds: number) => {
    // Always show seconds format: "Xs" for under 60s, "Xm Ys" for 60s+
    if (seconds < 60) {
      return `${seconds}s`
    }
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
  }

  return (
    <div className="w-full space-y-2">
      {message && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-300">{message}</span>
          {showTime && estimatedTime && (
            <span className="text-slate-400">
              {timeRemaining > 0 ? `${formatTime(timeRemaining)} remaining` : 'Finishing...'}
            </span>
          )}
        </div>
      )}
      <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
        <div
          className="bg-gradient-to-r from-red-600 to-red-500 h-2.5 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${displayProgress}%` }}
        />
      </div>
      {estimatedTime && elapsedTime >= estimatedTime && (
        <p className="text-xs text-slate-500">Taking longer than expected...</p>
      )}
    </div>
  )
}

