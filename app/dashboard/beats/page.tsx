'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  Music,
  Upload,
  Search,
  Filter,
  Play,
  Pause,
  Edit,
  Trash2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Download,
  Plus,
  X,
  Tag,
  DollarSign,
  Users,
  Package,
  FileText,
  Heart,
  CheckSquare,
  Square,
} from 'lucide-react'

interface Beat {
  id: string
  name: string
  bpm?: number // Auto-detected
  key?: string // Auto-detected musical key
  producerIds: string[]
  producers?: Array<{ id: string; name: string }>
  packId?: string
  packName?: string
  status: 'available' | 'reserved' | 'exclusive_sold'
  genre?: string
  mood?: string
  leasePrice?: number
  premiumLeasePrice?: number
  exclusivePrice?: number
  originalFileUrl: string
  previewFileUrl?: string
  owner: string
  copyright: string
  license: string
  contact: string
  tags?: string[]
  isIncomplete: boolean
  canPublish: boolean
  createdAt: string
  bpmAnalyzed?: boolean
  keyAnalyzed?: boolean
}

interface Producer {
  id: string
  name: string
  aliases?: string[]
  defaultRoyaltySplit?: number
}

interface BeatPack {
  id: string
  name: string
  uploadedAt: string
  beatIds: string[]
}

export default function BeatsPage() {
  const { user } = useAuth()
  const [beats, setBeats] = useState<Beat[]>([])
  const [producers, setProducers] = useState<Producer[]>([])
  const [packs, setPacks] = useState<BeatPack[]>([])
  const [filteredBeats, setFilteredBeats] = useState<Beat[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'reserved' | 'exclusive_sold'>('all')
  const [producerFilter, setProducerFilter] = useState<string>('all')
  const [packFilter, setPackFilter] = useState<string>('all')
  const [genreFilter, setGenreFilter] = useState<string>('all')
  const [moodFilter, setMoodFilter] = useState<string>('all')
  const [showHeartedOnly, setShowHeartedOnly] = useState(false)
  const [selectedBeats, setSelectedBeats] = useState<Set<string>>(new Set())
  const [lastClickedBeatId, setLastClickedBeatId] = useState<string | null>(null)
  const [showBulkEditModal, setShowBulkEditModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingBeat, setEditingBeat] = useState<Beat | null>(null)
  const [playingBeatId, setPlayingBeatId] = useState<string | null>(null)
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playingBeat, setPlayingBeat] = useState<Beat | null>(null)
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [packName, setPackName] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState<{ current: number; total: number; errors: Array<{ fileName: string; error: string }> } | null>(null)
  const [isFolderUpload, setIsFolderUpload] = useState(false)
  const [beatFiles, setBeatFiles] = useState<Record<string, any[]>>({}) // beatId -> files
  const [showFileUpload, setShowFileUpload] = useState<string | null>(null) // beatId for file upload
  const [fileUploadData, setFileUploadData] = useState({
    files: [] as File[],
    fileType: 'other' as 'logic' | 'bounced' | 'stem' | 'master' | 'music_video' | 'other',
    folderPath: '',
    isFolderUpload: false,
  })
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const [editFormData, setEditFormData] = useState<Partial<Beat & { key?: string }> | null>(null)
  const [isSavingBeat, setIsSavingBeat] = useState(false)
  const [artistPreferences, setArtistPreferences] = useState<{ preferredGenres: string[]; preferredMoods: string[]; listenHistory: string[]; favoriteBeats: string[] }>({ preferredGenres: [], preferredMoods: [], listenHistory: [], favoriteBeats: [] })
  const [showGenrePreferencesModal, setShowGenrePreferencesModal] = useState(false)
  const [selectedArtistForPreferences, setSelectedArtistForPreferences] = useState<string | null>(null)
  const [selectedProducerIds, setSelectedProducerIds] = useState<string[]>([])
  const [newProducerName, setNewProducerName] = useState('')
  const [isAddingProducer, setIsAddingProducer] = useState(false)

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchBeats()
      fetchProducers()
      fetchPacks()
    } else if (user?.role === 'artist') {
      fetchBeats()
      if (user.id) {
        fetchArtistPreferences()
      }
    }
  }, [user])

  const fetchArtistPreferences = async () => {
    if (!user?.id) return
    try {
      const res = await fetch(`/api/artist-preferences?artistId=${user.id}`)
      const data = await res.json()
      if (data.success) {
        setArtistPreferences({
          preferredGenres: data.preferredGenres || [],
          preferredMoods: data.preferredMoods || [],
          listenHistory: (data.listenHistory || []).map((entry: any) => entry.beatId),
          favoriteBeats: data.favoriteBeats || [],
        })
      }
    } catch (error) {
      console.error('Failed to fetch artist preferences:', error)
    }
  }

  useEffect(() => {
    // Fetch files for all beats when beats are loaded
    if (beats.length > 0 && user?.role === 'admin') {
      beats.forEach(beat => {
        fetchBeatFiles(beat.id)
      })
    }
  }, [beats, user])

  useEffect(() => {
    filterBeats()
    // Clear selection when filters change
    setSelectedBeats(new Set())
  }, [beats, searchTerm, statusFilter, producerFilter, packFilter, genreFilter, moodFilter, artistPreferences, showHeartedOnly, user])

  const fetchBeats = async () => {
    try {
      const res = await fetch('/api/beats')
      const data = await res.json()
      if (data.success) {
        setBeats(data.beats || [])
      }
    } catch (error) {
      console.error('Failed to fetch beats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchProducers = async () => {
    try {
      const res = await fetch('/api/producers')
      const data = await res.json()
      if (data.success) {
        setProducers(data.producers || [])
      }
    } catch (error) {
      console.error('Failed to fetch producers:', error)
    }
  }

  const fetchPacks = async () => {
    try {
      const res = await fetch('/api/beats/packs')
      const data = await res.json()
      if (data.success) {
        setPacks(data.packs || [])
      }
    } catch (error) {
      console.error('Failed to fetch packs:', error)
    }
  }

  const fetchBeatFiles = async (beatId: string) => {
    try {
      const res = await fetch(`/api/beats/files?beatId=${beatId}&userRole=${user?.role}`)
      const data = await res.json()
      if (data.success) {
        setBeatFiles(prev => ({
          ...prev,
          [beatId]: data.files || [],
        }))
      }
    } catch (error) {
      console.error('Failed to fetch beat files:', error)
    }
  }

  const handleFileSelectForBeat = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      
      if (fileUploadData.isFolderUpload) {
        // For folder upload, extract folder name from first file
        setFileUploadData(prev => ({
          ...prev,
          files: files,
          folderPath: files.length > 0 ? (files[0] as any).webkitRelativePath?.split('/')[0] || '' : prev.folderPath,
        }))
      } else {
        setFileUploadData(prev => ({
          ...prev,
          files: files,
        }))
      }
    }
  }

  const handleUploadBeatFile = async (beatId: string) => {
    if (fileUploadData.files.length === 0) {
      alert('Please select at least one file or folder')
      return
    }

    setIsUploadingFile(true)

    try {
      // Upload all files
      const uploadPromises = fileUploadData.files.map(async (file) => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('beatId', beatId)
        formData.append('fileType', fileUploadData.fileType)
        
        // For folder uploads, preserve folder structure
        if (fileUploadData.isFolderUpload && (file as any).webkitRelativePath) {
          const relativePath = (file as any).webkitRelativePath
          const pathParts = relativePath.split('/')
          if (pathParts.length > 1) {
            // Remove filename, keep folder path
            const folderPath = pathParts.slice(0, -1).join('/')
            formData.append('folderPath', folderPath)
          } else {
            formData.append('folderPath', fileUploadData.folderPath)
          }
        } else {
          formData.append('folderPath', fileUploadData.folderPath)
        }
        
        formData.append('userId', user?.id || '')
        formData.append('userRole', user?.role || '')

        const res = await fetch('/api/beats/files/upload', {
          method: 'POST',
          body: formData,
        })

        return res.json()
      })

      const results = await Promise.all(uploadPromises)
      const failed = results.filter(r => !r.success)

      if (failed.length === 0) {
        alert(`Successfully uploaded ${results.length} file(s)`)
        setShowFileUpload(null)
        setFileUploadData({ files: [], fileType: 'other', folderPath: '', isFolderUpload: false })
        fetchBeatFiles(beatId)
      } else {
        alert(`Uploaded ${results.length - failed.length} file(s), ${failed.length} failed`)
        fetchBeatFiles(beatId)
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload files')
    } finally {
      setIsUploadingFile(false)
    }
  }

  const handleDeleteBeatFile = async (fileId: string, beatId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return

    try {
      const res = await fetch(`/api/beats/files?id=${fileId}&userRole=${user?.role}`, {
        method: 'DELETE',
      })

      const data = await res.json()
      if (data.success) {
        fetchBeatFiles(beatId)
      } else {
        alert(`Failed to delete: ${data.error}`)
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete file')
    }
  }

  const filterBeats = () => {
    let filtered = [...beats]

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        beat =>
          beat.name.toLowerCase().includes(term) ||
          beat.producers?.some(p => p.name.toLowerCase().includes(term)) ||
          beat.packName?.toLowerCase().includes(term) ||
          beat.genre?.toLowerCase().includes(term)
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(beat => beat.status === statusFilter)
    }

    // Producer filter
    if (producerFilter !== 'all') {
      filtered = filtered.filter(beat =>
        beat.producerIds.includes(producerFilter)
      )
    }

    // Pack filter
    if (packFilter !== 'all') {
      filtered = filtered.filter(beat => beat.packId === packFilter)
    }

    // Genre filter
    if (genreFilter !== 'all') {
      filtered = filtered.filter(beat => beat.genre === genreFilter)
    }

    // Mood filter
    if (moodFilter !== 'all') {
      filtered = filtered.filter(beat => beat.mood === moodFilter)
    }

    // Hearted filter (for artists only)
    if (user?.role === 'artist' && showHeartedOnly) {
      filtered = filtered.filter(beat => artistPreferences.favoriteBeats.includes(beat.id))
    }

    // Sort by preferred genres and moods for artists (preferred genres/moods first)
    if (user?.role === 'artist' && (artistPreferences.preferredGenres.length > 0 || artistPreferences.preferredMoods.length > 0)) {
      filtered.sort((a, b) => {
        // First priority: preferred genre
        const aIsPreferredGenre = a.genre && artistPreferences.preferredGenres.includes(a.genre)
        const bIsPreferredGenre = b.genre && artistPreferences.preferredGenres.includes(b.genre)
        
        if (aIsPreferredGenre && !bIsPreferredGenre) return -1
        if (!aIsPreferredGenre && bIsPreferredGenre) return 1
        
        // Second priority: preferred mood (if genre is equal or both not preferred)
        const aIsPreferredMood = a.mood && artistPreferences.preferredMoods.includes(a.mood)
        const bIsPreferredMood = b.mood && artistPreferences.preferredMoods.includes(b.mood)
        
        if (aIsPreferredMood && !bIsPreferredMood) return -1
        if (!aIsPreferredMood && bIsPreferredMood) return 1
        
        // Within preferred/non-preferred groups, sort by listen status (unheard first)
        const aHasListened = artistPreferences.listenHistory.includes(a.id)
        const bHasListened = artistPreferences.listenHistory.includes(b.id)
        
        if (!aHasListened && bHasListened) return -1
        if (aHasListened && !bHasListened) return 1
        
        return 0
      })
    }

    setFilteredBeats(filtered)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      const audioFiles = files.filter(
        f => f.type.startsWith('audio/') || ['.wav', '.mp3'].some(ext => f.name.toLowerCase().endsWith(ext))
      )
      
      // If folder upload, replace all files; otherwise append
      if (isFolderUpload) {
        setUploadFiles(audioFiles)
        // Auto-set pack name from folder name if not set
        if (!packName && audioFiles.length > 0) {
          // Extract folder name from first file's webkitRelativePath
          const firstFile = audioFiles[0] as any
          if (firstFile.webkitRelativePath) {
            const folderName = firstFile.webkitRelativePath.split('/')[0]
            setPackName(folderName)
          }
        }
      } else {
        setUploadFiles(prev => [...prev, ...audioFiles])
      }
    }
  }

  const handleUploadPack = async () => {
    if (uploadFiles.length === 0) {
      alert('Please select at least one audio file')
      return
    }

    setIsUploading(true)
    setUploadProgress(0)
    setUploadStatus({ current: 0, total: uploadFiles.length, errors: [] })

    try {
      // Determine pack name (folder upload uses webkitRelativePath)
      let finalPackName = packName || 'Untitled Pack'
      if (uploadFiles.length > 0) {
        const firstFile = uploadFiles[0] as any
        if (firstFile?.webkitRelativePath) {
          finalPackName = firstFile.webkitRelativePath.split('/')[0] || finalPackName
        }
      }
      // Keep pack naming consistent with server-side cleaning logic
      let finalCleanPackName = finalPackName
      try {
        const { extractProducersFromPackTitle } = await import('@/lib/beatParser')
        const derived = extractProducersFromPackTitle(finalPackName)
        finalCleanPackName = derived.cleanPackName || finalPackName
      } catch {
        // ignore
      }

      const totalFiles = uploadFiles.length
      let errors: Array<{ fileName: string; error: string }> = []
      let successCount = 0
      let incompleteCount = 0

      // Most reliable path: always chunked/resumable uploads (avoids 413 + flaky TLS on huge packs)
      {
        // Upload files individually using chunked uploader (most reliable through proxies)
        const processedBeatIds: string[] = []
        let incompleteUploaded = 0
        const CONCURRENT_UPLOADS = 2

        // Keep UI progress moving
        let completed = 0
        setUploadProgress(0)

        const totalBytes = uploadFiles.reduce((sum, f) => sum + (f?.size || 0), 0)
        let uploadedBytes = 0

        const uploadSingleFileChunked = async (file: File) => {
          const CHUNK_SIZE = 4 * 1024 * 1024 // 4MB (smaller = fewer TLS/proxy issues)
          const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
          const stableUploadId = `beat_${user?.id || 'anon'}_${finalPackName}_${file.name}_${file.size}_${file.lastModified}`
            .replace(/[^a-zA-Z0-9._-]/g, '_')

          let chunkIndex = 0
          while (chunkIndex < totalChunks) {
            const start = chunkIndex * CHUNK_SIZE
            const end = Math.min(start + CHUNK_SIZE, file.size)
            const chunk = file.slice(start, end)

            const attemptChunk = async () => {
              const fd = new FormData()
              fd.append('chunk', chunk, file.name)
              fd.append('uploadId', stableUploadId)
              fd.append('fileName', file.name)
              fd.append('packName', finalPackName)
              fd.append('userId', user?.id || '')
              fd.append('chunkIndex', String(chunkIndex))
              fd.append('totalChunks', String(totalChunks))

              const res = await fetch('/api/beats/upload-chunk', { method: 'POST', body: fd })

              let data: any = null
              const contentType = res.headers.get('content-type') || ''
              if (contentType.includes('application/json')) {
                data = await res.json()
              } else {
                const text = await res.text().catch(() => '')
                data = { error: text || `Upload failed (HTTP ${res.status})` }
              }

              return { res, data }
            }

            // Retry chunk on network/TLS flakiness
            let lastErr: any = null
            for (let attempt = 0; attempt < 5; attempt++) {
              try {
                const { res, data } = await attemptChunk()

                if (res.status === 409 && Number.isFinite(data?.expectedChunkIndex)) {
                  // Server already advanced (likely a prior attempt succeeded but response dropped)
                  const expected = Number(data.expectedChunkIndex)
                  if (expected > chunkIndex) {
                    chunkIndex = expected
                    lastErr = null
                    break
                  }
                }

                if (!res.ok || !data?.success) {
                  throw new Error(data?.error || data?.details || `Upload failed (HTTP ${res.status})`)
                }

                // Completed file
                if (data?.complete && data?.beat?.id) {
                  return data.beat
                }

                // Normal chunk accepted
                uploadedBytes += chunk.size
                if (totalBytes > 0) {
                  setUploadProgress(Math.min(99, Math.round((uploadedBytes / totalBytes) * 100)))
                }
                chunkIndex += 1
                lastErr = null
                break
              } catch (e: any) {
                lastErr = e
                // backoff: 200ms, 400ms, 800ms...
                const delay = 200 * Math.pow(2, attempt)
                await new Promise(r => setTimeout(r, delay))
              }
            }

            if (lastErr) throw lastErr
          }

          throw new Error('Chunked upload did not complete')
        }

        for (let i = 0; i < uploadFiles.length; i += CONCURRENT_UPLOADS) {
          const batch = uploadFiles.slice(i, i + CONCURRENT_UPLOADS)

          const batchResults = await Promise.all(batch.map(async (file) => {
            try {
              const beat = await uploadSingleFileChunked(file)
              if (beat?.id) processedBeatIds.push(beat.id)
              if (beat?.isIncomplete) incompleteUploaded += 1
              return { ok: true, beat }
            } catch (e: any) {
              return { ok: false, error: { fileName: file.name, error: e?.message || 'Upload failed' } }
            } finally {
              completed += 1
              setUploadStatus(prev => ({
                current: completed,
                total: uploadFiles.length,
                errors: prev?.errors || [],
              }))
              // If we didn't have totalBytes, fall back to per-file progress
              if (totalBytes === 0) {
                setUploadProgress(Math.round((completed / uploadFiles.length) * 100))
              }
            }
          }))

          batchResults.forEach(r => {
            if (!r.ok && r.error) errors.push(r.error)
          })
        }

        // Create pack record after all files are uploaded
        if (processedBeatIds.length > 0) {
          const packRes = await fetch('/api/beats/create-pack', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: finalCleanPackName,
              beatIds: processedBeatIds,
              userId: user?.id,
            }),
          })

          // Best effort: don’t fail whole upload if pack creation fails
          if (!packRes.ok) {
            const text = await packRes.text().catch(() => '')
            console.warn('Failed to create pack record:', text)
          }
        }

        successCount = processedBeatIds.length
        incompleteCount = incompleteUploaded
      }

      setUploadStatus({
        current: totalFiles,
        total: totalFiles,
        errors,
      })

      const errorCount = errors.length
      if (successCount > 0) {
        let message = `Upload complete!\n\n`
        message += `✅ Successfully uploaded: ${successCount} beat(s) out of ${totalFiles} file(s)\n`
        if (incompleteCount > 0) {
          message += `⚠️ Incomplete: ${incompleteCount} beat(s)\n`
        }
        if (errorCount > 0) {
          message += `❌ Failed: ${errorCount} file(s)\n\nFailed files:\n`
          errors.forEach((err, idx) => {
            message += `${idx + 1}. ${err.fileName}: ${err.error}\n`
          })
        }

        alert(message)
        setShowUploadModal(false)
        setUploadFiles([])
        setPackName('')
        setIsFolderUpload(false)
        setUploadStatus(null)
        fetchBeats()
        fetchPacks()
      } else {
        alert(`Upload failed: All ${totalFiles} file(s) failed to upload`)
        setUploadStatus(null)
      }
    } catch (error: any) {
      console.error('Upload error:', error)
      const msg = error?.message || 'Unknown error'
      alert(`Failed to upload beat pack: ${msg}`)
      setUploadStatus(null)
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  // Update current time and duration from audio element
  useEffect(() => {
    if (!audioRef) {
      setCurrentTime(0)
      setDuration(0)
      return
    }

    const updateTime = () => {
      if (audioRef && !isNaN(audioRef.currentTime)) {
        setCurrentTime(audioRef.currentTime)
      }
    }
    
    const updateDuration = () => {
      if (audioRef && isFinite(audioRef.duration) && audioRef.duration > 0 && !isNaN(audioRef.duration)) {
        setDuration(audioRef.duration)
      }
    }

    // Check duration immediately if already loaded
    if (isFinite(audioRef.duration) && audioRef.duration > 0 && !isNaN(audioRef.duration)) {
      setDuration(audioRef.duration)
    }

    audioRef.addEventListener('timeupdate', updateTime)
    audioRef.addEventListener('loadedmetadata', updateDuration)
    audioRef.addEventListener('durationchange', updateDuration)
    audioRef.addEventListener('canplay', updateDuration) // Also check on canplay
    audioRef.addEventListener('loadeddata', updateDuration) // Also check on loadeddata
    audioRef.addEventListener('ended', () => {
      setPlayingBeatId(null)
      setPlayingBeat(null)
      setCurrentTime(0)
      setDuration(0)
    })

    // Fallback: periodically check for duration if not set yet (in case events don't fire)
    const durationCheckInterval = setInterval(() => {
      if (audioRef && isFinite(audioRef.duration) && audioRef.duration > 0 && !isNaN(audioRef.duration)) {
        setDuration(audioRef.duration)
        clearInterval(durationCheckInterval) // Stop checking once we have duration
      }
    }, 100) // Check every 100ms

    // Stop checking after 5 seconds
    setTimeout(() => clearInterval(durationCheckInterval), 5000)

    return () => {
      clearInterval(durationCheckInterval)
      audioRef.removeEventListener('timeupdate', updateTime)
      audioRef.removeEventListener('loadedmetadata', updateDuration)
      audioRef.removeEventListener('durationchange', updateDuration)
      audioRef.removeEventListener('canplay', updateDuration)
      audioRef.removeEventListener('loadeddata', updateDuration)
    }
  }, [audioRef])

  const handlePlay = async (beat: Beat) => {
    if (playingBeatId === beat.id && audioRef) {
      audioRef.pause()
      setPlayingBeatId(null)
      setPlayingBeat(null)
      return
    }

    // Stop any currently playing audio
    if (audioRef) {
      audioRef.pause()
      audioRef.src = ''
    }

    // Reset state
    setCurrentTime(0)
    setDuration(0)

    const audioUrl = beat.previewFileUrl || beat.originalFileUrl
    if (!audioUrl) {
      alert('No audio file available for this beat')
      return
    }

    const audio = new Audio(audioUrl)
    audio.preload = 'metadata' // Load metadata first to get duration faster
    
    // Track listen for artists (call once when play starts)
    const trackListenOnce = () => {
      if (user?.role === 'artist' && user.id) {
        trackBeatListen(user.id, beat.id)
      }
    }
    
    // Try to play with timeout fallback
    const playWithFallback = () => {
      trackListenOnce() // Track listen when play actually starts
      const playAttempt = audio.play().catch((error) => {
        console.error('Play error:', error)
        // Try again after a short delay
        setTimeout(() => {
          audio.play().catch((err) => {
            console.error('Second play attempt failed:', err)
            alert('Failed to play audio. The file may be loading. Please try again in a moment.')
          })
        }, 500)
      })
      
      audio.addEventListener('ended', () => {
        setPlayingBeatId(null)
        setPlayingBeat(null)
        setCurrentTime(0)
        setDuration(0)
      }, { once: true })
      
      // Set audio ref first, then state will update via useEffect
      setAudioRef(audio)
      setPlayingBeatId(beat.id)
      setPlayingBeat(beat)
      
      // Try to get duration immediately if available
      if (isFinite(audio.duration) && audio.duration > 0 && !isNaN(audio.duration)) {
        setDuration(audio.duration)
      }
    }
    
      // Try immediate play first (for cached files)
      audio.play().then(() => {
        trackListenOnce() // Track listen when play succeeds
        audio.addEventListener('ended', () => {
          setPlayingBeatId(null)
          setPlayingBeat(null)
          setCurrentTime(0)
          setDuration(0)
        }, { once: true })
        
        // Set audio ref first, then state will update via useEffect
        setAudioRef(audio)
        setPlayingBeatId(beat.id)
        setPlayingBeat(beat)
        
        // Try to get duration immediately if available
        if (isFinite(audio.duration) && audio.duration > 0 && !isNaN(audio.duration)) {
          setDuration(audio.duration)
        }
      }).catch(() => {
      // If immediate play fails, wait for canplay
      const onCanPlay = () => {
        audio.removeEventListener('canplay', onCanPlay)
        audio.removeEventListener('loadeddata', onLoadedData)
        audio.removeEventListener('error', onError)
        clearTimeout(timeoutId)
        playWithFallback()
      }
      
      const onLoadedData = () => {
        audio.removeEventListener('canplay', onCanPlay)
        audio.removeEventListener('loadeddata', onLoadedData)
        audio.removeEventListener('error', onError)
        clearTimeout(timeoutId)
        playWithFallback()
      }
      
      const onError = (e: any) => {
        audio.removeEventListener('canplay', onCanPlay)
        audio.removeEventListener('loadeddata', onLoadedData)
        audio.removeEventListener('error', onError)
        clearTimeout(timeoutId)
        console.error('Audio load error:', e)
        alert('Failed to load audio file. Please check the file URL.')
      }
      
      // Timeout after 5 seconds
      const timeoutId = setTimeout(() => {
        audio.removeEventListener('canplay', onCanPlay)
        audio.removeEventListener('loadeddata', onLoadedData)
        audio.removeEventListener('error', onError)
        // Try to play anyway
        playWithFallback()
      }, 5000)
      
      audio.addEventListener('canplay', onCanPlay, { once: true })
      audio.addEventListener('loadeddata', onLoadedData, { once: true })
      audio.addEventListener('error', onError, { once: true })
      
      // Start loading
      audio.load()
    })
  }

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef || !duration || !isFinite(duration) || duration <= 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percent = Math.max(0, Math.min(1, x / rect.width)) // Clamp between 0 and 1
    const newTime = Math.max(0, Math.min(duration, percent * duration)) // Clamp between 0 and duration
    audioRef.currentTime = newTime
    setCurrentTime(newTime)
  }

  const handleClosePlayer = () => {
    if (audioRef) {
      audioRef.pause()
      audioRef.currentTime = 0
    }
    setPlayingBeatId(null)
    setPlayingBeat(null)
    setCurrentTime(0)
  }

  const toggleBeatSelection = (beatId: string) => {
    setLastClickedBeatId(beatId) // Track the last clicked beat
    setSelectedBeats(prev => {
      const newSet = new Set(prev)
      if (newSet.has(beatId)) {
        newSet.delete(beatId)
      } else {
        newSet.add(beatId)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedBeats.size === filteredBeats.length) {
      setSelectedBeats(new Set())
    } else {
      setSelectedBeats(new Set(filteredBeats.map(b => b.id)))
    }
  }

  // Keyboard shortcuts for quick selection
  useEffect(() => {
    if (user?.role !== 'admin') return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only if not typing in an input/textarea
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      const isModifier = e.ctrlKey || e.metaKey

      // Ctrl/Cmd + A to select all filtered beats
      if (isModifier && e.key === 'a') {
        e.preventDefault()
        setSelectedBeats(new Set(filteredBeats.map(b => b.id)))
        return
      }

      // Ctrl/Cmd + number keys to select surrounding beats around last clicked beat
      if (isModifier && !e.shiftKey) {
        const num = parseInt(e.key)
        if (!isNaN(num) && num >= 1 && num <= 9) {
          e.preventDefault()
          
          // Find the center beat (last clicked, or first selected, or first beat)
          let centerIndex = 0
          if (lastClickedBeatId) {
            const index = filteredBeats.findIndex(b => b.id === lastClickedBeatId)
            if (index >= 0) {
              centerIndex = index
            }
          } else if (selectedBeats.size > 0) {
            const firstSelectedId = Array.from(selectedBeats)[0]
            const index = filteredBeats.findIndex(b => b.id === firstSelectedId)
            if (index >= 0) {
              centerIndex = index
            }
          }
          
          // Select surrounding beats: num * 10 beats (half before, half after)
          const count = num * 10
          const halfCount = Math.floor(count / 2)
          const startIndex = Math.max(0, centerIndex - halfCount)
          const endIndex = Math.min(filteredBeats.length, centerIndex + halfCount + (count % 2))
          const beatsToSelect = filteredBeats.slice(startIndex, endIndex).map(b => b.id)
          setSelectedBeats(new Set(beatsToSelect))
          return
        }
        // Handle 0 as 10
        if (e.key === '0') {
          e.preventDefault()
          
          let centerIndex = 0
          if (lastClickedBeatId) {
            const index = filteredBeats.findIndex(b => b.id === lastClickedBeatId)
            if (index >= 0) {
              centerIndex = index
            }
          } else if (selectedBeats.size > 0) {
            const firstSelectedId = Array.from(selectedBeats)[0]
            const index = filteredBeats.findIndex(b => b.id === firstSelectedId)
            if (index >= 0) {
              centerIndex = index
            }
          }
          
          const startIndex = Math.max(0, centerIndex - 5)
          const endIndex = Math.min(filteredBeats.length, centerIndex + 5)
          const beatsToSelect = filteredBeats.slice(startIndex, endIndex).map(b => b.id)
          setSelectedBeats(new Set(beatsToSelect))
          return
        }
      }

      // Escape or Cmd+Delete to clear selection
      if ((e.key === 'Escape' || (isModifier && e.key === 'Backspace' || e.key === 'Delete')) && selectedBeats.size > 0) {
        e.preventDefault()
        setSelectedBeats(new Set())
        setLastClickedBeatId(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filteredBeats, selectedBeats.size, lastClickedBeatId, user?.role])

  const handleBulkDelete = async () => {
    if (selectedBeats.size === 0) return
    
    if (!confirm(`Are you sure you want to delete ${selectedBeats.size} beat(s)? This cannot be undone.`)) {
      return
    }

    try {
      const res = await fetch('/api/beats/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          beatIds: Array.from(selectedBeats),
          userId: user?.id,
        }),
      })

      const data = await res.json()
      if (data.success) {
        alert(data.message)
        setSelectedBeats(new Set())
        fetchBeats()
      } else {
        alert(`Failed: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Bulk delete error:', error)
      alert('Failed to delete beats')
    }
  }

  const handleCleanupTitles = async () => {
    if (!user?.id) return

    // First do a dry run to show what will change
    const dryRunRes = await fetch('/api/beats/cleanup-titles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        dryRun: true,
      }),
    })

    const dryRunData = await dryRunRes.json()
    if (!dryRunData.success) {
      alert(`Dry run failed: ${dryRunData.error}`)
      return
    }

    const willUpdate = dryRunData.results.changes.length
    if (willUpdate === 0) {
      alert('No beats need cleanup - all titles are already clean!')
      return
    }

    const message = `This will clean up ${willUpdate} beat title(s).\n\n` +
      `- Extract BPM and key from titles\n` +
      `- Extract producer names from titles\n` +
      `- Clean titles to remove extracted information\n\n` +
      `Continue?`

    if (!confirm(message)) {
      return
    }

    try {
      const res = await fetch('/api/beats/cleanup-titles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          dryRun: false,
        }),
      })

      const data = await res.json()
      if (data.success) {
        alert(`${data.message}\n\nUpdated: ${data.results.updated}\nSkipped: ${data.results.skipped}\nErrors: ${data.results.errors.length}`)
        fetchBeats()
      } else {
        alert(`Failed: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Cleanup error:', error)
      alert('Failed to cleanup beat titles')
    }
  }

  const trackBeatListen = async (artistId: string, beatId: string) => {
    try {
      await fetch('/api/artist-preferences/track-listen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistId, beatId }),
      })
      // Update local state
      if (!artistPreferences.listenHistory.includes(beatId)) {
        setArtistPreferences(prev => ({
          ...prev,
          listenHistory: [...prev.listenHistory, beatId],
        }))
      }
    } catch (error) {
      console.error('Failed to track listen:', error)
    }
  }

  const toggleHeartBeat = async (beatId: string) => {
    if (!user?.id || user?.role !== 'artist') return
    
    try {
      const res = await fetch('/api/artist-preferences/toggle-heart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistId: user.id, beatId }),
      })
      const data = await res.json()
      if (data.success) {
        // Update local state
        setArtistPreferences(prev => {
          const isHearted = prev.favoriteBeats.includes(beatId)
          if (isHearted) {
            return {
              ...prev,
              favoriteBeats: prev.favoriteBeats.filter(id => id !== beatId),
            }
          } else {
            return {
              ...prev,
              favoriteBeats: [...prev.favoriteBeats, beatId],
            }
          }
        })
      }
    } catch (error) {
      console.error('Failed to toggle heart:', error)
    }
  }

  const handleAddProducerToBeat = async () => {
    if (!newProducerName.trim()) {
      return
    }

    setIsAddingProducer(true)
    try {
      const res = await fetch('/api/producers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProducerName.trim() }),
      })

      const data = await res.json()
      if (data.success) {
        // Add the new producer to the selected list
        setSelectedProducerIds(prev => [...prev, data.producer.id])
        setNewProducerName('')
        // Refresh producers list
        await fetchProducers()
      } else {
        alert(`Failed to add producer: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to add producer:', error)
      alert('Failed to add producer. Please try again.')
    } finally {
      setIsAddingProducer(false)
    }
  }

  const handleDeleteBeat = async (beatId: string) => {
    if (!confirm('Are you sure you want to delete this beat?')) return

    try {
      const res = await fetch(`/api/beats?id=${beatId}&userId=${user?.id}&userRole=${user?.role}`, {
        method: 'DELETE',
      })

      const data = await res.json()
      if (data.success) {
        fetchBeats()
      } else {
        alert(`Failed to delete: ${data.error}`)
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete beat')
    }
  }

  const handleUpdateBeat = async () => {
    if (!editingBeat || !editFormData) return

    setIsSavingBeat(true)

    try {
      const res = await fetch('/api/beats', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingBeat.id,
          userId: user?.id,
          userRole: user?.role,
          ...editFormData,
          producerIds: selectedProducerIds,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setShowEditModal(false)
        setEditingBeat(null)
        setEditFormData(null)
        fetchBeats()
      } else {
        alert(`Failed to update: ${data.error}`)
      }
    } catch (error) {
      console.error('Update error:', error)
      alert('Failed to update beat')
    } finally {
      setIsSavingBeat(false)
    }
  }


  const handleEditBeatOpen = (beat: Beat) => {
    setEditingBeat(beat)
    setSelectedProducerIds(beat.producerIds || [])
    setEditFormData({
      name: beat.name,
      bpm: beat.bpm, // Allow manual BPM override
      key: beat.key, // Allow manual key override
      status: beat.status,
      leasePrice: beat.leasePrice,
      premiumLeasePrice: beat.premiumLeasePrice,
      exclusivePrice: beat.exclusivePrice,
      genre: beat.genre,
      mood: beat.mood,
    })
    setShowEditModal(true)
  }

  if (user?.role !== 'admin' && user?.role !== 'artist') {
    return (
      <div className="p-8">
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
          <p className="text-red-400">Access denied. Admin or Artist only.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`p-8 ${playingBeat && audioRef && playingBeatId === playingBeat.id ? 'pb-32' : ''}`}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Beat Catalog</h1>
          <p className="text-slate-400">Manage beats, packs, and producers</p>
        </div>
        <div className="flex items-center gap-3">
          {user?.role === 'admin' && (
            <button
              onClick={() => setShowGenrePreferencesModal(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
            >
              <Users className="w-5 h-5" />
              Manage Artist Preferences
            </button>
          )}
          {user?.role === 'admin' && (
            <button
              onClick={handleCleanupTitles}
              className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg transition"
            >
              <FileText className="w-5 h-5" />
              Cleanup Beat Titles
            </button>
          )}
          {user?.role === 'admin' && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
            >
              <Upload className="w-5 h-5" />
              Upload Beat Pack
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-900 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search beats..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Genre</label>
            <select
              value={genreFilter}
              onChange={e => setGenreFilter(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500"
            >
              <option value="all">All Genres</option>
              {Array.from(new Set(beats.map(b => b.genre).filter(Boolean))).map(genre => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Mood</label>
            <select
              value={moodFilter}
              onChange={e => setMoodFilter(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500"
            >
              <option value="all">All Moods</option>
              {Array.from(new Set(beats.map(b => b.mood).filter(Boolean))).map(mood => (
                <option key={mood} value={mood}>
                  {mood}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500"
            >
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="exclusive_sold">Exclusive Sold</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Producer</label>
            <select
              value={producerFilter}
              onChange={e => setProducerFilter(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500"
            >
              <option value="all">All Producers</option>
              {producers.map(producer => (
                <option key={producer.id} value={producer.id}>
                  {producer.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Pack</label>
            <select
              value={packFilter}
              onChange={e => setPackFilter(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500"
            >
              <option value="all">All Packs</option>
              {packs.map(pack => (
                <option key={pack.id} value={pack.id}>
                  {pack.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {user?.role === 'artist' && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <button
              onClick={() => setShowHeartedOnly(!showHeartedOnly)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                showHeartedOnly
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                  : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
              }`}
            >
              <Heart className={`w-4 h-4 ${showHeartedOnly ? 'fill-current' : ''}`} />
              <span>{showHeartedOnly ? 'Showing Hearted Beats Only' : 'Show Hearted Beats Only'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="text-slate-400 text-sm mb-1">Total Beats</div>
          <div className="text-2xl font-bold text-white">{beats.length}</div>
        </div>
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="text-slate-400 text-sm mb-1">Available</div>
          <div className="text-2xl font-bold text-green-400">
            {beats.filter(b => b.status === 'available').length}
          </div>
        </div>
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="text-slate-400 text-sm mb-1">Incomplete</div>
          <div className="text-2xl font-bold text-yellow-400">
            {beats.filter(b => b.isIncomplete).length}
          </div>
        </div>
        <div className="bg-slate-900 rounded-lg p-4">
          <div className="text-slate-400 text-sm mb-1">Packs</div>
          <div className="text-2xl font-bold text-white">{packs.length}</div>
        </div>
      </div>

      {/* Audio Player - Fixed at bottom */}
      {playingBeat && audioRef && playingBeatId === playingBeat.id && (
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-br from-slate-900 to-black border-t border-slate-800 shadow-2xl p-4 z-50">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (audioRef) {
                  if (audioRef.paused) {
                    audioRef.play()
                  } else {
                    audioRef.pause()
                  }
                }
              }}
              className="p-3 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition flex-shrink-0"
            >
              {audioRef.paused || !audioRef.duration ? (
                <Play className="w-6 h-6 text-red-400" />
              ) : (
                <Pause className="w-6 h-6 text-red-400" />
              )}
            </button>
            
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold truncate mb-1">{playingBeat.name}</div>
              <div className="text-sm text-slate-400">
                {playingBeat.producers && playingBeat.producers.length > 0
                  ? playingBeat.producers.map(p => p.name).join(' & ')
                  : 'Unknown Producer'}
              </div>
            </div>

            <div className="flex items-center gap-4 flex-shrink-0">
              <span className="text-sm text-slate-400 min-w-[80px] text-right">
                {formatTime(currentTime)} / {duration > 0 && isFinite(duration) ? formatTime(duration) : '--:--'}
              </span>
              
              <div
                onClick={handleSeek}
                className="flex-1 w-64 h-2 bg-slate-700 rounded-full cursor-pointer hover:bg-slate-600 transition relative group"
              >
                <div
                  className="h-2 bg-red-500 rounded-full transition-all"
                  style={{ width: duration > 0 && isFinite(duration) && !isNaN(duration) ? `${Math.min(100, Math.max(0, (currentTime / duration) * 100))}%` : '0%' }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ left: duration > 0 && isFinite(duration) && !isNaN(duration) ? `calc(${Math.min(100, Math.max(0, (currentTime / duration) * 100))}% - 8px)` : '-8px' }}
                />
              </div>
            </div>

            <button
              onClick={handleClosePlayer}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition flex-shrink-0"
              title="Close player"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Beats List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-slate-400">Loading beats...</p>
        </div>
      ) : filteredBeats.length === 0 ? (
        <div className="bg-slate-900 rounded-lg p-12 text-center">
          <Music className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No beats found</p>
        </div>
      ) : (
        <>
          {/* Bulk Actions Toolbar */}
          {user?.role === 'admin' && (
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 mb-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-slate-300 font-medium">
                    {selectedBeats.size > 0 ? `${selectedBeats.size} selected` : 'Quick Select:'}
                  </span>
                  <button
                    onClick={toggleSelectAll}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition text-sm"
                  >
                    {selectedBeats.size === filteredBeats.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <button
                    onClick={() => {
                      const availableBeats = filteredBeats.filter(b => b.status === 'available').map(b => b.id)
                      setSelectedBeats(new Set(availableBeats))
                    }}
                    className="px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-300 rounded-lg transition text-sm border border-green-500/30"
                  >
                    Select Available
                  </button>
                  <button
                    onClick={() => {
                      const incompleteBeats = filteredBeats.filter(b => b.isIncomplete).map(b => b.id)
                      setSelectedBeats(new Set(incompleteBeats))
                    }}
                    className="px-3 py-1.5 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-300 rounded-lg transition text-sm border border-yellow-500/30"
                  >
                    Select Incomplete
                  </button>
                  <button
                    onClick={() => {
                      // Select surrounding 10 beats around last clicked or first selected beat
                      let centerIndex = 0
                      if (lastClickedBeatId) {
                        const index = filteredBeats.findIndex(b => b.id === lastClickedBeatId)
                        if (index >= 0) {
                          centerIndex = index
                        }
                      } else if (selectedBeats.size > 0) {
                        const firstSelectedId = Array.from(selectedBeats)[0]
                        const index = filteredBeats.findIndex(b => b.id === firstSelectedId)
                        if (index >= 0) {
                          centerIndex = index
                        }
                      }
                      const startIndex = Math.max(0, centerIndex - 5)
                      const endIndex = Math.min(filteredBeats.length, centerIndex + 5)
                      const surrounding10 = filteredBeats.slice(startIndex, endIndex).map(b => b.id)
                      setSelectedBeats(new Set(surrounding10))
                    }}
                    className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-lg transition text-sm border border-indigo-500/30"
                    title="Select surrounding 10 beats (Cmd+0 or Cmd+1)"
                  >
                    Surrounding 10
                  </button>
                  <div className="text-xs text-slate-500 ml-2">
                    Click a beat, then: Cmd+1 (10), Cmd+2 (20), Cmd+3 (30)... Cmd+9 (90), Cmd+A (all), Cmd+Delete (clear)
                  </div>
                  {selectedBeats.size > 0 && (
                    <>
                      <div className="h-6 w-px bg-slate-700"></div>
                      <button
                        onClick={() => setShowBulkEditModal(true)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm"
                      >
                        Edit Selected
                      </button>
                      <button
                        onClick={handleBulkDelete}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition text-sm"
                      >
                        Delete Selected
                      </button>
                      <button
                        onClick={() => setSelectedBeats(new Set())}
                        className="px-3 py-1.5 text-slate-400 hover:text-white transition text-sm"
                      >
                        Clear
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50 border-b border-slate-700">
                  <tr>
                    {user?.role === 'admin' && (
                      <th className="w-12 py-3 px-4">
                        <button
                          onClick={toggleSelectAll}
                          className="text-slate-400 hover:text-white transition"
                          title={`${selectedBeats.size === filteredBeats.length ? 'Deselect' : 'Select'} all (${filteredBeats.length} beats)`}
                        >
                          {selectedBeats.size === filteredBeats.length && filteredBeats.length > 0 ? (
                            <CheckSquare className="w-5 h-5 text-blue-400" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                      </th>
                    )}
                    <th className="text-left py-3 px-4 text-slate-300 font-semibold text-sm">Beat Name</th>
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold text-sm">Genre</th>
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold text-sm">BPM</th>
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold text-sm">Key</th>
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold text-sm">Producer(s)</th>
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold text-sm">Pack</th>
                  <th className="text-left py-3 px-4 text-slate-300 font-semibold text-sm">Status</th>
                  <th className="text-center py-3 px-4 text-slate-300 font-semibold text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBeats.map((beat, idx) => {
                  const hasListened = user?.role === 'artist' && artistPreferences.listenHistory.includes(beat.id)
                  const isPreferredGenre = user?.role === 'artist' && beat.genre && artistPreferences.preferredGenres.includes(beat.genre)
                  const isSelected = selectedBeats.has(beat.id)
                  
                  return (
                  <tr
                    key={beat.id}
                    className={`border-b border-slate-800 hover:bg-slate-800/30 transition ${
                      idx % 2 === 0 ? 'bg-slate-900/50' : 'bg-slate-900'
                    } ${
                      hasListened ? 'opacity-75' : ''
                    } ${
                      isPreferredGenre ? 'ring-1 ring-blue-500/30' : ''
                    } ${
                      isSelected ? 'bg-blue-900/20 ring-1 ring-blue-500/50' : ''
                    }`}
                  >
                    {user?.role === 'admin' && (
                      <td className="py-3 px-4">
                        <button
                          onClick={() => toggleBeatSelection(beat.id)}
                          className="text-slate-400 hover:text-white transition"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-blue-400" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                      </td>
                    )}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-white font-medium ${hasListened ? 'line-through text-slate-500' : ''}`}>
                          {beat.name}
                        </span>
                        {hasListened && (
                          <span title="You've already listened to this beat" className="text-green-400">
                            <CheckCircle className="w-4 h-4" />
                          </span>
                        )}
                        {isPreferredGenre && !hasListened && (
                          <span title="Your preferred genre" className="text-blue-400">
                            <Tag className="w-4 h-4" />
                          </span>
                        )}
                        {beat.isIncomplete && (
                          <span title="Incomplete - missing producer info">
                            <AlertCircle className="w-4 h-4 text-yellow-400" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          {beat.genre ? (
                            <span className={`px-2 py-1 rounded text-sm font-medium ${
                              isPreferredGenre 
                                ? 'bg-blue-500/30 text-blue-300 ring-1 ring-blue-500/50' 
                                : 'bg-blue-500/20 text-blue-300'
                            }`}>
                              {beat.genre}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-sm">—</span>
                          )}
                        </div>
                        {beat.mood && (
                          <span className={`px-2 py-1 rounded text-sm font-medium ${
                            user?.role === 'artist' && artistPreferences.preferredMoods.includes(beat.mood)
                              ? 'bg-purple-500/30 text-purple-300 ring-1 ring-purple-500/50'
                              : 'bg-purple-500/20 text-purple-300'
                          }`}>
                            {beat.mood}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {beat.bpm ? (
                        <span className="text-slate-300 font-medium">{beat.bpm}</span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {beat.key ? (
                        <span className="text-slate-300 font-medium">{beat.key}</span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-slate-300">
                        {beat.producers && beat.producers.length > 0
                          ? beat.producers.map(p => p.name).join(' & ')
                          : '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {beat.packName ? (
                        <div className="flex items-center gap-1 text-slate-300">
                          <Package className="w-3 h-3" />
                          <span className="text-sm">{beat.packName}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {beat.status === 'available' && (
                          <span className="flex items-center gap-1 text-green-400">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm">Available</span>
                          </span>
                        )}
                        {beat.status === 'reserved' && (
                          <span className="text-yellow-400 text-sm">Reserved</span>
                        )}
                        {beat.status === 'exclusive_sold' && (
                          <span className="flex items-center gap-1 text-red-400">
                            <XCircle className="w-4 h-4" />
                            <span className="text-sm">Exclusive Sold</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handlePlay(beat)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition"
                          title={playingBeatId === beat.id ? 'Pause' : 'Play'}
                        >
                          {playingBeatId === beat.id ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </button>
                        {user?.role === 'artist' && (
                          <button
                            onClick={() => toggleHeartBeat(beat.id)}
                            className={`p-1.5 rounded transition ${
                              artistPreferences.favoriteBeats.includes(beat.id)
                                ? 'text-red-500 hover:text-red-400 hover:bg-red-500/20'
                                : 'text-slate-400 hover:text-red-400 hover:bg-slate-700'
                            }`}
                            title={artistPreferences.favoriteBeats.includes(beat.id) ? 'Unheart' : 'Heart'}
                          >
                            <Heart className={`w-4 h-4 ${artistPreferences.favoriteBeats.includes(beat.id) ? 'fill-current' : ''}`} />
                          </button>
                        )}
                        {beat.originalFileUrl && (
                          <button
                            onClick={async () => {
                              try {
                                const response = await fetch(beat.originalFileUrl)
                                const blob = await response.blob()
                                const url = window.URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = url
                                const urlFilename = beat.originalFileUrl.split('/').pop() || 'beat.wav'
                                const ext = urlFilename.substring(urlFilename.lastIndexOf('.'))
                                const cleanName = beat.name.replace(/[^a-zA-Z0-9.-]/g, '_')
                                a.download = `${cleanName}${ext}`
                                document.body.appendChild(a)
                                a.click()
                                document.body.removeChild(a)
                                window.URL.revokeObjectURL(url)
                              } catch (error) {
                                console.error('Download failed:', error)
                                window.open(beat.originalFileUrl, '_blank')
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleEditBeatOpen(beat)}
                          className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded transition"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteBeat(beat.id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Upload Beat Pack</h2>
              <button
                onClick={() => {
                  setShowUploadModal(false)
                  setUploadFiles([])
                  setPackName('')
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Pack Name</label>
                <input
                  type="text"
                  value={packName}
                  onChange={e => setPackName(e.target.value)}
                  placeholder="Enter pack name (or leave blank to use folder name)"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <div className="flex items-center gap-4 mb-2">
                  <label className="block text-sm text-slate-400">Upload Type</label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={!isFolderUpload}
                        onChange={() => setIsFolderUpload(false)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-slate-300">Individual Files</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={isFolderUpload}
                        onChange={() => setIsFolderUpload(true)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-slate-300">Folder</span>
                    </label>
                  </div>
                </div>
                <input
                  type="file"
                  multiple={!isFolderUpload}
                  {...(isFolderUpload ? { webkitdirectory: '' as any, directory: '' as any } : {})}
                  accept="audio/*,.wav,.mp3"
                  onChange={handleFileSelect}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500"
                />
                {isFolderUpload && (
                  <p className="mt-1 text-xs text-slate-500">
                    Select a folder containing beat files. All audio files in the folder will be uploaded.
                  </p>
                )}
                {uploadFiles.length > 0 && (
                  <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                    <div className="text-xs text-slate-500 mb-1">
                      {uploadFiles.length} file{uploadFiles.length !== 1 ? 's' : ''} selected
                    </div>
                    {uploadFiles.slice(0, 10).map((file, idx) => (
                      <div key={idx} className="text-sm text-slate-400 flex items-center justify-between bg-slate-800 p-2 rounded">
                        <span className="truncate flex-1" title={file.name}>{file.name}</span>
                        {!isFolderUpload && (
                          <button
                            onClick={() => setUploadFiles(files => files.filter((_, i) => i !== idx))}
                            className="text-red-400 hover:text-red-300 ml-2"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {uploadFiles.length > 10 && (
                      <div className="text-xs text-slate-500 text-center py-1">
                        ... and {uploadFiles.length - 10} more files
                      </div>
                    )}
                    {isFolderUpload && uploadFiles.length > 0 && (
                      <button
                        onClick={() => {
                          setUploadFiles([])
                          setPackName('')
                        }}
                        className="w-full mt-2 text-sm text-red-400 hover:text-red-300 py-1"
                      >
                        Clear Selection
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Upload Progress */}
              {isUploading && uploadStatus && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-300 font-medium">
                      Uploading: {uploadStatus.current} / {uploadStatus.total} files
                    </span>
                    <span className="text-sm text-slate-400">
                      {Math.round((uploadStatus.current / uploadStatus.total) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
                    <div
                      className="bg-red-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(uploadStatus.current / uploadStatus.total) * 100}%` }}
                    />
                  </div>
                  {uploadStatus.errors.length > 0 && (
                    <div className="mt-3 space-y-1 max-h-32 overflow-y-auto">
                      <div className="text-xs text-red-400 font-medium">Errors ({uploadStatus.errors.length}):</div>
                      {uploadStatus.errors.map((err, idx) => (
                        <div key={idx} className="text-xs text-red-300 bg-red-900/20 p-2 rounded">
                          <span className="font-medium">{err.fileName}:</span> {err.error}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-4 pt-4">
                <button
                  onClick={handleUploadPack}
                  disabled={isUploading || uploadFiles.length === 0}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition"
                >
                  {isUploading ? `Uploading ${uploadStatus?.current || 0}/${uploadStatus?.total || 0}...` : `Upload Pack (${uploadFiles.length} file${uploadFiles.length !== 1 ? 's' : ''})`}
                </button>
                <button
                  onClick={() => {
                    if (!isUploading) {
                      setShowUploadModal(false)
                      setUploadFiles([])
                      setPackName('')
                      setIsFolderUpload(false)
                      setUploadStatus(null)
                    }
                  }}
                  disabled={isUploading}
                  className="px-4 py-2 text-slate-400 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? 'Uploading...' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingBeat && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Edit Beat</h2>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingBeat(null)
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Beat Name</label>
                <input
                  type="text"
                  value={editFormData?.name || ''}
                  onChange={e => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Genre</label>
                  <input
                    type="text"
                    value={editFormData?.genre || ''}
                    onChange={e => setEditFormData(prev => ({ ...prev, genre: e.target.value || undefined }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500"
                    placeholder="e.g., Hip-Hop, Trap, R&B"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Status</label>
                  <select
                    value={editFormData?.status || 'available'}
                    onChange={e => setEditFormData(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="available">Available</option>
                    <option value="reserved">Reserved</option>
                    <option value="exclusive_sold">Exclusive Sold</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                <div className="mb-3">
                  <span className="text-sm text-slate-400 font-medium">BPM & Key</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">BPM (manual override)</label>
                    <input
                      type="number"
                      value={editFormData?.bpm || ''}
                      onChange={e => setEditFormData(prev => ({ ...prev, bpm: e.target.value ? parseInt(e.target.value) : undefined }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500"
                      placeholder="Auto-detected"
                    />
                    {editingBeat?.bpm && !editFormData?.bpm && (
                      <p className="text-xs text-slate-500 mt-1">Current: {editingBeat.bpm}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Key (manual override)</label>
                    <input
                      type="text"
                      value={editFormData?.key || ''}
                      onChange={e => setEditFormData(prev => ({ ...prev, key: e.target.value || undefined }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500"
                      placeholder="e.g., C Major, A Minor"
                    />
                    {editingBeat?.key && !editFormData?.key && (
                      <p className="text-xs text-slate-500 mt-1">Current: {editingBeat.key}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Lease Price</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      value={editFormData?.leasePrice || ''}
                      onChange={e => setEditFormData(prev => ({ ...prev, leasePrice: e.target.value ? parseFloat(e.target.value) : undefined }))}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500"
                      placeholder="0.00"
                    />
                    <label className="flex items-center gap-1 text-xs text-slate-400 cursor-pointer whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={editFormData?.leasePrice === 0 || (editFormData?.leasePrice === undefined && editingBeat?.leasePrice === 0)}
                        onChange={e => {
                          if (e.target.checked) {
                            setEditFormData(prev => ({ ...prev, leasePrice: 0 }))
                          } else {
                            setEditFormData(prev => ({ ...prev, leasePrice: undefined }))
                          }
                        }}
                        className="rounded"
                      />
                      Free
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Premium Lease</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      value={editFormData?.premiumLeasePrice || ''}
                      onChange={e => setEditFormData(prev => ({ ...prev, premiumLeasePrice: e.target.value ? parseFloat(e.target.value) : undefined }))}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500"
                      placeholder="0.00"
                    />
                    <label className="flex items-center gap-1 text-xs text-slate-400 cursor-pointer whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={editFormData?.premiumLeasePrice === 0 || (editFormData?.premiumLeasePrice === undefined && editingBeat?.premiumLeasePrice === 0)}
                        onChange={e => {
                          if (e.target.checked) {
                            setEditFormData(prev => ({ ...prev, premiumLeasePrice: 0 }))
                          } else {
                            setEditFormData(prev => ({ ...prev, premiumLeasePrice: undefined }))
                          }
                        }}
                        className="rounded"
                      />
                      Free
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Exclusive Price</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      value={editFormData?.exclusivePrice || ''}
                      onChange={e => setEditFormData(prev => ({ ...prev, exclusivePrice: e.target.value ? parseFloat(e.target.value) : undefined }))}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500"
                      placeholder="0.00"
                    />
                    <label className="flex items-center gap-1 text-xs text-slate-400 cursor-pointer whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={editFormData?.exclusivePrice === 0 || (editFormData?.exclusivePrice === undefined && editingBeat?.exclusivePrice === 0)}
                        onChange={e => {
                          if (e.target.checked) {
                            setEditFormData(prev => ({ ...prev, exclusivePrice: 0 }))
                          } else {
                            setEditFormData(prev => ({ ...prev, exclusivePrice: undefined }))
                          }
                        }}
                        className="rounded"
                      />
                      Free
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Mood</label>
                <input
                  type="text"
                  value={editFormData?.mood || ''}
                  onChange={e => setEditFormData(prev => ({ ...prev, mood: e.target.value || undefined }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500"
                  placeholder="e.g., Dark, Upbeat, Melodic"
                />
              </div>

              {/* Producers Section */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Producers</label>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedProducerIds.map(producerId => {
                      const producer = producers.find(p => p.id === producerId)
                      if (!producer) return null
                      return (
                        <span
                          key={producerId}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600/20 text-blue-300 rounded-lg text-sm"
                        >
                          {producer.name}
                          <button
                            onClick={() => setSelectedProducerIds(prev => prev.filter(id => id !== producerId))}
                            className="hover:text-red-400"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )
                    })}
                  </div>
                  <div className="flex gap-2">
                    <select
                      value=""
                      onChange={e => {
                        if (e.target.value && !selectedProducerIds.includes(e.target.value)) {
                          setSelectedProducerIds(prev => [...prev, e.target.value])
                        }
                        e.target.value = ''
                      }}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500"
                    >
                      <option value="">Select Producer...</option>
                      {producers
                        .filter(p => !selectedProducerIds.includes(p.id))
                        .map(producer => (
                          <option key={producer.id} value={producer.id}>
                            {producer.name}
                          </option>
                        ))}
                    </select>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newProducerName}
                        onChange={e => setNewProducerName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && newProducerName.trim()) {
                            handleAddProducerToBeat()
                          }
                        }}
                        placeholder="New producer name..."
                        className="w-48 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500"
                      />
                      <button
                        onClick={handleAddProducerToBeat}
                        disabled={isAddingProducer || !newProducerName.trim()}
                        className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg text-sm transition"
                        title="Add new producer"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Beat Files Section */}
              <div className="border-t border-slate-800 pt-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-white">Additional Files</h3>
                  <button
                    onClick={() => {
                      setShowFileUpload(editingBeat.id)
                      setFileUploadData({ files: [], fileType: 'other', folderPath: '', isFolderUpload: false })
                    }}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-sm transition"
                  >
                    <Plus className="w-4 h-4" />
                    Add Files/Folder
                  </button>
                </div>
                
                {beatFiles[editingBeat.id] && beatFiles[editingBeat.id].length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {beatFiles[editingBeat.id].map((file: any) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between bg-slate-800 p-2 rounded"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white truncate">{file.fileName}</div>
                          <div className="text-xs text-slate-400">
                            {file.fileType} {file.fileSize && `• ${(file.fileSize / 1024 / 1024).toFixed(2)} MB`}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {file.fileUrl && (
                            <a
                              href={`${file.fileUrl}?userId=${user?.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            onClick={() => handleDeleteBeatFile(file.id, editingBeat.id)}
                            className="text-red-400 hover:text-red-300"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No additional files</p>
                )}
              </div>

              <div className="flex items-center gap-4 pt-4">
                <button
                  onClick={handleUpdateBeat}
                  disabled={isSavingBeat}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition"
                >
                  {isSavingBeat ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingBeat(null)
                    setEditFormData(null)
                    setShowFileUpload(null)
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Upload Modal */}
      {showFileUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-lg p-6 max-w-lg w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Upload File</h2>
              <button
                onClick={() => {
                  setShowFileUpload(null)
                  setFileUploadData({ files: [], fileType: 'other', folderPath: '', isFolderUpload: false })
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-4 mb-2">
                  <label className="block text-sm text-slate-400">Upload Type</label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={!fileUploadData.isFolderUpload}
                        onChange={() => setFileUploadData(prev => ({ ...prev, isFolderUpload: false, files: [] }))}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-slate-300">Individual Files</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={fileUploadData.isFolderUpload}
                        onChange={() => setFileUploadData(prev => ({ ...prev, isFolderUpload: true, files: [] }))}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-slate-300">Folder</span>
                    </label>
                  </div>
                </div>
                <input
                  type="file"
                  multiple={!fileUploadData.isFolderUpload}
                  {...(fileUploadData.isFolderUpload ? { webkitdirectory: '' as any, directory: '' as any } : {})}
                  onChange={handleFileSelectForBeat}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500"
                />
                {fileUploadData.isFolderUpload && (
                  <p className="mt-1 text-xs text-slate-500">
                    Select a folder containing files. All files in the folder will be uploaded.
                  </p>
                )}
                {fileUploadData.files.length > 0 && (
                  <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                    <div className="text-xs text-slate-500 mb-1">
                      {fileUploadData.files.length} file{fileUploadData.files.length !== 1 ? 's' : ''} selected
                    </div>
                    {fileUploadData.files.slice(0, 5).map((file, idx) => (
                      <div key={idx} className="text-sm text-slate-400 truncate bg-slate-800 p-1 rounded">
                        {file.name}
                      </div>
                    ))}
                    {fileUploadData.files.length > 5 && (
                      <div className="text-xs text-slate-500 text-center py-1">
                        ... and {fileUploadData.files.length - 5} more files
                      </div>
                    )}
                    {!fileUploadData.isFolderUpload && (
                      <button
                        onClick={() => setFileUploadData(prev => ({ ...prev, files: [] }))}
                        className="w-full mt-2 text-sm text-red-400 hover:text-red-300 py-1"
                      >
                        Clear Selection
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">File Type</label>
                <select
                  value={fileUploadData.fileType}
                  onChange={e => setFileUploadData(prev => ({ ...prev, fileType: e.target.value as any }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500"
                >
                  <option value="logic">Logic Project</option>
                  <option value="bounced">Bounced</option>
                  <option value="stem">Stem</option>
                  <option value="master">Master</option>
                  <option value="music_video">Music Video</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Folder Path (optional)</label>
                <input
                  type="text"
                  value={fileUploadData.folderPath}
                  onChange={e => setFileUploadData(prev => ({ ...prev, folderPath: e.target.value }))}
                  placeholder="e.g., Logic Sessions"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex items-center gap-4 pt-4">
                <button
                  onClick={() => handleUploadBeatFile(showFileUpload)}
                  disabled={isUploadingFile || fileUploadData.files.length === 0}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition"
                >
                  {isUploadingFile ? `Uploading ${fileUploadData.files.length} file(s)...` : `Upload ${fileUploadData.files.length} file(s)`}
                </button>
                <button
                  onClick={() => {
                    setShowFileUpload(null)
                    setFileUploadData({ files: [], fileType: 'other', folderPath: '', isFolderUpload: false })
                  }}
                  className="px-4 py-2 text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Genre Preferences Modal */}
      {showGenrePreferencesModal && (
        <GenrePreferencesModal
          onClose={() => {
            setShowGenrePreferencesModal(false)
            setSelectedArtistForPreferences(null)
          }}
          onSave={() => {
            setShowGenrePreferencesModal(false)
            setSelectedArtistForPreferences(null)
          }}
        />
      )}

      {/* Bulk Edit Modal */}
      {showBulkEditModal && (
        <BulkEditModal
          selectedBeats={Array.from(selectedBeats)}
          onClose={() => {
            setShowBulkEditModal(false)
          }}
          onSave={() => {
            setShowBulkEditModal(false)
            setSelectedBeats(new Set())
            fetchBeats()
          }}
        />
      )}

    </div>
  )
}

// Bulk Edit Modal Component
function BulkEditModal({ 
  selectedBeats, 
  onClose, 
  onSave 
}: { 
  selectedBeats: string[]
  onClose: () => void
  onSave: () => void 
}) {
  const { user } = useAuth()
  const [genre, setGenre] = useState<string>('')
  const [customGenre, setCustomGenre] = useState<string>('')
  const [useCustomGenre, setUseCustomGenre] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [producerNames, setProducerNames] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  const [availableGenres, setAvailableGenres] = useState<string[]>([])
  const [producers, setProducers] = useState<Producer[]>([])
  const [selectedBeatsData, setSelectedBeatsData] = useState<Beat[]>([])
  const [previewChanges, setPreviewChanges] = useState<{
    genre?: { before: string; after: string }
    status?: { before: string; after: string }
    producers?: { before: string; after: string }
  }>({})

  useEffect(() => {
    fetchGenres()
    fetchProducers()
    fetchSelectedBeats()
  }, [])

  useEffect(() => {
    if (selectedBeatsData.length > 0) {
      updatePreview()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genre, customGenre, useCustomGenre, status, producerNames, selectedBeatsData.length])

  const fetchSelectedBeats = async () => {
    try {
      const res = await fetch('/api/beats')
      const data = await res.json()
      if (data.success) {
        const beats = (data.beats || []).filter((b: any) => selectedBeats.includes(b.id))
        setSelectedBeatsData(beats)
      }
    } catch (error) {
      console.error('Failed to fetch selected beats:', error)
    }
  }

  const updatePreview = () => {
    const changes: any = {}
    
    if (genre || (useCustomGenre && customGenre.trim())) {
      const newGenre = useCustomGenre ? customGenre.trim() : genre
      const currentGenres = Array.from(new Set(selectedBeatsData.map(b => b.genre).filter(Boolean)))
      changes.genre = {
        before: currentGenres.length > 0 ? currentGenres.join(', ') : '—',
        after: newGenre,
      }
    }
    
    if (status) {
      const currentStatuses = Array.from(new Set(selectedBeatsData.map(b => b.status)))
      changes.status = {
        before: currentStatuses.length > 0 ? currentStatuses.join(', ') : '—',
        after: status,
      }
    }
    
    if (producerNames.trim()) {
      const names = producerNames.split(/[,\n]/).map(n => n.trim()).filter(n => n.length > 0)
      const currentProducers = Array.from(new Set(
        selectedBeatsData.flatMap(b => 
          (b.producers || []).map((p: any) => p.name)
        )
      ))
      changes.producers = {
        before: currentProducers.length > 0 ? currentProducers.join(', ') : '—',
        after: names.join(', '),
      }
    }
    
    setPreviewChanges(changes)
  }

  const fetchGenres = async () => {
    try {
      const res = await fetch('/api/beats')
      const data = await res.json()
      if (data.success) {
        const genres = Array.from(new Set(
          (data.beats || []).map((b: any) => b.genre).filter(Boolean)
        )).sort() as string[]
        setAvailableGenres(genres)
      }
    } catch (error) {
      console.error('Failed to fetch genres:', error)
    }
  }

  const fetchProducers = async () => {
    try {
      const res = await fetch('/api/producers')
      const data = await res.json()
      if (data.success) {
        setProducers(data.producers || [])
      }
    } catch (error) {
      console.error('Failed to fetch producers:', error)
    }
  }

  const handleSave = async () => {
    const finalGenre = useCustomGenre ? customGenre.trim() : genre
    if (!finalGenre && !status && !producerNames.trim()) {
      alert('Please select at least one field to update')
      return
    }

    setIsSaving(true)
    try {
      const updates: any = {}
      if (finalGenre) updates.genre = finalGenre
      if (status) updates.status = status as 'available' | 'reserved' | 'exclusive_sold'
      if (producerNames.trim()) {
        // Parse producer names (comma or newline separated)
        const names = producerNames
          .split(/[,\n]/)
          .map(n => n.trim())
          .filter(n => n.length > 0)
        updates.producerNames = names
      }

      const res = await fetch('/api/beats/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          beatIds: selectedBeats,
          userId: user?.id,
          updates,
        }),
      })

      const data = await res.json()
      if (data.success) {
        alert(data.message)
        onSave()
      } else {
        alert(`Failed: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Bulk update error:', error)
      alert('Failed to update beats')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">Bulk Edit Beats</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-4 text-slate-400">
          Editing {selectedBeats.length} beat{selectedBeats.length !== 1 ? 's' : ''}
        </div>

        {/* Preview Changes */}
        {Object.keys(previewChanges).length > 0 && (
          <div className="mb-4 p-4 bg-blue-900/20 border border-blue-500/50 rounded-lg">
            <div className="text-sm font-medium text-blue-300 mb-2">Preview Changes:</div>
            <div className="space-y-1 text-xs text-slate-300">
              {previewChanges.genre && (
                <div>
                  <span className="text-slate-400">Genre:</span>{' '}
                  <span className="line-through text-slate-500">{previewChanges.genre.before}</span>{' '}
                  → <span className="text-blue-300 font-medium">{previewChanges.genre.after}</span>
                </div>
              )}
              {previewChanges.status && (
                <div>
                  <span className="text-slate-400">Status:</span>{' '}
                  <span className="line-through text-slate-500">{previewChanges.status.before}</span>{' '}
                  → <span className="text-blue-300 font-medium">{previewChanges.status.after}</span>
                </div>
              )}
              {previewChanges.producers && (
                <div>
                  <span className="text-slate-400">Producers:</span>{' '}
                  <span className="line-through text-slate-500">{previewChanges.producers.before}</span>{' '}
                  → <span className="text-blue-300 font-medium">{previewChanges.producers.after}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Genre (leave empty to keep unchanged)</label>
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!useCustomGenre}
                    onChange={() => {
                      setUseCustomGenre(false)
                      setCustomGenre('')
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-slate-300">Select existing</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={useCustomGenre}
                    onChange={() => {
                      setUseCustomGenre(true)
                      setGenre('')
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-slate-300">Add new genre</span>
                </label>
              </div>
              {!useCustomGenre ? (
                <select
                  value={genre}
                  onChange={e => setGenre(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500"
                >
                  <option value="">Keep unchanged</option>
                  {availableGenres.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={customGenre}
                  onChange={e => setCustomGenre(e.target.value)}
                  placeholder="Enter new genre name"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500"
                />
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Status (leave empty to keep unchanged)</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500"
            >
              <option value="">Keep unchanged</option>
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="exclusive_sold">Exclusive Sold</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Producer Names (comma or newline separated, leave empty to keep unchanged)</label>
            <textarea
              value={producerNames}
              onChange={e => setProducerNames(e.target.value)}
              placeholder="Producer1, Producer2&#10;or&#10;Producer1&#10;Producer2"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500 min-h-[100px]"
            />
            <p className="text-xs text-slate-500 mt-1">
              Separate multiple producers with commas or new lines. This will replace existing producers.
            </p>
          </div>

          {/* Current Values Display */}
          {selectedBeatsData.length > 0 && (
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="text-sm font-medium text-slate-300 mb-2">Current Values (first beat):</div>
              <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
                <div>
                  <span className="text-slate-500">Genre:</span>{' '}
                  <span className="text-slate-300">{selectedBeatsData[0]?.genre || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Status:</span>{' '}
                  <span className="text-slate-300 capitalize">{selectedBeatsData[0]?.status || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500">BPM:</span>{' '}
                  <span className="text-slate-300">{selectedBeatsData[0]?.bpm || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Key:</span>{' '}
                  <span className="text-slate-300">{selectedBeatsData[0]?.key || '—'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500">Producers:</span>{' '}
                  <span className="text-slate-300">
                    {selectedBeatsData[0]?.producers && selectedBeatsData[0].producers.length > 0
                      ? selectedBeatsData[0].producers.map((p: any) => p.name).join(', ')
                      : '—'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={isSaving || (!(useCustomGenre ? customGenre.trim() : genre) && !status && !producerNames.trim())}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Genre Preferences Modal Component
function GenrePreferencesModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [artists, setArtists] = useState<Array<{ id: string; name: string; preferredGenres: string[]; preferredMoods: string[] }>>([])
  const [selectedArtistId, setSelectedArtistId] = useState<string>('')
  const [availableGenres, setAvailableGenres] = useState<string[]>([])
  const [availableMoods, setAvailableMoods] = useState<string[]>([])
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [selectedMoods, setSelectedMoods] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchArtists()
    fetchGenres()
    fetchMoods()
  }, [])

  useEffect(() => {
    if (selectedArtistId) {
      const artist = artists.find(a => a.id === selectedArtistId)
      setSelectedGenres(artist?.preferredGenres || [])
      setSelectedMoods(artist?.preferredMoods || [])
    } else {
      setSelectedGenres([])
      setSelectedMoods([])
    }
  }, [selectedArtistId, artists])

  const fetchArtists = async () => {
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      if (data.success) {
        const artistUsers = data.users.filter((u: any) => u.role === 'artist')
        setArtists(artistUsers.map((u: any) => ({
          id: u.id,
          name: u.name,
          preferredGenres: u.preferredGenres || [],
          preferredMoods: u.preferredMoods || [],
        })))
      }
    } catch (error) {
      console.error('Failed to fetch artists:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchGenres = async () => {
    try {
      const res = await fetch('/api/beats')
      const data = await res.json()
      if (data.success) {
        const genres = Array.from(new Set(
          (data.beats || []).map((b: any) => b.genre).filter(Boolean)
        )).sort() as string[]
        setAvailableGenres(genres)
      }
    } catch (error) {
      console.error('Failed to fetch genres:', error)
    }
  }

  const fetchMoods = async () => {
    try {
      const res = await fetch('/api/beats')
      const data = await res.json()
      if (data.success) {
        const moods = Array.from(new Set(
          (data.beats || []).map((b: any) => b.mood).filter(Boolean)
        )).sort() as string[]
        setAvailableMoods(moods)
      }
    } catch (error) {
      console.error('Failed to fetch moods:', error)
    }
  }

  const handleSave = async () => {
    if (!selectedArtistId) {
      alert('Please select an artist')
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch('/api/artist-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistId: selectedArtistId,
          genres: selectedGenres,
          moods: selectedMoods,
        }),
      })

      const data = await res.json()
      if (data.success) {
        alert('Preferences saved successfully!')
        await fetchArtists()
        onSave()
      } else {
        alert(`Failed to save: ${data.error}`)
      }
    } catch (error) {
      console.error('Failed to save preferences:', error)
      alert('Failed to save preferences')
    } finally {
      setIsSaving(false)
    }
  }

  const toggleGenre = (genre: string) => {
    if (selectedGenres.includes(genre)) {
      setSelectedGenres(selectedGenres.filter(g => g !== genre))
    } else {
      setSelectedGenres([...selectedGenres, genre])
    }
  }

  const toggleMood = (mood: string) => {
    if (selectedMoods.includes(mood)) {
      setSelectedMoods(selectedMoods.filter(m => m !== mood))
    } else {
      setSelectedMoods([...selectedMoods, mood])
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">Manage Artist Preferences</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-400">Loading...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Select Artist</label>
              <select
                value={selectedArtistId}
                onChange={e => setSelectedArtistId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Choose an artist...</option>
                {artists.map(artist => (
                  <option key={artist.id} value={artist.id}>
                    {artist.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedArtistId && (
              <>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Preferred Genres (beats of these genres will appear first)
                  </label>
                  <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                    {availableGenres.length === 0 ? (
                      <p className="text-slate-500 text-sm">No genres available. Upload beats with genres first.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {availableGenres.map(genre => (
                          <button
                            key={genre}
                            onClick={() => toggleGenre(genre)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                              selectedGenres.includes(genre)
                                ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {genre}
                            {selectedGenres.includes(genre) && (
                              <span className="ml-1">✓</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedGenres.length > 0 && (
                    <p className="text-xs text-slate-500 mt-2">
                      {selectedGenres.length} genre{selectedGenres.length !== 1 ? 's' : ''} selected
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Preferred Moods (beats of these moods will appear first)
                  </label>
                  <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                    {availableMoods.length === 0 ? (
                      <p className="text-slate-500 text-sm">No moods available. Upload beats with moods first.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {availableMoods.map(mood => (
                          <button
                            key={mood}
                            onClick={() => toggleMood(mood)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                              selectedMoods.includes(mood)
                                ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {mood}
                            {selectedMoods.includes(mood) && (
                              <span className="ml-1">✓</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedMoods.length > 0 && (
                    <p className="text-xs text-slate-500 mt-2">
                      {selectedMoods.length} mood{selectedMoods.length !== 1 ? 's' : ''} selected
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition"
                  >
                    {isSaving ? 'Saving...' : 'Save Preferences'}
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-slate-400 hover:text-white transition"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

