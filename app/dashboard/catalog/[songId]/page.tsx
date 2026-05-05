'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Music, ArrowLeft, Upload, Link as LinkIcon, FileText, Trash2, Plus, CheckSquare, Play, Pause, Download, Folder, ChevronRight, ChevronDown, ChevronUp, Edit, SkipForward, SkipBack, Square, Loader2, AlertCircle, Image as ImageIcon, Users, X, Clipboard, Check, Video, ExternalLink, Route, MoreVertical, Archive, UserPlus } from 'lucide-react'

// Helper function to get distributor URL
const getDistributorUrl = (distributor: string): string | null => {
  const lowerDistributor = distributor.toLowerCase()
  
  if (lowerDistributor.includes('empire')) {
    return 'https://empiredistrib.com'
  }
  if (lowerDistributor.includes('identify') || lowerDistributor.includes('identifyy')) {
    return 'https://identifyy.com'
  }
  if (lowerDistributor.includes('orchard')) {
    return 'https://www.theorchard.com'
  }
  if (lowerDistributor.includes('distrokid') || lowerDistributor.includes('distro kid')) {
    return 'https://distrokid.com'
  }
  if (lowerDistributor.includes('cd baby') || lowerDistributor.includes('cdbaby')) {
    return 'https://cdbaby.com'
  }
  if (lowerDistributor.includes('tunecore')) {
    return 'https://www.tunecore.com'
  }
  if (lowerDistributor.includes('amuse')) {
    return 'https://amuse.io'
  }
  if (lowerDistributor.includes('ditto')) {
    return 'https://dittomusic.com'
  }
  if (lowerDistributor.includes('landr')) {
    return 'https://www.landr.com'
  }
  if (lowerDistributor.includes('awal')) {
    return 'https://www.awal.com'
  }
  
  return null
}

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = n
  let u = 0
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024
    u++
  }
  const decimals = u >= 2 && v < 10 ? 1 : 0
  return `${v.toFixed(decimals)} ${units[u]}`
}

const DEFAULT_XHR_UPLOAD_TIMEOUT_MS = 3 * 60 * 60 * 1000 // 3h for multi-GB motion covers

/** Absolute URL for /api/files/... paths (usable from hooks before inline getAbsoluteUrl exists). */
function absoluteAssetUrl(url: string | undefined | null): string {
  if (!url || !url.trim()) return ''
  const t = url.trim()
  if (t.startsWith('http') || t.startsWith('//')) return t
  if (typeof window === 'undefined') return t.startsWith('/') ? t : `/${t}`
  return t.startsWith('/') ? `${window.location.origin}${t}` : `${window.location.origin}/${t}`
}

import { useAuth } from '@/contexts/AuthContext'
import { useAudioPlayer } from '@/contexts/AudioPlayerContext'
import ReleaseChecklist from '@/components/ReleaseChecklist'
import SongCampaignSection from '@/components/SongCampaignSection'
import CampaignBlueprintSection from '@/components/CampaignBlueprintSection'
import { formatLocalDate, formatLocalDateString } from '@/lib/utils'

/** Match server-side album-cover route for motion / still images */
const COVER_VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'avi', 'mpeg', 'm4v', 'mkv'])
function isCoverVideoFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  if (COVER_VIDEO_EXTENSIONS.has(ext)) return true
  if (file.type.startsWith('video/')) return true
  return false
}
function isCoverImageFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return true
  if (file.type.startsWith('image/')) return true
  return false
}

interface CatalogItem {
  id: string
  song: string
  artist: string
  artistId?: string
  artistIds?: string[]
  releaseType?: 'single' | 'ep' | 'album'
  releaseDate?: string
  releaseDateRequested?: string
  releaseApprovalStatus?: 'pending' | 'approved' | 'denied'
  releaseApprovalNotes?: string
  totalStreams: number
  platforms?: string[]
  distributor?: string
  manuallyAdded: boolean
  googleDriveUrl?: string
  fileUrl?: string
  upc?: string
  isrc?: string
  albumCover?: string
  motionCover?: string
  motionCoverPreview?: string
  coverArchive?: Array<{
    id: string
    kind: 'still' | 'motion'
    masterUrl: string
    previewUrl?: string
    replacedAt: string
  }>
  musicVideo?: string
  isUnreleased?: boolean
  isDelayed?: boolean
  delayReason?: string
  sentToEmpireAt?: string
  songs?: Array<{
    id: string
    song: string
    isrc?: string
    streams?: number
    audioUrl?: string
    featuring?: string
    featuredArtistIds?: string[]
    credits?: Array<{
      id: string
      role: 'producer' | 'engineer' | 'writer' | 'publisher' | 'mixer' | 'mastering' | 'other'
      name: string
      ipi?: string
      customRole?: string
      adminNotes?: string
    }>
  }>
  credits?: Array<{
    id: string
    role: 'producer' | 'engineer' | 'writer' | 'publisher' | 'mixer' | 'mastering' | 'other'
    name: string
    ipi?: string
    customRole?: string
    adminNotes?: string
  }>
  promoNotes?: string
  aiActionHistory?: Array<{
    id: string
    at: string
    action: string
    summary: string
  }>
  additionalInfo?: string
}

interface SongVaultFile {
  id: string
  songId: string
  fileName: string
  fileType: 'logic' | 'bounced' | 'stem' | 'master' | 'music_video' | 'other' | 'folder'
  fileUrl?: string
  googleDriveUrl?: string
  fileSize?: number
  folderPath?: string
  isFolder?: boolean
  uploadedAt: string
  uploadedBy: string
}

export default function SongPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const isStaff = user?.role === 'artist' && Array.isArray(user?.staffPermissions) && user.staffPermissions.length > 0
  const isProducer = user?.role === 'producer'
  // Staff can view but request changes to owner - they cannot edit directly
  const canManage = !isProducer && (user?.role === 'admin' || user?.role === 'manager')
  const canRequestChange = isStaff
  
  // Helper function to check if a user can manage (edit) a specific catalog item
  // Staff cannot edit - they request changes to owner instead
  const canManageItem = (item: CatalogItem | null): boolean => {
    if (!user || !item) return false
    if (user.role === 'admin') return true
    if (user.role === 'manager') {
      const linkedIds = user.linkedArtistIds || []
      if (item.artistId && linkedIds.includes(item.artistId)) return true
      if (item.artistIds && item.artistIds.some(id => linkedIds.includes(id))) return true
      return false
    }
    return false
  }
  
  // Decode URL-encoded song ID
  const songId = decodeURIComponent(params.songId as string)
  
  const [song, setSong] = useState<CatalogItem | null>(null)
  const [vaultFiles, setVaultFiles] = useState<SongVaultFile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [isVaultExpanded, setIsVaultExpanded] = useState(false) // Collapsed by default on mobile
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [showAddFileModal, setShowAddFileModal] = useState(false)
  const [fileFormData, setFileFormData] = useState({
    fileName: '',
    fileType: 'logic' as 'logic' | 'bounced' | 'stem' | 'master' | 'music_video' | 'other',
    file: null as File | null,
    files: null as FileList | null, // For folder uploads
    folderPath: '', // Folder path for organization
    isFolderUpload: false, // Whether uploading a folder
  })
  const [isUploading, setIsUploading] = useState(false)
  const [isDownloadingReleaseKit, setIsDownloadingReleaseKit] = useState(false)
  const [downloadingFolders, setDownloadingFolders] = useState<Set<string>>(new Set())
  const [playingFile, setPlayingFile] = useState<string | null>(null)
  const [lyrics, setLyrics] = useState('')
  const [lyricsArray, setLyricsArray] = useState<Array<{ id: string; title?: string; content: string; createdAt: string }>>([])
  const [isEditingLyrics, setIsEditingLyrics] = useState(false)
  const [editingLyricId, setEditingLyricId] = useState<string | null>(null)
  const [showAddLyricModal, setShowAddLyricModal] = useState(false)
  const [expandedLyrics, setExpandedLyrics] = useState<Set<string>>(new Set())
  const [isTracklistExpanded, setIsTracklistExpanded] = useState(false)
  const [showTrackUploadModal, setShowTrackUploadModal] = useState(false)
  const [selectedTrack, setSelectedTrack] = useState<{ id: string; song: string } | null>(null)
  const [trackUploadFile, setTrackUploadFile] = useState<File | null>(null)
  const [isUploadingTrack, setIsUploadingTrack] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [isLoadingAudio, setIsLoadingAudio] = useState(false)
  
  // Use global audio player
  const audioPlayer = useAudioPlayer()
  const isPlaying = audioPlayer.isPlaying && audioPlayer.currentTrack?.songId === songId
  const playingTrackId = audioPlayer.currentTrack?.id || null
  const currentTime = audioPlayer.currentTime
  const duration = audioPlayer.duration
  const audioRef = audioPlayer.audioRef // Get audio ref from global player
  const [albumCover, setAlbumCover] = useState<string | null>(null)
  const [showCoverUpload, setShowCoverUpload] = useState(false)
  const [coverUploadFile, setCoverUploadFile] = useState<File | null>(null)
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  /** Bytes sent / file size for large motion cover & music video uploads */
  const [uploadByteProgress, setUploadByteProgress] = useState<{ loaded: number; total: number } | null>(null)
  const [isMotionCover, setIsMotionCover] = useState(false)
  const [archivePreviousCoverOnReplace, setArchivePreviousCoverOnReplace] = useState(true)
  const [deletingCoverKind, setDeletingCoverKind] = useState<'album' | 'motion' | null>(null)
  const [coverActionsMenuOpen, setCoverActionsMenuOpen] = useState(false)
  const coverActionsMenuRef = useRef<HTMLDivElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showMusicVideoUpload, setShowMusicVideoUpload] = useState(false)
  const [musicVideoUploadFile, setMusicVideoUploadFile] = useState<File | null>(null)
  const [isUploadingMusicVideo, setIsUploadingMusicVideo] = useState(false)
  const [editingStreams, setEditingStreams] = useState(false)
  const [editingStreamsValue, setEditingStreamsValue] = useState('')
  const [showDelayModal, setShowDelayModal] = useState(false)
  const [delayReason, setDelayReason] = useState('')
  const [isUpdatingDelay, setIsUpdatingDelay] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [isUpdatingSchedule, setIsUpdatingSchedule] = useState(false)
  const [showCreditsModal, setShowCreditsModal] = useState(false)
  const [editingCredit, setEditingCredit] = useState<{ id: string; role: string; name: string; ipi?: string; customRole?: string; adminNotes?: string } | null>(null)
  const [creditFormData, setCreditFormData] = useState({
    role: 'producer' as 'producer' | 'engineer' | 'writer' | 'publisher' | 'mixer' | 'mastering' | 'other',
    name: '',
    ipi: '',
    customRole: '',
    adminNotes: '',
  })
  const [showCreateAccountPrompt, setShowCreateAccountPrompt] = useState(false)
  const [pendingCreditData, setPendingCreditData] = useState<{name: string; ipi: string; role: string; customRole: string; adminNotes: string} | null>(null)
  const [showSongCreditsModal, setShowSongCreditsModal] = useState(false)
  const [editingSongCredit, setEditingSongCredit] = useState<{ trackId: string; creditId: string; role: string; name: string; ipi?: string; customRole?: string } | null>(null)
  const [selectedTrackForCredits, setSelectedTrackForCredits] = useState<string | null>(null)
  const [projectedStreams, setProjectedStreams] = useState<number | null>(null)
  const [showPromoNotesModal, setShowPromoNotesModal] = useState(false)
  const [showFeaturingModal, setShowFeaturingModal] = useState(false)
  const [featuringEditTrackId, setFeaturingEditTrackId] = useState<string | null>(null)
  const [featuringDisplayText, setFeaturingDisplayText] = useState('')
  const [featuringArtistIds, setFeaturingArtistIds] = useState<string[]>([])
  const [allFeaturingArtists, setAllFeaturingArtists] = useState<Array<{ id: string; name: string; artistName?: string }>>([])
  const [isSavingFeaturing, setIsSavingFeaturing] = useState(false)
  const [showAiSummaryAll, setShowAiSummaryAll] = useState(false)
  const [promoNotesText, setPromoNotesText] = useState('')
  const [isSavingPromoNotes, setIsSavingPromoNotes] = useState(false)
  const [showAdditionalInfoModal, setShowAdditionalInfoModal] = useState(false)
  const [additionalInfoText, setAdditionalInfoText] = useState('')
  const [isSavingAdditionalInfo, setIsSavingAdditionalInfo] = useState(false)
  const [deletingAiEntryId, setDeletingAiEntryId] = useState<string | null>(null)
  const [editingUPC, setEditingUPC] = useState(false)
  const [editingISRC, setEditingISRC] = useState(false)
  const [upcValue, setUpcValue] = useState('')
  const [isrcValue, setIsrcValue] = useState('')
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [isSavingUPC, setIsSavingUPC] = useState(false)
  const [isSavingISRC, setIsSavingISRC] = useState(false)
  const [showRequestChangeModal, setShowRequestChangeModal] = useState(false)
  const [requestChangeText, setRequestChangeText] = useState('')
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false)
  const [showImportPastModal, setShowImportPastModal] = useState(false)
  const [importPastForm, setImportPastForm] = useState({
    releaseDate: '',
    url: '',
    platform: '',
    date: '',
    notes: '',
    week1Streams: '',
    month1Streams: '',
    totalStreams: '',
  })
  const [isImportingPast, setIsImportingPast] = useState(false)
  const [showRouteArtistModal, setShowRouteArtistModal] = useState(false)
  const [routeArtistSelectedId, setRouteArtistSelectedId] = useState('')
  const [routeArtistConfirmText, setRouteArtistConfirmText] = useState('')
  const [artistsForRoute, setArtistsForRoute] = useState<Array<{ id: string; name: string; artistName?: string }>>([])
  const [isRoutingArtist, setIsRoutingArtist] = useState(false)
  const motionCoverPlaybackMaster = useMemo(
    () => (song?.motionCover ? absoluteAssetUrl(song.motionCover) : ''),
    [song?.motionCover]
  )
  const motionCoverPlaybackPreview = useMemo(
    () => (song?.motionCoverPreview ? absoluteAssetUrl(song.motionCoverPreview) : ''),
    [song?.motionCoverPreview]
  )
  const motionCoverVideoKey = useMemo(
    () => `${motionCoverPlaybackPreview}|${motionCoverPlaybackMaster}`,
    [motionCoverPlaybackPreview, motionCoverPlaybackMaster]
  )
  /** When a still exists under motion, hide video until it plays — then crossfade (first frame matches still). */
  const [motionHeroVideoReady, setMotionHeroVideoReady] = useState(false)
  const motionHeroReadyRef = useRef(false)

  useEffect(() => {
    setMotionHeroVideoReady(false)
    motionHeroReadyRef.current = false
  }, [motionCoverVideoKey])

  useEffect(() => {
    fetchSongData()
  }, [songId])

  // Cleanup preview URL on unmount or when file changes
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  useEffect(() => {
    if (showCoverUpload) {
      setArchivePreviousCoverOnReplace(true)
    }
  }, [showCoverUpload])

  // Listen for catalog updates to recalculate projections
  useEffect(() => {
    const handleCatalogUpdate = () => {
      if (song) {
        // Fetch latest catalog to recalculate projections
        fetch(user?.id ? `/api/catalog?userId=${encodeURIComponent(user.id)}` : '/api/catalog')
          .then(res => res.json())
          .then(data => {
            if (data.success && data.catalog) {
              calculateProjectedStreams(song, data.catalog)
            }
          })
          .catch(err => console.error('Failed to fetch catalog for projection update:', err))
      }
    }

    // Listen for custom catalog update events
    window.addEventListener('catalogUpdated', handleCatalogUpdate)
    
    return () => {
      window.removeEventListener('catalogUpdated', handleCatalogUpdate)
    }
  }, [song])

  // Fetch artists when song loads (for display) or when Route to Artist modal opens
  useEffect(() => {
    const shouldFetch = (song && canManageItem(song)) || showRouteArtistModal
    if (!shouldFetch) return
    const fetchArtists = async () => {
      try {
        const res = await fetch('/api/users')
        const data = await res.json()
        if (data.success && data.users) {
          let artists = data.users
            .filter((u: any) => u.role === 'artist')
            .map((u: any) => ({
              id: u.id,
              name: u.name || u.artistName || u.id,
              artistName: u.artistName || u.name,
            }))
          // Managers can only route to their linked artists
          if (user?.role === 'manager' && user?.linkedArtistIds?.length) {
            artists = artists.filter((a: { id: string }) => user.linkedArtistIds!.includes(a.id))
          }
          setArtistsForRoute(artists)
        }
      } catch (err) {
        console.error('Failed to fetch artists:', err)
      }
    }
    fetchArtists()
    if (showRouteArtistModal) {
      setRouteArtistSelectedId('')
      setRouteArtistConfirmText('')
    }
  }, [song?.id, showRouteArtistModal])

  useEffect(() => {
    if (!song || !user) return
    if (user.role !== 'admin' && user.role !== 'manager') return
    if (!canManageItem(song)) return
    const run = async () => {
      try {
        const res = await fetch('/api/users')
        const data = await res.json()
        if (data.success && data.users) {
          const primaryIds = new Set(
            (song.artistIds?.length ? song.artistIds : song.artistId ? [song.artistId] : []).filter(Boolean)
          )
          const list = data.users
            .filter((u: any) => u.role === 'artist')
            .filter((u: any) => !primaryIds.has(u.id))
            .map((u: any) => ({
              id: u.id,
              name: u.name || u.artistName || u.id,
              artistName: u.artistName || u.name,
            }))
          setAllFeaturingArtists(list)
        }
      } catch (e) {
        console.error('Failed to load artists for featuring:', e)
      }
    }
    void run()
  }, [song?.id, user?.id, user?.role])

  // Auto-fill IPI when name changes
  useEffect(() => {
    if (!creditFormData.name.trim() || editingCredit) return

    const checkUserIpi = async () => {
      try {
        const res = await fetch('/api/users/check-or-create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: creditFormData.name.trim() }),
        })
        const data = await res.json()
        if (data.exists && data.user?.ipi && !creditFormData.ipi) {
          setCreditFormData(prev => ({ ...prev, ipi: data.user.ipi }))
        }
      } catch (error) {
        // Silently fail - this is just for convenience
      }
    }

    const timeoutId = setTimeout(checkUserIpi, 500) // Debounce
    return () => clearTimeout(timeoutId)
  }, [creditFormData.name, editingCredit])

  const handleUpdateStreams = async (newStreams: number) => {
    // Prevent artists from updating streams
    if (user?.role === 'artist') {
      alert('Artists cannot update streams')
      return
    }

    if (!song) return
    if (!user?.id) {
      alert('You must be logged in to update streams')
      return
    }

    try {
      const res = await fetch('/api/catalog', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: song.id,
          totalStreams: newStreams,
          userId: user.id,
          userRole: user.role,
          userName: user.name,
        }),
      })

      const data = await res.json()
      if (data.success) {
        // Update local state immediately
        setSong({ ...song, totalStreams: newStreams })
        setEditingStreams(false)
        setEditingStreamsValue('')
        // Refresh to ensure consistency
        fetchSongData()
      } else {
        alert(data.error || 'Failed to update streams')
        fetchSongData()
      }
    } catch (error) {
      console.error('Failed to update streams:', error)
      alert('Failed to update streams')
      fetchSongData()
    }
  }

  const handleCopyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      alert('Failed to copy to clipboard')
    }
  }

  const handleSaveUPC = async () => {
    if (!song || !user?.id) return

    setIsSavingUPC(true)
    try {
      const res = await fetch('/api/catalog', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: song.id,
          upc: upcValue.trim() || undefined,
          userId: user.id,
          userRole: user.role,
          userName: user.name,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setEditingUPC(false)
        setUpcValue('')
        fetchSongData()
      } else {
        alert(data.error || 'Failed to update UPC')
      }
    } catch (error) {
      console.error('Failed to update UPC:', error)
      alert('Failed to update UPC')
    } finally {
      setIsSavingUPC(false)
    }
  }

  const handleSaveISRC = async () => {
    if (!song || !user?.id) return

    setIsSavingISRC(true)
    try {
      const res = await fetch('/api/catalog', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: song.id,
          isrc: isrcValue.trim() || undefined,
          userId: user.id,
          userRole: user.role,
          userName: user.name,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setEditingISRC(false)
        setIsrcValue('')
        fetchSongData()
      } else {
        alert(data.error || 'Failed to update ISRC')
      }
    } catch (error) {
      console.error('Failed to update ISRC:', error)
      alert('Failed to update ISRC')
    } finally {
      setIsSavingISRC(false)
    }
  }

  const handleRouteToArtist = async () => {
    if (!song || !user?.id || !routeArtistSelectedId) return
    const target = artistsForRoute.find((a) => a.id === routeArtistSelectedId)
    if (!target) return
    const displayName = (target.artistName || target.name || '').trim()
    if (!displayName) {
      alert('Selected artist has no display name')
      return
    }
    if (routeArtistConfirmText.trim().toLowerCase() !== displayName.toLowerCase()) {
      alert(`Type "${displayName}" exactly to confirm. This prevents accidentally routing to the wrong artist.`)
      return
    }
    setIsRoutingArtist(true)
    try {
      const res = await fetch(`/api/catalog/${songId}/route-artist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          artistId: routeArtistSelectedId,
          confirmArtistName: routeArtistConfirmText.trim(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        setShowRouteArtistModal(false)
        setRouteArtistSelectedId('')
        setRouteArtistConfirmText('')
        fetchSongData()
        window.dispatchEvent(new CustomEvent('catalogUpdated'))
        alert(data.message)
      } else {
        alert(data.details || data.error || 'Failed to route song')
      }
    } catch (error: any) {
      console.error('Failed to route song:', error)
      alert(error.message || 'Failed to route song')
    } finally {
      setIsRoutingArtist(false)
    }
  }

  // Cleanup audio on unmount (handled by global audio player)

  // Helper function to convert relative URLs to absolute URLs
  const getAbsoluteUrl = (url: string | undefined | null): string => {
    if (!url || !url.trim()) return ''
    const trimmedUrl = url.trim()
    if (trimmedUrl.startsWith('http') || trimmedUrl.startsWith('//')) return trimmedUrl
    if (typeof window !== 'undefined') {
      if (trimmedUrl.startsWith('/')) {
        return `${window.location.origin}${trimmedUrl}`
      } else {
        return `${window.location.origin}/${trimmedUrl}`
      }
    }
    return trimmedUrl
  }

  const fetchSongData = async () => {
    // Set loading state immediately for better UX
    setIsLoading(true)
    try {
      setIsLoading(true)
      console.log('[fetchSongData] Fetching song data for ID:', songId)
      
      const [catalogRes, vaultRes] = await Promise.all([
        fetch(user?.id ? `/api/catalog?userId=${encodeURIComponent(user.id)}` : '/api/catalog'),
        fetch(`/api/song-vault?songId=${songId}`),
      ])

      if (!catalogRes.ok) {
        throw new Error(`Catalog API returned ${catalogRes.status}: ${catalogRes.statusText}`)
      }

      const catalogData = await catalogRes.json()
      const vaultData = await vaultRes.json()

      console.log('[fetchSongData] Catalog response:', {
        success: catalogData.success,
        catalogLength: catalogData.catalog?.length || 0,
        hasCatalog: !!catalogData.catalog,
      })

      if (catalogData.success && catalogData.catalog && Array.isArray(catalogData.catalog)) {
        // Try to find song by exact ID match first (top-level catalog item)
        let foundSong = catalogData.catalog.find((s: CatalogItem) => s.id === songId)
        
        // If not found, check if it's a song within an album/EP's songs array
        if (!foundSong) {
          console.log('[fetchSongData] Song not found as top-level item, checking albums/EPs...')
          
          // Search through albums/EPs for this song ID in their songs array
          for (const item of catalogData.catalog) {
            if (item.songs && Array.isArray(item.songs)) {
              const nestedSong = item.songs.find((song: any) => song.id === songId)
              if (nestedSong) {
                console.log('[fetchSongData] Found song in album/EP:', item.id, item.song)
                // Create a virtual catalog item for this nested song
                foundSong = {
                  ...item,
                  // Override with the nested song's details
                  song: nestedSong.song,
                  id: songId, // Use the nested song's ID
                  totalStreams: nestedSong.streams || item.totalStreams || 0,
                  isrc: nestedSong.isrc || item.isrc,
                  // Keep parent album/EP info
                  parentRelease: {
                    id: item.id,
                    song: item.song,
                    artist: item.artist,
                    releaseType: item.releaseType,
                  },
                } as any
                break
              }
            }
          }
        }
        
        // If still not found, try other matching strategies
        if (!foundSong) {
          console.log('[fetchSongData] Song not found by exact ID:', songId)
          console.log('[fetchSongData] Total catalog items:', catalogData.catalog.length)
          
          // Check if song exists with different ID format
          const songIdParts = songId.split('_')
          if (songIdParts.length >= 2) {
            const timestamp = songIdParts[1]
            foundSong = catalogData.catalog.find((s: CatalogItem) => {
              if (!s.id) return false
              const sIdParts = s.id.split('_')
              return sIdParts.length >= 2 && sIdParts[1] === timestamp
            })
            if (foundSong) {
              console.log('[fetchSongData] Found song by timestamp match:', foundSong.id)
            }
          }
          
          if (!foundSong) {
            console.log('[fetchSongData] Sample IDs:', catalogData.catalog.slice(0, 10).map((s: CatalogItem) => ({
              id: s.id,
              song: s.song,
              artist: s.artist,
            })))
            
            // Try case-insensitive match
            foundSong = catalogData.catalog.find((s: CatalogItem) => 
              s.id?.toLowerCase() === songId.toLowerCase()
            )
            
            if (foundSong) {
              console.log('[fetchSongData] Found song with case-insensitive match')
            } else {
              // Try partial match
              foundSong = catalogData.catalog.find((s: CatalogItem) => 
                s.id?.includes(songId) || songId.includes(s.id || '')
              )
              if (foundSong) {
                console.log('[fetchSongData] Found song with partial match')
              }
            }
          }
        }
        
        if (foundSong) {
          console.log('[fetchSongData] Found song:', {
            id: foundSong.id,
            song: foundSong.song,
            artist: foundSong.artist,
            releaseType: foundSong.releaseType,
          })
          // Ensure releaseType defaults to 'single' if not set
          foundSong.releaseType = foundSong.releaseType || 'single'
          // Ensure songs array exists for albums/EPs AND singles (for play/upload functionality)
          if (!foundSong.songs || !Array.isArray(foundSong.songs)) {
            if (foundSong.releaseType === 'single') {
              // For singles, create a songs array with one entry (the single itself)
              // Check both fileUrl (legacy) and any existing audioUrl in songs array
              foundSong.songs = [{
                id: foundSong.id,
                song: foundSong.song,
                isrc: foundSong.isrc,
                streams: foundSong.totalStreams || 0,
                audioUrl: foundSong.fileUrl || undefined,
              }]
            } else {
              // For albums/EPs, initialize empty array
              foundSong.songs = []
            }
          } else if (foundSong.releaseType === 'single' && foundSong.songs.length > 0) {
            // For singles with existing songs array, ensure audioUrl is set from fileUrl if missing
            foundSong.songs = foundSong.songs.map((song: any) => ({
              ...song,
              // Use audioUrl if it's a valid non-empty string, otherwise fall back to fileUrl
              audioUrl: (song.audioUrl && song.audioUrl.trim()) ? song.audioUrl : (foundSong.fileUrl || undefined),
              streams: song.streams || foundSong.totalStreams || 0,
              credits: song.credits || [],
            }))
          }
          // Ensure streams and credits are initialized for songs array
          // IMPORTANT: Preserve audioUrl - don't overwrite valid URLs with undefined
          if (foundSong.songs && Array.isArray(foundSong.songs)) {
            foundSong.songs = foundSong.songs.map((song: any) => {
              // Determine the correct audioUrl: use existing if valid, otherwise fall back to fileUrl for singles
              let finalAudioUrl = song.audioUrl
              if (!finalAudioUrl || !finalAudioUrl.trim()) {
                // If audioUrl is missing/empty and this is a single, use fileUrl
                if (foundSong.releaseType === 'single' && foundSong.fileUrl) {
                  finalAudioUrl = foundSong.fileUrl
                } else {
                  finalAudioUrl = undefined
                }
              }
              return {
                ...song,
                streams: song.streams || 0,
                credits: song.credits || [],
                audioUrl: finalAudioUrl,
              }
            })
          }
          // Ensure credits array exists
          if (!foundSong.credits || !Array.isArray(foundSong.credits)) {
            foundSong.credits = []
          }
          
          setSong(foundSong)
          
          // Preload album cover immediately if available
          if (foundSong.albumCover && typeof window !== 'undefined') {
            const img = document.createElement('img')
            img.src = getAbsoluteUrl(foundSong.albumCover)
          }
          
          // Load lyrics - support both old single lyrics and new lyricsArray
          const songLyrics = (foundSong as any).lyricsArray || ((foundSong as any).lyrics ? [{
            id: 'legacy_1',
            content: (foundSong as any).lyrics,
            createdAt: new Date().toISOString()
          }] : [])
          // Sort lyrics by date (oldest to newest)
          const sortedLyrics = songLyrics.sort((a: any, b: any) => {
            const dateA = new Date(a.createdAt || 0).getTime()
            const dateB = new Date(b.createdAt || 0).getTime()
            return dateA - dateB // Oldest first
          })
          setLyricsArray(sortedLyrics)
          setLyrics((foundSong as any).lyrics || '') // Keep for backwards compatibility
          
          // Calculate projected streams based on artist's historical performance
          calculateProjectedStreams(foundSong, catalogData.catalog)
        } else {
          console.error('[fetchSongData] Song not found in catalog:', songId)
          console.error('[fetchSongData] Catalog response:', {
            success: catalogData.success,
            catalogLength: catalogData.catalog?.length || 0,
            hasCatalog: !!catalogData.catalog,
          })
          if (catalogData.catalog && catalogData.catalog.length > 0) {
            console.error('[fetchSongData] Available catalog IDs (first 20):', 
              catalogData.catalog.slice(0, 20).map((s: CatalogItem) => ({
                id: s.id,
                song: s.song,
                artist: s.artist,
              }))
            )
          }
          setSong(null)
        }
      } else {
        console.error('[fetchSongData] Failed to fetch catalog - invalid response:', {
          success: catalogData.success,
          error: catalogData.error,
          catalog: catalogData.catalog ? 'exists' : 'missing',
        })
        setSong(null)
      }

      if (vaultData.success) {
        // Sort vault files by date (oldest to newest)
        const sortedFiles = (vaultData.files || []).sort((a: SongVaultFile, b: SongVaultFile) => {
          const dateA = new Date(a.uploadedAt || 0).getTime()
          const dateB = new Date(b.uploadedAt || 0).getTime()
          return dateA - dateB // Oldest first
        })
        setVaultFiles(sortedFiles)
      } else {
        console.error('[fetchSongData] Invalid catalog response:', catalogData)
        setSong(null)
      }
    } catch (error: any) {
      console.error('[fetchSongData] Failed to fetch song data:', error)
      console.error('[fetchSongData] Error details:', {
        message: error.message,
        stack: error.stack,
        songId,
      })
      setSong(null)
    } finally {
      setIsLoading(false)
      console.log('[fetchSongData] Finished loading, isLoading set to false')
    }
  }

  const handleAddFile = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Check if it's a folder upload
    if (fileFormData.isFolderUpload && fileFormData.files) {
      await handleFolderUpload(fileFormData.files)
      return
    }
    
    if (!fileFormData.file) {
      alert('Please select a file to upload')
      return
    }

    if (!user?.id) {
      alert('User ID is required. Please log in again.')
      return
    }

    setIsUploading(true)
    try {
      // First upload the file
      const uploadFormData = new FormData()
      uploadFormData.append('file', fileFormData.file)
      uploadFormData.append('category', 'vault')
      uploadFormData.append('userId', user.id)
      uploadFormData.append('userRole', user?.role || '')

      const uploadRes = await fetch('/api/upload-file', {
        method: 'POST',
        body: uploadFormData,
      })

      const uploadData = await uploadRes.json()
      if (!uploadData.success) {
        throw new Error(uploadData.error || 'File upload failed')
      }

      // Then add to vault
      const res = await fetch('/api/song-vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          songId,
          fileName: fileFormData.fileName || fileFormData.file.name,
          fileType: fileFormData.fileType,
          fileUrl: uploadData.fileUrl,
          fileSize: uploadData.size,
          uploadedBy: user?.name || 'Admin',
          userId: user?.id,
          userRole: user?.role,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setShowAddFileModal(false)
        setFileFormData({ fileName: '', fileType: 'logic', file: null, files: null, folderPath: '', isFolderUpload: false })
        fetchSongData()
      }
    } catch (error: any) {
      console.error('Failed to add file:', error)
      alert(error.message || 'Failed to upload file')
    } finally {
      setIsUploading(false)
    }
  }

  const handleFolderUpload = async (files: FileList) => {
    setIsUploading(true)
    try {
      const folderName = fileFormData.folderPath || 'Uploaded Folder'
      
      // Create folder entry first
      const folderRes = await fetch('/api/song-vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          songId,
          fileName: folderName,
          fileType: 'folder',
          isFolder: true,
          folderPath: fileFormData.folderPath || undefined,
          uploadedBy: user?.name || 'Admin',
          userId: user?.id,
        }),
      })

      const folderData = await folderRes.json()
      if (!folderData.success) {
        throw new Error('Failed to create folder')
      }

      // Upload all files
      const uploadPromises = Array.from(files).map(async (file) => {
        const uploadFormData = new FormData()
        uploadFormData.append('file', file)
        uploadFormData.append('category', 'vault')
        uploadFormData.append('userId', user?.id || '')
        uploadFormData.append('userRole', user?.role || '')
        
        // Include folderPath so files are uploaded to the correct directory structure
        const fileFolderPath = fileFormData.folderPath || folderName
        if (fileFolderPath) {
          uploadFormData.append('folderPath', fileFolderPath)
        }

        const uploadRes = await fetch('/api/upload-file', {
          method: 'POST',
          body: uploadFormData,
        })

        const uploadData = await uploadRes.json()
        if (!uploadData.success) {
          throw new Error(`Failed to upload ${file.name}`)
        }

        // Add file to vault
        const res = await fetch('/api/song-vault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            songId,
            fileName: file.name,
            fileType: 'other',
            fileUrl: uploadData.fileUrl,
            fileSize: uploadData.size,
            folderPath: folderName,
            uploadedBy: user?.name || 'Admin',
            userRole: user?.role,
          }),
        })

        return res.json()
      })

      await Promise.all(uploadPromises)
      setShowAddFileModal(false)
      setFileFormData({ fileName: '', fileType: 'logic', file: null, files: null, folderPath: '', isFolderUpload: false })
      fetchSongData()
      alert(`Successfully uploaded folder "${folderName}" with ${files.length} files`)
    } catch (error: any) {
      console.error('Failed to upload folder:', error)
      alert(error.message || 'Failed to upload folder')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteFile = async (id: string) => {
    // Prevent artists from deleting files
    if (user?.role === 'artist') {
      alert('Artists cannot delete song vault files')
      return
    }

    if (!confirm('Are you sure you want to delete this file?')) return

    try {
      const res = await fetch(`/api/song-vault?id=${id}&userRole=${user?.role || ''}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        fetchSongData()
      } else {
        alert(data.error || 'Failed to delete file')
      }
    } catch (error) {
      console.error('Failed to delete file:', error)
      alert('Failed to delete file')
    }
  }

  const handleUploadTrackAudio = async () => {
    if (!selectedTrack || !trackUploadFile || !song) return

    if (!user?.id) {
      alert('User ID is required. Please log in again.')
      return
    }

    // Validate file before sending
    if (trackUploadFile.size === 0) {
      alert('Please select a valid audio file')
      return
    }

    try {
      setIsUploadingTrack(true)
      const formData = new FormData()
      formData.append('file', trackUploadFile)
      formData.append('albumId', song.id || '')
      formData.append('trackId', selectedTrack.id || '')
      formData.append('userId', user.id)
      formData.append('userRole', user?.role || '')
      formData.append('uploadedBy', user?.name || 'Admin')

      const res = await fetch('/api/catalog/track-audio', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        let errorData
        try {
          errorData = await res.json()
        } catch {
          errorData = { error: `Upload failed (${res.status} ${res.statusText})` }
        }
        const errorMsg = errorData.details || errorData.error || 'Upload failed'
        console.error('[TRACK AUDIO UPLOAD] API error:', { status: res.status, errorData })
        throw new Error(errorMsg)
      }

      const data = await res.json()
      if (data.success) {
        setShowTrackUploadModal(false)
        setSelectedTrack(null)
        setTrackUploadFile(null)
        fetchSongData()
        alert('Audio uploaded successfully!')
      } else {
        const errorMsg = data.details || data.error || 'Failed to upload audio'
        console.error('[TRACK AUDIO UPLOAD] API returned error:', data)
        throw new Error(errorMsg)
      }
    } catch (error: any) {
      console.error('Failed to upload track audio:', error)
      alert(error.message || 'Failed to upload audio. Please check the console for details.')
    } finally {
      setIsUploadingTrack(false)
    }
  }

  const handleRenameFolder = async (oldFolderName: string, newFolderName: string) => {
    // Prevent artists from renaming folders
    if (user?.role === 'artist') {
      alert('Artists cannot rename folders')
      return
    }

    if (!newFolderName.trim() || newFolderName.trim() === oldFolderName) {
      setRenamingFolder(null)
      setNewFolderName('')
      return
    }

    try {
      const res = await fetch('/api/song-vault', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldFolderPath: oldFolderName,
          newFolderPath: newFolderName.trim(),
          songId: songId,
          userId: user?.id,
          userRole: user?.role,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setRenamingFolder(null)
        setNewFolderName('')
        fetchSongData()
        // Update expanded folders if the renamed folder was expanded
        const newExpanded = new Set(expandedFolders)
        if (newExpanded.has(oldFolderName)) {
          newExpanded.delete(oldFolderName)
          newExpanded.add(newFolderName.trim())
          setExpandedFolders(newExpanded)
        }
      } else {
        alert(data.error || 'Failed to rename folder')
      }
    } catch (error: any) {
      console.error('Failed to rename folder:', error)
      alert(error.message || 'Failed to rename folder')
    }
  }

  const handleDownloadFolder = async (folderName: string) => {
    setDownloadingFolders(prev => new Set(prev).add(folderName))
    
    try {
      const url = `/api/download-folder?folderPath=${encodeURIComponent(folderName)}&songId=${encodeURIComponent(songId)}`
      const response = await fetch(url)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }))
        throw new Error(errorData.error || `Failed to download folder: ${response.status}`)
      }
      
      // Get the blob and trigger download
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `${folderName}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
    } catch (error: any) {
      console.error('Failed to download folder:', error)
      alert(error.message || 'Failed to download folder')
    } finally {
      setDownloadingFolders(prev => {
        const newSet = new Set(prev)
        newSet.delete(folderName)
        return newSet
      })
    }
  }

  const handleDeleteFolder = async (folderName: string, fileCount: number) => {
    // Prevent artists from deleting folders
    if (user?.role === 'artist') {
      alert('Artists cannot delete folders')
      return
    }

    if (!confirm(`Are you sure you want to delete the folder "${folderName}" and all ${fileCount} file${fileCount !== 1 ? 's' : ''} inside it? This cannot be undone.`)) {
      return
    }

    try {
      const res = await fetch(`/api/song-vault?folderPath=${encodeURIComponent(folderName)}&songId=${songId}&userRole=${user?.role || ''}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        // Remove from expanded folders if it was expanded
        const newExpanded = new Set(expandedFolders)
        newExpanded.delete(folderName)
        setExpandedFolders(newExpanded)
        fetchSongData()
        alert(`Successfully deleted folder "${folderName}" and ${data.deleted || fileCount} file${(data.deleted || fileCount) !== 1 ? 's' : ''}`)
      } else {
        alert(data.error || 'Failed to delete folder')
      }
    } catch (error: any) {
      console.error('Failed to delete folder:', error)
      alert(error.message || 'Failed to delete folder')
    }
  }

  // XMLHttpRequest upload progress (supports multi-GB motion covers). Percent maps ~0–98% to bytes, 100% when response completes.
  type UploadProgressPayload = { percent: number; loaded: number; total: number }

  const uploadWithProgress = (
    url: string,
    formData: FormData,
    onProgress: (p: UploadProgressPayload) => void,
    options?: { knownSizeBytes?: number; timeoutMs?: number }
  ): Promise<Response> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      let settled = false
      const timeoutMs = options?.timeoutMs ?? DEFAULT_XHR_UPLOAD_TIMEOUT_MS
      const knownSize = options?.knownSizeBytes ?? 0

      let lastLoaded = 0
      let lastTotalReported = knownSize

      const emit = (percent: number, loaded: number, total: number) => {
        lastLoaded = loaded
        lastTotalReported = total
        const pct = Math.max(0, Math.min(100, Math.round(percent * 10) / 10))
        onProgress({ percent: pct, loaded, total })
      }

      emit(0, 0, knownSize || 0)

      const watchdog = setTimeout(() => {
        if (!settled) {
          xhr.abort()
          reject(
            new Error(
              'Upload timed out. For 4GB+ files use a stable connection and keep this tab open — or try splitting into a smaller file.'
            )
          )
        }
      }, timeoutMs)

      xhr.upload.addEventListener('progress', (e) => {
        const total =
          e.lengthComputable && e.total > 0 ? e.total : knownSize > 0 ? knownSize : 0
        const loaded = e.loaded

        if (total > 0) {
          const pct = Math.min(98, (loaded / total) * 98)
          emit(pct, loaded, total)
        } else if (loaded > 0 && knownSize > 0) {
          const pct = Math.min(98, (loaded / knownSize) * 98)
          emit(pct, loaded, knownSize)
        } else if (loaded > 0) {
          emit(Math.min(12, loaded / (100 * 1024 * 1024)), loaded, 0)
        }
      })

      xhr.addEventListener('loadstart', () => {
        emit(0.5, 0, knownSize || 0)
      })

      xhr.addEventListener('load', () => {
        clearTimeout(watchdog)
        settled = true
        console.log('[Upload] Load complete', xhr.status, 'Response:', xhr.responseText?.substring(0, 200))

        const totalForComplete =
          lastTotalReported > 0 ? lastTotalReported : knownSize > 0 ? knownSize : lastLoaded

        if (xhr.status >= 200 && xhr.status < 300) {
          emit(100, totalForComplete, totalForComplete)

          const headers: Record<string, string> = {}
          const headerString = xhr.getAllResponseHeaders()
          if (headerString) {
            headerString.split('\r\n').forEach((header) => {
              const colonIndex = header.indexOf(': ')
              if (colonIndex > 0) {
                const key = header.substring(0, colonIndex).trim()
                const value = header.substring(colonIndex + 2).trim()
                if (key && value) headers[key] = value
              }
            })
          }

          resolve(
            new Response(xhr.responseText || '', {
              status: xhr.status,
              statusText: xhr.statusText,
              headers: new Headers(headers),
            })
          )
          return
        }

        let errorMessage = `Upload failed: ${xhr.status} ${xhr.statusText}`
        try {
          const errorData = JSON.parse(xhr.responseText || '{}')
          errorMessage = errorData.error || errorData.details || errorMessage
        } catch {
          // keep default
        }
        reject(new Error(errorMessage))
      })

      xhr.addEventListener('error', () => {
        clearTimeout(watchdog)
        settled = true
        console.error('[Upload] Network error occurred')
        reject(new Error('Network error during upload. Please check your connection and try again.'))
      })

      xhr.addEventListener('abort', () => {
        clearTimeout(watchdog)
        settled = true
        reject(new Error('Upload was cancelled'))
      })

      xhr.addEventListener('timeout', () => {
        clearTimeout(watchdog)
        settled = true
        console.error('[Upload] Request timeout')
        reject(new Error('Upload timeout: the server took too long to respond. Please try again.'))
      })

      xhr.timeout = timeoutMs
      xhr.open('POST', url)
      xhr.send(formData)
    })
  }

  const handleFileSelection = (file: File) => {
    const isVideoFile = isCoverVideoFile(file)
    const isImageFile = isCoverImageFile(file)
    // Infer motion vs still from the file so a video still works if the user opened the red "album cover" flow by mistake
    if (isVideoFile) {
      setIsMotionCover(true)
    } else if (isImageFile) {
      setIsMotionCover(false)
    } else {
      alert('Unsupported file type. Use an image (JPG, PNG, WebP, GIF) or a video (MP4, MOV, M4V, WebM, etc.).')
      return
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setCoverUploadFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const handleUploadAlbumCover = async () => {
    // Prevent artists from uploading album covers
    if (user?.role === 'artist') {
      alert('Artists cannot upload album covers')
      return
    }

    if (!coverUploadFile || !song) return

    if (!user?.id) {
      alert('User ID is required. Please log in again.')
      return
    }

    const isVideoFile = isCoverVideoFile(coverUploadFile)
    const isImageFile = isCoverImageFile(coverUploadFile)
    if (isMotionCover && !isVideoFile) {
      alert('Please select a video file for motion cover')
      return
    }
    if (!isMotionCover && !isImageFile) {
      alert('Please select an image file for album cover')
      return
    }

    try {
      setIsUploadingCover(true)
      setUploadProgress(0)
      setUploadByteProgress({ loaded: 0, total: coverUploadFile.size })

      console.log('[Upload] Starting upload:', {
        fileName: coverUploadFile.name,
        fileSize: formatBytes(coverUploadFile.size),
        isMotionCover,
        fileType: coverUploadFile.type,
      })

      const formData = new FormData()
      formData.append('file', coverUploadFile)
      formData.append('songId', song.id)
      formData.append('userId', user.id)
      formData.append('userRole', user?.role || '')
      formData.append('uploadedBy', user?.name || 'Admin')
      formData.append('isMotionCover', isMotionCover ? 'true' : 'false')
      const replacesExistingCover = isMotionCover
        ? !!song.motionCover?.trim()
        : !!song.albumCover?.trim()
      formData.append(
        'archivePrevious',
        replacesExistingCover && archivePreviousCoverOnReplace ? 'true' : 'false'
      )

      const res = await uploadWithProgress(
        '/api/catalog/album-cover',
        formData,
        (p) => {
          setUploadProgress(p.percent)
          setUploadByteProgress({ loaded: p.loaded, total: p.total })
        },
        { knownSizeBytes: coverUploadFile.size }
      )

      console.log('[Upload] Response received:', res.status, res.statusText)

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(errorData.error || errorData.details || `Upload failed: ${res.status} ${res.statusText}`)
      }

      const data = await res.json()
      console.log('[Upload] Response data:', data)
      if (data.success) {
        setUploadProgress(100)
        const successMessage = isMotionCover
          ? 'Motion cover uploaded successfully!'
          : 'Album cover uploaded successfully!'
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl)
          setPreviewUrl(null)
        }
        setShowCoverUpload(false)
        setCoverUploadFile(null)
        setIsMotionCover(false)
        setIsDragging(false)
        setTimeout(() => {
          setUploadProgress(0)
          setUploadByteProgress(null)
        }, 600)
        alert(successMessage)
        // Full reload so the hero video/image remounts with new URLs (and picks up motionCoverPreview once ffmpeg finishes).
        if (typeof window !== 'undefined') {
          window.location.reload()
        }
      } else {
        setUploadProgress(0)
        setUploadByteProgress(null)
        throw new Error(data.error || data.details || 'Failed to upload album cover')
      }
    } catch (error: any) {
      console.error('Failed to upload album cover:', error)
      setUploadProgress(0)
      setUploadByteProgress(null)
      const errorMessage = error.message || 'Failed to upload album cover. Please check the file size and format.'
      console.error('[Upload Error Details]', {
        error: error.message,
        stack: error.stack,
        name: error.name,
      })
      alert(errorMessage)
    } finally {
      setIsUploadingCover(false)
    }
  }

  const downloadCoverAsset = async (assetUrl: string | undefined, fallbackFilename: string) => {
    if (!assetUrl?.trim()) return
    try {
      const absolute = getAbsoluteUrl(assetUrl)
      const response = await fetch(absolute)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = assetUrl.split('/').pop() || fallbackFilename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Download failed:', error)
      alert('Download failed')
    }
  }

  const deleteCoverAsset = async (target: 'album' | 'motion') => {
    if (!song?.id || !user?.id) return
    const msg =
      target === 'album'
        ? 'Delete the still album cover? This removes the file from the server.'
        : 'Delete the motion cover (full-quality file and any web preview)? This removes the files from the server.'
    if (!window.confirm(msg)) return
    setDeletingCoverKind(target)
    try {
      const res = await fetch('/api/catalog/album-cover', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId: song.id, userId: user.id, target }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || data.details || `Delete failed (${res.status})`)
      }
      await fetchSongData()
    } catch (e: any) {
      alert(e.message || 'Delete failed')
    } finally {
      setDeletingCoverKind(null)
    }
  }

  const openFeaturingModal = (trackId: string) => {
    if (!song?.songs) return
    const tr = song.songs.find((t) => t.id === trackId)
    setFeaturingEditTrackId(trackId)
    setFeaturingDisplayText(tr?.featuring?.trim() || '')
    setFeaturingArtistIds(tr?.featuredArtistIds?.length ? [...tr.featuredArtistIds] : [])
    setShowFeaturingModal(true)
  }

  const saveFeaturing = async () => {
    if (!song?.songs || !featuringEditTrackId || !user?.id) return
    setIsSavingFeaturing(true)
    try {
      let line = featuringDisplayText.trim()
      if (!line && featuringArtistIds.length > 0) {
        const names = featuringArtistIds
          .map((id) => {
            const u = allFeaturingArtists.find((a) => a.id === id)
            return u?.artistName || u?.name || ''
          })
          .filter(Boolean)
        if (names.length > 0) line = `feat. ${names.join(' & ')}`
      }
      const nextSongs = song.songs.map((t) => {
        if (t.id !== featuringEditTrackId) return t
        return {
          ...t,
          featuring: line || undefined,
          featuredArtistIds:
            featuringArtistIds.length > 0 ? [...new Set(featuringArtistIds)] : undefined,
        }
      })
      const res = await fetch('/api/catalog', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: song.id,
          songs: nextSongs,
          userId: user.id,
          userName: user.name,
          userRole: user.role,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || data.details || 'Failed to save')
      }
      setShowFeaturingModal(false)
      setFeaturingEditTrackId(null)
      await fetchSongData()
    } catch (e: any) {
      alert(e.message || 'Failed to save featuring')
    } finally {
      setIsSavingFeaturing(false)
    }
  }

  useEffect(() => {
    if (!coverActionsMenuOpen) return
    const onDoc = (e: MouseEvent) => {
      const el = coverActionsMenuRef.current
      if (el && !el.contains(e.target as Node)) {
        setCoverActionsMenuOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCoverActionsMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [coverActionsMenuOpen])

  const handleUploadMusicVideo = async () => {
    // Prevent artists from uploading music videos
    if (user?.role === 'artist') {
      alert('Artists cannot upload music videos')
      return
    }

    if (!musicVideoUploadFile || !song) return

    if (!user?.id) {
      alert('User ID is required. Please log in again.')
      return
    }

    try {
      setIsUploadingMusicVideo(true)
      setUploadProgress(0)
      setUploadByteProgress({ loaded: 0, total: musicVideoUploadFile.size })

      const formData = new FormData()
      formData.append('file', musicVideoUploadFile)
      formData.append('songId', song.id)
      formData.append('userId', user.id)
      formData.append('userRole', user?.role || '')
      formData.append('uploadedBy', user?.name || 'Admin')

      const res = await uploadWithProgress(
        '/api/catalog/music-video',
        formData,
        (p) => {
          setUploadProgress(p.percent)
          setUploadByteProgress({ loaded: p.loaded, total: p.total })
        },
        { knownSizeBytes: musicVideoUploadFile.size }
      )

      const data = await res.json()
      if (data.success) {
        setUploadProgress(100)
        setShowMusicVideoUpload(false)
        setMusicVideoUploadFile(null)
        setTimeout(() => {
          setUploadProgress(0)
          setUploadByteProgress(null)
        }, 600)
        fetchSongData()
        alert('Music video uploaded successfully!')
      } else {
        setUploadProgress(0)
        setUploadByteProgress(null)
        alert(data.error || 'Failed to upload music video')
      }
    } catch (error: any) {
      console.error('Failed to upload music video:', error)
      setUploadProgress(0)
      setUploadByteProgress(null)
      alert(error.message || 'Failed to upload music video')
    } finally {
      setIsUploadingMusicVideo(false)
    }
  }

  const handleSaveCredit = async () => {
    if (!song || !creditFormData.name.trim()) return

    try {
      // Check if user exists
      const checkRes = await fetch('/api/users/check-or-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: creditFormData.name.trim(),
          ipi: creditFormData.ipi?.trim() || undefined,
        }),
      })

      const checkData = await checkRes.json()
      
      if (!checkData.exists) {
        // User doesn't exist - prompt for account creation
        setPendingCreditData({
          name: creditFormData.name.trim(),
          ipi: creditFormData.ipi?.trim() || '',
          role: creditFormData.role,
          customRole: creditFormData.customRole,
          adminNotes: creditFormData.adminNotes,
        })
        setShowCreateAccountPrompt(true)
        return
      }

      // User exists - use their IPI if they have one and form doesn't
      const userIpi = checkData.user?.ipi
      const finalIpi = creditFormData.ipi?.trim() || userIpi || undefined

      // If user has IPI but form doesn't, update the form
      if (userIpi && !creditFormData.ipi?.trim()) {
        setCreditFormData({ ...creditFormData, ipi: userIpi })
      }

      // Auto-create producer account if this is a producer credit and user doesn't exist
      if (creditFormData.role === 'producer' && !checkData.exists) {
        try {
          const createProducerRes = await fetch('/api/create-producer-accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              songId: song.id,
              credits: [{
                role: 'producer',
                name: creditFormData.name.trim(),
                ipi: finalIpi,
              }],
            }),
          })
          const createProducerData = await createProducerRes.json()
          if (createProducerData.success) {
            console.log(`[handleSaveCredit] Auto-created producer account for ${creditFormData.name.trim()}`)
          }
        } catch (error) {
          console.error('[handleSaveCredit] Error auto-creating producer account:', error)
          // Continue anyway - non-critical
        }
      }

      // Continue with saving credit
      const currentCredits = song.credits || []
      let updatedCredits: typeof currentCredits

      if (editingCredit) {
        // Update existing credit
        updatedCredits = currentCredits.map(c =>
          c.id === editingCredit.id
            ? {
                ...c,
                role: creditFormData.role,
                name: creditFormData.name.trim(),
                ipi: finalIpi,
                customRole: creditFormData.role === 'other' ? creditFormData.customRole?.trim() : undefined,
                adminNotes: canManageItem(song) && creditFormData.adminNotes?.trim() 
                  ? creditFormData.adminNotes.trim() 
                  : c.adminNotes,
              }
            : c
        )
      } else {
        // Add new credit
        updatedCredits = [
          ...currentCredits,
          {
            id: `credit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            role: creditFormData.role,
            name: creditFormData.name.trim(),
            ipi: finalIpi,
            customRole: creditFormData.role === 'other' ? creditFormData.customRole?.trim() : undefined,
            adminNotes: canManageItem(song) && creditFormData.adminNotes?.trim() 
              ? creditFormData.adminNotes.trim() 
              : undefined,
          },
        ]
      }

      const res = await fetch('/api/catalog', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: songId,
          credits: updatedCredits,
          userId: user?.id,
          userRole: user?.role,
          userName: user?.name,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setShowCreditsModal(false)
        setEditingCredit(null)
        setCreditFormData({ role: 'producer', name: '', ipi: '', customRole: '', adminNotes: '' })
        fetchSongData()
      } else {
        alert(data.error || 'Failed to save credit')
      }
    } catch (error: any) {
      console.error('Failed to save credit:', error)
      alert('Failed to save credit')
    }
  }

  const handleCreateAccountForCredit = async (createAccount: boolean) => {
    if (!pendingCreditData || !song) return

    if (createAccount) {
      try {
        // Auto-create producer account if this is a producer credit
        if (pendingCreditData.role === 'producer') {
          const createProducerRes = await fetch('/api/create-producer-accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              songId: song.id,
              credits: [{
                role: 'producer',
                name: pendingCreditData.name,
                ipi: pendingCreditData.ipi || undefined,
              }],
            }),
          })
          const createProducerData = await createProducerRes.json()
          if (createProducerData.success) {
            console.log(`[handleCreateAccountForCredit] Auto-created producer account for ${pendingCreditData.name}`)
          }
        } else {
          // For non-producer credits, create artist account (existing behavior)
          const username = pendingCreditData.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
          const defaultPassword = `${username}123`
          
          const createRes = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username,
              password: defaultPassword,
              name: pendingCreditData.name,
              email: `${username}@lfr.com`,
              role: 'artist',
              ipi: pendingCreditData.ipi || undefined,
              createdFromCredit: true,
            }),
          })

          const createData = await createRes.json()
          if (!createData.success) {
            alert('Failed to create account: ' + createData.error)
            setShowCreateAccountPrompt(false)
            setPendingCreditData(null)
            return
          }
        }
      } catch (error: any) {
        console.error('Failed to create account:', error)
        alert('Failed to create account')
        setShowCreateAccountPrompt(false)
        setPendingCreditData(null)
        return
      }
    }

    // Continue with saving credit
    setCreditFormData({
      role: pendingCreditData.role as any,
      name: pendingCreditData.name,
      ipi: pendingCreditData.ipi,
      customRole: pendingCreditData.customRole,
      adminNotes: pendingCreditData.adminNotes,
    })
    setShowCreateAccountPrompt(false)
    setPendingCreditData(null)
    
    // Trigger save again
    setTimeout(() => {
      handleSaveCredit()
    }, 100)
  }

  const handleDeleteCredit = async (creditId: string) => {
    if (!song || !confirm('Are you sure you want to delete this credit?')) return

    try {
      const updatedCredits = (song.credits || []).filter(c => c.id !== creditId)

      const res = await fetch('/api/catalog', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: songId,
          credits: updatedCredits,
          userId: user?.id,
          userRole: user?.role,
          userName: user?.name,
        }),
      })

      const data = await res.json()
      if (data.success) {
        fetchSongData()
      } else {
        alert(data.error || 'Failed to delete credit')
      }
    } catch (error: any) {
      console.error('Failed to delete credit:', error)
      alert('Failed to delete credit')
    }
  }

  const handleSaveSongCredit = async () => {
    if (!song || !selectedTrackForCredits || !creditFormData.name.trim()) return

    try {
      const updatedSongs = (song.songs || []).map(track => {
        if (track.id !== selectedTrackForCredits) return track
        
        const currentCredits = track.credits || []
        let updatedCredits: typeof currentCredits

        if (editingSongCredit) {
          // Update existing credit
          updatedCredits = currentCredits.map(c =>
            c.id === editingSongCredit.creditId
              ? {
                  ...c,
                  role: creditFormData.role,
                  name: creditFormData.name.trim(),
                  ipi: creditFormData.ipi?.trim() || undefined,
                  customRole: creditFormData.role === 'other' ? creditFormData.customRole?.trim() : undefined,
                }
              : c
          )
        } else {
          // Add new credit
          updatedCredits = [
            ...currentCredits,
            {
              id: `credit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              role: creditFormData.role,
              name: creditFormData.name.trim(),
              ipi: creditFormData.ipi?.trim() || undefined,
              customRole: creditFormData.role === 'other' ? creditFormData.customRole?.trim() : undefined,
            },
          ]
        }

        return {
          ...track,
          credits: updatedCredits,
        }
      })

      const res = await fetch('/api/catalog', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: songId,
          songs: updatedSongs,
          userId: user?.id,
          userRole: user?.role,
          userName: user?.name,
        }),
      })

      const data = await res.json()
      if (data.success) {
        fetchSongData()
        setShowSongCreditsModal(false)
        setEditingSongCredit(null)
        setSelectedTrackForCredits(null)
        setCreditFormData({ role: 'producer', name: '', ipi: '', customRole: '', adminNotes: '' })
      } else {
        alert(data.error || 'Failed to save credit')
      }
    } catch (error: any) {
      console.error('Failed to save song credit:', error)
      alert('Failed to save credit')
    }
  }

  const handleDeleteSongCredit = async (trackId: string, creditId: string) => {
    if (!song || !confirm('Are you sure you want to delete this credit?')) return

    try {
      const updatedSongs = (song.songs || []).map(track => {
        if (track.id !== trackId) return track
        return {
          ...track,
          credits: (track.credits || []).filter(c => c.id !== creditId),
        }
      })

      const res = await fetch('/api/catalog', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: songId,
          songs: updatedSongs,
          userId: user?.id,
          userRole: user?.role,
          userName: user?.name,
        }),
      })

      const data = await res.json()
      if (data.success) {
        fetchSongData()
      } else {
        alert(data.error || 'Failed to delete credit')
      }
    } catch (error: any) {
      console.error('Failed to delete song credit:', error)
      alert('Failed to delete credit')
    }
  }

  const handleSavePromoNotes = async () => {
    if (!song) return
    if (!user?.id) {
      alert('You must be logged in to save promotional notes')
      return
    }

    try {
      setIsSavingPromoNotes(true)
      const res = await fetch('/api/catalog', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: songId,
          promoNotes: promoNotesText.trim() || null,
          userId: user.id,
          userRole: user.role,
          userName: user.name,
        }),
      })

      const data = await res.json()
      if (data.success) {
        fetchSongData()
        setShowPromoNotesModal(false)
      } else {
        alert(data.error || 'Failed to save promotional notes')
      }
    } catch (error: any) {
      console.error('Failed to save promotional notes:', error)
      alert('Failed to save promotional notes')
    } finally {
      setIsSavingPromoNotes(false)
    }
  }

  const handleDeleteAiHistoryEntry = async (entryId: string) => {
    if (!song) {
      alert('Song data not loaded')
      return
    }
    if (!user?.id) {
      alert('You must be logged in to delete AI history entries')
      return
    }
    if (!confirm('Are you sure you want to delete this AI history entry?')) return

    try {
      setDeletingAiEntryId(entryId)
      const currentHistory = song.aiActionHistory || []
      const updatedHistory = currentHistory.filter(entry => entry.id !== entryId)

      const res = await fetch('/api/catalog', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: songId,
          aiActionHistory: updatedHistory,
          userId: user.id,
          userRole: user.role,
        }),
      })

      const data = await res.json()
      if (data.success) {
        fetchSongData()
      } else {
        alert(data.error || 'Failed to delete AI history entry')
      }
    } catch (error: any) {
      console.error('Failed to delete AI history entry:', error)
      alert('Failed to delete AI history entry')
    } finally {
      setDeletingAiEntryId(null)
    }
  }

  const handleRevertAiAction = async (entry: any) => {
    if (!song) {
      alert('Song data not loaded')
      return
    }
    if (!user?.id) {
      alert('You must be logged in to revert AI actions')
      return
    }
    if (!confirm('Are you sure you want to revert this AI action? This will attempt to undo the changes. Note: Some fields may need manual adjustment.')) return

    try {
      setDeletingAiEntryId(entry.id)
      
      // Parse the summary to extract what was changed
      // Format examples:
      // "Updated albumCover; albumCover → /api/files/album-covers/..."
      // "Updated releaseDate; releaseDate → 2023-04-15T00:00:00.000Z"
      // "Updated totalStreams; totalStreams → 31"
      // "Updated albumCover, releaseDate; albumCover → ...; releaseDate → ..."
      
      const summary = entry.summary || ''
      const updates: any = {}
      
      // Try to extract field names from the summary
      // Look for patterns like "Updated fieldName" or "fieldName →"
      const fieldPatterns = [
        { pattern: /albumCover/i, action: () => { updates.albumCover = null } },
        { pattern: /releaseDate/i, action: () => { updates.releaseDate = null } },
        { pattern: /totalStreams/i, action: () => { 
          // Try to preserve current value or set to 0
          if (song.totalStreams !== undefined) {
            // Don't change if we can't determine the old value
            // User will need to manually adjust
          }
        }},
        { pattern: /artist/i, action: () => {
          // Can't revert artist name without old value
          // Skip this field
        }},
        { pattern: /song/i, action: () => {
          // Can't revert song name without old value
          // Skip this field
        }},
      ]
      
      // Apply revert actions for detected fields
      fieldPatterns.forEach(({ pattern, action }) => {
        if (pattern.test(summary)) {
          action()
        }
      })
      
      // Remove the AI history entry
      const currentHistory = song.aiActionHistory || []
      const updatedHistory = currentHistory.filter(e => e.id !== entry.id)

      const res = await fetch('/api/catalog', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: songId,
          ...updates,
          aiActionHistory: updatedHistory,
          userId: user.id,
          userRole: user.role,
        }),
      })

      const data = await res.json()
      if (data.success) {
        fetchSongData()
        alert('AI action reverted. Please review the changes and adjust manually if needed.')
      } else {
        alert(data.error || 'Failed to revert AI action')
      }
    } catch (error: any) {
      console.error('Failed to revert AI action:', error)
      alert('Failed to revert AI action')
    } finally {
      setDeletingAiEntryId(null)
    }
  }

  const getRoleDisplayName = (role: string, customRole?: string) => {
    if (role === 'other' && customRole) return customRole
    return role.charAt(0).toUpperCase() + role.slice(1)
  }

  // Calculate projected streams based on artist's historical performance
  const calculateProjectedStreams = (currentSong: CatalogItem, allCatalog: CatalogItem[]) => {
    // Only calculate for unreleased songs or recently released songs (within 30 days)
    const releaseDate = currentSong.releaseDate ? new Date(currentSong.releaseDate) : null
    const isUnreleased = currentSong.isUnreleased || !releaseDate
    const isRecentlyReleased = releaseDate && releaseDate > new Date() && 
      (releaseDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24) <= 30
    
    if (!isUnreleased && !isRecentlyReleased) {
      setProjectedStreams(null)
      return
    }

    // Find all songs by the same artist (excluding current song)
    const artistSongs = allCatalog.filter(item => {
      if (item.id === currentSong.id) return false
      
      // Match by artist name (case-insensitive)
      const currentArtist = currentSong.artist?.toLowerCase().trim()
      const itemArtist = item.artist?.toLowerCase().trim()
      
      if (currentArtist && itemArtist) {
        // Check exact match or if one contains the other
        return currentArtist === itemArtist || 
               currentArtist.includes(itemArtist) || 
               itemArtist.includes(currentArtist)
      }
      
      return false
    })

    if (artistSongs.length === 0) {
      setProjectedStreams(null)
      return
    }

    // Filter to only released songs (not unreleased)
    const releasedSongs = artistSongs.filter(s => {
      if (s.isUnreleased) return false
      if (!s.releaseDate) return false
      const songReleaseDate = new Date(s.releaseDate)
      return songReleaseDate <= new Date() // Only count songs that have been released
    })

    if (releasedSongs.length === 0) {
      setProjectedStreams(null)
      return
    }

    // Calculate average streams per song
    const totalStreams = releasedSongs.reduce((sum, song) => sum + (song.totalStreams || 0), 0)
    const avgStreams = Math.round(totalStreams / releasedSongs.length)

    // Calculate median for more accurate projection
    const sortedStreams = releasedSongs
      .map(s => s.totalStreams || 0)
      .sort((a, b) => a - b)
    const medianStreams = sortedStreams.length > 0
      ? sortedStreams[Math.floor(sortedStreams.length / 2)]
      : avgStreams

    // Use weighted average (60% median, 40% average) for projection
    const projection = Math.round(medianStreams * 0.6 + avgStreams * 0.4)

    setProjectedStreams(projection)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mb-4"></div>
        <p className="text-slate-400 text-sm">Loading song data...</p>
        <p className="text-slate-500 text-xs mt-2">Song ID: {songId}</p>
      </div>
    )
  }

  if (!song) {
    return (
      <div className="space-y-8">
        <button
          onClick={() => router.push('/dashboard/catalog')}
          className="flex items-center text-slate-400 hover:text-white mb-4 transition"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Catalog
        </button>
        <div className="text-center py-12">
          <Music className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 mb-2">Song not found</p>
          <p className="text-slate-500 text-sm">Song ID: {songId}</p>
          <p className="text-slate-500 text-xs mt-2">
            If you just created this release, try refreshing the page or going back to the catalog.
          </p>
        </div>
      </div>
    )
  }

  // Check if this is a nested song (from an album/EP)
  const parentRelease = (song as any).parentRelease

  const heroCoverMedia =
    'absolute inset-0 h-full w-full rounded-[1.35rem] object-cover object-bottom shadow-[0_28px_90px_-24px_rgba(0,0,0,0.9)] ring-1 ring-white/25 transition-[opacity,transform] duration-700 ease-out group-hover:scale-[1.02]'
  const stillUnderMotion =
    !!(song.motionCover?.trim() && motionCoverPlaybackMaster && song.albumCover?.trim())
  const markMotionHeroReady = () => {
    if (!stillUnderMotion || motionHeroReadyRef.current) return
    motionHeroReadyRef.current = true
    setMotionHeroVideoReady(true)
  }

  return (
    <div className="space-y-10 md:space-y-14">
      <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/dashboard/catalog')}
              className="inline-flex items-center text-sm text-slate-400 hover:text-white transition-colors duration-300 hover:-translate-x-0.5"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Catalog
            </button>
            {canRequestChange && !canManageItem(song) && (
              <button
                type="button"
                onClick={() => {
                  setRequestChangeText('')
                  setShowRequestChangeModal(true)
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-200 text-sm ring-1 ring-amber-500/30 hover:bg-amber-500/25 transition-all duration-300 hover:-translate-y-0.5"
              >
                <AlertCircle className="w-4 h-4" />
                Flag a fix
              </button>
            )}
            {user?.role === 'admin' && (
              <button
                onClick={() => {
                  setImportPastForm({
                    releaseDate: song.releaseDate?.split('T')[0] || '',
                    url: '',
                    platform: '',
                    date: '',
                    notes: '',
                    week1Streams: '',
                    month1Streams: '',
                    totalStreams: String(song.totalStreams || ''),
                  })
                  setShowImportPastModal(true)
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.06] text-slate-200 text-sm ring-1 ring-white/[0.08] hover:bg-white/[0.1] transition-all duration-300 hover:-translate-y-0.5"
              >
                <Upload className="w-4 h-4" />
                Old campaign data
              </button>
            )}
      </div>

      {parentRelease && (
        <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-400/25 text-sm text-sky-200 max-w-2xl">
          From{' '}
          <a
            href={`/dashboard/catalog/${parentRelease.id}`}
            className="font-semibold text-white underline decoration-sky-500/50 underline-offset-2 hover:text-sky-100"
          >
            {parentRelease.song}
          </a>
          <span className="text-sky-400/90"> · {parentRelease.releaseType}</span>
        </div>
      )}

      <section className="relative overflow-visible rounded-2xl border border-white/[0.06] bg-transparent sm:rounded-[2rem]">
        <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br from-white/[0.03] via-transparent to-transparent" aria-hidden />
        <div className="relative z-[1] grid md:grid-cols-[auto,minmax(0,1fr)] gap-10 lg:gap-16 items-start px-6 py-10 sm:px-10 sm:py-12 lg:px-14 lg:py-14">
            <div className="relative flex-shrink-0 mx-auto md:mx-0 group md:-rotate-1 md:hover:rotate-0 transition-transform duration-500 w-[min(88vw,22rem)] md:w-96 lg:w-[26rem] aspect-square">
              <div className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-red-950/30 blur-2xl opacity-50" aria-hidden />
              {/* Sized shell so layout never collapses when video/img fail or 404 */}
              <div className="absolute inset-0 rounded-[1.35rem] bg-gradient-to-br from-zinc-700 to-zinc-950 flex items-center justify-center ring-1 ring-white/10 shadow-2xl shadow-black/40 z-0 overflow-hidden">
                <Music className="w-16 h-16 sm:w-24 sm:h-24 md:w-28 md:h-28 text-zinc-600" aria-hidden />
              </div>
              {song.motionCover && motionCoverPlaybackMaster ? (
                <>
                  {stillUnderMotion ? (
                    <img
                      src={getAbsoluteUrl(song.albumCover!)}
                      alt=""
                      aria-hidden
                      className={`${heroCoverMedia} z-10 pointer-events-none ${motionHeroVideoReady ? 'opacity-0' : 'opacity-100'}`}
                      loading="eager"
                      decoding="async"
                    />
                  ) : null}
                  <video
                    key={motionCoverVideoKey}
                    poster={stillUnderMotion ? getAbsoluteUrl(song.albumCover!) : undefined}
                    className={`${heroCoverMedia} ${
                      stillUnderMotion
                        ? motionHeroVideoReady
                          ? 'z-[11] opacity-100'
                          : 'z-[11] pointer-events-none opacity-0'
                        : 'z-10 opacity-100'
                    }`}
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="auto"
                    onLoadedData={(e) => {
                      const v = e.currentTarget
                      v.muted = true
                      void v.play().catch(() => {})
                    }}
                    onCanPlay={(e) => {
                      const v = e.currentTarget
                      v.muted = true
                      void v.play().catch(() => {})
                    }}
                    onPlaying={markMotionHeroReady}
                    onTimeUpdate={(e) => {
                      if (!stillUnderMotion || motionHeroReadyRef.current) return
                      if (e.currentTarget.currentTime > 0.02) markMotionHeroReady()
                    }}
                    onError={(e) => {
                      motionHeroReadyRef.current = false
                      setMotionHeroVideoReady(false)
                      e.currentTarget.style.display = 'none'
                    }}
                  >
                    {motionCoverPlaybackPreview &&
                    song.motionCoverPreview &&
                    song.motionCoverPreview.trim() !== song.motionCover?.trim() ? (
                      <source src={motionCoverPlaybackPreview} type="video/mp4" />
                    ) : null}
                    <source src={motionCoverPlaybackMaster} type="video/mp4" />
                  </video>
                </>
              ) : song.albumCover ? (
                <img 
                  src={getAbsoluteUrl(song.albumCover)} 
                  alt={song.song} 
                  className={`${heroCoverMedia} z-10`}
                  loading="eager"
                  decoding="async"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              ) : null}
              {canManageItem(song) ? (
                <div
                  ref={coverActionsMenuRef}
                  className={`absolute bottom-5 right-1 sm:right-3 z-[20] transition-all duration-300 translate-y-1 ${
                    coverActionsMenuOpen
                      ? 'opacity-100 translate-y-0 pointer-events-auto'
                      : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto group-hover:translate-y-0'
                  }`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setCoverActionsMenuOpen((v) => !v)
                    }}
                    className="bg-zinc-900/95 hover:bg-zinc-800 text-white rounded-full p-3 shadow-xl ring-1 ring-white/20 transition-all hover:scale-105"
                    title="Cover actions"
                    aria-expanded={coverActionsMenuOpen}
                    aria-haspopup="menu"
                  >
                    <MoreVertical className="w-6 h-6" />
                  </button>
                  {coverActionsMenuOpen ? (
                    <div
                      role="menu"
                      className="animate-cover-actions-menu absolute top-full right-0 mt-2 w-[min(calc(100vw-2rem),16rem)] rounded-xl border border-white/10 bg-zinc-900/98 backdrop-blur-md shadow-2xl py-1 overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="px-3 pt-2 pb-1 text-[0.65rem] uppercase tracking-wider text-slate-500">Upload</p>
                      <button
                        type="button"
                        role="menuitem"
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left text-white hover:bg-white/10"
                        onClick={() => {
                          setCoverActionsMenuOpen(false)
                          setIsMotionCover(false)
                          setShowCoverUpload(true)
                        }}
                      >
                        <ImageIcon className="w-4 h-4 shrink-0 text-red-400" />
                        Upload still cover
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left text-white hover:bg-white/10"
                        onClick={() => {
                          setCoverActionsMenuOpen(false)
                          setIsMotionCover(true)
                          setShowCoverUpload(true)
                        }}
                      >
                        <Video className="w-4 h-4 shrink-0 text-purple-400" />
                        Upload motion cover
                      </button>
                      {(song.albumCover || song.motionCover) ? (
                        <div className="my-1 border-t border-white/10" role="presentation" />
                      ) : null}
                      {song.albumCover ? (
                        <>
                          <p className="px-3 pt-2 pb-1 text-[0.65rem] uppercase tracking-wider text-slate-500">Still image</p>
                          <button
                            type="button"
                            role="menuitem"
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left text-white hover:bg-white/10"
                            disabled={deletingCoverKind !== null}
                            onClick={() => {
                              downloadCoverAsset(song.albumCover, `${song.song}_cover`)
                              setCoverActionsMenuOpen(false)
                            }}
                          >
                            <Download className="w-4 h-4 shrink-0 text-blue-400" />
                            Download
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                            disabled={deletingCoverKind !== null}
                            onClick={() => {
                              setCoverActionsMenuOpen(false)
                              deleteCoverAsset('album')
                            }}
                          >
                            <Trash2 className="w-4 h-4 shrink-0" />
                            Delete from release
                          </button>
                        </>
                      ) : null}
                      {song.motionCover ? (
                        <>
                          <p className="px-3 pt-2 pb-1 text-[0.65rem] uppercase tracking-wider text-slate-500">Motion video</p>
                          <button
                            type="button"
                            role="menuitem"
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left text-white hover:bg-white/10"
                            disabled={deletingCoverKind !== null}
                            onClick={() => {
                              downloadCoverAsset(song.motionCover, `${song.song}_motion_cover`)
                              setCoverActionsMenuOpen(false)
                            }}
                          >
                            <Download className="w-4 h-4 shrink-0 text-purple-400" />
                            Download (full file)
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                            disabled={deletingCoverKind !== null}
                            onClick={() => {
                              setCoverActionsMenuOpen(false)
                              deleteCoverAsset('motion')
                            }}
                          >
                            <Trash2 className="w-4 h-4 shrink-0" />
                            Delete from release
                          </button>
                        </>
                      ) : null}
                      {song.coverArchive && song.coverArchive.length > 0 ? (
                        <>
                          <div className="my-1 border-t border-white/10" role="presentation" />
                          <p className="px-3 pt-2 pb-1 text-[0.65rem] uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <Archive className="w-3 h-3 opacity-70 shrink-0" aria-hidden />
                            Archived (replaced)
                          </p>
                          <div className="max-h-52 overflow-y-auto overscroll-contain">
                            {song.coverArchive.map((entry) => (
                              <div
                                key={entry.id}
                                className="px-3 py-2 border-b border-white/[0.06] last:border-b-0"
                              >
                                <p className="text-xs text-slate-400 mb-1.5">
                                  {entry.kind === 'still' ? 'Still image' : 'Motion video'} ·{' '}
                                  {formatLocalDate(entry.replacedAt)}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="inline-flex items-center gap-1 rounded-md bg-white/10 hover:bg-white/15 px-2 py-1 text-[0.7rem] text-white"
                                    onClick={() => {
                                      downloadCoverAsset(
                                        entry.masterUrl,
                                        entry.masterUrl.split('/').pop() || `${song.song}_archived`
                                      )
                                      setCoverActionsMenuOpen(false)
                                    }}
                                  >
                                    <Download className="w-3 h-3 shrink-0" />
                                    {entry.kind === 'motion' ? 'Master' : 'File'}
                                  </button>
                                  {entry.previewUrl ? (
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="inline-flex items-center gap-1 rounded-md bg-white/10 hover:bg-white/15 px-2 py-1 text-[0.7rem] text-white"
                                      onClick={() => {
                                        downloadCoverAsset(
                                          entry.previewUrl,
                                          entry.previewUrl!.split('/').pop() || 'preview'
                                        )
                                        setCoverActionsMenuOpen(false)
                                      }}
                                    >
                                      <Download className="w-3 h-3 shrink-0" />
                                      Web preview
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="flex-1 flex flex-col justify-start md:justify-center pt-6 md:pt-0 md:pl-6 lg:pl-12 min-w-0 overflow-visible">
              <p className="text-xs sm:text-sm uppercase tracking-[0.28em] text-red-400/90 mb-4 sm:mb-5 font-medium">
                Release
              </p>
              <h1 className="release-hero-title font-display text-5xl sm:text-6xl md:text-7xl lg:text-[4.25rem] xl:text-[4.75rem] font-semibold text-white mb-4 sm:mb-5 tracking-tight [text-shadow:0_2px_40px_rgba(0,0,0,0.65)]">
                {song.song}
              </h1>
              <p className="text-2xl sm:text-3xl md:text-3xl lg:text-4xl text-slate-200/95 mb-4 sm:mb-6 font-medium leading-snug">
                {song.artist}
              </p>
              {song.releaseDate && (
                <p className="text-slate-400/95 text-base sm:text-lg md:text-xl lg:text-2xl font-medium tracking-tight">
                  Out {formatLocalDate(song.releaseDate)}
                </p>
              )}
            </div>
          </div>
      </section>

      {/* Audio Player removed - using global MiniAudioPlayer instead */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 lg:items-start">
        <div className="lg:pt-1">
          <h2 className="font-display text-2xl font-semibold text-white mb-2 tracking-tight">
            Before it ships
          </h2>
          <p className="text-sm text-slate-500 mb-6 max-w-sm">
            The unglamorous stuff that still has to be green.
          </p>
          <div className="rounded-2xl p-5 sm:p-6 bg-white/[0.03] ring-1 ring-white/[0.08]">
            <ReleaseChecklist songId={songId} songName={song.song} song={song} />
          </div>
        </div>

        <div className="rounded-[1.35rem] p-6 sm:p-8 border border-dashed border-white/[0.12] bg-gradient-to-b from-white/[0.04] to-transparent">
          <div className="flex items-center justify-between mb-4 gap-3">
            <h2 className="font-display text-2xl font-semibold text-white tracking-tight">Metadata</h2>
            <div className="flex items-center gap-2">
            {user?.role === 'admin' && !song.additionalInfo && (
              <button
                onClick={() => {
                  setAdditionalInfoText('')
                  setShowAdditionalInfoModal(true)
                }}
                className="text-xs text-blue-400 hover:text-blue-300 transition px-2 py-1"
                title="Add additional information"
              >
                + Add Info
              </button>
            )}
            <button
              onClick={async () => {
                if (isDownloadingReleaseKit) return // Prevent multiple clicks
                
                setIsDownloadingReleaseKit(true)
                try {
                  // Important: do NOT fetch() + blob() for large ZIPs (can fail / OOM).
                  // Let the browser handle the download directly (streaming).
                  window.location.href = `/api/catalog/${songId}/release-kit`
                } catch (error: any) {
                  console.error('Failed to download release kit:', error)
                  alert(error.message || 'Failed to download release kit')
                } finally {
                  // We can't reliably detect when the browser finishes downloading.
                  // Keep the glow briefly to confirm the click.
                  setTimeout(() => setIsDownloadingReleaseKit(false), 1500)
                }
              }}
              disabled={isDownloadingReleaseKit}
              className={`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-all font-medium relative ${
                isDownloadingReleaseKit
                  ? 'bg-red-600 cursor-wait shadow-lg shadow-red-500/50 ring-2 ring-red-400 ring-opacity-75'
                  : 'bg-red-600 hover:bg-red-700 hover:shadow-lg hover:shadow-red-500/50'
              }`}
            >
              {isDownloadingReleaseKit ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating Release Kit...</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse" />
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download Release Kit</span>
                </>
              )}
            </button>
            <a
              href={`/api/catalog/${songId}/release-kit?mode=docs`}
              className="px-3 py-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700"
              title="Downloads a smaller kit (no audio) for Cloudflare/tunnel safety"
            >
              Download Docs Only
            </a>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Route to Artist - Catalog routing (admin/manager only; managers can route any song to their artists) */}
            {(user?.role === 'admin' || (user?.role === 'manager' && (user?.linkedArtistIds?.length ?? 0) > 0)) && (
              <div className="md:col-span-2 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-slate-400 flex items-center gap-2">
                    <Route className="w-4 h-4" />
                    Catalog routing
                  </p>
                  <button
                    onClick={() => setShowRouteArtistModal(true)}
                    className="text-xs text-blue-400 hover:text-blue-300 transition"
                    title="Assign this song to an artist for catalog/analytics (release display name stays unchanged)"
                  >
                    Route to artist
                  </button>
                </div>
                <p className="text-white text-sm">
                  {song.artistId ? (
                    <>
                      Routed to: <span className="font-medium">{artistsForRoute.find((a) => a.id === song.artistId)?.artistName || artistsForRoute.find((a) => a.id === song.artistId)?.name || song.artistId}</span>
                      {song.artist && (
                        <span className="text-slate-400 ml-1">
                          (release displays as &quot;{song.artist}&quot;)
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-500">Not routed — uses release artist for catalog</span>
                  )}
                </p>
              </div>
            )}
            {/* UPC Field */}
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-slate-400">UPC</p>
                {canManageItem(song) && !editingUPC && (
                  <button
                    onClick={() => {
                      setUpcValue(song.upc || '')
                      setEditingUPC(true)
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300 transition"
                    title="Edit UPC"
                  >
                    <Edit className="w-3 h-3" />
                  </button>
                )}
              </div>
              {editingUPC ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={upcValue}
                    onChange={(e) => setUpcValue(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white font-mono text-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Enter UPC"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveUPC}
                      disabled={isSavingUPC}
                      className="flex-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                    >
                      {isSavingUPC ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Save</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setEditingUPC(false)
                        setUpcValue('')
                      }}
                      className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between group">
                  <p 
                    className={`text-white font-mono text-lg font-semibold cursor-pointer hover:text-red-400 transition ${!song.upc ? 'text-slate-500' : ''}`}
                    onClick={() => song.upc && handleCopyToClipboard(song.upc, 'upc')}
                    title={song.upc ? 'Click to copy' : 'No UPC set'}
                  >
                    {song.upc || 'Not set'}
                  </p>
                  {song.upc && (
                    <button
                      onClick={() => {
                        if (song.upc) {
                          handleCopyToClipboard(song.upc, 'upc')
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 transition text-slate-400 hover:text-white ml-2"
                      title="Copy UPC"
                    >
                      {copiedField === 'upc' ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Clipboard className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
            
            {/* ISRC Field */}
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-slate-400">ISRC</p>
                {canManageItem(song) && !editingISRC && (
                  <button
                    onClick={() => {
                      setIsrcValue(song.isrc || '')
                      setEditingISRC(true)
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300 transition"
                    title="Edit ISRC"
                  >
                    <Edit className="w-3 h-3" />
                  </button>
                )}
              </div>
              {editingISRC ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={isrcValue}
                    onChange={(e) => setIsrcValue(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white font-mono text-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Enter ISRC"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveISRC}
                      disabled={isSavingISRC}
                      className="flex-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                    >
                      {isSavingISRC ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Save</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setEditingISRC(false)
                        setIsrcValue('')
                      }}
                      className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between group">
                  <p 
                    className={`text-white font-mono text-lg font-semibold cursor-pointer hover:text-red-400 transition ${!song.isrc ? 'text-slate-500' : ''}`}
                    onClick={() => song.isrc && handleCopyToClipboard(song.isrc, 'isrc')}
                    title={song.isrc ? 'Click to copy' : 'No ISRC set'}
                  >
                    {song.isrc || 'Not set'}
                  </p>
                  {song.isrc && (
                    <button
                      onClick={() => {
                        if (song.isrc) {
                          handleCopyToClipboard(song.isrc, 'isrc')
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 transition text-slate-400 hover:text-white ml-2"
                      title="Copy ISRC"
                    >
                      {copiedField === 'isrc' ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Clipboard className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
            {song.songs && song.songs.length > 0 && (
              <div className="md:col-span-2">
                <p className="text-sm text-slate-400 mb-2">{song.releaseType === 'single' ? 'ISRC' : 'Track ISRCs'}</p>
                <div className="space-y-2">
                  {song.songs.map((track, tIdx) => (
                    <div key={track.id} className="p-3 bg-slate-800/50 rounded border border-slate-700">
                      <div className="flex gap-2 items-start">
                        <span className="text-slate-500 font-mono text-xs w-5 flex-shrink-0 text-right pt-0.5">{tIdx + 1}.</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-white text-sm font-medium truncate">{track.song}</span>
                            {track.isrc && (
                              <span className="text-white font-mono text-xs sm:text-sm flex-shrink-0">{track.isrc}</span>
                            )}
                          </div>
                          {(track.featuring?.trim() || (track.featuredArtistIds && track.featuredArtistIds.length > 0)) && (
                            <p className="text-xs text-purple-300/85 mt-1">
                              {track.featuring?.trim() ||
                                `feat. ${track.featuredArtistIds!.length} guest(s) · in their Catalog`}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Delay Status */}
            <div className="md:col-span-2">
              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-slate-400">Release Status</p>
                  {canManageItem(song) && (
                    <div className="flex items-center gap-3">
                      {((song as any).campaignStatus === 'completed' || (song as any).campaignStatus === 'archived') ? (
                        <button
                          onClick={() => document.getElementById('campaign-section')?.scrollIntoView({ behavior: 'smooth' })}
                          className="text-xs text-amber-400 hover:text-amber-300 transition"
                          title="View campaign results"
                        >
                          View Results
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            // Prefill schedule date for date input
                            const prefill =
                              song.releaseDate ||
                              song.releaseDateRequested ||
                              formatLocalDateString(new Date())
                            setScheduleDate(prefill)
                            setShowScheduleModal(true)
                          }}
                          className="text-xs text-blue-400 hover:text-blue-300 transition"
                          title="Mark as Scheduled / Edit schedule date"
                        >
                          {song.releaseApprovalStatus === 'approved' && song.releaseDate
                            ? 'Edit Scheduled'
                            : 'Mark as Scheduled'}
                        </button>
                      )}

                      <button
                        onClick={async () => {
                          try {
                            if (!user?.id) {
                              alert('You must be logged in to update this')
                              return
                            }
                            const nextValue = !song.isUnreleased
                            const res = await fetch('/api/catalog', {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                id: songId,
                                isUnreleased: nextValue,
                                userId: user.id,
                                userRole: user.role,
                                userName: user.name,
                              }),
                            })
                            const data = await res.json()
                            if (data.success) {
                              fetchSongData()
                            } else {
                              alert(data.error || 'Failed to update unreleased status')
                            }
                          } catch (error: any) {
                            console.error('Failed to update unreleased status:', error)
                            alert('Failed to update unreleased status')
                          }
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300 transition"
                        title="Toggle Unreleased"
                      >
                        {song.isUnreleased ? 'Remove Unreleased' : 'Mark as Unreleased'}
                      </button>

                      <button
                        onClick={() => {
                          setDelayReason(song.delayReason || '')
                          setShowDelayModal(true)
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300 transition"
                        title="Mark as Delayed / Edit delay reason"
                      >
                        {song.isDelayed ? 'Edit Delay' : 'Mark as Delayed'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {song.isUnreleased && (
                      <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded font-semibold">
                        ⚠️ UNRELEASED
                      </span>
                    )}
                    {song?.releaseApprovalStatus === 'denied' && (
                      <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded font-semibold flex items-center space-x-1">
                        <X className="w-3 h-3" />
                        <span>DENIED</span>
                      </span>
                    )}
                    {song.releaseApprovalStatus === 'approved' && song.releaseDate && (
                      <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded font-semibold">
                        {song.releaseDate && new Date(song.releaseDate) <= new Date() ? 'RELEASED' : 'SCHEDULED'}
                      </span>
                    )}
                    {song.isDelayed && (
                      <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded font-semibold">
                        ⚠️ DELAYED
                      </span>
                    )}
                  </div>

                  {/* Denied info - show reason */}
                  {song?.releaseApprovalStatus === 'denied' && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                      <div className="flex items-start space-x-2">
                        <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-red-400 mb-1">Release Request Denied</h4>
                          {song?.releaseApprovalNotes ? (
                            <p className="text-sm text-slate-300 whitespace-pre-wrap">{song.releaseApprovalNotes}</p>
                          ) : (
                            <p className="text-sm text-slate-400">No reason provided.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}



                  {/* Admin-only AI Summary */}
                  {user?.role === 'admin' && song.aiActionHistory && song.aiActionHistory.length > 0 && (
                    <div className="relative overflow-hidden border border-purple-700/30 rounded-lg p-4">
                      <div 
                        className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-purple-900/20"
                        style={{
                          backgroundSize: '200% 200%',
                          animation: 'gradientShift 8s ease infinite',
                        }}
                      ></div>
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">🤖</span>
                            <p className="text-sm font-medium text-purple-300">AI Activity</p>
                          </div>
                          {song.aiActionHistory.length > 3 && (
                            <button
                              onClick={() => setShowAiSummaryAll(!showAiSummaryAll)}
                              className="text-xs text-purple-400 hover:text-purple-300 transition"
                            >
                              {showAiSummaryAll ? 'Show Less' : 'Show More'}
                            </button>
                          )}
                        </div>
                        <div className="space-y-2.5">
                        {(showAiSummaryAll
                          ? [...song.aiActionHistory].slice(-10).reverse()
                          : [...song.aiActionHistory].slice(-3).reverse()
                        ).map((entry) => {
                          // Convert technical summary to a more natural sentence
                          const summary = entry.summary
                            .replace(/Updated ([\w, ]+);/g, 'Updated $1')
                            .replace(/→/g, 'to')
                            .replace(/;/g, ',')
                            .replace(/\s+/g, ' ')
                            .trim()
                          
                          const actionEmoji = entry.action === 'approve_release' ? '✅' :
                                             entry.action === 'deny_release' ? '❌' :
                                             entry.action === 'update_catalog' ? '✏️' :
                                             entry.action === 'create_release' ? '🎵' :
                                             entry.action === 'add_catalog_item' ? '➕' :
                                             '🤖'
                          
                          const timeAgo = (() => {
                            const now = new Date()
                            const then = new Date(entry.at)
                            const diffMs = now.getTime() - then.getTime()
                            const diffMins = Math.floor(diffMs / 60000)
                            const diffHours = Math.floor(diffMs / 3600000)
                            const diffDays = Math.floor(diffMs / 86400000)
                            
                            if (diffMins < 1) return 'just now'
                            if (diffMins < 60) return `${diffMins}m ago`
                            if (diffHours < 24) return `${diffHours}h ago`
                            if (diffDays < 7) return `${diffDays}d ago`
                            return new Date(entry.at).toLocaleDateString()
                          })()
                          
                          return (
                            <div key={entry.id} className="flex items-start gap-2.5 text-sm group">
                              <span className="text-base flex-shrink-0 mt-0.5">{actionEmoji}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-slate-200 leading-relaxed">{summary}</p>
                                <div className="flex items-center justify-between mt-1">
                                  <p className="text-xs text-slate-500">{timeAgo}</p>
                                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {entry.action === 'update_catalog' && (
                                      <button
                                        onClick={() => handleRevertAiAction(entry)}
                                        disabled={deletingAiEntryId === entry.id}
                                        className="text-xs text-yellow-400 hover:text-yellow-300 transition disabled:opacity-50"
                                        title="Revert this action"
                                      >
                                        ↶ Revert
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDeleteAiHistoryEntry(entry.id)}
                                      disabled={deletingAiEntryId === entry.id}
                                      className="text-xs text-red-400 hover:text-red-300 transition disabled:opacity-50"
                                      title="Delete this entry"
                                    >
                                      {deletingAiEntryId === entry.id ? 'Deleting...' : '✕ Delete'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Additional Information (Admin only) - Only show if there's content */}
                  {user?.role === 'admin' && song.additionalInfo && song.additionalInfo.trim() && (
                    <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-slate-400">Additional Information</p>
                        <button
                          onClick={() => {
                            setAdditionalInfoText(song.additionalInfo || '')
                            setShowAdditionalInfoModal(true)
                          }}
                          className="text-xs text-blue-400 hover:text-blue-300 transition"
                        >
                          Edit
                        </button>
                      </div>
                      <p className="text-sm text-slate-200 whitespace-pre-wrap">{song.additionalInfo}</p>
                    </div>
                  )}

                  {/* Scheduled/Released info + remove */}
                  {song.releaseApprovalStatus === 'approved' && song.releaseDate && (
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-slate-300">
                        <span className="text-slate-400">
                          {song.releaseDate && new Date(song.releaseDate) <= new Date() ? 'Released on: ' : 'Scheduled for: '}
                        </span>
                        {formatLocalDate(song.releaseDate)}
                      </p>
                      {canManageItem(song) && (
                        <button
                          onClick={async () => {
                            try {
                              if (!user?.id) {
                                alert('You must be logged in to update this')
                                return
                              }
                              const res = await fetch('/api/catalog', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  id: songId,
                                  releaseApprovalStatus: 'pending',
                                  releaseDate: null,
                                  userId: user.id,
                                  userRole: user.role,
                                  userName: user.name,
                                }),
                              })
                              const data = await res.json()
                              if (data.success) {
                                fetchSongData()
                              } else {
                                alert(data.error || 'Failed to remove scheduled status')
                              }
                            } catch (error: any) {
                              console.error('Failed to remove scheduled status:', error)
                              alert('Failed to remove scheduled status')
                            }
                          }}
                          className="text-xs text-red-400 hover:text-red-300 transition"
                        >
                          Remove Scheduled
                        </button>
                      )}
                    </div>
                  )}

                  {/* Delay info + remove */}
                  {song.isDelayed ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-slate-300">
                          <span className="text-slate-400">Delay: </span>
                          {song.delayReason || 'No reason provided'}
                        </p>
                        {canManageItem(song) && (
                          <button
                            onClick={async () => {
                              try {
                                if (!user?.id) {
                                  alert('You must be logged in to update this')
                                  return
                                }
                                const updateData: any = {
                                  id: songId,
                                  isDelayed: false,
                                  userId: user.id,
                                  userRole: user.role,
                                  userName: user.name,
                                }
                                // Explicitly set delayReason to null to remove it
                                updateData.delayReason = null
                                
                                const res = await fetch('/api/catalog', {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify(updateData),
                                })
                                const data = await res.json()
                                if (data.success) {
                                  fetchSongData()
                                } else {
                                  alert(data.error || 'Failed to update delay status')
                                }
                              } catch (error: any) {
                                console.error('Failed to update delay status:', error)
                                alert('Failed to update delay status')
                              }
                            }}
                            className="text-xs text-red-400 hover:text-red-300 transition"
                          >
                            Remove Delay
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    (() => {
                      // Check if release date is in the past
                      const isPastRelease = song.releaseDate && new Date(song.releaseDate) < new Date()
                      return (
                        <p className="text-sm text-green-400">
                          {isPastRelease ? 'Release was on schedule' : 'Release is on schedule'}
                        </p>
                      )
                    })()
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Campaign Section — Overview, Timeline, Performance */}
      <div id="campaign-section" className="mt-6 space-y-6">
        <SongCampaignSection
          song={song}
          songId={songId}
          canEdit={canManageItem(song)}
          userId={user?.id || ''}
          onRefresh={fetchSongData}
        />
        <CampaignBlueprintSection
          song={song}
          songId={songId}
          canEdit={canManageItem(song)}
          userId={user?.id || ''}
          onRefresh={fetchSongData}
        />
      </div>

      {/* Lyrics and Song Details - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lyrics Section */}
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Lyrics ({lyricsArray.length})</h2>
            {canManageItem(song) && (
            <button
              onClick={() => {
                setShowAddLyricModal(true)
                setEditingLyricId(null)
              }}
              className="text-sm text-blue-400 hover:text-blue-300 transition flex items-center space-x-1"
            >
              <Plus className="w-4 h-4" />
              <span>Add Lyrics</span>
            </button>
            )}
          </div>
          
          {lyricsArray.length === 0 ? (
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <p className="text-slate-400 text-sm italic">No lyrics added yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {lyricsArray.map((lyric, index) => {
                const isExpanded = expandedLyrics.has(lyric.id)
                const lines = lyric.content.split('\n')
                const previewLines = lines.slice(0, 3) // Show first 3 lines as preview
                const hasMore = lines.length > 3
                const previewText = previewLines.join('\n')
                
                return (
                  <div key={lyric.id} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-white">
                        {lyric.title || `Lyrics ${index + 1}`}
                      </h3>
                      <div className="flex items-center space-x-2">
                        {hasMore && (
                          <button
                            onClick={() => {
                              const newExpanded = new Set(expandedLyrics)
                              if (isExpanded) {
                                newExpanded.delete(lyric.id)
                              } else {
                                newExpanded.add(lyric.id)
                              }
                              setExpandedLyrics(newExpanded)
                            }}
                            className="text-xs text-slate-400 hover:text-white transition flex items-center space-x-1"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="w-3 h-3" />
                                <span>Show Less</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3 h-3" />
                                <span>Show More</span>
                              </>
                            )}
                          </button>
                        )}
                        {canManageItem(song) && (
                          <>
                            <button
                              onClick={() => {
                                setEditingLyricId(lyric.id)
                                setShowAddLyricModal(true)
                              }}
                              className="text-xs text-blue-400 hover:text-blue-300 transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm('Delete this lyrics version?')) {
                                  try {
                                    if (!user?.id) {
                                      alert('You must be logged in to update this')
                                      return
                                    }
                                    const updatedLyrics = lyricsArray.filter(l => l.id !== lyric.id)
                                    const res = await fetch('/api/catalog', {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        id: songId,
                                        userId: user.id,
                                        userRole: user.role,
                                        userName: user.name,
                                        lyricsArray: updatedLyrics,
                                      }),
                                    })
                                    const data = await res.json()
                                    if (data.success) {
                                      fetchSongData()
                                    } else {
                                      alert(data.error || 'Failed to delete lyrics')
                                    }
                                  } catch (error) {
                                    console.error('Failed to delete lyrics:', error)
                                    alert('Failed to delete lyrics')
                                  }
                                }
                              }}
                              className="text-xs text-red-400 hover:text-red-300 transition"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <pre className="text-white whitespace-pre-wrap font-sans text-sm">
                      {isExpanded ? lyric.content : previewText}
                      {!isExpanded && hasMore && (
                        <span className="text-slate-400 italic">...</span>
                      )}
                    </pre>
                    <p className="text-xs text-slate-500 mt-2">
                      Added {new Date(lyric.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Song Details */}
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Song Details</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            <div>
              <p className="text-sm text-slate-400">Artist</p>
              <p className="text-white font-medium">{song.artist}</p>
            </div>
            {song.releaseDate && (
              <div>
                <p className="text-sm text-slate-400">Release Date</p>
                <p className="text-white font-medium">{formatLocalDate(song.releaseDate)}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-slate-400">Total Streams</p>
              {editingStreams ? (
                <div className="flex items-center space-x-2 mt-1">
                  <input
                    type="number"
                    value={editingStreamsValue}
                    onChange={(e) => setEditingStreamsValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const newStreams = parseInt(editingStreamsValue.replace(/,/g, '')) || 0
                        handleUpdateStreams(newStreams)
                      } else if (e.key === 'Escape') {
                        setEditingStreams(false)
                        setEditingStreamsValue('')
                      }
                    }}
                    className="w-32 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-xl font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                    autoFocus
                    placeholder="0"
                  />
                  <button
                    onClick={() => {
                      const newStreams = parseInt(editingStreamsValue.replace(/,/g, '')) || 0
                      handleUpdateStreams(newStreams)
                    }}
                    className="text-sm text-green-400 hover:text-green-300 px-2"
                    title="Save"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => {
                      setEditingStreams(false)
                      setEditingStreamsValue('')
                    }}
                    className="text-sm text-red-400 hover:text-red-300 px-2"
                    title="Cancel"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 group">
                    <p className="text-white font-semibold text-2xl">{song.totalStreams.toLocaleString()}</p>
                    {user?.role !== 'artist' && (
                      <button
                        onClick={() => {
                          setEditingStreams(true)
                          setEditingStreamsValue(song.totalStreams.toString())
                        }}
                        className="opacity-0 group-hover:opacity-100 text-xs text-blue-400 hover:text-blue-300 underline ml-2 transition-opacity"
                        title="Edit streams"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  {projectedStreams !== null && (song.isUnreleased || !song.releaseDate || (song.releaseDate && new Date(song.releaseDate) > new Date())) && (
                    <div className="text-xs text-slate-400">
                      <span className="text-blue-400 font-medium">Projected:</span>{' '}
                      <span className="text-blue-300">{projectedStreams.toLocaleString()}</span>
                      <span className="text-slate-500 ml-1">(based on {song.artist}&apos;s historical performance)</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {song.distributor && (
            <div>
              <p className="text-sm text-slate-400">Distributor</p>
              {(() => {
                const distributorUrl = getDistributorUrl(song.distributor)
                return distributorUrl ? (
                  <a
                    href={distributorUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 text-white font-medium hover:text-blue-400 transition-colors group"
                  >
                    <span>{song.distributor}</span>
                    <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                ) : (
                  <p className="text-white font-medium">{song.distributor}</p>
                )
              })()}
              {song.distributor.toLowerCase().includes('empire') && (
                <div className="mt-2">
                  {song.sentToEmpireAt ? (
                    <div className="flex items-center space-x-2">
                      <CheckSquare className="w-4 h-4 text-green-400" />
                      <span className="text-xs text-green-400">
                        Sent to Empire: {new Date(song.sentToEmpireAt).toLocaleDateString()}
                      </span>
                    </div>
                  ) : canManageItem(song) ? (
                    <button
                      onClick={async () => {
                        if (confirm('Mark this song as sent to Empire? This will enable the SCHEDULED badge.')) {
                          try {
                            if (!user?.id) {
                              alert('You must be logged in to update this')
                              return
                            }
                            const res = await fetch('/api/catalog', {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                id: songId,
                                sentToEmpireAt: new Date().toISOString(),
                                userId: user.id,
                                userRole: user.role,
                                userName: user.name,
                              }),
                            })
                            const data = await res.json()
                            if (data.success) {
                              fetchSongData()
                            } else {
                              alert(data.error || 'Failed to update')
                            }
                          } catch (error) {
                            console.error('Failed to mark as sent to Empire:', error)
                            alert('Failed to update')
                          }
                        }
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 underline flex items-center space-x-1"
                    >
                      <CheckSquare className="w-3 h-3" />
                      <span>Mark as Sent to Empire</span>
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          )}
          {(song.fileUrl || song.googleDriveUrl) && (
            <div>
              <p className="text-sm text-slate-400 mb-2">Song File</p>
              <a
                href={song.fileUrl || song.googleDriveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 text-red-400 hover:text-red-300"
              >
                <LinkIcon className="w-4 h-4" />
                <span>{song.fileUrl ? 'Download File' : 'Open in Drive'}</span>
              </a>
            </div>
          )}
        </div>

        {/* Credits Section */}
        <div className="mt-6 pt-6 border-t border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span>Credits</span>
              </h3>
              {canManageItem(song) && (
                <button
                  onClick={() => {
                    setEditingCredit(null)
                    setCreditFormData({ role: 'producer', name: '', ipi: '', customRole: '', adminNotes: '' })
                    setShowCreditsModal(true)
                  }}
                  className="flex items-center space-x-2 text-sm text-blue-400 hover:text-blue-300 transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Credit</span>
                </button>
              )}
            </div>

            {song.credits && song.credits.length > 0 ? (
              <div className="space-y-3">
                {/* Group credits by role */}
                {['producer', 'engineer', 'writer', 'publisher', 'mixer', 'mastering', 'other'].map(role => {
                  const roleCredits = song.credits!.filter(c => c.role === role)
                  if (roleCredits.length === 0) return null

                  return (
                    <div key={role} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <h4 className="text-sm font-semibold text-slate-300 mb-2 capitalize">
                        {role === 'other' && roleCredits[0]?.customRole
                          ? roleCredits[0].customRole
                          : role === 'other'
                          ? 'Other'
                          : role}s
                      </h4>
                      <div className="space-y-2">
                        {roleCredits.map(credit => (
                          <div key={credit.id} className="flex items-center justify-between p-2 bg-slate-900/50 rounded border border-slate-700">
                            <div className="flex-1">
                              <p className="text-white font-medium">{credit.name}</p>
                              {credit.ipi && (
                                <p className="text-xs text-slate-400 mt-1">IPI: {credit.ipi}</p>
                              )}
                              {credit.role === 'other' && credit.customRole && (
                                <p className="text-xs text-slate-400 mt-1">Role: {credit.customRole}</p>
                              )}
                            </div>
                            {canManageItem(song) && (
                              <div className="flex items-center space-x-2 ml-4">
                                <button
                                  onClick={() => {
                                    setEditingCredit(credit)
                                    setCreditFormData({
                                      role: credit.role,
                                      name: credit.name,
                                      ipi: credit.ipi || '',
                                      customRole: credit.customRole || '',
                                      adminNotes: credit.adminNotes || '',
                                    })
                                    setShowCreditsModal(true)
                                  }}
                                  className="text-blue-400 hover:text-blue-300 transition"
                                  title="Edit credit"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteCredit(credit.id)}
                                  className="text-red-400 hover:text-red-300 transition"
                                  title="Delete credit"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <p className="text-slate-400 text-sm italic">No credits added yet</p>
              </div>
            )}
        </div>
      </div>

      {/* Add/Edit Lyrics Modal */}
      {showAddLyricModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-2xl w-full">
              <h2 className="text-2xl font-bold text-white mb-4">
                {editingLyricId ? 'Edit Lyrics' : 'Add Lyrics'}
              </h2>
              <form onSubmit={async (e) => {
                e.preventDefault()
                
                // Prevent artists from adding/editing lyrics
                if (user?.role === 'artist') {
                  alert('Artists cannot add or edit lyrics')
                  return
                }
                
                const formData = new FormData(e.target as HTMLFormElement)
                const title = formData.get('title') as string
                const content = formData.get('content') as string

                try {
                  let updatedLyrics: Array<{ id: string; title?: string; content: string; createdAt: string }>
                  
                  if (editingLyricId) {
                    // Update existing
                    updatedLyrics = lyricsArray.map(l => 
                      l.id === editingLyricId 
                        ? { ...l, title: title.trim() || undefined, content: content.trim() }
                        : l
                    )
                  } else {
                    // Add new
                    updatedLyrics = [...lyricsArray, {
                      id: `lyric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                      title: title.trim() || undefined,
                      content: content.trim(),
                      createdAt: new Date().toISOString(),
                    }]
                  }

                  const res = await fetch('/api/catalog', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      id: songId,
                      userRole: user?.role,
                      lyricsArray: updatedLyrics,
                    }),
                  })
                  const data = await res.json()
                  if (data.success) {
                    setShowAddLyricModal(false)
                    setEditingLyricId(null)
                    fetchSongData()
                  }
                } catch (error) {
                  console.error('Failed to save lyrics:', error)
                  alert('Failed to save lyrics')
                }
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Title (Optional) - e.g., &quot;Explicit&quot;, &quot;Clean&quot;, &quot;Verse 1&quot;
                  </label>
                  <input
                    type="text"
                    name="title"
                    defaultValue={editingLyricId ? lyricsArray.find(l => l.id === editingLyricId)?.title || '' : ''}
                    placeholder="Enter title (optional)"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Lyrics Content *
                  </label>
                  <textarea
                    name="content"
                    defaultValue={editingLyricId ? lyricsArray.find(l => l.id === editingLyricId)?.content || '' : ''}
                    placeholder="Enter song lyrics..."
                    required
                    rows={12}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition"
                  >
                    {editingLyricId ? 'Update Lyrics' : 'Add Lyrics'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddLyricModal(false)
                      setEditingLyricId(null)
                    }}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
        </div>
      )}

      {/* Song Vault - Full Width Under Song Details */}
      <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3 flex-1">
            <h2 className="text-xl font-semibold text-white">Song Vault</h2>
            <span className="text-sm text-slate-400">({vaultFiles.length} files)</span>
          </div>
          <div className="flex items-center space-x-2">
            {/* Mobile collapse/expand button */}
            <button
              onClick={() => setIsVaultExpanded(!isVaultExpanded)}
              className="lg:hidden text-slate-400 hover:text-white transition p-2"
              title={isVaultExpanded ? 'Collapse' : 'Expand'}
            >
              {isVaultExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {canManageItem(song) && (
              <button
                onClick={() => setShowAddFileModal(true)}
                className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition text-sm"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add File</span>
              </button>
            )}
          </div>
        </div>
        <div className={`space-y-2 lg:block ${isVaultExpanded ? 'block' : 'hidden'}`}>
          {vaultFiles.length === 0 ? (
            <p className="text-slate-400 text-sm">No files in vault</p>
          ) : (() => {
              // Group files by folder
              const folders = new Map<string, SongVaultFile[]>()
              const rootFiles: SongVaultFile[] = []
              const folderEntries: SongVaultFile[] = []

              vaultFiles.forEach(file => {
                if (file.isFolder) {
                  folderEntries.push(file)
                } else if (file.folderPath) {
                  const folderName = file.folderPath.split('/')[0] // Get top-level folder
                  if (!folders.has(folderName)) {
                    folders.set(folderName, [])
                  }
                  folders.get(folderName)!.push(file)
                } else {
                  rootFiles.push(file)
                }
              })

              // Sort folders by date (oldest to newest)
              folderEntries.sort((a, b) => {
                const dateA = new Date(a.uploadedAt || 0).getTime()
                const dateB = new Date(b.uploadedAt || 0).getTime()
                return dateA - dateB // Oldest first
              })

              // Sort files within each folder by date (oldest to newest)
              folders.forEach((files, folderName) => {
                folders.set(folderName, files.sort((a, b) => {
                  const dateA = new Date(a.uploadedAt || 0).getTime()
                  const dateB = new Date(b.uploadedAt || 0).getTime()
                  return dateA - dateB // Oldest first
                }))
              })

              // Sort root files by date (oldest to newest)
              rootFiles.sort((a, b) => {
                const dateA = new Date(a.uploadedAt || 0).getTime()
                const dateB = new Date(b.uploadedAt || 0).getTime()
                return dateA - dateB // Oldest first
              })

              // Get unique folder names from folder entries
              const folderNames = new Set<string>()
              folderEntries.forEach(folder => {
                if (folder.fileName) {
                  folderNames.add(folder.fileName)
                }
              })
              folders.forEach((files, folderName) => {
                folderNames.add(folderName)
              })

              return (
                <>
                  {/* Root level files */}
                  {rootFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700"
                    >
                      <div className="flex items-center space-x-3 flex-1">
                        <FileText className="w-5 h-5 text-slate-400" />
                        <div className="flex-1">
                          <p className="text-white text-sm font-medium">{file.fileName}</p>
                          <div className="flex items-center space-x-3 mt-1">
                            <p className="text-xs text-slate-400 capitalize">{file.fileType.replace('_', ' ')}</p>
                            {file.fileSize && (
                              <p className="text-xs text-slate-500">
                                {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {(file.fileType === 'bounced' || file.fileType === 'master' || file.fileType === 'music_video') && (file.fileUrl || file.googleDriveUrl) && (
                          <button
                            onClick={() => {
                              if (playingFile === file.id) {
                                setPlayingFile(null)
                              } else {
                                setPlayingFile(file.id)
                              }
                            }}
                            className="p-2 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded transition"
                            title={playingFile === file.id ? 'Stop' : 'Play'}
                          >
                            {playingFile === file.id ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        <a
                          href={file.fileUrl || file.googleDriveUrl}
                          download
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition"
                          title="Download File"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        {canManageItem(song) && (
                        <button
                          onClick={() => handleDeleteFile(file.id)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Folders */}
                  {Array.from(folderNames).sort().map((folderName) => {
                    const folderFiles = folders.get(folderName) || []
                    const isExpanded = expandedFolders.has(folderName)
                    
                    return (
                      <div key={folderName} className="border border-slate-700 rounded-lg overflow-hidden">
                        <div className="flex items-center p-3 bg-slate-800/50 hover:bg-slate-800/70 transition">
                          <button
                            onClick={() => {
                              const newExpanded = new Set(expandedFolders)
                              if (isExpanded) {
                                newExpanded.delete(folderName)
                              } else {
                                newExpanded.add(folderName)
                              }
                              setExpandedFolders(newExpanded)
                            }}
                            className="flex items-center space-x-3 flex-1 text-left"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            )}
                            <Folder className="w-5 h-5 text-purple-400" />
                            <div className="flex-1">
                              {renamingFolder === folderName ? (
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="text"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    onKeyPress={(e) => {
                                      if (e.key === 'Enter') {
                                        handleRenameFolder(folderName, newFolderName)
                                      } else if (e.key === 'Escape') {
                                        setRenamingFolder(null)
                                        setNewFolderName('')
                                      }
                                    }}
                                    autoFocus
                                    className="flex-1 px-2 py-1 text-sm bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                                  />
                                  <button
                                    onClick={() => handleRenameFolder(folderName, newFolderName)}
                                    className="p-1 text-green-400 hover:text-green-300"
                                    title="Save"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={() => {
                                      setRenamingFolder(null)
                                      setNewFolderName('')
                                    }}
                                    className="p-1 text-red-400 hover:text-red-300"
                                    title="Cancel"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <p className="text-white text-sm font-medium">{folderName}</p>
                                  <p className="text-xs text-slate-400 mt-0.5">{folderFiles.length} file{folderFiles.length !== 1 ? 's' : ''}</p>
                                </>
                              )}
                            </div>
                          </button>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleDownloadFolder(folderName)}
                              disabled={downloadingFolders.has(folderName)}
                              className="p-1.5 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Download folder as ZIP"
                            >
                              {downloadingFolders.has(folderName) ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Download className="w-3.5 h-3.5" />
                              )}
                            </button>
                            {canManageItem(song) && renamingFolder !== folderName && (
                              <>
                                <button
                                  onClick={() => {
                                    setRenamingFolder(folderName)
                                    setNewFolderName(folderName)
                                  }}
                                  className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition"
                                  title="Rename folder"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    handleDeleteFolder(folderName, folderFiles.length)
                                  }}
                                  className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition"
                                  title="Delete folder"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="bg-slate-900/50 p-2 space-y-1">
                            {folderFiles.map((file) => (
                              <div
                                key={file.id}
                                className="flex items-center justify-between p-2 bg-slate-800/50 rounded border border-slate-700"
                              >
                                <div className="flex items-center space-x-2 flex-1">
                                  <FileText className="w-4 h-4 text-slate-400" />
                                  <div className="flex-1">
                                    <p className="text-white text-xs font-medium">{file.fileName}</p>
                                    <div className="flex items-center space-x-2 mt-0.5">
                                      <p className="text-xs text-slate-500 capitalize">{file.fileType.replace('_', ' ')}</p>
                                      {file.fileSize && (
                                        <p className="text-xs text-slate-600">
                                          {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-1">
                                  {(file.fileType === 'bounced' || file.fileType === 'master' || file.fileType === 'music_video') && (file.fileUrl || file.googleDriveUrl) && (
                                    <button
                                      onClick={() => {
                                        if (playingFile === file.id) {
                                          setPlayingFile(null)
                                        } else {
                                          setPlayingFile(file.id)
                                        }
                                      }}
                                      className="p-1.5 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded transition"
                                      title={playingFile === file.id ? 'Stop' : 'Play'}
                                    >
                                      {playingFile === file.id ? (
                                        <Pause className="w-3.5 h-3.5" />
                                      ) : (
                                        <Play className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  )}
                                  <a
                                    href={file.fileUrl || file.googleDriveUrl}
                                    download
                                    className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition"
                                    title="Download File"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </a>
                                  {canManageItem(song) && (
                                  <button
                                    onClick={() => handleDeleteFile(file.id)}
                                    className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </>
              )
            })()}
        </div>
        
        {/* Audio/Video Player for Song Vault */}
        {playingFile && (() => {
          const file = vaultFiles.find(f => f.id === playingFile)
          if (!file || !(file.fileUrl || file.googleDriveUrl)) return null
          
          const isVideo = file.fileType === 'music_video'
          const fileUrl = file.fileUrl || file.googleDriveUrl
          
          return (
            <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-white font-semibold text-sm">{file.fileName}</h4>
                </div>
                <button
                  onClick={() => setPlayingFile(null)}
                  className="p-2 text-slate-400 hover:text-white rounded transition"
                >
                  <Pause className="w-4 h-4" />
                </button>
              </div>
              {isVideo ? (
                <video
                  src={fileUrl}
                  controls
                  className="w-full rounded-lg"
                  onEnded={() => setPlayingFile(null)}
                />
              ) : (
                <audio
                  src={fileUrl}
                  controls
                  className="w-full"
                  onEnded={() => setPlayingFile(null)}
                />
              )}
            </div>
          )
        })()}
      </div>

      {/* Audio/Tracklist Section */}
      {song.songs && song.songs.length > 0 && (
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">{song.releaseType === 'single' ? 'Audio' : 'Tracklist'} ({song.songs.length})</h2>
            {song.songs.length > 5 && (
              <button
                onClick={() => setIsTracklistExpanded(!isTracklistExpanded)}
                className="text-sm text-slate-400 hover:text-white transition flex items-center space-x-1"
              >
                {isTracklistExpanded ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    <span>Show Less</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    <span>Show All ({song.songs.length})</span>
                  </>
                )}
              </button>
            )}
          </div>
          <div className="space-y-3">
                {(isTracklistExpanded ? song.songs : song.songs.slice(0, 5)).map((track, idx) => (
                  <div key={track.id} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="flex gap-3 min-w-0">
                      <span className="text-sm text-slate-500 font-mono w-7 flex-shrink-0 text-right pt-0.5 tabular-nums">
                        {idx + 1}.
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <span className="text-white text-base font-medium block truncate">{track.song}</span>
                            {(track.featuring?.trim() ||
                              (track.featuredArtistIds && track.featuredArtistIds.length > 0)) && (
                              <p className="text-sm text-purple-300/90 mt-1 leading-snug">
                                {track.featuring?.trim() ||
                                  `feat. ${track.featuredArtistIds!.length} guest artist(s) — also in their Catalog`}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                            {canManageItem(song) && (
                              <button
                                type="button"
                                onClick={() => openFeaturingModal(track.id)}
                                className="flex items-center justify-center text-purple-300 hover:text-purple-200 transition p-2 rounded-lg hover:bg-slate-700/80"
                                title="Featuring & guest catalog access"
                              >
                                <UserPlus className="w-5 h-5" />
                              </button>
                            )}
                            {track.streams ? (
                              <span className="text-sm text-slate-400 hidden sm:inline tabular-nums">
                                {track.streams.toLocaleString()} streams
                              </span>
                            ) : null}
                            {track.audioUrl ? (
                          <button
                            onClick={() => {
                              if (playingTrackId === track.id && isPlaying) {
                                audioPlayer.pauseTrack()
                              } else {
                                let audioUrl = track.audioUrl
                                // Validate audioUrl exists and is not empty
                                if (!audioUrl || !audioUrl.trim()) {
                                  console.error('Invalid audioUrl for track:', track.id, track.song, { audioUrl })
                                  setAudioError('No audio file available')
                                  return
                                }
                                
                                // Ensure audioUrl is absolute using helper function
                                audioUrl = getAbsoluteUrl(audioUrl)
                                
                                // Double-check after conversion
                                if (!audioUrl || !audioUrl.trim()) {
                                  console.error('Failed to convert audioUrl to absolute URL:', track.audioUrl)
                                  setAudioError('Invalid audio URL')
                                  return
                                }
                                
                                setIsLoadingAudio(true)
                                setAudioError(null)
                                audioPlayer.playTrack({
                                  id: track.id,
                                  song: track.song,
                                  artist: song.artist,
                                  audioUrl,
                                  songId: songId,
                                })
                                // Reduce timeout since we're optimizing loading
                                setTimeout(() => setIsLoadingAudio(false), 200)
                              }
                            }}
                            className="flex items-center space-x-1 text-red-400 hover:text-red-300 transition p-2 rounded-lg hover:bg-slate-700"
                            title={playingTrackId === track.id ? (isLoadingAudio ? 'Loading...' : isPlaying ? 'Pause' : 'Play') : 'Play'}
                            disabled={isLoadingAudio && playingTrackId === track.id}
                          >
                            {playingTrackId === track.id && isLoadingAudio ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : playingTrackId === track.id && isPlaying ? (
                              <Pause className="w-5 h-5" />
                            ) : (
                              <Play className="w-5 h-5" />
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedTrack({ id: track.id, song: track.song })
                              setShowTrackUploadModal(true)
                            }}
                            className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 transition p-2 rounded-lg hover:bg-slate-700"
                            title="Upload audio"
                          >
                            <Upload className="w-5 h-5" />
                          </button>
                        )}
                          </div>
                        </div>
                        {track.isrc && (
                          <p className="text-sm text-slate-500 font-mono mt-2">ISRC: {track.isrc}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
          </div>
        </div>
      )}

      {showFeaturingModal && song && featuringEditTrackId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <h2 className="text-xl font-semibold text-white mb-1">Featuring & guest access</h2>
            <p className="text-sm text-slate-400 mb-4">
              Track:{' '}
              <span className="text-white font-medium">
                {song.songs?.find((t) => t.id === featuringEditTrackId)?.song}
              </span>
            </p>
            <p className="text-xs text-slate-500 mb-4">
              Linked artists appear in <strong className="text-slate-300">their</strong> Catalog for this release so they can follow performance. Add a public line (e.g. feat. Name) for the tracklist.
            </p>
            <label className="block text-sm font-medium text-slate-300 mb-2">Display line</label>
            <input
              type="text"
              value={featuringDisplayText}
              onChange={(e) => setFeaturingDisplayText(e.target.value)}
              placeholder='e.g. feat. Jane & John'
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
            />
            <p className="text-sm font-medium text-slate-300 mb-2">Guest artist accounts (catalog access)</p>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-700 divide-y divide-slate-700/80 mb-4">
              {allFeaturingArtists.length === 0 ? (
                <p className="p-3 text-sm text-slate-500">Loading artists…</p>
              ) : (
                allFeaturingArtists.map((a) => (
                  <label
                    key={a.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-slate-800/80 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={featuringArtistIds.includes(a.id)}
                      onChange={() => {
                        setFeaturingArtistIds((prev) =>
                          prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id]
                        )
                      }}
                      className="rounded border-slate-600 bg-slate-800 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-white truncate">{a.artistName || a.name}</span>
                  </label>
                ))
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowFeaturingModal(false)
                  setFeaturingEditTrackId(null)
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveFeaturing()}
                disabled={isSavingFeaturing}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg transition"
              >
                {isSavingFeaturing ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Promotional Notes Section - Full Width Bottom */}
      <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Promotional Plans & Notes</h2>
          {canManageItem(song) && (
            <button
              onClick={() => {
                setPromoNotesText(song.promoNotes || '')
                setShowPromoNotesModal(true)
              }}
              className="text-sm text-blue-400 hover:text-blue-300 transition flex items-center space-x-1"
            >
              <Edit className="w-4 h-4" />
              <span>{song.promoNotes ? 'Edit Notes' : 'Add Notes'}</span>
            </button>
          )}
        </div>
        
        {song.promoNotes ? (
          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <pre className="text-white whitespace-pre-wrap font-sans text-sm">{song.promoNotes}</pre>
          </div>
        ) : (
          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <p className="text-slate-400 text-sm italic">No promotional notes added yet</p>
          </div>
        )}
      </div>

      {showRequestChangeModal && song && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full">
            <div className="p-4 sm:p-6 border-b border-slate-800">
              <h2 className="text-xl font-bold text-white">Request Catalog Change</h2>
              <p className="text-slate-400 text-sm mt-1">{song.song} by {song.artist}</p>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Describe the change you need</label>
                <textarea
                  value={requestChangeText}
                  onChange={(e) => setRequestChangeText(e.target.value)}
                  placeholder="e.g. Update release date to 2025-02-20, fix UPC..."
                  rows={4}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setShowRequestChangeModal(false); setRequestChangeText('') }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!requestChangeText.trim() || !user?.id) return
                    setIsSubmittingRequest(true)
                    try {
                      const res = await fetch('/api/catalog-change-requests', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          songId: song.id,
                          songName: song.song,
                          artistName: song.artist,
                          requestedBy: user.id,
                          requestedByName: user.name || user.artistName || 'Staff',
                          changes: requestChangeText.trim(),
                        }),
                      })
                      const data = await res.json()
                      if (data.success) {
                        setShowRequestChangeModal(false)
                        setRequestChangeText('')
                      }
                    } finally {
                      setIsSubmittingRequest(false)
                    }
                  }}
                  disabled={!requestChangeText.trim() || isSubmittingRequest}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg transition"
                >
                  {isSubmittingRequest ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddFileModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold text-white mb-4">Add File/Folder to Vault</h2>
            <form onSubmit={handleAddFile} className="space-y-4">
              <div>
                <label className="flex items-center space-x-2 mb-3">
                  <input
                    type="checkbox"
                    checked={fileFormData.isFolderUpload}
                    onChange={(e) => {
                      setFileFormData({
                        ...fileFormData,
                        isFolderUpload: e.target.checked,
                        file: null,
                        files: null,
                      })
                    }}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm text-slate-300 flex items-center space-x-2">
                    <Folder className="w-4 h-4" />
                    <span>Upload Folder</span>
                  </span>
                </label>
                {fileFormData.isFolderUpload ? (
                  <>
                    <input
                      type="file"
                      {...({ webkitdirectory: '', directory: '' } as any)}
                      multiple
                      onChange={(e) => {
                        const selectedFiles = e.target.files
                        if (selectedFiles && selectedFiles.length > 0) {
                          setFileFormData({
                            ...fileFormData,
                            files: selectedFiles,
                            folderPath: fileFormData.folderPath || selectedFiles[0].webkitRelativePath.split('/')[0] || 'Uploaded Folder',
                          })
                        }
                      }}
                      required
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-red-600 file:text-white hover:file:bg-red-700"
                    />
                    {fileFormData.files && (
                      <p className="text-xs text-slate-400 mt-2">
                        {fileFormData.files.length} file{fileFormData.files.length !== 1 ? 's' : ''} selected
                      </p>
                    )}
                    <div className="mt-2">
                      <label className="block text-sm font-medium text-slate-300 mb-2">Folder Name</label>
                      <input
                        type="text"
                        value={fileFormData.folderPath}
                        onChange={(e) => setFileFormData({ ...fileFormData, folderPath: e.target.value })}
                        placeholder="Enter folder name"
                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  </>
                ) : (
                  <input
                    type="file"
                    onChange={(e) => {
                      const selectedFile = e.target.files?.[0]
                      if (selectedFile) {
                        setFileFormData({
                          ...fileFormData,
                          file: selectedFile,
                          fileName: fileFormData.fileName || selectedFile.name,
                        })
                      }
                    }}
                    required
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-red-600 file:text-white hover:file:bg-red-700"
                  />
                )}
              </div>
              {!fileFormData.isFolderUpload && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">File Name (Optional - defaults to uploaded filename)</label>
                    <input
                      type="text"
                      value={fileFormData.fileName}
                      onChange={(e) => setFileFormData({ ...fileFormData, fileName: e.target.value })}
                      placeholder="e.g., song_final_mix.logicx"
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">File Type</label>
                    <select
                      value={fileFormData.fileType}
                      onChange={(e) => setFileFormData({ ...fileFormData, fileType: e.target.value as any })}
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="logic">Logic Project</option>
                      <option value="bounced">Bounced Version</option>
                      <option value="stem">Stem</option>
                      <option value="master">Master</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </>
              )}
              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={isUploading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? 'Uploading...' : 'Upload & Add File'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddFileModal(false)
                    setFileFormData({ fileName: '', fileType: 'logic', file: null, files: null, folderPath: '', isFolderUpload: false })
                  }}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delay Status Modal */}
      {showDelayModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold text-white mb-4">Mark Release as Delayed</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Delay Reason (Optional)
              </label>
              <textarea
                value={delayReason}
                onChange={(e) => setDelayReason(e.target.value)}
                placeholder="e.g., Waiting for final mix, Cover art pending, etc."
                rows={4}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={async () => {
                  try {
                    setIsUpdatingDelay(true)
                    const updateData: any = {
                      id: songId,
                      isDelayed: true,
                      userRole: user?.role,
                    }
                    // Only include delayReason if it has a value
                    if (delayReason.trim()) {
                      updateData.delayReason = delayReason.trim()
                    } else {
                      updateData.delayReason = null
                    }
                    
                    const res = await fetch('/api/catalog', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(updateData),
                    })
                    const data = await res.json()
                    if (data.success) {
                      setShowDelayModal(false)
                      setDelayReason('')
                      fetchSongData()
                    } else {
                      alert(data.error || 'Failed to update delay status')
                    }
                  } catch (error: any) {
                    console.error('Failed to update delay status:', error)
                    alert('Failed to update delay status')
                  } finally {
                    setIsUpdatingDelay(false)
                  }
                }}
                disabled={isUpdatingDelay}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                {isUpdatingDelay ? 'Updating...' : 'Mark as Delayed'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDelayModal(false)
                  setDelayReason('')
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Status Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 max-w-md w-full my-auto max-h-[95vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-white mb-4">Mark Release as Scheduled</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">Release Date *</label>
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                min={formatLocalDateString(new Date())}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />
              <p className="text-xs text-slate-500 mt-2">
                This will set the song to <span className="text-green-400 font-semibold">SCHEDULED</span>.
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={async () => {
                  try {
                    if (!scheduleDate) {
                      alert('Please choose a release date')
                      return
                    }
                    setIsUpdatingSchedule(true)
                    const res = await fetch('/api/catalog', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        id: songId,
                        releaseApprovalStatus: 'approved',
                        releaseDate: scheduleDate,
                        userRole: user?.role,
                      }),
                    })
                    const data = await res.json()
                    if (data.success) {
                      setShowScheduleModal(false)
                      fetchSongData()
                    } else {
                      alert(data.error || 'Failed to schedule release')
                    }
                  } catch (error: any) {
                    console.error('Failed to schedule release:', error)
                    alert('Failed to schedule release')
                  } finally {
                    setIsUpdatingSchedule(false)
                  }
                }}
                disabled={isUpdatingSchedule}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                {isUpdatingSchedule ? 'Saving...' : 'Mark as Scheduled'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowScheduleModal(false)
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Past Campaign Modal */}
      {showImportPastModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 max-w-lg w-full my-auto max-h-[95vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-white mb-4">Import Past Campaign</h2>
            <p className="text-slate-400 text-sm mb-4">Add past release data, old posts, and final stats for songs that weren&apos;t tracked before.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Release Date</label>
                <input
                  type="date"
                  value={importPastForm.releaseDate}
                  onChange={(e) => setImportPastForm((f) => ({ ...f, releaseDate: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Add Past Content Link (Instagram, YouTube, etc.)</label>
                <input
                  type="url"
                  value={importPastForm.url}
                  onChange={(e) => setImportPastForm((f) => ({ ...f, url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Platform</label>
                  <input
                    value={importPastForm.platform}
                    onChange={(e) => setImportPastForm((f) => ({ ...f, platform: e.target.value }))}
                    placeholder="Instagram, YouTube..."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Post Date</label>
                  <input
                    type="date"
                    value={importPastForm.date}
                    onChange={(e) => setImportPastForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Notes</label>
                <textarea
                  value={importPastForm.notes}
                  onChange={(e) => setImportPastForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                />
              </div>
              <div className="border-t border-slate-700 pt-4">
                <p className="text-sm font-medium text-slate-300 mb-2">Final Stats</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Week 1</label>
                    <input
                      type="number"
                      value={importPastForm.week1Streams}
                      onChange={(e) => setImportPastForm((f) => ({ ...f, week1Streams: e.target.value }))}
                      className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Month 1</label>
                    <input
                      type="number"
                      value={importPastForm.month1Streams}
                      onChange={(e) => setImportPastForm((f) => ({ ...f, month1Streams: e.target.value }))}
                      className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Total</label>
                    <input
                      type="number"
                      value={importPastForm.totalStreams}
                      onChange={(e) => setImportPastForm((f) => ({ ...f, totalStreams: e.target.value }))}
                      className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={async () => {
                  if (!user?.id) return
                  setIsImportingPast(true)
                  try {
                    const updates: Record<string, any> = {}
                    if (importPastForm.releaseDate) {
                      updates.releaseDate = importPastForm.releaseDate + 'T00:00:00.000Z'
                      updates.releaseApprovalStatus = 'approved'
                    }
                    if (importPastForm.totalStreams) {
                      updates.totalStreams = Number(importPastForm.totalStreams)
                    }
                    if (Object.keys(updates).length > 0) {
                      const res = await fetch('/api/catalog', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: songId, ...updates, userId: user.id, userRole: user.role, userName: user.name }),
                      })
                      const data = await res.json()
                      if (!data.success) throw new Error(data.error)
                    }
                    if (importPastForm.url) {
                      const existing = (song as any).pastContentLinks || []
                      const newLink = {
                        id: `pcl_${Date.now()}`,
                        url: importPastForm.url,
                        platform: importPastForm.platform || undefined,
                        date: importPastForm.date || undefined,
                        notes: importPastForm.notes || undefined,
                      }
                      const res2 = await fetch(`/api/catalog/${songId}/campaign`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          userId: user.id,
                          pastContentLinks: [...existing, newLink],
                        }),
                      })
                      const data2 = await res2.json()
                      if (!data2.success) throw new Error(data2.error)
                    }
                    if (importPastForm.week1Streams || importPastForm.month1Streams || importPastForm.totalStreams) {
                      const res3 = await fetch(`/api/catalog/${songId}/campaign`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          userId: user.id,
                          performanceMetrics: {
                            week1Streams: importPastForm.week1Streams ? Number(importPastForm.week1Streams) : undefined,
                            month1Streams: importPastForm.month1Streams ? Number(importPastForm.month1Streams) : undefined,
                            totalStreams: importPastForm.totalStreams ? Number(importPastForm.totalStreams) : undefined,
                          },
                        }),
                      })
                      const data3 = await res3.json()
                      if (!data3.success) throw new Error(data3.error)
                    }
                    setShowImportPastModal(false)
                    fetchSongData()
                  } catch (e: any) {
                    alert(e.message || 'Failed to import')
                  } finally {
                    setIsImportingPast(false)
                  }
                }}
                disabled={isImportingPast}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                {isImportingPast ? 'Importing...' : 'Import'}
              </button>
              <button
                onClick={() => setShowImportPastModal(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Track Audio Upload Modal */}
      {showTrackUploadModal && selectedTrack && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold text-white mb-4">Upload Audio for Track</h2>
            <p className="text-sm text-slate-400 mb-4">Track: <span className="text-white font-medium">{selectedTrack.song}</span></p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">Audio File (Any Format)</label>
              <input
                type="file"
                accept="audio/*,*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    if (file.size === 0) {
                      alert('Selected file is empty. Please choose a valid audio file.')
                      return
                    }
                    setTrackUploadFile(file)
                  } else {
                    setTrackUploadFile(null)
                  }
                }}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              {trackUploadFile && (
                <p className="text-xs text-slate-400 mt-2">
                  Selected: {trackUploadFile.name} ({(trackUploadFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleUploadTrackAudio}
                disabled={!trackUploadFile || isUploadingTrack}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                {isUploadingTrack ? 'Uploading...' : 'Upload Audio'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowTrackUploadModal(false)
                  setSelectedTrack(null)
                  setTrackUploadFile(null)
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Album Cover Upload Modal */}
      {showCoverUpload && song && (
        <div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onDragOver={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold text-white mb-4">
              {isMotionCover ? 'Upload Motion Cover' : 'Upload Album Cover'}
            </h2>
            <p className="text-sm text-slate-400 mb-4">Song: <span className="text-white font-medium">{song.song}</span></p>
            
            <div className="mb-4">
              <label className="flex items-center space-x-2 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isMotionCover}
                  onChange={(e) => {
                    setIsMotionCover(e.target.checked)
                    // Clean up preview URL
                    if (previewUrl) {
                      URL.revokeObjectURL(previewUrl)
                      setPreviewUrl(null)
                    }
                    setCoverUploadFile(null) // Reset file when switching types
                  }}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm text-slate-300">Upload as Motion Cover (Video)</span>
              </label>

              {(isMotionCover ? !!song.motionCover?.trim() : !!song.albumCover?.trim()) ? (
                <label className="flex items-start gap-3 mb-4 cursor-pointer rounded-lg border border-white/10 bg-white/[0.03] p-3.5">
                  <input
                    type="checkbox"
                    checked={archivePreviousCoverOnReplace}
                    onChange={(e) => setArchivePreviousCoverOnReplace(e.target.checked)}
                    className="mt-1 w-4 h-4 shrink-0 rounded border-slate-600 bg-slate-800 text-red-600 focus:ring-red-500"
                  />
                  <span>
                    <span className="text-sm font-medium text-white block">Keep previous cover in archive</span>
                    <span className="text-xs text-slate-500 leading-snug block mt-1">
                      Saves the current file(s) when you replace them—useful if the old artwork may still show on DSPs. You can download archived covers from the cover menu anytime.
                    </span>
                  </span>
                </label>
              ) : null}
              
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIsDragging(true)
                }}
                onDragLeave={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIsDragging(false)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIsDragging(false)
                  
                  const file = e.dataTransfer.files?.[0] || null
                  if (file) {
                    handleFileSelection(file)
                  }
                }}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                  isDragging
                    ? 'border-red-500 bg-red-500/10'
                    : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
                }`}
              >
                {previewUrl && coverUploadFile ? (
                  <div className="space-y-4">
                    {isMotionCover ? (
                      <video
                        src={previewUrl}
                        className="w-full max-h-48 object-cover rounded-lg border border-slate-700 mx-auto"
                        controls
                        autoPlay
                        loop
                        muted
                        playsInline
                        onError={(e) => {
                          console.error('Preview video failed to load')
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="w-full max-h-48 object-cover rounded-lg border border-slate-700 mx-auto"
                        onError={(e) => {
                          console.error('Preview image failed to load')
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    )}
                    <div className="text-sm text-slate-300">
                      <p className="font-medium">{coverUploadFile.name}</p>
                      <p className="text-slate-400">
                        {((coverUploadFile.size / 1024 / 1024).toFixed(2))} MB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (previewUrl) {
                          URL.revokeObjectURL(previewUrl)
                        }
                        setPreviewUrl(null)
                        setCoverUploadFile(null)
                      }}
                      className="text-sm text-red-400 hover:text-red-300 underline"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center">
                      {isMotionCover ? (
                        <Video className="w-12 h-12 text-slate-400 mb-3" />
                      ) : (
                        <ImageIcon className="w-12 h-12 text-slate-400 mb-3" />
                      )}
                      <p className="text-slate-300 font-medium mb-1">
                        {isDragging ? 'Drop file here' : 'Drag and drop your file here'}
                      </p>
                      <p className="text-sm text-slate-400 mb-4">
                        {isMotionCover
                          ? 'Video (MP4, MOV, M4V, WebM, …). Large files can take several minutes to upload.'
                          : 'Cover Image (JPG, PNG, WebP, GIF)'}
                      </p>
                      <label className="cursor-pointer">
                        <span className="inline-block bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-6 rounded-lg transition">
                          Browse Files
                        </span>
                        <input
                          type="file"
                          accept={isMotionCover ? 'video/*' : 'image/jpeg,image/jpg,image/png,image/webp,image/gif'}
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null
                            if (file) {
                              handleFileSelection(file)
                            }
                            // Reset input value to allow selecting the same file again
                            e.target.value = ''
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {isUploadingCover && (
              <div className="mb-4 w-full space-y-2 rounded-xl border border-white/10 bg-black/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <span className="font-medium text-slate-300">
                    Uploading{isMotionCover ? ' motion cover' : ' cover'}…
                  </span>
                  <span className="font-mono tabular-nums text-slate-200">
                    {uploadByteProgress && uploadByteProgress.total > 0
                      ? `${formatBytes(uploadByteProgress.loaded)} / ${formatBytes(uploadByteProgress.total)}`
                      : uploadByteProgress && uploadByteProgress.loaded > 0
                        ? `${formatBytes(uploadByteProgress.loaded)} sent`
                        : 'Preparing…'}
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-red-600 via-red-500 to-orange-400 transition-[width] duration-200 ease-out"
                    style={{ width: `${Math.min(100, Math.max(2, uploadProgress))}%` }}
                  />
                </div>
                <p className="text-center text-[0.7rem] font-medium text-slate-500">
                  {Math.round(uploadProgress)}% — keep this tab open until finished
                </p>
              </div>
            )}

            <div className="flex space-x-3">
              {song.albumCover && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!song.albumCover) return
                    try {
                      const imageUrl = getAbsoluteUrl(song.albumCover)
                      const response = await fetch(imageUrl)
                      const blob = await response.blob()
                      const url = window.URL.createObjectURL(blob)
                      const link = document.createElement('a')
                      link.href = url
                      // Extract filename from URL or use song name
                      const urlPath = song.albumCover.split('/').pop() || `${song.song}_cover`
                      link.download = urlPath
                      document.body.appendChild(link)
                      link.click()
                      document.body.removeChild(link)
                      window.URL.revokeObjectURL(url)
                    } catch (error) {
                      console.error('Failed to download album cover:', error)
                      alert('Failed to download album cover')
                    }
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Cover
                </button>
              )}
              <button
                onClick={handleUploadAlbumCover}
                disabled={!coverUploadFile || isUploadingCover}
                className={`${song.albumCover ? 'flex-1' : 'flex-1'} bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition`}
              >
                {isUploadingCover ? (
                  <span className="relative z-10">Uploading…</span>
                ) : (
                  'Upload Cover'
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  // Clean up preview URL
                  if (previewUrl) {
                    URL.revokeObjectURL(previewUrl)
                    setPreviewUrl(null)
                  }
                  setShowCoverUpload(false)
                  setCoverUploadFile(null)
                  setIsMotionCover(false)
                  setIsDragging(false)
                  setUploadByteProgress(null)
                  setUploadProgress(0)
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Song Credits Modal */}
      {showSongCreditsModal && selectedTrackForCredits && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-4">
              {editingSongCredit ? 'Edit Credit' : 'Add Credit'}
              {song?.songs?.find(t => t.id === selectedTrackForCredits) && (
                <span className="text-sm text-slate-400 ml-2 block mt-1">
                  for &quot;{song.songs.find(t => t.id === selectedTrackForCredits)?.song}&quot;
                </span>
              )}
            </h2>
            <form onSubmit={(e) => {
              e.preventDefault()
              handleSaveSongCredit()
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Role *
                </label>
                <select
                  value={creditFormData.role}
                  onChange={(e) => {
                    setCreditFormData({ ...creditFormData, role: e.target.value as any })
                  }}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                >
                  <option value="producer">Producer</option>
                  <option value="engineer">Engineer</option>
                  <option value="writer">Writer</option>
                  <option value="publisher">Publisher</option>
                  <option value="mixer">Mixer</option>
                  <option value="mastering">Mastering Engineer</option>
                  <option value="other">Other</option>
                </select>
              </div>
              {creditFormData.role === 'other' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Custom Role *
                  </label>
                  <input
                    type="text"
                    value={creditFormData.customRole}
                    onChange={(e) => setCreditFormData({ ...creditFormData, customRole: e.target.value })}
                    placeholder="e.g., Featured Artist, Co-Producer"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    required
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  value={creditFormData.name}
                  onChange={(e) => setCreditFormData({ ...creditFormData, name: e.target.value })}
                  placeholder="Enter name"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  IPI Number (optional)
                </label>
                <input
                  type="text"
                  value={creditFormData.ipi}
                  onChange={(e) => setCreditFormData({ ...creditFormData, ipi: e.target.value })}
                  placeholder="Enter IPI number"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  {editingSongCredit ? 'Update Credit' : 'Add Credit'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSongCreditsModal(false)
                    setEditingSongCredit(null)
                    setSelectedTrackForCredits(null)
                    setCreditFormData({ role: 'producer', name: '', ipi: '', customRole: '', adminNotes: '' })
                  }}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Route to Artist Modal */}
      {showRouteArtistModal && song && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
              <Route className="w-5 h-5" />
              Route song to artist
            </h2>
            <p className="text-slate-400 text-sm mb-4">
              Assign &quot;{song.song}&quot; to an artist for catalog and analytics. The release will continue to display as &quot;{song.artist}&quot;.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">Artist to route to</label>
              <select
                value={routeArtistSelectedId}
                onChange={(e) => setRouteArtistSelectedId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">Select artist...</option>
                {artistsForRoute.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.artistName || a.name}
                  </option>
                ))}
              </select>
            </div>

            {routeArtistSelectedId && (() => {
              const selected = artistsForRoute.find((a) => a.id === routeArtistSelectedId)
              const displayName = (selected?.artistName || selected?.name || '').trim()
              const releaseArtist = (song.artist || '').toLowerCase()
              const selectedNameLower = displayName.toLowerCase()
              const nameNotInRelease = displayName && !releaseArtist.includes(selectedNameLower)
              return (
                <>
                  {nameNotInRelease && (
                    <div className="mb-4 p-3 bg-amber-500/20 border border-amber-500/50 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-amber-200 text-sm">
                        <strong>{displayName}</strong> does not appear in the release credits (&quot;{song.artist}&quot;). Confirm you are routing to the correct artist.
                      </p>
                    </div>
                  )}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Type &quot;{displayName}&quot; to confirm
                    </label>
                    <input
                      type="text"
                      value={routeArtistConfirmText}
                      onChange={(e) => setRouteArtistConfirmText(e.target.value)}
                      placeholder={displayName}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      autoComplete="off"
                    />
                  </div>
                </>
              )
            })()}

            <div className="flex space-x-3">
              <button
                onClick={handleRouteToArtist}
                disabled={!routeArtistSelectedId || isRoutingArtist || routeArtistConfirmText.trim().toLowerCase() !== (artistsForRoute.find((a) => a.id === routeArtistSelectedId)?.artistName || artistsForRoute.find((a) => a.id === routeArtistSelectedId)?.name || '').trim().toLowerCase()}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                {isRoutingArtist ? 'Routing...' : 'Confirm & route'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowRouteArtistModal(false)
                  setRouteArtistSelectedId('')
                  setRouteArtistConfirmText('')
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Additional Information Modal */}
      {showAdditionalInfoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <h2 className="text-2xl font-bold text-white mb-4 flex-shrink-0">Additional Information</h2>
            <div className="flex-1 overflow-y-auto mb-4">
              <textarea
                value={additionalInfoText}
                onChange={(e) => setAdditionalInfoText(e.target.value)}
                placeholder="Enter any additional information, notes, or details about this release..."
                rows={12}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
            </div>
            <div className="flex space-x-3 flex-shrink-0">
              <button
                onClick={async () => {
                  if (!song) return
                  setIsSavingAdditionalInfo(true)
                  try {
                    const res = await fetch('/api/catalog', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        id: songId,
                        additionalInfo: additionalInfoText.trim() || undefined,
                        userRole: user?.role,
                        userId: user?.id,
                        userName: user?.name,
                      }),
                    })
                    const data = await res.json()
                    if (data.success) {
                      setShowAdditionalInfoModal(false)
                      fetchSongData()
                    } else {
                      alert(data.error || 'Failed to save additional information')
                    }
                  } catch (error: any) {
                    console.error('Failed to save additional information:', error)
                    alert('Failed to save additional information')
                  } finally {
                    setIsSavingAdditionalInfo(false)
                  }
                }}
                disabled={isSavingAdditionalInfo}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                {isSavingAdditionalInfo ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAdditionalInfoModal(false)
                  setAdditionalInfoText(song?.additionalInfo || '')
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Promotional Notes Modal */}
      {showPromoNotesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <h2 className="text-2xl font-bold text-white mb-4 flex-shrink-0">Promotional Plans & Notes</h2>
            <div className="flex-1 overflow-y-auto mb-4">
              <textarea
                value={promoNotesText}
                onChange={(e) => setPromoNotesText(e.target.value)}
                placeholder="Enter promotional plans, marketing strategies, social media plans, press release ideas, etc..."
                rows={12}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
            </div>
            <div className="flex space-x-3 flex-shrink-0">
              <button
                onClick={handleSavePromoNotes}
                disabled={isSavingPromoNotes}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                {isSavingPromoNotes ? 'Saving...' : 'Save Notes'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPromoNotesModal(false)
                  setPromoNotesText(song?.promoNotes || '')
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credits Modal */}
      {showCreditsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold text-white mb-4">
              {editingCredit ? 'Edit Credit' : 'Add Credit'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Role *</label>
                <select
                  value={creditFormData.role}
                  onChange={(e) => setCreditFormData({ ...creditFormData, role: e.target.value as any })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                >
                  <option value="producer">Producer</option>
                  <option value="engineer">Engineer</option>
                  <option value="writer">Writer</option>
                  <option value="publisher">Publisher</option>
                  <option value="mixer">Mixer</option>
                  <option value="mastering">Mastering Engineer</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {creditFormData.role === 'other' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Custom Role *</label>
                  <input
                    type="text"
                    value={creditFormData.customRole}
                    onChange={(e) => setCreditFormData({ ...creditFormData, customRole: e.target.value })}
                    placeholder="e.g., Featured Artist, Vocalist, etc."
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    required={creditFormData.role === 'other'}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Name *</label>
                <input
                  type="text"
                  value={creditFormData.name}
                  onChange={(e) => setCreditFormData({ ...creditFormData, name: e.target.value })}
                  placeholder="Enter name"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">IPI Number (for publishing)</label>
                <input
                  type="text"
                  value={creditFormData.ipi}
                  onChange={(e) => setCreditFormData({ ...creditFormData, ipi: e.target.value })}
                  placeholder="Enter IPI number (optional)"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              {canManageItem(song) && (
                <div className="opacity-60 hover:opacity-100 transition-opacity">
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Admin Notes (hidden)
                    <span className="text-xs text-slate-500 ml-2">e.g., &quot;Style One (Crystal Marie Ashley on MLC)&quot;</span>
                  </label>
                  <input
                    type="text"
                    value={creditFormData.adminNotes}
                    onChange={(e) => setCreditFormData({ ...creditFormData, adminNotes: e.target.value })}
                    placeholder="Internal notes (not displayed publicly)"
                    className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handleSaveCredit}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  {editingCredit ? 'Update Credit' : 'Add Credit'}
                </button>
                <button
                  onClick={() => {
                    setShowCreditsModal(false)
                    setEditingCredit(null)
                    setCreditFormData({ role: 'producer', name: '', ipi: '', customRole: '', adminNotes: '' })
                  }}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Account Creation Prompt Modal */}
      {showCreateAccountPrompt && pendingCreditData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold text-white mb-4">Create Account?</h2>
            <p className="text-slate-300 mb-6">
              &quot;{pendingCreditData.name}&quot; doesn&apos;t have an account yet. Would you like to create one?
              {pendingCreditData.ipi && (
                <span className="block mt-2 text-sm text-slate-400">
                  IPI Number: {pendingCreditData.ipi}
                </span>
              )}
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => handleCreateAccountForCredit(true)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                Yes, Create Account
              </button>
              <button
                onClick={() => handleCreateAccountForCredit(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                No, Just Add Credit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Music Video Section - At the bottom */}
      {song.musicVideo && (
        <div className="mt-12 mb-8">
          <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
            <h2 className="text-2xl font-semibold text-white mb-4 flex items-center space-x-2">
              <Play className="w-6 h-6" />
              <span>Music Video</span>
            </h2>
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}> {/* 16:9 aspect ratio */}
              <video
                src={getAbsoluteUrl(song.musicVideo)}
                className="absolute top-0 left-0 w-full h-full rounded-lg"
                controls
                autoPlay
                muted
                playsInline
                onError={(e) => {
                  console.error('Failed to load music video:', song.musicVideo)
                  alert('Failed to load music video')
                }}
              />
            </div>
            {canManageItem(song) && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to remove the music video?')) {
                      // TODO: Add delete functionality
                      alert('Delete functionality coming soon')
                    }
                  }}
                  className="text-sm text-red-400 hover:text-red-300 transition"
                >
                  Remove Video
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Music Video Upload Button - Show if no video exists */}
      {!song.musicVideo && canManageItem(song) && (
        <div className="mt-12 mb-8">
          <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
            <h2 className="text-2xl font-semibold text-white mb-4 flex items-center space-x-2">
              <Play className="w-6 h-6" />
              <span>Music Video</span>
            </h2>
            <button
              onClick={() => setShowMusicVideoUpload(true)}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition flex items-center justify-center gap-2"
            >
              <Upload className="w-5 h-5" />
              Upload Music Video
            </button>
          </div>
        </div>
      )}

      {/* Music Video Upload Modal */}
      {showMusicVideoUpload && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold text-white mb-4">Upload Music Video</h2>
            <p className="text-sm text-slate-400 mb-4">
              Full music videos are large. Uploads can take several minutes; keep this tab open until it finishes.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Video (MP4, MOV, M4V, WebM, …)
                </label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setMusicVideoUploadFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              {musicVideoUploadFile && (
                <div className="mb-4">
                  <p className="text-sm text-slate-400 mb-2">Preview:</p>
                  <video
                    src={URL.createObjectURL(musicVideoUploadFile)}
                    className="w-full max-h-48 object-cover rounded-lg border border-slate-700"
                    controls
                  />
                </div>
              )}

              {isUploadingMusicVideo && (
                <div className="mb-4 w-full space-y-2 rounded-xl border border-white/10 bg-black/50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                    <span className="font-medium text-slate-300">Uploading music video…</span>
                    <span className="font-mono tabular-nums text-slate-200">
                      {uploadByteProgress && uploadByteProgress.total > 0
                        ? `${formatBytes(uploadByteProgress.loaded)} / ${formatBytes(uploadByteProgress.total)}`
                        : uploadByteProgress && uploadByteProgress.loaded > 0
                          ? `${formatBytes(uploadByteProgress.loaded)} sent`
                          : 'Preparing…'}
                    </span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-red-600 via-red-500 to-orange-400 transition-[width] duration-200 ease-out"
                      style={{ width: `${Math.min(100, Math.max(2, uploadProgress))}%` }}
                    />
                  </div>
                  <p className="text-center text-[0.7rem] font-medium text-slate-500">
                    {Math.round(uploadProgress)}% — keep this tab open until finished
                  </p>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={handleUploadMusicVideo}
                  disabled={!musicVideoUploadFile || isUploadingMusicVideo}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  {isUploadingMusicVideo ? 'Uploading…' : 'Upload Video'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMusicVideoUpload(false)
                    setMusicVideoUploadFile(null)
                    setUploadByteProgress(null)
                    setUploadProgress(0)
                  }}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

