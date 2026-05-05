'use client'

import { useAudioPlayer } from '@/contexts/AudioPlayerContext'
import { Play, Pause, X, Maximize2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function MiniAudioPlayer() {
  const { currentTrack, isPlaying, currentTime, duration, playTrack, pauseTrack, stopTrack, setCurrentTime } = useAudioPlayer()
  const router = useRouter()
  const [isExpanded, setIsExpanded] = useState(false)

  // Format time helper
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Calculate progress percentage
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  // Don't render if no track is playing
  if (!currentTrack) return null

  const handlePlayPause = () => {
    if (isPlaying) {
      pauseTrack()
    } else {
      if (currentTrack) {
        playTrack(currentTrack)
      }
    }
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    const newTime = percentage * duration
    setCurrentTime(newTime)
  }

  const handleGoToSong = () => {
    if (currentTrack.songId) {
      router.push(`/dashboard/catalog/${encodeURIComponent(currentTrack.songId)}`)
    }
  }

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-[9999] pointer-events-none"
      style={{
        marginLeft: 'var(--sidebar-width, 0px)',
        width: 'calc(100% - var(--sidebar-width, 0px))',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 pb-4 pointer-events-auto">
        <div 
          className={`bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-lg shadow-2xl transition-all duration-300 ${
            isExpanded ? 'p-4' : 'p-3'
          }`}
          style={{
            boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Progress bar */}
          <div 
            className="absolute top-0 left-0 right-0 h-1 bg-slate-800 cursor-pointer group"
            onClick={handleSeek}
          >
            <div 
              className="h-full bg-red-500 transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center gap-4">
            {/* Album cover placeholder */}
            <div 
              className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-red-500/20 to-slate-800 rounded-lg flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 text-red-400" />
              ) : (
                <Play className="w-6 h-6 text-red-400 ml-0.5" />
              )}
            </div>

            {/* Track info */}
            <div className="flex-1 min-w-0">
              <div 
                className="text-white font-semibold truncate cursor-pointer hover:text-red-400 transition"
                onClick={handleGoToSong}
                title={currentTrack.song}
              >
                {currentTrack.song}
              </div>
              <div className="text-slate-400 text-sm truncate">
                {currentTrack.artist}
              </div>
              {isExpanded && (
                <div className="text-slate-500 text-xs mt-1">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePlayPause}
                className="w-10 h-10 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 text-white" />
                ) : (
                  <Play className="w-5 h-5 text-white ml-0.5" />
                )}
              </button>

              {currentTrack.songId && (
                <button
                  onClick={handleGoToSong}
                  className="w-8 h-8 text-slate-400 hover:text-white rounded transition-colors"
                  title="Go to song page"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={stopTrack}
                className="w-8 h-8 text-slate-400 hover:text-red-400 rounded transition-colors"
                title="Stop"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Expanded view with seek bar */}
          {isExpanded && (
            <div className="mt-4">
              <div 
                className="h-2 bg-slate-800 rounded-full cursor-pointer group"
                onClick={handleSeek}
              >
                <div 
                  className="h-full bg-red-500 rounded-full transition-all duration-100 relative"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
