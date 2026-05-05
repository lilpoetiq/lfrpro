'use client'

import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react'

interface AudioPlayerState {
  currentTrack: {
    id: string
    song: string
    artist: string
    audioUrl: string
    songId?: string
  } | null
  isPlaying: boolean
  currentTime: number
  duration: number
  audioRef: HTMLAudioElement | null
}

interface AudioPlayerContextType extends AudioPlayerState {
  playTrack: (track: { id: string; song: string; artist: string; audioUrl: string; songId?: string }) => void
  pauseTrack: () => void
  stopTrack: () => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined)

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<AudioPlayerState['currentTrack']>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

      // Create audio element if it doesn't exist
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
      // Use 'metadata' preload for faster initial load - starts playing sooner
      audioRef.current.preload = 'metadata'
      audioRef.current.addEventListener('timeupdate', () => {
        if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime)
        }
      })
      audioRef.current.addEventListener('loadedmetadata', () => {
        if (audioRef.current) {
          setDuration(audioRef.current.duration)
        }
      })
      audioRef.current.addEventListener('loadeddata', () => {
        // Audio has enough data to start playing - this fires faster than 'canplay'
      })
      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false)
        setCurrentTime(0)
      })
      audioRef.current.addEventListener('play', () => setIsPlaying(true))
      audioRef.current.addEventListener('pause', () => setIsPlaying(false))
      audioRef.current.addEventListener('error', (e) => {
        const audio = e.target as HTMLAudioElement
        const error = audio.error
        
        // Don't handle errors if there's no source set (initial state)
        if (!audio.src || audio.src === window.location.href) {
          return
        }
        
        if (error) {
          let errorMessage = 'Unknown audio error'
          switch (error.code) {
            case MediaError.MEDIA_ERR_ABORTED:
              errorMessage = 'Audio loading aborted'
              break
            case MediaError.MEDIA_ERR_NETWORK:
              errorMessage = 'Network error while loading audio'
              break
            case MediaError.MEDIA_ERR_DECODE:
              errorMessage = 'Audio decoding error'
              break
            case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
              errorMessage = 'Audio format not supported'
              break
          }
          // Only log actual errors, not aborted loads (which are normal when switching tracks)
          if (error.code !== MediaError.MEDIA_ERR_ABORTED) {
            console.error('Audio playback error:', errorMessage, { code: error.code, src: audio.src })
            setIsPlaying(false)
            setCurrentTrack(null)
          }
        }
      })
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const playTrack = (track: { id: string; song: string; artist: string; audioUrl: string; songId?: string }) => {
    if (!audioRef.current) return
    
    // Convert relative URLs to absolute URLs
    let audioUrl = track.audioUrl
    if (!audioUrl) {
      console.error('No audioUrl provided for track:', track)
      return
    }
    
    if (audioUrl && !audioUrl.startsWith('http') && !audioUrl.startsWith('//')) {
      // If it's a relative path, make it absolute
      if (audioUrl.startsWith('/')) {
        audioUrl = typeof window !== 'undefined' ? `${window.location.origin}${audioUrl}` : audioUrl
      } else {
        audioUrl = typeof window !== 'undefined' ? `${window.location.origin}/${audioUrl}` : audioUrl
      }
    }
    
    // If same track, toggle play/pause
    if (currentTrack?.id === track.id && audioRef.current.src === audioUrl) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play().catch((error) => {
          // Only log if it's not a user-initiated abort
          if (error.name !== 'AbortError' && error.name !== 'NotAllowedError') {
            console.error('Failed to play audio:', error.name, error.message)
          }
          setIsPlaying(false)
        })
      }
    } else {
      // New track - stop current, load new, and play
      try {
        // Stop current audio first
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        
        // Set new source - don't call load() explicitly, let browser handle it
        // This allows the browser to start buffering immediately
        audioRef.current.src = audioUrl
        // Reset preload to metadata for faster initial load
        audioRef.current.preload = 'metadata'
        
        // Try to play immediately - browser will buffer as needed
        const playPromise = audioRef.current.play()
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setCurrentTrack(track)
              setIsPlaying(true)
              // Once playing, switch to auto preload for better buffering
              if (audioRef.current) {
                audioRef.current.preload = 'auto'
              }
            })
            .catch((error) => {
              // If play fails, wait for 'loadeddata' event (faster than 'canplay')
              const onLoadedData = () => {
                audioRef.current?.removeEventListener('loadeddata', onLoadedData)
                audioRef.current?.removeEventListener('error', onError)
                audioRef.current?.play()
                  .then(() => {
                    setCurrentTrack(track)
                    setIsPlaying(true)
                    if (audioRef.current) {
                      audioRef.current.preload = 'auto'
                    }
                  })
                  .catch((playError) => {
                    if (playError.name !== 'AbortError' && playError.name !== 'NotAllowedError') {
                      console.error('Failed to play audio after load:', playError.name, playError.message, { audioUrl })
                    }
                    setIsPlaying(false)
                    setCurrentTrack(null)
                  })
              }
              
              const onError = (e: any) => {
                audioRef.current?.removeEventListener('loadeddata', onLoadedData)
                audioRef.current?.removeEventListener('error', onError)
                const audio = e.target as HTMLAudioElement
                const audioError = audio.error
                if (audioError && audioError.code !== MediaError.MEDIA_ERR_ABORTED) {
                  console.error('Audio load error:', audioError.code, { audioUrl })
                }
                setIsPlaying(false)
                setCurrentTrack(null)
              }
              
              if (audioRef.current) {
                audioRef.current.addEventListener('loadeddata', onLoadedData, { once: true })
                audioRef.current.addEventListener('error', onError, { once: true })
              }
            })
        }
      } catch (error: any) {
        console.error('Error setting up audio:', error)
        setIsPlaying(false)
        setCurrentTrack(null)
      }
    }
  }

  const pauseTrack = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(false)
    }
  }

  const stopTrack = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlaying(false)
      setCurrentTime(0)
      setCurrentTrack(null)
    }
  }

  const handleSetCurrentTime = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const handleSetDuration = (dur: number) => {
    setDuration(dur)
  }

  return (
    <AudioPlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        audioRef: audioRef.current,
        playTrack,
        pauseTrack,
        stopTrack,
        setCurrentTime: handleSetCurrentTime,
        setDuration: handleSetDuration,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  )
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext)
  if (context === undefined) {
    throw new Error('useAudioPlayer must be used within AudioPlayerProvider')
  }
  return context
}





