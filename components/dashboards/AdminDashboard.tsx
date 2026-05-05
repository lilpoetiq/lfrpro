'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp, Upload, Brain, Download, BarChart3, Activity, Music, Trash2, AlertTriangle } from 'lucide-react'
import Chart from '@/components/Chart'
import ProgressBar from '@/components/ProgressBar'
import NotificationDropdown from '@/components/NotificationDropdown'
import { formatTimeAgo } from '@/lib/utils'

interface AIInsight {
  title: string
  category: string
  insight: string
  recommendation: string
  trend: 'up' | 'down' | 'stable'
}

interface Analysis {
  id: string
  analysis: {
    insights: AIInsight[]
    summary: string
  }
  generatedAt: any
}

interface Upload {
  id: string
  fileName: string
  uploadedAt: any
  rowCount: number
}

export default function AdminDashboard() {
  const router = useRouter()
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [uploads, setUploads] = useState<Upload[]>([])
  const [selectedUpload, setSelectedUpload] = useState<string | null>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [topSongs, setTopSongs] = useState<any[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [aiChatRef, setAiChatRef] = useState<any>(null)
  const [streamingTrends, setStreamingTrends] = useState<any[]>([])
  const [streamingStats, setStreamingStats] = useState<{
    totalStreams: number
    growthRate: number
    periodStreams: number
    previousPeriodStreams: number
  } | null>(null)
  const [vaultStats, setVaultStats] = useState<{
    totalSongs: number
    songsWithVaultFiles: number
    totalVaultFiles: number
  } | null>(null)

  useEffect(() => {
    fetchAnalyses()
    fetchUploads()
    fetchTasks()
    fetchTopSongs()
    fetchStreamingTrends()
    fetchVaultStats()
    
    // Listen for catalog updates to refresh trends
    const channel = new BroadcastChannel('catalog-updates')
    channel.addEventListener('message', (event) => {
      if (event.data.type === 'catalog-updated') {
        fetchStreamingTrends()
        fetchTopSongs()
        fetchVaultStats()
      }
    })
    
    return () => {
      channel.close()
    }
  }, [])

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks')
      const data = await res.json()
      if (data.success) {
        setTasks(data.tasks)
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
    }
  }

  const handleNotificationClick = (notification: any) => {
    // Generate AI prompt based on notification type with full context
    let prompt = ''
    
    // Check if notification is about the current user (admin)
    const currentUserName = 'Eric Marshall' // Admin name
    const notificationAboutSelf = notification.metadata?.fromName === currentUserName || 
                                  notification.title.includes(currentUserName) ||
                                  (notification.message && notification.message.includes(currentUserName))
    
    switch (notification.type) {
      case 'message':
        // For messages, use the full message content, not just the subject
        const fullMessage = notification.metadata?.fullMessage || notification.message
        const messageSubject = notification.title.includes('AI') ? notification.title : notification.message
        
        if (notificationAboutSelf && (notification.title.includes('AI Issue Detected') || notification.title.includes('AI Conversation Redirect'))) {
          // If notification is about the admin themselves, make it a joke
          prompt = `I just got a notification about myself (${currentUserName}) - it seems like the AI sent me a notification about an issue I had with the AI! ${fullMessage || notification.message}\n\nThis is a bit meta - can you explain what happened and maybe make a joke about the AI sending a notification about itself to the person it's talking to?`
        } else if (notification.title.includes('AI Issue Detected') || notification.title.includes('AI Conversation Redirect')) {
          // For AI issue notifications, extract the actual issue details from the message
          prompt = `I clicked on a notification about an AI issue with ${notification.metadata?.fromName || 'an artist'}. ${fullMessage || notification.message}\n\nPlease help me understand what happened and what I should do about it.`
        } else {
          prompt = `I received a message from ${notification.metadata?.fromName || 'an artist'}. ${fullMessage || notification.message}\n\nHelp me respond appropriately and take any necessary actions.`
        }
        break
      case 'release_pending':
        prompt = `I need to review a release approval request. ${notification.metadata?.artist || 'An artist'} wants to release "${notification.metadata?.song || 'a song'}" on ${new Date(notification.metadata?.requestedDate || notification.timestamp).toLocaleDateString()}. Help me decide if this date works and what I should consider.`
        break
      case 'release_approved':
        prompt = `A release was approved: "${notification.metadata?.song || 'a song'}" by ${notification.metadata?.artist || 'an artist'} is scheduled for ${new Date(notification.metadata?.releaseDate || notification.timestamp).toLocaleDateString()}. What should I do next to ensure a successful release?`
        break
      case 'release_denied':
        prompt = `A release request was denied: "${notification.metadata?.song || 'a song'}" by ${notification.metadata?.artist || 'an artist'}. The reason was: "${notification.metadata?.notes || notification.message}". Help me communicate this to the artist and suggest next steps.`
        break
      default:
        // For other notifications, include the full message content
        prompt = `I have a notification: ${notification.title}.\n\n${notification.message}\n\nWhat should I do about this?`
    }
    
    // Trigger AI chat with the prompt
    // We'll use a custom event to communicate with AIChatPopup
    window.dispatchEvent(new CustomEvent('openAIChat', { detail: { prompt } }))
  }

  const fetchTopSongs = async () => {
    try {
      const catalogRes = await fetch('/api/catalog')
      const catalogData = await catalogRes.json()

      if (!catalogData.success || !catalogData.catalog) {
        setTopSongs([])
        return
      }

      // Helper function to normalize strings for comparison
      const normalize = (str: string): string => {
        return (str || '').toLowerCase().trim().replace(/\s+/g, ' ')
      }

      // Use a Map to deduplicate songs by normalized song name + artist
      // Key format: "normalizedSongName|normalizedArtist"
      const songMap = new Map<string, {
        song: string
        artist: string
        streams: number
        isrc?: string
        catalogItemId?: string
      }>()

      // Process catalog items - match analytics logic exactly
      catalogData.catalog.forEach((item: any) => {
        // Skip pending releases
        if (item.releaseApprovalStatus === 'pending') return

        const artistString = item.artist || 'Unknown'
        const catalogItemId = item.id || ''
        const isAlbumOrEP = (item.releaseType === 'album' || item.releaseType === 'ep') && item.songs && item.songs.length > 0

        if (isAlbumOrEP) {
          // For albums/EPs: process each song individually if they have streams
          const songsTotal = item.songs.reduce((sum: number, song: any) => sum + (song.streams || 0), 0)

          if (songsTotal > 0) {
            // Process each song individually
            item.songs.forEach((subSong: any) => {
              const songName = subSong.song || ''
              if (!songName) return

              const songStreams = subSong.streams || 0
              if (songStreams <= 0) return

              // Create unique key for deduplication
              const normalizedSong = normalize(songName)
              const normalizedArtist = normalize(artistString)
              const dedupeKey = `${normalizedSong}|${normalizedArtist}`

              // Use ISRC if available for better deduplication
              const isrc = subSong.isrc || item.isrc

              // Check if we already have this song
              const existing = songMap.get(dedupeKey)
              if (existing) {
                // If we have an ISRC match, prefer that entry
                if (isrc && existing.isrc && isrc === existing.isrc) {
                  // Same ISRC - use the higher stream count
                  if (songStreams > existing.streams) {
                    songMap.set(dedupeKey, {
                      song: songName,
                      artist: artistString,
                      streams: songStreams,
                      isrc: isrc,
                      catalogItemId: catalogItemId,
                    })
                  }
                } else if (isrc && !existing.isrc) {
                  // This entry has ISRC, existing doesn't - prefer this one
                  songMap.set(dedupeKey, {
                    song: songName,
                    artist: artistString,
                    streams: songStreams,
                    isrc: isrc,
                    catalogItemId: catalogItemId,
                  })
                } else {
                  // No ISRC match - use the higher stream count
                  if (songStreams > existing.streams) {
                    songMap.set(dedupeKey, {
                      song: songName,
                      artist: artistString,
                      streams: songStreams,
                      isrc: isrc || existing.isrc,
                      catalogItemId: catalogItemId,
                    })
                  }
                }
              } else {
                // New song - add it
                songMap.set(dedupeKey, {
                  song: songName,
                  artist: artistString,
                  streams: songStreams,
                  isrc: isrc,
                  catalogItemId: catalogItemId,
                })
              }
            })
          } else {
            // No individual song streams, use item.totalStreams (fallback)
            const streams = item.totalStreams || 0
            if (streams > 0) {
              const songName = item.song || item.name || `Album: ${artistString}`
              const normalizedSong = normalize(songName)
              const normalizedArtist = normalize(artistString)
              const dedupeKey = `${normalizedSong}|${normalizedArtist}`

              const existing = songMap.get(dedupeKey)
              if (!existing || streams > existing.streams) {
                songMap.set(dedupeKey, {
                  song: songName,
                  artist: artistString,
                  streams: streams,
                  isrc: item.isrc,
                  catalogItemId: catalogItemId,
                })
              }
            }
          }
        } else {
          // For singles: use item.totalStreams
          const streams = item.totalStreams || 0
          if (streams > 0) {
            const songName = item.song || item.name || 'Unknown Song'
            const normalizedSong = normalize(songName)
            const normalizedArtist = normalize(artistString)
            const dedupeKey = `${normalizedSong}|${normalizedArtist}`

            const existing = songMap.get(dedupeKey)
            if (!existing || streams > existing.streams) {
              songMap.set(dedupeKey, {
                song: songName,
                artist: artistString,
                streams: streams,
                isrc: item.isrc,
                catalogItemId: catalogItemId,
              })
            }
          }
        }
      })

      // Convert map to array, sort by streams, and take top 10
      const uniqueSongs = Array.from(songMap.values())
        .sort((a, b) => b.streams - a.streams)
        .slice(0, 10)

      setTopSongs(uniqueSongs)
    } catch (error) {
      console.error('Failed to fetch top songs:', error)
      setTopSongs([])
    }
  }

  const fetchVaultStats = async () => {
    try {
      const [catalogRes, vaultRes] = await Promise.all([
        fetch('/api/catalog'),
        fetch('/api/song-vault'),
      ])
      
      const catalogData = await catalogRes.json()
      const vaultData = await vaultRes.json().catch(() => ({ success: false, files: [] }))

      if (!catalogData.success || !catalogData.catalog) {
        setVaultStats({
          totalSongs: 0,
          songsWithVaultFiles: 0,
          totalVaultFiles: 0,
        })
        return
      }

      // Helper function to normalize strings for comparison (same as fetchTopSongs)
      const normalize = (str: string): string => {
        return (str || '').toLowerCase().trim().replace(/\s+/g, ' ')
      }

      // Use a Map to deduplicate songs by normalized song name + artist (same logic as fetchTopSongs)
      const songMap = new Map<string, {
        song: string
        artist: string
        catalogItemId: string
        songId?: string // For individual songs in albums
      }>()

      // Process catalog items - match fetchTopSongs logic exactly
      catalogData.catalog.forEach((item: any) => {
        // Skip pending releases
        if (item.releaseApprovalStatus === 'pending') return

        const artistString = item.artist || 'Unknown'
        const catalogItemId = item.id || ''
        const isAlbumOrEP = (item.releaseType === 'album' || item.releaseType === 'ep') && item.songs && item.songs.length > 0

        if (isAlbumOrEP) {
          // For albums/EPs: process each song individually (count ALL songs, not just ones with streams)
          if (item.songs && item.songs.length > 0) {
            // Process each song individually
            item.songs.forEach((subSong: any) => {
              const songName = subSong.song || ''
              if (!songName) return

              // Create unique key for deduplication
              const normalizedSong = normalize(songName)
              const normalizedArtist = normalize(artistString)
              const dedupeKey = `${normalizedSong}|${normalizedArtist}`

              // Only add if not already present (keep first occurrence)
              if (!songMap.has(dedupeKey)) {
                songMap.set(dedupeKey, {
                  song: songName,
                  artist: artistString,
                  catalogItemId: catalogItemId,
                  songId: subSong.id,
                })
              }
            })
          } else {
            // No songs array, use item as single entry
            const songName = item.song || item.name || `Album: ${artistString}`
            const normalizedSong = normalize(songName)
            const normalizedArtist = normalize(artistString)
            const dedupeKey = `${normalizedSong}|${normalizedArtist}`

            if (!songMap.has(dedupeKey)) {
              songMap.set(dedupeKey, {
                song: songName,
                artist: artistString,
                catalogItemId: catalogItemId,
              })
            }
          }
        } else {
          // For singles: use item as single entry
          const songName = item.song || item.name || 'Unknown Song'
          const normalizedSong = normalize(songName)
          const normalizedArtist = normalize(artistString)
          const dedupeKey = `${normalizedSong}|${normalizedArtist}`

          if (!songMap.has(dedupeKey)) {
            songMap.set(dedupeKey, {
              song: songName,
              artist: artistString,
              catalogItemId: catalogItemId,
            })
          }
        }
      })

      const totalSongs = songMap.size

      // Process vault files
      const vaultFiles = vaultData.success && vaultData.files ? vaultData.files : []
      const totalVaultFiles = vaultFiles.length

      // Count songs with vault files
      // Vault files can be linked by songId (for individual songs) or catalog item ID
      const songsWithVaultFilesSet = new Set<string>()
      
      vaultFiles.forEach((file: any) => {
        if (file.songId) {
          // Find the catalog item and song this vault file belongs to
          const catalogItem = catalogData.catalog.find((item: any) => {
            if (item.id === file.songId) return true
            if (item.songs) {
              return item.songs.some((song: any) => song.id === file.songId)
            }
            return false
          })
          
          if (catalogItem) {
            const artistString = catalogItem.artist || 'Unknown'
            if (catalogItem.songs) {
              const song = catalogItem.songs.find((s: any) => s.id === file.songId)
              if (song) {
                const normalizedSong = normalize(song.song)
                const normalizedArtist = normalize(artistString)
                songsWithVaultFilesSet.add(`${normalizedSong}|${normalizedArtist}`)
              }
            } else {
              const songName = catalogItem.song || catalogItem.name || 'Unknown Song'
              const normalizedSong = normalize(songName)
              const normalizedArtist = normalize(artistString)
              songsWithVaultFilesSet.add(`${normalizedSong}|${normalizedArtist}`)
            }
          }
        } else if (file.songName && file.artistName) {
          // Unreleased songs or files linked by name
          const normalizedSong = normalize(file.songName)
          const normalizedArtist = normalize(file.artistName)
          songsWithVaultFilesSet.add(`${normalizedSong}|${normalizedArtist}`)
        }
      })

      setVaultStats({
        totalSongs,
        songsWithVaultFiles: songsWithVaultFilesSet.size,
        totalVaultFiles,
      })
    } catch (error) {
      console.error('Failed to fetch vault stats:', error)
      setVaultStats({
        totalSongs: 0,
        songsWithVaultFiles: 0,
        totalVaultFiles: 0,
      })
    }
  }

  const fetchStreamingTrends = async () => {
    try {
      const catalogRes = await fetch('/api/catalog')
      const catalogData = await catalogRes.json()
      
      if (!catalogData.success || !catalogData.catalog) {
        setStreamingTrends([])
        setStreamingStats(null)
        return
      }

      // Process catalog items to get actual stream totals
      const allSongs: Array<{ name: string; streams: number; date?: string }> = []
      
      catalogData.catalog.forEach((item: any) => {
        // Skip pending releases
        if (item.releaseApprovalStatus === 'pending') return
        
        const isAlbumOrEP = (item.releaseType === 'album' || item.releaseType === 'ep') && item.songs && item.songs.length > 0
        
        if (isAlbumOrEP) {
          // For albums/EPs: process each song individually if they have streams
          const songsTotal = item.songs.reduce((sum: number, song: any) => sum + (song.streams || 0), 0)
          
          if (songsTotal > 0) {
            item.songs.forEach((subSong: any) => {
              const songName = subSong.song || ''
              if (!songName) return
              
              const songStreams = subSong.streams || 0
              if (songStreams <= 0) return
              
              allSongs.push({
                name: songName,
                streams: songStreams,
                date: item.releaseDate,
              })
            })
          } else {
            // No individual song streams, use item.totalStreams
            const streams = item.totalStreams || 0
            if (streams > 0) {
              const songName = item.song || item.name || `Album: ${item.artist}`
              allSongs.push({
                name: songName,
                streams: streams,
                date: item.releaseDate,
              })
            }
          }
        } else {
          // For singles: use item.totalStreams
          const streams = item.totalStreams || 0
          if (streams > 0) {
            const songName = item.song || item.name || 'Unknown Song'
            allSongs.push({
              name: songName,
              streams: streams,
              date: item.releaseDate,
            })
          }
        }
      })

      // Group by monthly periods (last 6 months)
      const now = new Date()
      const trendPeriods: Array<{ period: string; streams: number; date: Date; songCount: number }> = []
      
      for (let i = 0; i < 6; i++) {
        const periodStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const periodEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59)
        
        const periodSongs = allSongs.filter((song) => {
          if (!song.date) return false
          const releaseDate = new Date(song.date)
          return releaseDate >= periodStart && releaseDate <= periodEnd
        })
        
        const periodStreams = periodSongs.reduce((sum, song) => sum + song.streams, 0)
        
        trendPeriods.push({
          period: periodStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          streams: periodStreams,
          date: periodStart,
          songCount: periodSongs.length,
        })
      }
      
      // Reverse to show oldest to newest
      trendPeriods.reverse()
      
      // Calculate trends
      const trends = trendPeriods.map((period, idx) => {
        let trend: 'up' | 'down' | 'stable' = 'stable'
        if (idx > 0) {
          const prevPeriod = trendPeriods[idx - 1]
          if (period.streams > prevPeriod.streams * 1.05) {
            trend = 'up'
          } else if (period.streams < prevPeriod.streams * 0.95) {
            trend = 'down'
          } else {
            trend = 'stable'
          }
        }
        
        return {
          period: period.period,
          streams: period.streams,
          trend,
          songCount: period.songCount,
        }
      })

      // Calculate stats
      const totalStreams = allSongs.reduce((sum, song) => sum + song.streams, 0)
      const currentPeriodStreams = trendPeriods[trendPeriods.length - 1]?.streams || 0
      const previousPeriodStreams = trendPeriods[trendPeriods.length - 2]?.streams || 0
      
      let growthRate = 0
      if (previousPeriodStreams > 0) {
        growthRate = ((currentPeriodStreams - previousPeriodStreams) / previousPeriodStreams) * 100
      } else if (currentPeriodStreams > 0) {
        growthRate = 100
      }

      setStreamingTrends(trends)
      setStreamingStats({
        totalStreams,
        growthRate,
        periodStreams: currentPeriodStreams,
        previousPeriodStreams,
      })
    } catch (error) {
      console.error('Failed to fetch streaming trends:', error)
      setStreamingTrends([])
      setStreamingStats(null)
    }
  }

  const fetchAnalyses = async () => {
    try {
      const res = await fetch('/api/get-analyses')
      const data = await res.json()
      if (data.success) {
        setAnalyses(data.analyses)
      }
    } catch (error) {
      console.error('Failed to fetch analyses:', error)
    }
  }

  const fetchUploads = async () => {
    try {
      const res = await fetch('/api/get-uploads')
      const data = await res.json()
      if (data.success) {
        setUploads(data.uploads)
      }
    } catch (error) {
      console.error('Failed to fetch uploads:', error)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setUploadStatus('Please select a valid CSV file')
      return
    }

    setCsvFile(file)
    setIsUploading(true)
    setUploadProgress(0)
    setUploadStatus('Uploading CSV file...')
    
    // Estimate time based on file size (roughly 1MB per second)
    const estimatedUploadTime = Math.max(5, Math.ceil(file.size / (1024 * 1024))) // seconds

    try {
      const formData = new FormData()
      formData.append('file', file)

      // Simulate progress during upload
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(90, prev + 10))
      }, estimatedUploadTime * 100)

      const res = await fetch('/api/upload-csv', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || data.details || 'Upload failed')
      }

      if (data.success) {
        const artistsMsg = data.artistsFound && data.artistsFound.length > 0
          ? ` Found ${data.artistsFound.length} artist(s): ${data.artistsFound.join(', ')}`
          : ''
        
        setUploadStatus(`✓ CSV uploaded successfully! ${data.rowCount} rows processed.${artistsMsg}`)
        setCsvFile(null)
        fetchUploads()
        
        // Start analysis progress tracking if analysis was triggered
        if (data.analysisTriggered) {
          setIsAnalyzing(true)
          setAnalysisProgress(0)
          setUploadStatus(prev => prev + ' Starting AI analysis...')
          
          // Poll for analysis completion
          pollForAnalysis(data.id)
        } else {
          fetchAnalyses() // Refresh analyses
        }
        
        // Reset file input
        const input = document.getElementById('csv-upload') as HTMLInputElement
        if (input) input.value = ''
      } else {
        setUploadStatus(`Error: ${data.error || 'Unknown error occurred'}`)
      }
    } catch (error: any) {
      console.error('Upload error:', error)
      setUploadStatus(`Upload failed: ${error.message || 'Please check your file and try again'}`)
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  // Get average analysis time from localStorage
  const getAverageAnalysisTime = (): number => {
    try {
      const stored = localStorage.getItem('analysisTimes')
      if (!stored) return 35 // Default 35 seconds
      const times = JSON.parse(stored) as number[]
      if (times.length === 0) return 35
      const sum = times.reduce((a, b) => a + b, 0)
      return Math.round(sum / times.length)
    } catch {
      return 35
    }
  }

  // Store analysis time in localStorage
  const storeAnalysisTime = (timeInSeconds: number) => {
    try {
      const stored = localStorage.getItem('analysisTimes')
      const times = stored ? JSON.parse(stored) as number[] : []
      times.push(timeInSeconds)
      // Keep only last 10 analysis times
      const recentTimes = times.slice(-10)
      localStorage.setItem('analysisTimes', JSON.stringify(recentTimes))
    } catch {
      // Ignore localStorage errors
    }
  }

  const pollForAnalysis = async (uploadId: string) => {
    const startTime = Date.now()
    let attempts = 0
    const maxAttempts = 60 // 5 minutes max (5 second intervals)
    const estimatedAnalysisTime = getAverageAnalysisTime() || 35 // Use learned average, default to 35
    
    setAnalysisProgress(0)
    
    // Update progress bar immediately with estimated time
    setAnalysisProgress(0)

    // Progress update interval (more frequent for smoother progress bar)
    const progressInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      // Calculate progress based on elapsed time vs estimated time
      const progress = Math.min(95, (elapsed / estimatedAnalysisTime) * 100)
      setAnalysisProgress(progress)
    }, 100) // Update every 100ms for smooth progress

    const checkInterval = setInterval(async () => {
      attempts++
      
      try {
        const res = await fetch('/api/get-analyses')
        const data = await res.json()
        
        if (data.success && data.analyses.length > 0) {
          const latestAnalysis = data.analyses[0]
          // Check if this analysis is for our upload (by checking if it's recent)
          const analysisTime = new Date(latestAnalysis.generatedAt).getTime()
          const now = Date.now()
          
          // If analysis was generated in the last 2 minutes, assume it's ours
          if (now - analysisTime < 120000) {
            const actualTime = Math.floor((now - startTime) / 1000)
            storeAnalysisTime(actualTime) // Learn from this time
            
            clearInterval(checkInterval)
            clearInterval(progressInterval)
            setAnalysisProgress(100)
            setIsAnalyzing(false)
            setUploadStatus(prev => prev.replace(' Starting AI analysis...', ` ✓ AI analysis completed! (finished in ${actualTime} seconds)`))
            fetchUploads()
            fetchAnalyses()
            return
          }
        }
        
        // Update progress based on elapsed time
        const elapsed = Math.floor((Date.now() - startTime) / 1000)
        const progress = Math.min(95, (elapsed / estimatedAnalysisTime) * 100)
        setAnalysisProgress(progress)
        
        if (attempts >= maxAttempts) {
          clearInterval(checkInterval)
          clearInterval(progressInterval)
          setIsAnalyzing(false)
          setUploadStatus(prev => prev.replace(' Starting AI analysis...', ' (Analysis may still be processing)'))
        }
      } catch (error) {
        console.error('Failed to check analysis status:', error)
      }
    }, 5000) // Check every 5 seconds
  }

  const handleAnalyze = async () => {
    if (!selectedUpload && uploads.length === 0) {
      setUploadStatus('Please upload a CSV file first')
      return
    }

    setIsAnalyzing(true)
    setUploadStatus('Analyzing data with AI...')

    try {
      const res = await fetch('/api/analyze-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId: selectedUpload || uploads[0]?.id }),
      })

      const data = await res.json()

      if (data.success) {
        setUploadStatus('✓ AI analysis completed!')
        fetchAnalyses()
      } else {
        setUploadStatus(`Analysis failed: ${data.error}`)
      }
    } catch (error: any) {
      setUploadStatus(`Analysis failed: ${error.message}`)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleDeleteAllData = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch('/api/delete-all-data', {
        method: 'DELETE',
      })
      const data = await res.json()
      
      if (res.ok && data.success) {
        setUploadStatus(`✓ All data deleted successfully. ${data.deletedFiles} files and ${data.deletedDirs} directories removed.`)
        setShowDeleteConfirm(false)
        // Refresh all data
        fetchAnalyses()
        fetchUploads()
        fetchTasks()
        fetchTopSongs()
        // Clear status after 5 seconds
        setTimeout(() => setUploadStatus(''), 5000)
      } else {
        setUploadStatus(`Error: ${data.error || 'Failed to delete data'}`)
      }
    } catch (error: any) {
      setUploadStatus(`Error: ${error.message || 'Failed to delete data'}`)
    } finally {
      setIsDeleting(false)
    }
  }

  const latestAnalysis = analyses[0]
  const insights = latestAnalysis?.analysis?.insights || []
  const summary = latestAnalysis?.analysis?.summary || ''

  // Generate analytics from insights
  const performanceInsights = insights.filter(i => i.category === 'performance')
  // Removed engagement insights - focus on streaming data only

  const performanceData = performanceInsights.length > 0 ? [
    { platform: 'Spotify', streams: 2450, revenue: 185 },
    { platform: 'Apple Music', streams: 1800, revenue: 142 },
    { platform: 'YouTube', streams: 1200, revenue: 98 },
    { platform: 'Other', streams: 450, revenue: 35 },
  ] : []

  return (
    <div className="space-y-10 md:space-y-14">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
        <div className="max-w-xl">
          <p className="font-display text-[0.7rem] uppercase tracking-[0.25em] text-red-400/90 mb-3">
            Label ops
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-white tracking-tight leading-[1.15] mb-3">
            Morning — here&apos;s the pulse.
          </h1>
          <p className="text-base text-slate-400 leading-relaxed">
            Streams, uploads, and the messy bits — same tools, less spreadsheet brain.
          </p>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4 shrink-0">
          {/* Notification bell moved to fixed position for mobile - see NotificationDropdown component */}
          <div className="hidden md:block">
            <NotificationDropdown onNotificationClick={handleNotificationClick} />
          </div>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-red-950/40 hover:bg-red-900/50 border border-red-500/35 text-red-300 rounded-xl transition-all duration-300 text-sm font-medium hover:-translate-y-0.5 hover:shadow-lg hover:shadow-red-950/50"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Nuke all imports</span>
            <span className="sm:hidden">Reset</span>
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-red-600/50 rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-white">Delete All Data</h2>
            </div>
            <p className="text-slate-300 mb-6">
              Are you sure you want to delete all the data on the website? This will permanently delete:
            </p>
            <ul className="list-disc list-inside text-slate-400 mb-6 space-y-1 text-sm">
              <li>All CSV uploads</li>
              <li>All catalog items</li>
              <li>All AI analyses</li>
              <li>All artist data</li>
              <li>All song vault files</li>
              <li>All tasks and messages</li>
            </ul>
            <p className="text-red-400 font-semibold mb-6">
              This action cannot be undone!
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteAllData}
                disabled={isDeleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Deleting...
                  </>
                ) : (
                  'Yes, Delete Everything'
                )}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick stats — intentionally uneven */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-6 items-stretch stagger-children">
        <button
          type="button"
          onClick={() => {
            if (uploads.length > 0) {
              router.push('/dashboard/upload')
            } else {
              setUploadStatus('Upload a CSV first.')
              setTimeout(() => setUploadStatus(''), 3000)
            }
          }}
          className="md:col-span-5 text-left group border-b border-white/[0.08] pb-8 md:pb-6 hover:border-red-500/40 transition-all duration-300 hover-lift"
        >
          <span className="text-xs uppercase tracking-widest text-slate-500 group-hover:text-slate-400 transition-colors">
            CSV drops
          </span>
          <div className="font-display text-6xl sm:text-7xl font-semibold text-white tabular-nums mt-2 mb-1 tracking-tight">
            {uploads.length}
          </div>
          <p className="text-sm text-slate-400">
            {uploads.length > 0 && uploads[0]
              ? `Last file ${formatTimeAgo(uploads[0].uploadedAt)}`
              : 'Nothing ingested yet'}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            if (analyses.length > 0) {
              router.push('/dashboard/insights')
            } else {
              setUploadStatus('Run an analysis after you upload.')
              setTimeout(() => setUploadStatus(''), 3000)
            }
          }}
          className="md:col-span-4 rounded-2xl p-6 md:p-7 bg-white/[0.03] ring-1 ring-white/[0.07] shadow-lift hover:ring-red-500/25 hover:bg-white/[0.05] transition-all duration-300 text-left hover:-translate-y-1"
        >
          <div className="flex justify-between items-start mb-5">
            <TrendingUp className="w-7 h-7 text-emerald-400/90" strokeWidth={1.5} />
            <span className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">Runs</span>
          </div>
          <div className="font-display text-4xl font-semibold text-white tabular-nums mb-1">
            {analyses.length}
          </div>
          <p className="text-sm text-slate-400">
            {analyses.length > 0 && analyses[0]
              ? `Latest ${formatTimeAgo(analyses[0].generatedAt)}`
              : 'Waiting on data'}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            if (insights.length > 0) {
              router.push('/dashboard/insights')
            } else {
              setUploadStatus('Generate a run first.')
              setTimeout(() => setUploadStatus(''), 3000)
            }
          }}
          className="md:col-span-3 pl-0 md:pl-8 md:border-l border-white/[0.09] text-left hover-lift py-2"
        >
          <Brain className="w-8 h-8 text-violet-400/90 mb-4" strokeWidth={1.25} />
          <div className="font-display text-3xl font-semibold text-white tabular-nums">
            {insights.length}
          </div>
          <p className="text-sm text-slate-500 mt-1 leading-snug">
            Takeaways you can actually use
          </p>
        </button>
      </div>

      {/* Import + digest — different visual weight each side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-start">
        <div className="lg:pr-4">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-white mb-1 tracking-tight">
            Drop a CSV
          </h2>
          <p className="text-sm text-slate-500 mb-6 max-w-md">
            Royalty files, distributor exports — we’ll chew through the rows.
          </p>
          <div className="space-y-4">
            <div className="border border-dashed border-white/[0.12] rounded-2xl p-8 sm:p-10 text-center hover:border-red-500/50 hover:bg-white/[0.02] transition-all duration-300 hover:-translate-y-0.5">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
                disabled={isUploading}
              />
              <label
                htmlFor="csv-upload"
                className={`cursor-pointer flex flex-col items-center ${isUploading ? 'opacity-50' : ''}`}
              >
                <Upload className="w-11 h-11 text-slate-500 mb-4 mx-auto" strokeWidth={1.25} />
                <p className="text-sm text-slate-300 mb-1">
                  {isUploading ? 'Sending…' : 'Tap to choose a file'}
                </p>
                <p className="text-xs text-slate-500">.csv only</p>
              </label>
            </div>
            {/* Progress Bar for Upload */}
            {isUploading && (
              <ProgressBar
                isLoading={isUploading}
                progress={uploadProgress}
                message="Uploading CSV file..."
                estimatedTime={Math.max(5, csvFile ? Math.ceil(csvFile.size / (1024 * 1024)) : 10)}
                showTime={true}
              />
            )}
            
            {/* Progress Bar for Analysis */}
            {isAnalyzing && (
              <ProgressBar
                isLoading={isAnalyzing}
                progress={analysisProgress}
                message="Analyzing data with AI..."
                estimatedTime={getAverageAnalysisTime()}
                showTime={true}
              />
            )}
            
            {uploadStatus && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  uploadStatus.includes('✓')
                    ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                    : uploadStatus.includes('Error') || uploadStatus.includes('failed')
                    ? 'bg-red-500/10 border border-red-500/20 text-red-500'
                    : 'bg-red-500/10 border border-red-500/20 text-red-500'
                }`}
              >
                {uploadStatus}
              </div>
            )}
            {uploads.length > 0 && (
              <div className="mt-4">
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-3">Recently in</p>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {uploads.slice(0, 3).map((upload) => (
                    <div key={upload.id} className="text-xs text-slate-400 bg-black/30 px-3 py-2 rounded-lg border border-white/[0.05]">
                      {upload.fileName} <span className="text-slate-600">·</span> {upload.rowCount} rows
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="relative lg:mt-10 lg:ml-4">
          <div className="absolute -left-3 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-red-500/40 to-transparent hidden lg:block" aria-hidden />
          <div className="rounded-2xl p-6 sm:p-8 bg-gradient-to-br from-violet-950/40 via-black to-black ring-1 ring-white/[0.08] shadow-[0_24px_80px_-24px_rgba(88,28,135,0.35)]">
          <h2 className="font-display text-xl sm:text-2xl font-semibold text-white mb-2 tracking-tight">
            Digest it
          </h2>
          <p className="text-sm text-slate-400 mb-6">
            One pass turns columns into something you can skim.
          </p>
          <div className="space-y-4">
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || uploads.length === 0}
              className="w-full bg-white text-black font-semibold py-3.5 px-4 rounded-xl transition-all duration-300 disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center hover:scale-[1.02] hover:shadow-xl hover:shadow-white/10 active:scale-[0.98]"
            >
              {isAnalyzing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-black border-t-transparent mr-2"></div>
                  Working…
                </>
              ) : (
                <>
                  <Brain className="w-5 h-5 mr-2" strokeWidth={2} />
                  Run the insight pass
                </>
              )}
            </button>
            {summary && (
              <div className="p-4 rounded-xl bg-black/50 border border-white/[0.06] backdrop-blur-sm">
                <p className="text-sm text-slate-300 leading-relaxed">{summary}</p>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>

      {/* Analytics Charts */}
      {insights.length > 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {performanceData.length > 0 && (
              <div className="rounded-2xl p-6 sm:p-8 bg-black/40 ring-1 ring-white/[0.06] backdrop-blur-md">
                <h2 className="font-display text-lg font-semibold text-white mb-1 tracking-tight">
                  Platforms (sample slice)
                </h2>
                <p className="text-xs text-slate-500 mb-6">From the latest analysis bundle</p>
                <div className="h-64">
                  <Chart
                    data={performanceData}
                    type="bar"
                    dataKey="streams"
                    nameKey="platform"
                    bars={[
                      { dataKey: 'streams', name: 'Streams', color: '#ef4444' },
                      { dataKey: 'revenue', name: 'Revenue', color: '#dc2626' },
                    ]}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* AI Insights */}
      {insights.length > 0 && (
        <>
          {streamingTrends.length > 0 && streamingStats && (
            <section className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.07] bg-gradient-to-br from-emerald-950/25 via-black to-black px-5 py-7 sm:p-9 shadow-[0_32px_120px_-48px_rgba(16,185,129,0.25)]">
              <div className="pointer-events-none absolute -right-24 top-0 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" aria-hidden />
              <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-8">
                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.2em] text-emerald-400/90 mb-2">Listening</p>
                  <h2 className="font-display text-2xl sm:text-3xl font-semibold text-white tracking-tight">
                    Stream drift
                  </h2>
                  <p className="text-sm text-slate-400 mt-2 max-w-md">
                    Pulled from your catalog dates — not Spotify’s dashboard, but close enough for a vibe check.
                  </p>
                </div>
                <div className="flex flex-wrap gap-8 lg:gap-12">
                  <div>
                    <div className="font-display text-3xl sm:text-4xl font-semibold text-white tabular-nums">
                      {streamingStats.totalStreams.toLocaleString()}
                    </div>
                    <div className="text-xs uppercase tracking-wider text-slate-500 mt-1">All-time</div>
                  </div>
                  <div>
                    <div className={`font-display text-3xl sm:text-4xl font-semibold flex items-center gap-2 tabular-nums ${
                      streamingStats.growthRate >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {streamingStats.growthRate >= 0 ? (
                        <TrendingUp className="w-6 h-6" />
                      ) : (
                        <TrendingUp className="w-6 h-6 rotate-180" />
                      )}
                      {Math.abs(streamingStats.growthRate).toFixed(1)}%
                    </div>
                    <div className="text-xs uppercase tracking-wider text-slate-500 mt-1">Vs last window</div>
                  </div>
                </div>
              </div>
              <div className="relative h-80 w-full">
                <Chart
                  data={streamingTrends}
                  type="line"
                  dataKey="streams"
                  nameKey="period"
                  lines={[
                    { 
                      dataKey: 'streams', 
                      name: 'Streams', 
                      color: '#34d399',
                    },
                  ]}
                />
              </div>
              <div className="relative mt-8 grid grid-cols-3 gap-3 sm:gap-6 pt-8 border-t border-white/[0.06]">
                {streamingTrends.slice(-3).map((trend: any, idx: number) => (
                  <div key={idx} className={idx === 1 ? 'text-center sm:border-x border-white/[0.06]' : 'text-center'}>
                    <div className="font-display text-xl font-semibold text-white tabular-nums">
                      {trend.streams.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500">{trend.period}</div>
                    <div className={`text-xs mt-2 flex items-center justify-center gap-1 ${
                      trend.trend === 'up' ? 'text-emerald-400' : 
                      trend.trend === 'down' ? 'text-red-400' : 
                      'text-slate-500'
                    }`}>
                      {trend.trend === 'up' && <TrendingUp className="w-3 h-3" />}
                      {trend.trend === 'down' && <TrendingUp className="w-3 h-3 rotate-180" />}
                      {trend.trend === 'stable' && '—'}
                      {trend.songCount > 0 && ` · ${trend.songCount} tr${trend.songCount !== 1 ? 'acks' : 'ack'}`}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="border-t border-white/[0.06] pt-12 mt-4">
            <h2 className="font-display text-2xl font-semibold text-white mb-2 tracking-tight">
              What stuck out
            </h2>
            <p className="text-sm text-slate-500 mb-8 max-w-lg">
              Raw notes from the last pass — skim the bold lines first.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-h-96 overflow-y-auto pr-1">
              {insights.map((insight, index) => (
                <article
                  key={index}
                  className={`group p-5 rounded-2xl transition-all duration-300 hover:-translate-y-1 ${
                    index % 3 === 0
                      ? 'bg-white/[0.04] ring-1 ring-white/[0.08]'
                      : index % 3 === 1
                        ? 'border-l-2 border-red-500/70 pl-5 bg-transparent'
                        : 'bg-black/50 border border-white/[0.05]'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3 gap-3">
                    <h3 className="font-semibold text-white text-sm leading-snug">
                      {insight.title}
                    </h3>
                    {insight.trend === 'up' && (
                      <TrendingUp className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    )}
                    {insight.trend === 'down' && (
                      <TrendingUp className="w-5 h-5 text-red-400 flex-shrink-0 rotate-180" />
                    )}
                    {insight.trend === 'stable' && (
                      <Activity className="w-5 h-5 text-slate-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-slate-300 mb-3 leading-relaxed">{insight.insight}</p>
                  <div className="mt-3 pt-3 border-t border-white/[0.06]">
                    <p className="text-[0.65rem] uppercase tracking-wider text-red-400/90 mb-1">Try this</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{insight.recommendation}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Top Performing Songs */}
      {topSongs.length > 0 && (
        <div className="md:flex md:gap-12 md:items-start">
          <div className="md:w-48 shrink-0 mb-6 md:mb-0">
            <p className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500 mb-2">Right now</p>
            <h2 className="font-display text-2xl font-semibold text-white tracking-tight leading-snug">
              Who&apos;s eating
            </h2>
          </div>
          <div className="flex-1 min-w-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="text-left py-3 pr-4 font-medium text-slate-500 w-10">#</th>
                  <th className="text-left py-3 px-2 font-medium text-slate-500">Title</th>
                  <th className="text-left py-3 px-2 font-medium text-slate-500">Artist</th>
                  <th className="text-right py-3 pl-4 font-medium text-slate-500">Streams</th>
                </tr>
              </thead>
              <tbody>
                {topSongs.map((song, idx) => (
                  <tr key={`${song.catalogItemId || idx}-${song.song}-${song.artist}`} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                    <td className="py-3.5 pr-4 text-slate-500 tabular-nums">{idx + 1}</td>
                    <td className="py-3.5 px-2 text-white font-medium">{song.song}</td>
                    <td className="py-3.5 px-2 text-slate-400">{song.artist}</td>
                    <td className="py-3.5 pl-4 text-right font-display text-base text-white tabular-nums">{song.streams.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Song Vault Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-1">
          <h2 className="font-display text-2xl font-semibold text-white mb-2 tracking-tight">
            Vault
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed mb-4">
            Stems, sessions, the stuff you don&apos;t post on IG.
          </p>
          <button
            type="button"
            onClick={() => router.push('/dashboard/catalog')}
            className="text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            Open catalog →
          </button>
        </div>
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:pt-1">
            <p className="text-xs text-slate-500 mb-1">Songs in play</p>
            <p className="font-display text-4xl text-white font-semibold tabular-nums">
              {vaultStats ? vaultStats.totalSongs.toLocaleString() : '—'}
            </p>
            <p className="text-xs text-slate-600 mt-2">deduped</p>
          </div>
          <div className="rounded-xl p-4 bg-gradient-to-b from-white/[0.05] to-transparent ring-1 ring-white/[0.07]">
            <p className="text-xs text-slate-500 mb-1">With files</p>
            <p className="font-display text-3xl text-white font-semibold tabular-nums">
              {vaultStats ? vaultStats.songsWithVaultFiles.toLocaleString() : '—'}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              {vaultStats && vaultStats.totalSongs > 0 
                ? `${Math.round((vaultStats.songsWithVaultFiles / vaultStats.totalSongs) * 100)}% covered`
                : ''}
            </p>
          </div>
          <div className="border border-dashed border-white/[0.12] rounded-xl p-4 flex flex-col justify-center">
            <p className="text-xs text-slate-500 mb-1">Files sitting</p>
            <p className="font-display text-3xl text-white font-semibold tabular-nums">
              {vaultStats ? vaultStats.totalVaultFiles.toLocaleString() : '—'}
            </p>
            <p className="text-xs text-slate-600 mt-2">total uploads</p>
          </div>
        </div>
      </div>

      {/* Recent Tasks */}
      {tasks.length > 0 && (
        <div className="rounded-2xl overflow-hidden ring-1 ring-white/[0.07] bg-black/30">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] bg-white/[0.02]">
            <h2 className="font-display text-lg font-semibold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-red-400" />
              On your desk
            </h2>
            <button
              type="button"
              onClick={() => router.push('/dashboard/tasks')}
              className="text-xs uppercase tracking-wider text-red-400/90 hover:text-red-300 transition-colors"
            >
              Everything →
            </button>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {tasks.slice(0, 5).map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={task.completed}
                    readOnly
                    className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-red-400"
                  />
                  <div>
                    <h3 className={`font-medium ${task.completed ? 'line-through text-slate-500' : 'text-white'}`}>
                      {task.title}
                    </h3>
                    <p className="text-sm text-slate-400">{task.assignedToName}</p>
                  </div>
                </div>
                <span className="text-xs text-slate-500 tabular-nums">
                  {new Date(task.dueDate).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload History */}
      {uploads.length > 0 && (
        <div className="pt-4 border-t border-white/[0.06]">
          <h2 className="font-display text-xl font-semibold text-white mb-6">
            Past drops
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="pb-3 font-medium">File</th>
                  <th className="pb-3 font-medium">Rows</th>
                  <th className="pb-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((upload) => (
                  <tr
                    key={upload.id}
                    className="border-t border-white/[0.05] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3 text-white font-medium">
                      {upload.fileName}
                    </td>
                    <td className="py-3 text-slate-400 tabular-nums">
                      {upload.rowCount}
                    </td>
                    <td className="py-3 text-slate-500">
                      {formatTimeAgo(upload.uploadedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
