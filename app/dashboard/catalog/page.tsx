'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatLocalDate, formatLocalDateString } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { Music, TrendingUp, Calendar, Play, Plus, Trash2, Edit, Link as LinkIcon, Clipboard, Check, Search, ChevronDown, ChevronUp, List, ArrowUp, ArrowDown, GripVertical, X, AlertCircle, Archive, ArchiveRestore, ExternalLink } from 'lucide-react'
import { findExistingCollaboration, parseArtistsFromString, matchArtistsToUsers } from '@/lib/artistParser'

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

interface CatalogItem {
  id: string
  song: string
  artist: string
  artistId?: string
  artistIds?: string[]
  releaseType: 'single' | 'ep' | 'album'
  releaseDate?: string
  releaseDateRequested?: string
  releaseApprovalStatus?: 'pending' | 'approved' | 'denied'
  releaseApprovalNotes?: string
  isDelayed?: boolean
  delayReason?: string
  totalStreams: number
  distributor?: string
  platforms?: string[]
  manuallyAdded: boolean
  googleDriveUrl?: string
  fileUrl?: string
  upc?: string
  isrc?: string
  albumCover?: string
  fromCSV?: boolean
  isUnreleased?: boolean
  vaultFileId?: string
  sentToEmpireAt?: string
  isArchived?: boolean
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
  readinessTags?: {
    energy?: 'low' | 'medium' | 'high'
    emotion?: 'pain' | 'praise' | 'flex' | 'healing' | 'celebration' | 'reflection' | 'motivation' | 'other'
    lane?: 'underground' | 'regional' | 'faith' | 'creative' | 'inspirational'
    contentFit?: 'snippet-ready' | 'visual-heavy' | 'story-driven' | 'viral-potential' | 'deep-listening'
    triggerReady?: boolean
    triggerReadyAt?: string
    triggerReadyReason?: string
  }
}

export default function CatalogPage() {
  const { user, staffViewMode = 'artist' } = useAuth()
  const isStaff = user?.role === 'artist' && Array.isArray(user?.staffPermissions) && user.staffPermissions.length > 0
  // Staff can view catalog but request changes to owner - they cannot edit directly
  const canManage = user?.role === 'admin' || user?.role === 'manager'
  const canRequestChange = isStaff && staffViewMode === 'staff'
  
  // Helper function to check if a user can manage (edit) a specific catalog item
  // Staff cannot edit - they request changes to owner instead
  const canManageItem = (item: CatalogItem): boolean => {
    if (!user) return false
    if (user.role === 'admin') return true
    if (user.role === 'manager') {
      const linkedIds = user.linkedArtistIds || []
      if (item.artistId && linkedIds.includes(item.artistId)) return true
      if (item.artistIds && item.artistIds.some(id => linkedIds.includes(id))) return true
      return false
    }
    // Staff: cannot edit directly - they use Request Change
    return false
  }
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [filteredCatalog, setFilteredCatalog] = useState<CatalogItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOrder, setSortOrder] = useState<'name' | 'genre' | 'artist-preference' | 'date'>('date')
  const [statusFilter, setStatusFilter] = useState<string>('') // upcoming | active | completed | archived
  const [artistFilter, setArtistFilter] = useState<string>('')
  const [showAllItems, setShowAllItems] = useState(true) // Always show all items
  const [artistPreferences, setArtistPreferences] = useState<{ preferredGenres?: string[]; lane?: string }>({})
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showBulkImportModal, setShowBulkImportModal] = useState(false)
  const [showAudioUploadModal, setShowAudioUploadModal] = useState(false)
  const [audioUploadData, setAudioUploadData] = useState({
    file: null as File | null,
    songName: '',
    releaseDate: '',
  })
  const [isUploadingAudio, setIsUploadingAudio] = useState(false)
  const [pastedData, setPastedData] = useState('')
  const [parsedData, setParsedData] = useState<any[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [isFetchingDocs, setIsFetchingDocs] = useState(false)
  const [columnMapping, setColumnMapping] = useState<Record<string, number | null>>({
    song: null,
    artist: null,
    releaseType: null,
    releaseDate: null,
    distributor: null,
    upc: null,
    isrc: null,
    googleDoc: null,
    songLinks: null,
  })
  const [detectedColumns, setDetectedColumns] = useState<string[]>([])
  const [showMappingStep, setShowMappingStep] = useState(false)
  const [sampleRow, setSampleRow] = useState<string[]>([])
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null)
  const [users, setUsers] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([]) // Store all users for manager filtering
  const [formData, setFormData] = useState({
    song: '',
    artist: '',
    artistId: '',
    artistIds: [] as string[],
    releaseType: 'single' as 'single' | 'ep' | 'album',
    releaseDate: '',
    distributor: '',
    file: null as File | null,
    upc: '',
    isrc: '',
    selectedSongIds: [] as string[], // For album/EP song selection
  })
  const [isUploading, setIsUploading] = useState(false)
  const [showSongsModal, setShowSongsModal] = useState(false)
  const [selectedRelease, setSelectedRelease] = useState<CatalogItem | null>(null)
  const [releaseSongs, setReleaseSongs] = useState<Array<{ id: string; song: string; isrc?: string; streams?: number }>>([])
  const [editingISRC, setEditingISRC] = useState<string | null>(null)
  const [editingISRCValue, setEditingISRCValue] = useState('')
  const [editingStreams, setEditingStreams] = useState<string | null>(null)
  const [editingStreamsValue, setEditingStreamsValue] = useState('')
  const [showCollaborativeModal, setShowCollaborativeModal] = useState(false)
  const [selectedCollaborativeSong, setSelectedCollaborativeSong] = useState<CatalogItem | null>(null)
  const [collaborativePrimaryUserId, setCollaborativePrimaryUserId] = useState<string>('')
  const [editingSongStreams, setEditingSongStreams] = useState<string | null>(null)
  const [editingSongStreamsValue, setEditingSongStreamsValue] = useState('')
  const [newSongName, setNewSongName] = useState('')
  const [newSongISRC, setNewSongISRC] = useState('')
  const [showSongSelector, setShowSongSelector] = useState(false)
  const [selectedSongIds, setSelectedSongIds] = useState<Set<string>>(new Set())
  const [expandedAlbums, setExpandedAlbums] = useState<Set<string>>(new Set())
  const [checklistPercentages, setChecklistPercentages] = useState<Record<string, number>>({})
  const [songVaultFiles, setSongVaultFiles] = useState<Record<string, any[]>>({}) // songId -> vault files
  const [addingToAlbum, setAddingToAlbum] = useState<string | null>(null)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null)
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null)
  const [showCombineModal, setShowCombineModal] = useState(false)
  const [addModalSuggestedExample, setAddModalSuggestedExample] = useState<any>(null)
  const [showRequestChangeModal, setShowRequestChangeModal] = useState(false)
  const [requestChangeItem, setRequestChangeItem] = useState<CatalogItem | null>(null)
  const [requestChangeText, setRequestChangeText] = useState('')
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false)
  // Staff users default to full label view in Staff mode; in Artist mode they see their artist catalog view.
  const showFullCatalog = isStaff && staffViewMode === 'staff'

  useEffect(() => {
    fetchCatalog()
    fetchUsers() // Always fetch users (needed for manager filtering)
    fetchChecklistPercentages()
  }, [staffViewMode, statusFilter]) // Refetch when mode or status filter changes (artist filter uses blur/Enter)

  // Auto-suggest past campaign example when adding new song
  useEffect(() => {
    if (!showAddModal || !formData.artistIds?.length) {
      setAddModalSuggestedExample(null)
      return
    }
    const artistId = formData.artistIds[0]
    fetch(`/api/campaign-blueprint/recommend?artistId=${encodeURIComponent(artistId)}`)
      .then((r) => r.json())
      .then((d) => setAddModalSuggestedExample(d))
      .catch(() => setAddModalSuggestedExample(null))
  }, [showAddModal, formData.artistIds])

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

  const fetchChecklistPercentages = async () => {
    try {
      const isStaff = user?.role === 'artist' && Array.isArray(user?.staffPermissions) && user.staffPermissions.length > 0
      const shouldScope = (user?.role === 'manager' || (isStaff && !showFullCatalog)) && user?.id
      const scopeParam = shouldScope ? `?userId=${encodeURIComponent(user.id)}` : ''
      const catalogRes = await fetch(`/api/catalog${scopeParam}`)
      const catalogData = await catalogRes.json()
      if (catalogData.success) {
        const percentages: Record<string, number> = {}
        // Batch requests with Promise.allSettled to prevent blocking
        const results = await Promise.allSettled(
          catalogData.catalog.slice(0, 50).map(async (item: CatalogItem) => {
            try {
              const res = await fetch(`/api/checklist?songId=${item.id}`)
              const data = await res.json()
              if (data.success && data.items) {
                const mandatoryItems = data.items.filter((i: any) => i.category === 'mandatory')
                const completedMandatory = mandatoryItems.filter((i: any) => i.completed).length
                const totalMandatory = mandatoryItems.length
                percentages[item.id] = totalMandatory > 0 ? Math.round((completedMandatory / totalMandatory) * 100) : 0
              }
            } catch (error) {
              // Skip if checklist doesn't exist
            }
          })
        )
        setChecklistPercentages(percentages)
        // Load remaining items in background
        if (catalogData.catalog.length > 50) {
          setTimeout(() => {
            Promise.allSettled(
              catalogData.catalog.slice(50).map(async (item: CatalogItem) => {
                try {
                  const res = await fetch(`/api/checklist?songId=${item.id}`)
                  const data = await res.json()
                  if (data.success && data.items) {
                    const mandatoryItems = data.items.filter((i: any) => i.category === 'mandatory')
                    const completedMandatory = mandatoryItems.filter((i: any) => i.completed).length
                    const totalMandatory = mandatoryItems.length
                    setChecklistPercentages(prev => ({
                      ...prev,
                      [item.id]: totalMandatory > 0 ? Math.round((completedMandatory / totalMandatory) * 100) : 0
                    }))
                  }
                } catch (error) {
                  // Skip if checklist doesn't exist
                }
              })
            )
          }, 1000)
        }
      }
    } catch (error) {
      console.error('Failed to fetch checklist percentages:', error)
    }
  }

  const fetchVaultFilesForSong = async (songId: string) => {
    try {
      const res = await fetch(`/api/song-vault?songId=${songId}`)
      const data = await res.json()
      if (data.success) {
        setSongVaultFiles(prev => ({ ...prev, [songId]: data.files }))
      }
    } catch (error) {
      console.error('Failed to fetch vault files:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      if (data.success) {
        // Store all users for manager filtering logic
        setAllUsers(data.users)
        // Include both artists and managers in the user list for linking dropdown
        // Managers can also be linked as artists (e.g., "Meezy (Miles)")
        setUsers(data.users.filter((u: any) => u.role === 'artist' || u.role === 'manager'))
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  const handleSetCollaborativeAccount = (item: CatalogItem) => {
    // Check if there's an existing mapping
    fetch(`/api/collaborative-songs?songName=${encodeURIComponent(item.song)}&artistString=${encodeURIComponent(item.artist)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.mappings && data.mappings.length > 0) {
          const existing = data.mappings.find((m: any) => 
            m.songName.toLowerCase() === item.song.toLowerCase() &&
            m.artistString.toLowerCase() === item.artist.toLowerCase()
          )
          if (existing) {
            setCollaborativePrimaryUserId(existing.primaryUserId)
          }
        }
        setSelectedCollaborativeSong(item)
        setShowCollaborativeModal(true)
      })
      .catch(err => {
        console.error('Failed to fetch collaborative mappings:', err)
        setSelectedCollaborativeSong(item)
        setShowCollaborativeModal(true)
      })
  }

  const handleSaveCollaborativeAccount = async () => {
    if (!selectedCollaborativeSong || !collaborativePrimaryUserId) return

    try {
      const res = await fetch('/api/collaborative-songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          songName: selectedCollaborativeSong.song,
          artistString: selectedCollaborativeSong.artist,
          primaryUserId: collaborativePrimaryUserId,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setShowCollaborativeModal(false)
        setSelectedCollaborativeSong(null)
        setCollaborativePrimaryUserId('')
        // Refresh catalog to show updated data
        fetchCatalog()
      } else {
        alert('Failed to save: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to save collaborative account:', error)
      alert('Failed to save collaborative account')
    }
  }

  // Update artist preferences when user changes
  useEffect(() => {
    if (user) {
      setArtistPreferences({
        preferredGenres: (user as any).preferredGenres || [],
        lane: (user as any).lane,
      })
    }
  }, [user])

  const fetchCatalog = async () => {
    setIsLoading(true)
    // Fetch users if manager (needed for linked artists filtering)
    const isStaff = user?.role === 'artist' && Array.isArray(user?.staffPermissions) && user.staffPermissions.length > 0
    if (user?.role === 'manager') {
      fetchUsers()
    }
    try {
      // Fetch both manual catalog entries and CSV data, plus unreleased vault songs
      // Use autoLink=true to automatically link catalog items to artist accounts
      // Staff users can toggle between scoped view (their managed artists) and full catalog view
      // Include archived items for admins and staff viewing full catalog
      // Admins always see full catalog with all items
      const isAdmin = user?.role === 'admin'
      const shouldScope = (user?.role === 'manager' || (isStaff && !showFullCatalog)) && user?.id && !isAdmin
      const scopeParam = shouldScope ? `&userId=${encodeURIComponent(user.id)}` : ''
      // Always include archived for admins, or for staff viewing full catalog
      const includeArchived = (isAdmin || (isStaff && showFullCatalog)) ? '&includeArchived=true' : ''
      const statusParam = statusFilter ? `&status=${encodeURIComponent(statusFilter)}` : ''
      const artistParam = artistFilter ? `&artist=${encodeURIComponent(artistFilter)}` : ''
      console.log(`[Catalog] Fetching - isAdmin: ${isAdmin}, shouldScope: ${shouldScope}, scopeParam: ${scopeParam}, includeArchived: ${includeArchived}`)
      const [catalogRes, artistsRes, vaultRes] = await Promise.all([
        fetch(`/api/catalog?autoLink=true${scopeParam}${includeArchived}${statusParam}${artistParam}`),
        fetch('/api/get-artists'),
        fetch('/api/song-vault'),
      ])

      const catalogData = await catalogRes.json()
      const artistsData = await artistsRes.json()

      console.log(`[Catalog] API returned ${catalogData.catalog?.length || 0} items`)

      const catalogMap = new Map<string, CatalogItem>()

      // Add manual entries
      if (catalogData.success && catalogData.catalog) {
        catalogData.catalog.forEach((item: CatalogItem) => {
          // Validate item has required fields
          if (!item || !item.id || !item.song || !item.artist) {
            console.warn('Skipping invalid catalog item:', item)
            return
          }
          
          // IMPORTANT:
          // Do NOT key by `${song}-${artist}` because different release types can share the same title
          // (e.g., a single and an EP with the same name). Using the item id prevents accidental
          // "deletes" (actually merges/overwrites) in the UI.
          catalogMap.set(item.id, item)
        })
      }
      
      console.log(`[Catalog] Added ${catalogMap.size} items to catalog map`)

      // Merge with CSV data
      if (artistsData.success && artistsData.artists) {
        artistsData.artists.forEach((artist: any) => {
          artist.songs.forEach((song: any) => {
            const key = `${song.name}-${artist.name}`
            // Check if this song is already in an album/EP before adding as CSV entry
            const isInAlbum = catalogData.catalog?.some((item: CatalogItem) => {
              if ((item.releaseType === 'album' || item.releaseType === 'ep') && item.songs) {
                return item.songs.some((albumSong: any) => 
                  albumSong.song.toLowerCase().trim() === song.name.toLowerCase().trim() &&
                  item.artist.toLowerCase().trim() === artist.name.toLowerCase().trim()
                )
              }
              return false
            })
            
            // Skip CSV entries that are already in albums/EPs
            if (isInAlbum) {
              return
            }
            
            // Don't auto-add CSV songs to catalog - only show manually added items
            // CSV data is available through artist data API but shouldn't clutter catalog
          })
        })
      }

      let mergedCatalog = Array.from(catalogMap.values())
      
      // Filter out songs that are part of albums/EPs - they should only appear under the album
      const albumsAndEPs = mergedCatalog.filter(item => 
        (item.releaseType === 'album' || item.releaseType === 'ep') && 
        item.songs && 
        item.songs.length > 0
      )
      
      // Create a set of song names that belong to albums/EPs (by artist)
      const songsInAlbums = new Set<string>()
      albumsAndEPs.forEach(album => {
        album.songs?.forEach(song => {
          // Use song name + artist as the key to avoid false matches
          const key = `${song.song.toLowerCase().trim()}-${album.artist.toLowerCase().trim()}`
          songsInAlbums.add(key)
        })
      })
      
      // Don't filter out singles that are part of albums/EPs - allow them to show in both places
      // Users may want to see singles separately even if they're also on an album/EP
      // mergedCatalog = mergedCatalog.filter(item => {
      //   // Keep albums and EPs
      //   if (item.releaseType === 'album' || item.releaseType === 'ep') {
      //     return true
      //   }
      //   
      //   // For singles, check if they're part of an album/EP
      //   const songKey = `${item.song.toLowerCase().trim()}-${item.artist.toLowerCase().trim()}`
      //   return !songsInAlbums.has(songKey)
      // })
      
      // Don't filter out pending items - show all items including pending
      // The API already filters out denied items, so we don't need to filter here
      // This ensures all catalog items are visible
      
      // Filter by artist if user is an artist (but not if staff user viewing full catalog)
      if (user?.role === 'artist' && !(isStaff && showFullCatalog)) {
        mergedCatalog = mergedCatalog.filter(item => {
          // Match by artistIds array (for collaborations)
          const itemArtistIds = item.artistIds || (item.artistId ? [item.artistId] : [])
          if (itemArtistIds.includes(user.id)) return true
          
          if (item.songs?.some((t: any) => Array.isArray(t.featuredArtistIds) && t.featuredArtistIds.includes(user.id))) {
            return true
          }
          
          // Match by artistId if available (most reliable) - backwards compatibility
          if (item.artistId && item.artistId === user.id) return true
          
          // Match by artist name - check all possible name variations
          const itemArtist = item.artist.toLowerCase().trim()
          const userName = user.name?.toLowerCase().trim() || ''
          const artistName = user.artistName?.toLowerCase().trim() || ''
          const realName = user.realName?.toLowerCase().trim() || ''
          const aliases = (user.aliases || []).map(a => a.toLowerCase().trim())
          
          // Helper function to check if names match
          const namesMatch = (name1: string, name2: string): boolean => {
            if (!name1 || !name2) return false
            
            // Exact match
            if (name1 === name2) return true
            
            // Normalized match (remove special chars)
            const normalize = (str: string) => str.replace(/[^a-z0-9]/g, '')
            if (normalize(name1) === normalize(name2)) return true
            
            return false
          }
          
          // Check against user.name
          if (userName && namesMatch(itemArtist, userName)) return true
          
          // Check against artistName
          if (artistName && namesMatch(itemArtist, artistName)) return true
          
          // Check against realName
          if (realName && namesMatch(itemArtist, realName)) return true
          
          // Check against aliases
          for (const alias of aliases) {
            if (namesMatch(itemArtist, alias)) return true
          }
          
          return false
        })
      }
      
      // Filter for managers - show their linked artists' catalog items
      if (user?.role === 'manager') {
        // Fetch full user data to get linkedArtistIds (AuthContext user might not have it)
        const fullUserData = allUsers.find(u => u.id === user.id)
        const linkedArtistIds = fullUserData?.linkedArtistIds || []
        
        if (linkedArtistIds.length > 0) {
          mergedCatalog = mergedCatalog.filter(item => {
            // Match by artistIds array (for collaborations)
            const itemArtistIds = item.artistIds || (item.artistId ? [item.artistId] : [])
            
            // Check if any of the linked artist IDs match this catalog item
            const hasLinkedArtist = linkedArtistIds.some((linkedId: string) => 
              itemArtistIds.includes(linkedId) || item.artistId === linkedId
            )
            
            if (hasLinkedArtist) return true

            const hasLinkedFeatured = item.songs?.some((t: any) =>
              Array.isArray(t.featuredArtistIds) &&
              t.featuredArtistIds.some((fid: string) => linkedArtistIds.includes(fid))
            )
            if (hasLinkedFeatured) return true
            
            // Also check by artist name for linked artists (fallback)
            if (item.artist && allUsers.length > 0) {
              const linkedUsers = allUsers.filter(u => linkedArtistIds.includes(u.id))
              for (const linkedUser of linkedUsers) {
                const itemArtist = item.artist.toLowerCase().trim()
                const linkedUserName = linkedUser.name?.toLowerCase().trim() || ''
                const linkedArtistName = linkedUser.artistName?.toLowerCase().trim() || ''
                
                if (itemArtist === linkedUserName || itemArtist === linkedArtistName) {
                  return true
                }
              }
            }
            
            return false
          })
        }
      }
      
      // Sort catalog by release date (oldest to newest), then by streams if no date
      const sortedCatalog = [...mergedCatalog].sort((a, b) => {
        const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : (a.releaseDateRequested ? new Date(a.releaseDateRequested).getTime() : 0)
        const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : (b.releaseDateRequested ? new Date(b.releaseDateRequested).getTime() : 0)
        
        // If both have dates, sort by date (oldest first)
        if (dateA > 0 && dateB > 0) {
          return dateA - dateB
        }
        // If only one has a date, prioritize it
        if (dateA > 0 && dateB === 0) return -1
        if (dateB > 0 && dateA === 0) return 1
        // If neither has a date, sort by streams (lowest first) as fallback
        return a.totalStreams - b.totalStreams
      })
      console.log(`[Catalog] Loaded ${sortedCatalog.length} items (${mergedCatalog.length} before sorting)`)
      setCatalog(sortedCatalog)
      setFilteredCatalog(sortedCatalog)
      // Dispatch event to notify other components of catalog update
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('catalogUpdated'))
      }
    } catch (error) {
      console.error('Failed to fetch catalog:', error)
    } finally {
      setIsLoading(false)
    }
  }


  // Filter and sort catalog based on search term and sort order
  useEffect(() => {
    // Filter out invalid items first
    let validCatalog = catalog.filter(item => item && item.id && item.song && item.artist)
    
    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim()
      validCatalog = validCatalog.filter(item => {
        // Validate item has required fields (double check)
        if (!item || !item.song || !item.artist) {
          return false
        }
        
        // Search in main fields
        if (
          item.song.toLowerCase().includes(term) ||
          item.artist.toLowerCase().includes(term) ||
          item.distributor?.toLowerCase().includes(term) ||
          item.upc?.toLowerCase().includes(term) ||
          item.isrc?.toLowerCase().includes(term)
        ) {
          return true
        }
        
        // Also search in album/EP tracklist
        if (item.songs && item.songs.length > 0) {
          const songMatch = item.songs.some(song => 
            song && song.song && (
              song.song.toLowerCase().includes(term) ||
              song.isrc?.toLowerCase().includes(term)
            )
          )
          if (songMatch) return true
        }
        
        return false
      })
    }

    // Apply sorting
    if (sortOrder === 'name') {
      validCatalog.sort((a, b) => {
        const nameA = a.song.toLowerCase()
        const nameB = b.song.toLowerCase()
        return nameA.localeCompare(nameB)
      })
    } else if (sortOrder === 'genre') {
      validCatalog.sort((a, b) => {
        const genreA = a.readinessTags?.lane || ''
        const genreB = b.readinessTags?.lane || ''
        if (genreA && !genreB) return -1
        if (!genreA && genreB) return 1
        if (genreA && genreB) {
          const genreCompare = genreA.localeCompare(genreB)
          if (genreCompare !== 0) return genreCompare
        }
        // If same genre or no genre, sort by name
        return a.song.toLowerCase().localeCompare(b.song.toLowerCase())
      })
    } else if (sortOrder === 'date') {
      // Sort by release date (oldest first), then by streams if no date
      validCatalog.sort((a, b) => {
        const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : (a.releaseDateRequested ? new Date(a.releaseDateRequested).getTime() : 0)
        const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : (b.releaseDateRequested ? new Date(b.releaseDateRequested).getTime() : 0)
        
        // If both have dates, sort by date (oldest first)
        if (dateA > 0 && dateB > 0) {
          return dateA - dateB
        }
        // If only one has a date, prioritize it
        if (dateA > 0 && dateB === 0) return -1
        if (dateB > 0 && dateA === 0) return 1
        // If neither has a date, sort by streams (lowest first) as fallback
        return a.totalStreams - b.totalStreams
      })
    } else if (sortOrder === 'artist-preference') {
      // Sort by artist preference, then by release date
      const preferredGenres = artistPreferences.preferredGenres || []
      const preferredLane = artistPreferences.lane
      
      validCatalog.sort((a, b) => {
        // Check if items match preferred genres (using lane as genre)
        const aLane = a.readinessTags?.lane || ''
        const bLane = b.readinessTags?.lane || ''
        
        // If user has preferred genres, prioritize those
        if (preferredGenres.length > 0) {
          const aIsPreferred = aLane && preferredGenres.includes(aLane)
          const bIsPreferred = bLane && preferredGenres.includes(bLane)
          
          if (aIsPreferred && !bIsPreferred) return -1
          if (!aIsPreferred && bIsPreferred) return 1
        }
        
        // If user has a preferred lane, prioritize items matching that lane
        if (preferredLane) {
          const aMatchesLane = aLane === preferredLane
          const bMatchesLane = bLane === preferredLane
          
          if (aMatchesLane && !bMatchesLane) return -1
          if (!aMatchesLane && bMatchesLane) return 1
        }
        
        // Within preference groups, sort by release date (newest first), then by name
        const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : (a.releaseDateRequested ? new Date(a.releaseDateRequested).getTime() : 0)
        const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : (b.releaseDateRequested ? new Date(b.releaseDateRequested).getTime() : 0)
        
        if (dateA > 0 && dateB > 0) {
          return dateB - dateA
        }
        if (dateA > 0 && dateB === 0) return -1
        if (dateB > 0 && dateA === 0) return 1
        
        return a.song.toLowerCase().localeCompare(b.song.toLowerCase())
      })
    }
    
    setFilteredCatalog(validCatalog)
  }, [searchTerm, catalog, sortOrder, artistPreferences])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate UPC/ISRC for past releases
    // ISRC is not required for albums/EPs (only UPC)
    if (formData.releaseDate && new Date(formData.releaseDate) < new Date()) {
      if (!formData.upc) {
        alert('UPC is required for past releases')
        return
      }
      // Only require ISRC for singles
      if (formData.releaseType === 'single' && !formData.isrc) {
        alert('ISRC is required for past single releases')
        return
      }
    }
    
    // Check for existing collaborations if creating new entry
    if (!editingItem && formData.artistIds && formData.artistIds.length > 1) {
      const existing = findExistingCollaboration(formData.song, formData.artistIds, catalog)
      
      if (existing.length > 0) {
        const exactMatch = existing.find(item => {
          const itemArtistIds = item.artistIds || (item.artistId ? [item.artistId] : [])
          return itemArtistIds.length === formData.artistIds.length &&
                  itemArtistIds.every((id: string) => formData.artistIds.includes(id))
        })
        
        if (exactMatch) {
          if (!confirm(`A collaboration "${formData.song}" with these artists already exists. Do you want to create another entry anyway?`)) {
            return
          }
        } else {
          const partialMatch = existing[0]
          if (!confirm(`A similar song "${partialMatch.song}" exists with some of these artists. Do you want to create a new entry or map to the existing one? Click OK to create new, Cancel to map to existing.`)) {
            // Map to existing - update it with all artist IDs
            setIsUploading(true)
            try {
              const res = await fetch('/api/catalog', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: partialMatch.id,
                  artistIds: Array.from(new Set([...(partialMatch.artistIds || []), ...(partialMatch.artistId ? [partialMatch.artistId] : []), ...formData.artistIds])),
                  userId: user?.id,
                  userRole: user?.role || '',
                  userName: user?.name,
                }),
              })
              const data = await res.json()
              if (data.success) {
                setShowAddModal(false)
                setFormData({ song: '', artist: '', artistId: '', artistIds: [], releaseType: 'single', releaseDate: '', distributor: '', file: null, upc: '', isrc: '', selectedSongIds: [] })
                fetchCatalog()
              }
            } catch (error) {
              console.error('Failed to update collaboration:', error)
            } finally {
              setIsUploading(false)
            }
            return
          }
        }
      }
    }
    
    setIsUploading(true)
    try {
      let fileUrl = undefined
      
      // Upload file if provided
      if (formData.file) {
        if (!user?.id) {
          alert('User ID is required. Please log in again.')
          return
        }

        const uploadFormData = new FormData()
        uploadFormData.append('file', formData.file)
        uploadFormData.append('category', 'catalog')
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
        fileUrl = uploadData.fileUrl
      }

      const res = await fetch('/api/catalog', {
        method: editingItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingItem 
          ? { 
              id: editingItem.id, 
              song: formData.song?.trim() || '',
              artist: formData.artist?.trim() || '',
              artistId: formData.artistIds[0] || formData.artistId,
              artistIds: formData.artistIds.length > 0 ? formData.artistIds : undefined,
              releaseType: formData.releaseType,
              releaseDate: formData.releaseDate || undefined,
              distributor: formData.distributor,
              fileUrl,
              upc: formData.upc,
              isrc: formData.isrc,
              songs: formData.releaseType !== 'single' ? (editingItem.songs || []) : undefined,
              userRole: user?.role || '',
              userId: user?.id,
              userName: user?.name,
            }
          : { 
              song: formData.song?.trim() || '',
              artist: formData.artist?.trim() || '',
              artistId: formData.artistIds[0] || formData.artistId,
              artistIds: formData.artistIds.length > 0 ? formData.artistIds : undefined,
              releaseType: formData.releaseType,
              releaseDate: formData.releaseDate || undefined,
              distributor: formData.distributor,
              fileUrl,
              upc: formData.upc,
              isrc: formData.isrc,
              songs: formData.releaseType !== 'single' 
                ? formData.selectedSongIds.map(songId => {
                    const song = catalog.find(s => s.id === songId)
                    return {
                      id: songId,
                      song: song?.song || 'Unknown',
                      isrc: song?.isrc,
                      streams: song?.totalStreams || 0,
                    }
                  })
                : undefined,
              totalStreams: formData.releaseType !== 'single' && formData.selectedSongIds.length > 0
                ? formData.selectedSongIds.reduce((sum, songId) => {
                    const song = catalog.find(s => s.id === songId)
                    return sum + (song?.totalStreams || 0)
                  }, 0)
                : 0,
              userRole: user?.role || '',
              userId: user?.id,
              userName: user?.name,
            }
        ),
      })

      const data = await res.json()
      if (data.success) {
        setShowAddModal(false)
        setEditingItem(null)
        setFormData({ song: '', artist: '', artistId: '', artistIds: [], releaseType: 'single', releaseDate: '', distributor: '', file: null, upc: '', isrc: '', selectedSongIds: [] })
        
        // Refresh catalog first to ensure new item is available
        await fetchCatalog()
        
        // Scroll to top to see the new item
        window.scrollTo({ top: 0, behavior: 'smooth' })
        
        // Notify other pages that catalog was updated
        const channel = new BroadcastChannel('catalog-updates')
        channel.postMessage({ type: 'catalog-updated', action: editingItem ? 'updated' : 'created' })
        channel.close()
        
        // If EP or Album and no songs were selected, open songs modal to add more
        if (formData.releaseType !== 'single' && !editingItem && formData.selectedSongIds.length === 0) {
          setTimeout(async () => {
            const newItem = data.item
            if (newItem) {
              // Find the item in the refreshed catalog to ensure we have the latest data
              try {
                const catalogRes = await fetch('/api/catalog')
                const catalogData = await catalogRes.json()
                if (catalogData.success && catalogData.catalog) {
                  const foundItem = catalogData.catalog.find((s: CatalogItem) => s.id === newItem.id)
                  if (foundItem) {
                    handleOpenSongsModal(foundItem)
                  } else {
                    // If not found immediately, try again after a short delay
                    setTimeout(async () => {
                      await fetchCatalog()
                      const catalogRes2 = await fetch('/api/catalog')
                      const catalogData2 = await catalogRes2.json()
                      if (catalogData2.success && catalogData2.catalog) {
                        const foundItem2 = catalogData2.catalog.find((s: CatalogItem) => s.id === newItem.id)
                        if (foundItem2) {
                          handleOpenSongsModal(foundItem2)
                        }
                      }
                    }, 500)
                  }
                }
              } catch (error) {
                console.error('Failed to find new item:', error)
              }
            }
          }, 200)
        }
      } else {
        // Show error message
        alert(`Failed to ${editingItem ? 'update' : 'add'} catalog item: ${data.error || 'Unknown error'}`)
        console.error('Catalog API error:', data)
      }
    } catch (error: any) {
      console.error('Failed to save catalog item:', error)
      alert(error.message || 'Failed to save catalog item')
    } finally {
      setIsUploading(false)
    }
  }

  const handleUpdateStreams = async (id: string, newStreams: number) => {
    // Prevent artists from updating streams
    if (user?.role === 'artist') {
      alert('Artists cannot update streams')
      return
    }

    try {
      const res = await fetch('/api/catalog', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          totalStreams: newStreams,
          userRole: user?.role || '',
          userId: user?.id,
          userName: user?.name,
        }),
      })

      const data = await res.json()
      if (data.success) {
        // Update local state immediately for better UX
        setCatalog(prevCatalog => 
          prevCatalog.map(item => 
            item.id === id ? { ...item, totalStreams: newStreams } : item
          )
        )
        setFilteredCatalog(prevFiltered => 
          prevFiltered.map(item => 
            item.id === id ? { ...item, totalStreams: newStreams } : item
          )
        )
        // Refresh to ensure consistency
        fetchCatalog()
        
        // Notify other pages that catalog was updated
        const channel = new BroadcastChannel('catalog-updates')
        channel.postMessage({ type: 'catalog-updated', action: 'streams-updated' })
        channel.close()
      } else {
        alert(data.error || 'Failed to update streams')
        // Refresh on error to revert any local changes
        fetchCatalog()
      }
    } catch (error) {
      console.error('Failed to update streams:', error)
      alert('Failed to update streams')
      // Refresh on error to revert any local changes
      fetchCatalog()
    }
  }

  const handleArchive = async (id: string) => {
    // Prevent artists from archiving
    if (user?.role === 'artist') {
      alert('Artists cannot archive catalog items')
      return
    }

    if (!confirm('Are you sure you want to archive this item? It will be hidden from the catalog but can be restored later.')) return

    try {
      // Handle CSV entries (dynamically created, not in catalog.json)
      if (id.startsWith('csv_')) {
        // For CSV entries, just remove from display by filtering them out
        // They'll be re-added on next CSV merge, but this allows temporary removal
        setCatalog(prevCatalog => prevCatalog.filter(item => item.id !== id))
        setFilteredCatalog(prevFiltered => prevFiltered.filter(item => item.id !== id))
        return
      }

      const res = await fetch(`/api/catalog?id=${id}&action=archive&userRole=${user?.role || ''}&userId=${user?.id || ''}&userName=${encodeURIComponent(user?.name || '')}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        fetchCatalog()
        
        // Notify other pages that catalog was updated
        const channel = new BroadcastChannel('catalog-updates')
        channel.postMessage({ type: 'catalog-updated', action: 'archived' })
        channel.close()
      } else {
        alert(data.error || 'Failed to archive item')
      }
    } catch (error) {
      console.error('Failed to archive item:', error)
      alert('Failed to archive item')
    }
  }

  const handleDelete = async (id: string) => {
    // Only admins can delete
    if (user?.role !== 'admin') {
      alert('Only admins can permanently delete catalog items')
      return
    }

    if (!confirm('⚠️ WARNING: This will permanently delete this item. This action cannot be undone!\n\nAre you absolutely sure you want to delete this item?')) return

    try {
      // Handle CSV entries (dynamically created, not in catalog.json)
      if (id.startsWith('csv_')) {
        // For CSV entries, just remove from display by filtering them out
        setCatalog(prevCatalog => prevCatalog.filter(item => item.id !== id))
        setFilteredCatalog(prevFiltered => prevFiltered.filter(item => item.id !== id))
        return
      }

      const res = await fetch(`/api/catalog?id=${id}&action=delete&userRole=${user?.role || ''}&userId=${user?.id || ''}&userName=${encodeURIComponent(user?.name || '')}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        fetchCatalog()
        
        // Notify other pages that catalog was updated
        const channel = new BroadcastChannel('catalog-updates')
        channel.postMessage({ type: 'catalog-updated', action: 'deleted' })
        channel.close()
      } else {
        alert(data.error || 'Failed to delete item')
      }
    } catch (error) {
      console.error('Failed to delete item:', error)
      alert('Failed to delete item')
    }
  }

  const handleArchiveSelected = async () => {
    // Prevent artists from archiving
    if (user?.role === 'artist') {
      alert('Artists cannot archive catalog items')
      return
    }

    if (selectedItems.size === 0) {
      alert('Please select at least one item to archive')
      return
    }

    const count = selectedItems.size
    if (!confirm(`Are you sure you want to archive ${count} item${count > 1 ? 's' : ''}? They will be hidden from the catalog but can be restored later.`)) return

    try {
      const idsToArchive = Array.from(selectedItems)
      const csvEntries: string[] = []
      const catalogEntries: string[] = []

      // Separate CSV entries from catalog entries
      idsToArchive.forEach(id => {
        if (id.startsWith('csv_')) {
          csvEntries.push(id)
        } else {
          catalogEntries.push(id)
        }
      })

      // Archive CSV entries from display immediately
      if (csvEntries.length > 0) {
        setCatalog(prevCatalog => prevCatalog.filter(item => !csvEntries.includes(item.id)))
        setFilteredCatalog(prevFiltered => prevFiltered.filter(item => !csvEntries.includes(item.id)))
      }

      // Archive catalog entries via API
      if (catalogEntries.length > 0) {
        const archivePromises = catalogEntries.map(id =>
          fetch(`/api/catalog?id=${id}&action=archive&userRole=${user?.role || ''}&userId=${user?.id || ''}&userName=${encodeURIComponent(user?.name || '')}`, { method: 'DELETE' })
            .then(res => res.json())
        )

        const results = await Promise.all(archivePromises)
        const failed = results.filter(r => !r.success)

        if (failed.length > 0) {
          alert(`Failed to archive ${failed.length} item${failed.length > 1 ? 's' : ''}`)
        }

        // Refresh catalog to get updated data
        fetchCatalog()
        
        // Notify other pages that catalog was updated
        const channel = new BroadcastChannel('catalog-updates')
        channel.postMessage({ type: 'catalog-updated', action: 'bulk-archived' })
        channel.close()
      }

      // Clear selection
      setSelectedItems(new Set())
    } catch (error) {
      console.error('Failed to archive selected items:', error)
      alert('Failed to archive selected items')
    }
  }

  const handleDeleteSelected = async () => {
    // Only admins can delete
    if (user?.role !== 'admin') {
      alert('Only admins can permanently delete catalog items')
      return
    }

    if (selectedItems.size === 0) {
      alert('Please select at least one item to delete')
      return
    }

    const count = selectedItems.size
    if (!confirm(`⚠️ WARNING: This will permanently delete ${count} item${count > 1 ? 's' : ''}. This action cannot be undone!\n\nAre you absolutely sure?`)) return

    try {
      const idsToDelete = Array.from(selectedItems)
      const csvEntries: string[] = []
      const catalogEntries: string[] = []

      // Separate CSV entries from catalog entries
      idsToDelete.forEach(id => {
        if (id.startsWith('csv_')) {
          csvEntries.push(id)
        } else {
          catalogEntries.push(id)
        }
      })

      // Delete CSV entries from display immediately
      if (csvEntries.length > 0) {
        setCatalog(prevCatalog => prevCatalog.filter(item => !csvEntries.includes(item.id)))
        setFilteredCatalog(prevFiltered => prevFiltered.filter(item => !csvEntries.includes(item.id)))
      }

      // Delete catalog entries via API
      if (catalogEntries.length > 0) {
        const deletePromises = catalogEntries.map(id =>
          fetch(`/api/catalog?id=${id}&action=delete&userRole=${user?.role || ''}&userId=${user?.id || ''}&userName=${encodeURIComponent(user?.name || '')}`, { method: 'DELETE' })
            .then(res => res.json())
        )

        const results = await Promise.all(deletePromises)
        const failed = results.filter(r => !r.success)

        if (failed.length > 0) {
          alert(`Failed to delete ${failed.length} item${failed.length > 1 ? 's' : ''}`)
        }

        // Refresh catalog to get updated data
        fetchCatalog()
        
        // Notify other pages that catalog was updated
        const channel = new BroadcastChannel('catalog-updates')
        channel.postMessage({ type: 'catalog-updated', action: 'bulk-deleted' })
        channel.close()
      }

      // Clear selection
      setSelectedItems(new Set())
    } catch (error) {
      console.error('Failed to delete selected items:', error)
      alert('Failed to delete selected items')
    }
  }

  const handleCombineSongs = async (albumName: string, releaseType: 'album' | 'ep', artist: string, releaseDate: string, distributor: string, upc: string, isrc: string) => {
    if (selectedItems.size === 0) {
      alert('Please select at least one song to combine')
      return
    }
    
    // Only allow combining singles
    const selectedSingles = Array.from(selectedItems).filter(id => {
      const item = catalog.find(c => c.id === id)
      return item && item.releaseType === 'single'
    })
    
    if (selectedSingles.length === 0) {
      alert('Please select at least one single to combine')
      return
    }

    try {
      setIsUploading(true)
      const res = await fetch('/api/catalog/combine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          songIds: selectedSingles,
          albumName,
          artist,
          releaseType,
          releaseDate: releaseDate || undefined,
          distributor: distributor || undefined,
          upc: upc || undefined,
          isrc: isrc || undefined,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setShowCombineModal(false)
        setSelectedItems(new Set())
        fetchCatalog()
        alert(`Successfully combined ${data.deletedSongs.length} songs into ${releaseType}!`)
      } else {
        alert(data.error || 'Failed to combine songs')
      }
    } catch (error: any) {
      console.error('Failed to combine songs:', error)
      alert(error.message || 'Failed to combine songs')
    } finally {
      setIsUploading(false)
    }
  }

  const handleOpenSongsModal = (item: CatalogItem) => {
    setSelectedRelease(item)
    // Ensure all songs have streams property initialized
    const songsWithStreams = (item.songs || []).map(song => ({
      ...song,
      streams: song.streams || 0,
    }))
    setReleaseSongs(songsWithStreams)
    setSelectedSongIds(new Set(songsWithStreams.map(s => s.id)))
    setShowSongsModal(true)
  }
  
  // Get available songs from catalog that can be added to this album/EP
  const getAvailableSongs = () => {
    if (!selectedRelease) return []
    
    // Filter to singles by the same artist
    const available = catalog.filter(item => {
      // Must be a single
      if (item.releaseType !== 'single') return false
      
      // Must be same artist
      if (selectedRelease.artistId) {
        return item.artistId === selectedRelease.artistId
      } else {
        return item.artist.toLowerCase() === selectedRelease.artist.toLowerCase()
      }
    })
    
    // Sort by release date (oldest to newest)
    return available.sort((a, b) => {
      const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : (a.releaseDateRequested ? new Date(a.releaseDateRequested).getTime() : 0)
      const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : (b.releaseDateRequested ? new Date(b.releaseDateRequested).getTime() : 0)
      return dateA - dateB // Oldest first
    })
  }
  
  const handleToggleSongSelection = (songId: string, songName: string, isrc?: string, streams?: number) => {
    const newSelected = new Set(selectedSongIds)
    if (newSelected.has(songId)) {
      newSelected.delete(songId)
      // Remove from releaseSongs
      setReleaseSongs(releaseSongs.filter(s => s.id !== songId))
    } else {
      newSelected.add(songId)
      // Add to releaseSongs with streams from catalog if available
      const catalogSong = catalog.find(s => s.id === songId)
      setReleaseSongs([...releaseSongs, {
        id: songId,
        song: songName,
        isrc: isrc,
        streams: streams || catalogSong?.totalStreams || 0,
      }])
    }
    setSelectedSongIds(newSelected)
  }

  const handleDivideStreams = () => {
    if (!selectedRelease) return
    
    const totalStreams = selectedRelease.totalStreams || 0
    const songCount = releaseSongs.length
    
    if (songCount === 0) {
      alert('Please add songs first before dividing streams')
      return
    }
    
    const streamsPerSong = Math.floor(totalStreams / songCount)
    const remainder = totalStreams % songCount
    
    // Distribute streams evenly, with remainder going to first songs
    const updatedSongs = releaseSongs.map((song, index) => ({
      ...song,
      streams: streamsPerSong + (index < remainder ? 1 : 0),
    }))
    
    setReleaseSongs(updatedSongs)
    
    // Update selectedRelease totalStreams to match the distributed total (should be the same)
    const newTotal = updatedSongs.reduce((sum, song) => sum + (song.streams || 0), 0)
    if (newTotal !== selectedRelease.totalStreams) {
      setSelectedRelease({ ...selectedRelease, totalStreams: newTotal })
    }
  }

  const handleAddSongToRelease = () => {
    if (!newSongName.trim()) return
    
    const newSong = {
      id: `song_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      song: newSongName.trim(),
      isrc: newSongISRC.trim() || undefined,
      streams: 0, // Initialize with 0 streams
    }
    
    setReleaseSongs([...releaseSongs, newSong])
    setNewSongName('')
    setNewSongISRC('')
  }

  const handleRemoveSong = (songId: string) => {
    setReleaseSongs(releaseSongs.filter(s => s.id !== songId))
  }

  const handleSaveReleaseSongs = async () => {
    if (!selectedRelease) return
    
    try {
      // Ensure all songs have streams property (default to 0 if missing)
      const songsWithStreams = releaseSongs.map(song => ({
        ...song,
        streams: song.streams || 0,
      }))
      
      // Calculate total streams from all songs in the release
      const songsTotal = songsWithStreams.reduce((sum, song) => {
        return sum + (song.streams || 0)
      }, 0)
      
      // Always update album totalStreams to match the sum of all songs
      // This ensures consistency between individual song streams and album total
      const finalTotalStreams = songsTotal
      
      console.log('[handleSaveReleaseSongs] Saving:', {
        releaseId: selectedRelease.id,
        songsCount: songsWithStreams.length,
        songsTotal,
        albumTotal: selectedRelease.totalStreams,
        finalTotal: finalTotalStreams,
      })
      
      if (!user?.id) {
        alert('You must be logged in to save tracklist changes')
        return
      }

      const res = await fetch('/api/catalog', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedRelease.id,
          songs: songsWithStreams,
          totalStreams: finalTotalStreams, // Always update to sum of songs
          userId: user.id,
          userRole: user.role,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setShowSongsModal(false)
        setSelectedRelease(null)
        setReleaseSongs([])
        setNewSongName('')
        setNewSongISRC('')
        setAddingToAlbum(null)
        fetchCatalog() // Refresh to show updated tracklist
        fetchChecklistPercentages() // Refresh checklist percentages
      } else {
        alert(data.error || 'Failed to save tracklist')
      }
    } catch (error) {
      console.error('Failed to save release songs:', error)
      alert('Failed to save tracklist. Please try again.')
    }
  }

  // Auto-detect column mapping from header and sample data
  const detectColumnMapping = (headerRow: string[], sampleRows: string[][]): Record<string, number | null> => {
    const mapping: Record<string, number | null> = {
      song: null,
      artist: null,
      releaseType: null,
      releaseDate: null,
      distributor: null,
      upc: null,
      isrc: null,
      googleDoc: null,
    }

      // Keywords to look for in headers
    const keywords: Record<string, string[]> = {
      song: ['song', 'title', 'album', 'single', 'track', 'name', 'release'],
      artist: ['artist', 'artists', 'performer', 'singer', 'musician'],
      releaseType: ['type', 'release type', 'kind', 'format'],
      releaseDate: ['date', 'release date', 'original release', 'published', 'released'],
      distributor: ['distributor', 'distribution', 'label', 'publisher'],
      upc: ['upc', 'barcode'],
      isrc: ['isrc', 'code'],
      googleDoc: ['link', 'url', 'docs', 'google', 'sheet', 'document', 'splits', 'credits'],
      songLinks: ['song link', 'song links', 'vault', 'file', 'drive', 'storage'],
    }

    // First, try to match headers
    headerRow.forEach((header, index) => {
      const headerLower = header.toLowerCase()
      
      for (const [field, fieldKeywords] of Object.entries(keywords)) {
        if (fieldKeywords.some(keyword => headerLower.includes(keyword))) {
          if (!mapping[field] || field === 'googleDoc') {
            mapping[field] = index
          }
        }
      }
    })

    // Then, analyze sample data to find patterns
    if (sampleRows.length > 0) {
      const firstRow = sampleRows[0]
      
      // Find song column (usually first non-empty, non-numeric column)
      if (!mapping.song) {
        for (let i = 0; i < firstRow.length; i++) {
          const val = firstRow[i]?.trim()
          if (val && !/^\d+$/.test(val) && val.length > 1) {
            mapping.song = i
            break
          }
        }
      }

      // Find artist (look for names with "&", ",", or common artist patterns)
      if (!mapping.artist) {
        for (let i = 0; i < firstRow.length; i++) {
          const val = firstRow[i]?.trim()
          if (val && (val.includes('&') || val.includes(',') || /^[A-Z][a-z]+/.test(val))) {
            if (i !== mapping.song) {
              mapping.artist = i
              break
            }
          }
        }
      }

      // Find release type (look for "single", "ep", "album")
      if (!mapping.releaseType) {
        for (let i = 0; i < firstRow.length; i++) {
          const val = firstRow[i]?.trim().toLowerCase()
          if (val && (val.includes('single') || val.includes('ep') || val.includes('album'))) {
            mapping.releaseType = i
            break
          }
        }
      }

      // Find dates
      if (!mapping.releaseDate) {
        for (let i = 0; i < firstRow.length; i++) {
          const val = firstRow[i]?.trim()
          if (val && (/\d{4}/.test(val) || /(january|february|march|april|may|june|july|august|september|october|november|december)/i.test(val))) {
            mapping.releaseDate = i
            break
          }
        }
      }

      // Find Google Docs links
      if (!mapping.googleDoc) {
        for (let i = 0; i < firstRow.length; i++) {
          const val = firstRow[i]?.trim()
          if (val && val.includes('docs.google.com')) {
            mapping.googleDoc = i
            break
          }
        }
      }
    }

    return mapping
  }

  // Parse date from various formats
  const parseDate = (dateStr: string): string => {
    if (!dateStr || !dateStr.trim()) return ''
    
    // Clean up common issues
    let cleaned = dateStr.trim()
      .replace(/d$/, '') // Remove trailing 'd' typo
      .replace(/\s+/, ' ')
    
    // Try to parse common date formats
    const dateFormats = [
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i,
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
      /(\d{4})-(\d{1,2})-(\d{1,2})/,
    ]
    
    for (const format of dateFormats) {
      const match = cleaned.match(format)
      if (match) {
        try {
          let date: Date
          if (format === dateFormats[0]) {
            // Month name format: "August 9, 2020" or "October 1st, 2021"
            const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                              'july', 'august', 'september', 'october', 'november', 'december']
            const month = monthNames.indexOf(match[1].toLowerCase())
            const day = parseInt(match[2])
            const year = parseInt(match[3])
            date = new Date(year, month, day)
          } else if (format === dateFormats[1]) {
            // MM/DD/YYYY format
            date = new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]))
          } else {
            // YYYY-MM-DD format
            date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]))
          }
          
          if (!isNaN(date.getTime())) {
            return formatLocalDateString(date)
          }
        } catch {
          // Continue to next format
        }
      }
    }
    
    return cleaned // Return as-is if we can't parse it
  }

  const parsePastedData = async (text: string) => {
    if (!text.trim()) {
      setParsedData([])
      setDetectedColumns([])
      setSampleRow([])
      setShowMappingStep(false)
      setIsFetchingDocs(false)
      return
    }

    const lines = text.trim().split('\n').filter(line => line.trim())
    if (lines.length === 0) return

    // Detect delimiter (tab, comma, or multiple spaces)
    const firstLine = lines[0]
    let delimiter: string | RegExp = '\t'
    if (!firstLine.includes('\t')) {
      if (firstLine.includes(',')) {
        delimiter = ','
      } else if (firstLine.match(/\s{2,}/)) {
        delimiter = /\s{2,}/
      }
    }
    
    // Store delimiter type for later use
    const delimiterType = typeof delimiter === 'string' ? delimiter : 'regex'

    // Parse all lines
    const parsedLines = lines.map(line => {
      if (typeof delimiter === 'string') {
        if (delimiter === '\t') {
          return line.split('\t')
        } else if (delimiter === ',') {
          return line.split(',').map(c => c.trim())
        }
      }
      // Handle RegExp delimiter
      return line.split(/\s{2,}/).map(c => c.trim())
    })

    // Detect if first row is header - be more aggressive in detection
    const firstRow = parsedLines[0]
    const isHeader = firstRow.some(cell => {
      const cellLower = cell.toLowerCase().trim()
      return (
        cellLower.includes('title') || 
        cellLower.includes('artist') || 
        cellLower.includes('song') ||
        cellLower.includes('album') ||
        cellLower.includes('type') ||
        cellLower.includes('date') ||
        cellLower.includes('distributor') ||
        cellLower.includes('upc') ||
        cellLower.includes('isrc') ||
        cellLower.includes('link') ||
        cellLower.includes('checklist') ||
        cellLower.includes('release') ||
        cellLower === 'y/n' ||
        cellLower === 'yes/no' ||
        // Check if first row looks like headers (all caps, short text, common header words)
        (cell.length < 20 && (
          cell === cell.toUpperCase() ||
          cellLower.includes('column') ||
          cellLower.includes('field')
        ))
      )
    })
    
    // Always skip first row if it looks like a header
    let dataRows = isHeader ? parsedLines.slice(1) : parsedLines
    
    // Additional check: if first data row doesn't look like actual data, skip it
    if (dataRows.length > 0 && !isHeader) {
      const firstDataRow = dataRows[0]
      const firstCell = firstDataRow[0]?.trim() || ''
      const firstCellLower = firstCell.toLowerCase()
      
      // If first cell looks like a header word, skip the row
      const looksLikeHeader = (
        firstCellLower.includes('title') ||
        firstCellLower.includes('album') ||
        firstCellLower.includes('song') ||
        firstCellLower.includes('checklist') ||
        firstCellLower === 'y/n' ||
        firstCellLower === 'yes/no' ||
        (firstCell.length < 20 && firstCell === firstCell.toUpperCase() && firstCell.length > 0)
      )
      
      if (looksLikeHeader) {
        dataRows = parsedLines.slice(1)
      }
    }

    const headerRow = isHeader ? firstRow : []
    const sampleRowData = dataRows[0] || []

    setDetectedColumns(headerRow.length > 0 ? headerRow : sampleRowData.map((_, i) => `Column ${i + 1}`))
    setSampleRow(sampleRowData)

    // Auto-detect column mapping
    const detectedMapping = detectColumnMapping(headerRow, dataRows.slice(0, 3))
    setColumnMapping(detectedMapping)
    setShowMappingStep(true)
  }

  const applyMappingAndParse = async () => {
    if (!columnMapping.song && columnMapping.song !== 0) {
      alert('Please map the Song/Title column')
      return
    }
    if (!columnMapping.artist && columnMapping.artist !== 0) {
      alert('Please map the Artist column')
      return
    }

    const lines = pastedData.trim().split('\n').filter(line => line.trim())
    const firstLine = lines[0]
    let delimiter: string | RegExp = '\t'
    if (!firstLine.includes('\t')) {
      if (firstLine.includes(',')) {
        delimiter = ','
      } else if (firstLine.match(/\s{2,}/)) {
        delimiter = /\s{2,}/
      }
    }

    const parsedLines = lines.map(line => {
      if (typeof delimiter === 'string') {
        if (delimiter === '\t') {
          return line.split('\t')
        } else if (delimiter === ',') {
          return line.split(',').map(c => c.trim())
        }
      }
      // Handle RegExp delimiter
      return line.split(/\s{2,}/).map(c => c.trim())
    })

    // Skip header if detected
    const firstRow = parsedLines[0]
    const isHeader = firstRow.some(cell => 
      cell.toLowerCase().includes('title') || 
      cell.toLowerCase().includes('artist') || 
      cell.toLowerCase().includes('song') ||
      cell.toLowerCase().includes('album') ||
      cell.toLowerCase().includes('type') ||
      cell.toLowerCase().includes('date')
    )
    const dataRows = isHeader ? parsedLines.slice(1) : parsedLines

    const parsed: any[] = []
    let hasGoogleDocs = false

    for (let index = 0; index < dataRows.length; index++) {
      const row = dataRows[index]
      
      const getValue = (field: string) => {
        const colIndex = columnMapping[field]
        return colIndex !== null && colIndex !== undefined ? (row[colIndex]?.trim() || '') : ''
      }

      const song = getValue('song')
      const artist = getValue('artist')
      const releaseType = getValue('releaseType')
      const releaseDate = getValue('releaseDate')
      const distributor = getValue('distributor')
      const upc = getValue('upc')
      const isrc = getValue('isrc')
      const googleDocUrl = getValue('googleDoc')
      const songLinks = getValue('songLinks')

      if (song && artist) {
        // Clean up artist name
        const cleanedArtist = artist
          .replace(/\s+/g, ' ')
          .replace(/\s*,\s*/g, ', ')
          .replace(/\s*&\s*/g, ' & ')
          .trim()

        // Normalize release type
        let normalizedType: 'single' | 'ep' | 'album' = 'single'
        const typeLower = releaseType.toLowerCase()
        if (typeLower.includes('ep') || typeLower === 'e.p.') {
          normalizedType = 'ep'
        } else if (typeLower.includes('album') || typeLower === 'lp') {
          normalizedType = 'album'
        }

        // Parse date
        const parsedDate = parseDate(releaseDate)

        // Clean distributor
        let cleanedDistributor = distributor
          .replace(/^Legendary Fyre Records\/L\.F\.R Distribution\s*/i, '')
          .replace(/^L\.F\.R,?\s*/i, '')
          .trim()

        // Check for Google Docs link
        let finalGoogleDocUrl = ''
        if (googleDocUrl && googleDocUrl.includes('docs.google.com')) {
          finalGoogleDocUrl = googleDocUrl
          hasGoogleDocs = true
        } else {
          // Also check in UPC/ISRC columns for links
          const allText = [upc, isrc, distributor].join(' ')
          const docLinkMatch = allText.match(/https?:\/\/docs\.google\.com\/[^\s]+/i)
          if (docLinkMatch) {
            finalGoogleDocUrl = docLinkMatch[0]
            hasGoogleDocs = true
          }
        }

        parsed.push({
          song: song.trim(),
          artist: cleanedArtist,
          releaseType: normalizedType,
          releaseDate: parsedDate,
          distributor: cleanedDistributor || undefined,
          upc: upc && !upc.includes('docs.google.com') ? upc : '',
          isrc: isrc && !isrc.includes('docs.google.com') ? isrc : '',
          googleDocUrl: finalGoogleDocUrl || undefined,
          songLinks: songLinks || undefined,
          rowNumber: index + 1,
        })
      }
    }

    setParsedData(parsed)
    setShowMappingStep(false)

    // Fetch from Google Docs if needed
    if (hasGoogleDocs) {
      setIsFetchingDocs(true)
      const updatedParsed = await Promise.all(
        parsed.map(async (item) => {
          if (item.googleDocUrl && item.googleDocUrl.includes('docs.google.com')) {
            try {
              const res = await fetch('/api/fetch-google-doc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: item.googleDocUrl }),
              })
              
              const docData = await res.json()
              if (docData.success) {
                return {
                  ...item,
                  upc: item.upc || docData.upc || '',
                  isrc: item.isrc || docData.isrc || '',
                }
              }
            } catch (error) {
              console.error('Failed to fetch Google Doc:', error)
            }
          }
          return item
        })
      )
      setParsedData(updatedParsed)
      setIsFetchingDocs(false)
    }
  }

  const handleBulkImport = async () => {
    if (parsedData.length === 0) {
      alert('No valid data to import')
      return
    }

    setIsImporting(true)
    try {
      const res = await fetch('/api/catalog/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: parsedData }),
      })

      const data = await res.json()
      if (data.success) {
        const messages = [
          `Successfully imported ${data.added} item(s).`,
          data.skipped > 0 ? `${data.skipped} duplicate(s) skipped.` : '',
          data.vaultFilesAdded > 0 ? `${data.vaultFilesAdded} song link(s) added to vault.` : '',
        ].filter(Boolean)
        alert(messages.join(' '))
        setShowBulkImportModal(false)
        setPastedData('')
        setParsedData([])
        setShowMappingStep(false)
        setColumnMapping({
          song: null,
          artist: null,
          releaseType: null,
          releaseDate: null,
          distributor: null,
          upc: null,
          isrc: null,
          googleDoc: null,
        })
        setDetectedColumns([])
        setSampleRow([])
        fetchCatalog()
        // Dispatch event to notify other components of catalog update
        window.dispatchEvent(new Event('catalogUpdated'))
      } else {
        throw new Error(data.error || 'Import failed')
      }
    } catch (error: any) {
      console.error('Failed to import:', error)
      alert(error.message || 'Failed to import catalog items')
    } finally {
      setIsImporting(false)
    }
  }

  const handleAudioUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Prevent artists from uploading audio
    if (user?.role === 'artist') {
      alert('Artists cannot upload audio files')
      return
    }
    
    if (!audioUploadData.file) {
      alert('Please select an audio file')
      return
    }
    
    if (!audioUploadData.songName.trim()) {
      alert('Please enter a song name')
      return
    }
    
    if (!user) {
      alert('You must be logged in to upload audio')
      return
    }
    
    setIsUploadingAudio(true)
    try {
      // Validate file before sending
      if (!audioUploadData.file || audioUploadData.file.size === 0) {
        throw new Error('Please select a valid audio file')
      }

      const formData = new FormData()
      formData.append('file', audioUploadData.file)
      formData.append('songName', audioUploadData.songName.trim() || '')
      formData.append('artistName', user.artistName || user.name || '')
      formData.append('userId', user.id || '')
      if (audioUploadData.releaseDate) {
        formData.append('releaseDate', audioUploadData.releaseDate)
      }

      const res = await fetch('/api/upload-audio', {
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
        console.error('[AUDIO UPLOAD] API error:', { status: res.status, errorData })
        throw new Error(errorMsg)
      }
      
      const data = await res.json()
      
      if (data.success) {
        alert('Audio file uploaded successfully! Waiting for admin approval.')
        setShowAudioUploadModal(false)
        setAudioUploadData({ file: null, songName: '', releaseDate: '' })
        fetchCatalog()
      } else {
        const errorMsg = data.details || data.error || 'Upload failed'
        console.error('[AUDIO UPLOAD] API returned error:', data)
        throw new Error(errorMsg)
      }
    } catch (error: any) {
      console.error('Failed to upload audio:', error)
      alert(error.message || 'Failed to upload audio file. Please check the console for details.')
    } finally {
      setIsUploadingAudio(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-red-500/80 border-t-transparent" />
        <p className="text-sm font-medium text-slate-500">Loading catalog…</p>
      </div>
    )
  }

  return (
    <div className="space-y-10 md:space-y-12 stagger-children">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          <p className="font-display text-[0.7rem] uppercase tracking-[0.22em] text-red-400/90">
            Catalog
          </p>
          <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Label catalog
          </h1>
          <p className="mt-2 text-base leading-relaxed text-slate-400">
            {isStaff && staffViewMode === 'artist'
              ? 'Your artist catalog view'
              : 'Releases, streams, and metadata in one place.'}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {isStaff && (
          <div className="flex items-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5">
            <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">Mode</span>
            <span className="ml-2 text-sm font-semibold text-white">
              {staffViewMode === 'staff' ? 'Staff' : 'Artist'}
            </span>
          </div>
        )}
        {canManage && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            onClick={() => {
              setShowBulkImportModal(true)
              setPastedData('')
              setParsedData([])
              setShowMappingStep(false)
              setColumnMapping({
                song: null,
                artist: null,
                releaseType: null,
                releaseDate: null,
                distributor: null,
                upc: null,
                isrc: null,
                googleDoc: null,
                songLinks: null,
              })
              setDetectedColumns([])
              setSampleRow([])
            }}
            className="hover-lift inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-sky-500/35 bg-sky-500/10 px-4 py-2.5 text-sm font-medium text-sky-100 shadow-lift transition hover:border-sky-400/45 hover:bg-sky-500/20 sm:w-auto"
          >
            <Clipboard className="h-5 w-5 shrink-0" />
            <span>Bulk import</span>
          </button>
        <button
          onClick={() => {
            setAudioUploadData({ file: null, songName: '', releaseDate: '' })
            setShowAudioUploadModal(true)
          }}
          className="hover-lift inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-100 shadow-lift transition hover:border-emerald-400/45 hover:bg-emerald-500/20 sm:w-auto"
        >
          <Music className="h-5 w-5 shrink-0" />
          <span>Upload audio</span>
        </button>
        <button
          onClick={() => {
            setEditingItem(null)
          setFormData({ song: '', artist: '', artistId: '', artistIds: [], releaseType: 'single', releaseDate: '', distributor: '', file: null, upc: '', isrc: '', selectedSongIds: [] })
            setShowAddModal(true)
          }}
          className="hover-lift inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-600/90 px-4 py-2.5 text-sm font-semibold text-white shadow-lift transition hover:border-red-400/60 hover:bg-red-500 sm:w-auto"
        >
          <Plus className="h-5 w-5 shrink-0" />
          <span>Add release</span>
        </button>
        </div>
        )}
        </div>
      </div>

      {/* Search Bar and Sort */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.75)] backdrop-blur-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="relative min-w-0 flex-1 lg:min-w-[200px]">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search song, artist, distributor, UPC, ISRC…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/35 py-3 pl-11 pr-4 text-white placeholder:text-slate-500 transition focus:border-red-500/40 focus:outline-none focus:ring-2 focus:ring-red-500/20"
            />
          </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="cursor-pointer rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white transition focus:border-red-500/40 focus:outline-none focus:ring-2 focus:ring-red-500/20 lg:min-w-[140px]"
            >
              <option value="">All statuses</option>
              <option value="upcoming">Upcoming</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
            <input
              type="text"
              placeholder="Filter by artist"
              value={artistFilter}
              onChange={(e) => setArtistFilter(e.target.value)}
              onBlur={() => fetchCatalog()}
              onKeyDown={(e) => e.key === 'Enter' && fetchCatalog()}
              className="min-w-[120px] rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white placeholder:text-slate-500 transition focus:border-red-500/40 focus:outline-none focus:ring-2 focus:ring-red-500/20 lg:min-w-[160px]"
            />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sort</span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'name' | 'genre' | 'artist-preference' | 'date')}
              className="cursor-pointer rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white transition focus:border-red-500/40 focus:outline-none focus:ring-2 focus:ring-red-500/20"
            >
              <option value="date">Release date (oldest)</option>
              <option value="artist-preference">Artist preference</option>
              <option value="name">Name</option>
              <option value="genre">Genre</option>
            </select>
          </div>
        </div>
        {searchTerm && (
          <p className="mt-4 text-sm font-medium text-slate-400">
            {filteredCatalog.length} result{filteredCatalog.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.06] to-transparent p-6 shadow-[0_20px_50px_-28px_rgba(0,0,0,0.8)]">
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-red-500/15 blur-2xl" />
          <div className="relative flex items-start justify-between">
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3">
              <Music className="h-6 w-6 text-red-300" />
            </div>
          </div>
          <h3 className="relative mt-4 font-display text-3xl font-semibold tabular-nums text-white">
            {catalog.length}
          </h3>
          <p className="relative mt-1 text-sm text-slate-400">Total releases</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-transparent p-6 shadow-[0_20px_50px_-28px_rgba(0,0,0,0.8)]">
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-emerald-500/10 blur-2xl" />
          <div className="relative flex items-start justify-between">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
              <Play className="h-6 w-6 text-emerald-300" />
            </div>
          </div>
          <h3 className="relative mt-4 font-display text-3xl font-semibold tabular-nums text-white">
            {catalog
              .filter(item => {
                // Exclude pending and denied items from total streams calculation
                // Only count approved releases or items without approval status
                if (item.releaseApprovalStatus === 'pending' || item.releaseApprovalStatus === 'denied') {
                  return false
                }
                return true
              })
              .reduce((sum, item) => {
                // For albums/EPs, sum streams from songs array if available
                if ((item.releaseType === 'album' || item.releaseType === 'ep') && item.songs && item.songs.length > 0) {
                  const songsTotal = item.songs.reduce((songSum: number, song: any) => songSum + (song.streams || 0), 0)
                  // Use songsTotal if > 0, otherwise fallback to item.totalStreams
                  // This prevents double-counting (don't add both)
                  return sum + (songsTotal > 0 ? songsTotal : (item.totalStreams || 0))
                }
                return sum + (item.totalStreams || 0)
              }, 0).toLocaleString()}
          </h3>
          <p className="relative mt-1 text-sm text-slate-400">Total streams</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-transparent p-6 shadow-[0_20px_50px_-28px_rgba(0,0,0,0.8)]">
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-violet-500/10 blur-2xl" />
          <div className="relative flex items-start justify-between">
            <div className="rounded-xl border border-violet-500/25 bg-violet-500/10 p-3">
              <TrendingUp className="h-6 w-6 text-violet-300" />
            </div>
          </div>
          <h3 className="relative mt-4 font-display text-3xl font-semibold tabular-nums text-white">
            {new Set(catalog.map(item => item.artist)).size}
          </h3>
          <p className="relative mt-1 text-sm text-slate-400">Artists</p>
        </div>
      </div>


      {/* Catalog Table */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.75)] backdrop-blur-sm sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-lg font-semibold text-white sm:text-xl">All releases</h2>
          {selectedItems.size > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-400">{selectedItems.size} selected</span>
              {Array.from(selectedItems).some(id => {
                const item = catalog.find(c => c.id === id)
                return item && item.releaseType === 'single'
              }) && (
                <button
                  onClick={() => setShowCombineModal(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-violet-500/35 bg-violet-600/20 px-3 py-2 text-sm font-medium text-violet-100 transition hover:bg-violet-600/30"
                >
                  <Music className="h-4 w-4" />
                  <span>Combine into album / EP</span>
                </button>
              )}
              <button
                onClick={handleArchiveSelected}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-500/35 bg-amber-600/20 px-3 py-2 text-sm font-medium text-amber-100 transition hover:bg-amber-600/30"
              >
                <Archive className="h-4 w-4" />
                <span>Archive selected</span>
              </button>
              {user?.role === 'admin' && (
                <button
                  onClick={handleDeleteSelected}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-600/80 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete selected</span>
                </button>
              )}
              <button
                onClick={() => setSelectedItems(new Set())}
                className="rounded-lg px-2 py-1.5 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white"
              >
                Clear
              </button>
            </div>
          )}
        </div>
        {catalog.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-black/25 py-16 text-center">
            <Music className="mx-auto mb-4 h-14 w-14 text-slate-600" />
            <p className="text-slate-400">No releases found</p>
          </div>
        ) : (
          <div className="-mx-3 overflow-x-auto sm:mx-0">
            <table className="w-full responsive-table sm:table">
              <thead className="hidden sm:table-header-group">
                <tr className="border-b border-white/[0.06] bg-white/[0.03]">
                  <th className="w-12 px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedItems.size > 0 && selectedItems.size === filteredCatalog.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const allIds = filteredCatalog.map(item => item.id)
                          setSelectedItems(new Set(allIds))
                        } else {
                          setSelectedItems(new Set())
                        }
                      }}
                      className="h-4 w-4 rounded border-white/20 bg-black/40 text-red-500 focus:ring-red-500/40"
                      title="Select all"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">Release</th>
                  <th className="px-4 py-3 text-left text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">Artist</th>
                  <th className="px-4 py-3 text-left text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">Type</th>
                  <th className="px-4 py-3 text-left text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">Release date</th>
                  <th className="px-4 py-3 text-left text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">Streams</th>
                  <th className="px-4 py-3 text-left text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">Checklist</th>
                  <th className="px-4 py-3 text-left text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">Distributor</th>
                  <th className="px-4 py-3 text-left text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">UPC</th>
                  <th className="px-4 py-3 text-right text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCatalog.filter(item => item && item.id && item.song && item.artist).map((item) => {
                  const isExpanded = expandedAlbums.has(item.id)
                  const hasTracklist = item.releaseType !== 'single' && item.songs && item.songs.length > 0
                  const checklistPercent = checklistPercentages[item.id] || 0
                  
                  return (
                    <React.Fragment key={item.id}>
                      <tr
                        key={`row-${item.id}`}
                        className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.04]"
                      >
                        <td className="px-4 py-3.5" data-label="">
                          <input
                            type="checkbox"
                            checked={selectedItems.has(item.id)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedItems)
                              if (e.target.checked) {
                                newSelected.add(item.id)
                              } else {
                                newSelected.delete(item.id)
                              }
                              setSelectedItems(newSelected)
                            }}
                            className="h-4 w-4 rounded border-white/20 bg-black/40 text-red-500 focus:ring-red-500/40"
                            title="Select item"
                          />
                        </td>
                        <td className="px-4 py-3.5" data-label="Release">
                          <div className="flex w-full items-start gap-3">
                            {/* Album Cover - all screen sizes */}
                            <div className="relative h-14 w-14 shrink-0 sm:h-16 sm:w-16">
                              <div className="absolute inset-0 flex h-full w-full items-center justify-center rounded-xl bg-gradient-to-br from-white/[0.08] to-slate-900/90 shadow-inner ring-1 ring-white/10">
                                <Music className="h-6 w-6 text-slate-500 sm:h-8 sm:w-8" />
                              </div>
                              {item.albumCover && (
                                <img 
                                  src={getAbsoluteUrl(item.albumCover)}
                                  alt={item.song}
                                  className="relative h-full w-full rounded-xl object-cover shadow-md ring-1 ring-white/10"
                                  loading="lazy"
                                  decoding="async"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement
                                    target.style.display = 'none'
                                  }}
                                />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <a
                                  href={`/dashboard/catalog/${encodeURIComponent(item.id)}`}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    // Only handle transfer for unreleased items with vaultFileId
                                    if (item.isUnreleased && item.vaultFileId) {
                                      e.preventDefault()
                                      if (confirm(`Transfer "${item.song}" to catalog?`)) {
                                        fetch('/api/transfer-vault-to-catalog', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ vaultFileId: item.vaultFileId }),
                                        })
                                          .then(res => res.json())
                                          .then(data => {
                                            if (data.success) {
                                              alert('Successfully transferred to catalog!')
                                              fetchCatalog()
                                            } else {
                                              alert(data.error || 'Failed to transfer')
                                            }
                                          })
                                      }
                                    }
                                    // For all other items (including unreleased without vaultFileId), allow normal navigation via href
                                  }}
                                  className="font-display cursor-pointer text-base font-semibold leading-normal text-white line-clamp-2 transition hover:text-red-300 sm:text-sm [padding-block:0.125em]"
                                >
                                  {item.song}
                                </a>
                                {hasTracklist && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      const newExpanded = new Set(expandedAlbums)
                                      if (isExpanded) {
                                        newExpanded.delete(item.id)
                                      } else {
                                        newExpanded.add(item.id)
                                      }
                                      setExpandedAlbums(newExpanded)
                                    }}
                                    className="text-slate-400 hover:text-white transition flex-shrink-0 p-1"
                                  >
                                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                  </button>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                {item.isUnreleased && (
                                  <span className="text-xs bg-red-500/20 text-red-400 px-2.5 py-1 rounded-full font-semibold">
                                    UNRELEASED
                                  </span>
                                )}
                                {item?.releaseApprovalStatus === 'denied' && (
                                  <span className="text-xs bg-red-500/20 text-red-400 px-2.5 py-1 rounded-full font-semibold flex items-center space-x-1" title={item?.releaseApprovalNotes || 'Release denied'}>
                                    <X className="w-3 h-3" />
                                    <span>DENIED</span>
                                  </span>
                                )}
                                {item.releaseApprovalStatus === 'approved' && item.releaseDate && item.sentToEmpireAt && (
                                  <span className="text-xs bg-green-500/20 text-green-400 px-2.5 py-1 rounded-full font-semibold">
                                    {item.releaseDate && new Date(item.releaseDate) <= new Date() ? 'RELEASED' : 'SCHEDULED'}
                                  </span>
                                )}
                                {item.isDelayed && (
                                  <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2.5 py-1 rounded-full font-semibold">
                                    DELAYED
                                  </span>
                                )}
                                {item.releaseType !== 'single' && (
                                  <button
                                    onClick={() => handleOpenSongsModal(item)}
                                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center space-x-1 px-2.5 py-1 rounded-full bg-blue-500/10 transition"
                                    title="Manage tracklist"
                                  >
                                    <List className="w-3 h-3" />
                                    <span>{item.songs?.length || 0} tracks</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-300" data-label="Artist">
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="font-medium text-white">{item.artist}</span>
                          {item.artistIds && item.artistIds.length > 1 && (
                              <>
                                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
                              {item.artistIds.length} artists
                            </span>
                                {user?.role === 'admin' && (
                                  <button
                                    onClick={() => handleSetCollaborativeAccount(item)}
                                    className="text-xs text-purple-400 hover:text-purple-300 underline"
                                    title="Set which account this collaborative song links to"
                                  >
                                    Set Account
                                  </button>
                                )}
                              </>
                          )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5" data-label="Type">
                          <span className="inline-flex rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-xs font-semibold capitalize text-violet-200">
                            {item.releaseType || 'single'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-400" data-label="Release Date">
                          <div className="flex items-center space-x-2">
                            {item.releaseDate ? (
                              <>
                                <Calendar className="w-4 h-4 text-slate-500" />
                                <span>{formatLocalDate(item.releaseDate)}</span>
                              </>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-medium text-white" data-label="Streams">
                          {editingStreams === item.id ? (
                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                value={editingStreamsValue}
                                onChange={(e) => setEditingStreamsValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const newStreams = parseInt(editingStreamsValue.replace(/,/g, '')) || 0
                                    handleUpdateStreams(item.id, newStreams)
                                    setEditingStreams(null)
                                    setEditingStreamsValue('')
                                  } else if (e.key === 'Escape') {
                                    setEditingStreams(null)
                                    setEditingStreamsValue('')
                                  }
                                }}
                                className="w-24 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                autoFocus
                                placeholder="0"
                              />
                              <button
                                onClick={() => {
                                  const newStreams = parseInt(editingStreamsValue.replace(/,/g, '')) || 0
                                  handleUpdateStreams(item.id, newStreams)
                                  setEditingStreams(null)
                                  setEditingStreamsValue('')
                                }}
                                className="text-xs text-green-400 hover:text-green-300 px-2"
                                title="Save"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => {
                                  setEditingStreams(null)
                                  setEditingStreamsValue('')
                                }}
                                className="text-xs text-red-400 hover:text-red-300 px-2"
                                title="Cancel"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2 group">
                              <TrendingUp className="w-4 h-4 text-green-400 flex-shrink-0" />
                              <span className="font-semibold">
                          {(() => {
                            // For albums/EPs, sum streams from songs array if available
                            if ((item.releaseType === 'album' || item.releaseType === 'ep') && item.songs && item.songs.length > 0) {
                              const songsTotal = item.songs.reduce((sum: number, song: any) => sum + (song.streams || 0), 0)
                              return songsTotal > 0 ? songsTotal.toLocaleString() : item.totalStreams.toLocaleString()
                            }
                            return item.totalStreams.toLocaleString()
                          })()}
                              </span>
                              {user?.role !== 'artist' && (
                                <button
                                  onClick={() => {
                                    const currentStreams = (() => {
                                      if ((item.releaseType === 'album' || item.releaseType === 'ep') && item.songs && item.songs.length > 0) {
                                        const songsTotal = item.songs.reduce((sum: number, song: any) => sum + (song.streams || 0), 0)
                                        return songsTotal > 0 ? songsTotal : item.totalStreams
                                      }
                                      return item.totalStreams
                                    })()
                                    setEditingStreams(item.id)
                                    setEditingStreamsValue(currentStreams.toString())
                                  }}
                                  className="opacity-0 group-hover:opacity-100 text-xs text-blue-400 hover:text-blue-300 underline ml-auto transition-opacity"
                                  title="Edit streams"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5" data-label="Checklist">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                              <div
                                className={`h-full transition-all ${
                                  checklistPercent === 100
                                    ? 'bg-green-500'
                                    : checklistPercent >= 50
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                                }`}
                                style={{ width: `${checklistPercent}%` }}
                              />
                            </div>
                            <span className="min-w-[2.75rem] text-right text-xs font-semibold tabular-nums text-slate-400">{checklistPercent}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5" data-label="Distributor">
                          {item.distributor ? (
                            (() => {
                              const distributorUrl = getDistributorUrl(item.distributor)
                              return distributorUrl ? (
                                <a
                                  href={distributorUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center space-x-1.5 text-xs bg-red-500/20 text-red-400 px-3 py-1.5 rounded-full font-medium hover:bg-red-500/30 transition-colors cursor-pointer group"
                                >
                                  <span>{item.distributor}</span>
                                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </a>
                              ) : (
                                <span className="text-xs bg-red-500/20 text-red-400 px-3 py-1.5 rounded-full font-medium">
                                  {item.distributor}
                                </span>
                              )
                            })()
                          ) : (
                            <span className="text-slate-500 text-sm">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-400" data-label="UPC">
                          {item.upc && item.upc.toLowerCase() !== 'unknown' ? (
                            <span className="rounded-md border border-white/10 bg-black/40 px-2 py-1 font-mono text-xs text-white">{item.upc}</span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5" data-label="Actions">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {item.releaseType !== 'single' && (
                              <button
                                onClick={() => {
                                  setAddingToAlbum(item.id)
                                  handleOpenSongsModal(item)
                                }}
                                className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition"
                                title="Add songs to this album"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            )}
                            {canRequestChange && !canManageItem(item) && (
                              <button
                                onClick={() => {
                                  setRequestChangeItem(item)
                                  setRequestChangeText('')
                                  setShowRequestChangeModal(true)
                                }}
                                className="p-2 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded transition"
                                title="Request change (staff submits to owner)"
                              >
                                <AlertCircle className="w-4 h-4" />
                              </button>
                            )}
                            {canManageItem(item) && (
                              <>
                            <button
                              onClick={() => {
                                setEditingItem(item)
                                setFormData({
                                  song: item.song,
                                  artist: item.artist,
                                  artistId: item.artistIds?.[0] || item.artistId || '',
                                  artistIds: item.artistIds || (item.artistId ? [item.artistId] : []),
                                  releaseType: item.releaseType || 'single',
                                  releaseDate: item.releaseDate ? item.releaseDate.split('T')[0] : '',
                                  distributor: item.distributor || '',
                                  file: null, // Files are stored separately
                                  upc: item.upc || '',
                                  isrc: item.isrc || '',
                                  selectedSongIds: item.songs?.map(s => s.id) || [],
                                })
                                setShowAddModal(true)
                              }}
                              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleArchive(item.id)}
                              className="p-2 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 rounded transition"
                              title="Archive item"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                            {user?.role === 'admin' && (
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition"
                                title="Permanently delete item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && hasTracklist && (
                        <tr key={`${item.id}-tracklist`} className="bg-white/[0.02]">
                          <td colSpan={10} className="px-4 py-5">
                            <div className="pl-4 sm:pl-8">
                              <h4 className="mb-3 text-sm font-semibold text-slate-300">Tracklist ({item.songs?.length} songs)</h4>
                              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                                {item.songs?.map((song, index) => {
                                  // Find the song in the catalog to get its ID for navigation
                                  // For songs in albums/EPs, use the parent album/EP ID, not the nested song ID
                                  // Only use nested song ID if it exists as a standalone catalog item
                                  const catalogSong = catalog.find(c => 
                                    c.song.toLowerCase() === song.song.toLowerCase() && 
                                    (c.artist.toLowerCase() === item.artist.toLowerCase() || c.artistId === item.artistId) &&
                                    c.releaseType === 'single' // Only match singles, not the parent album/EP
                                  )
                                  // Use parent album/EP ID for navigation (not the nested song ID)
                                  const songPageId = catalogSong?.id || item.id
                                  
                                  return (
                                    <div
                                      key={song.id}
                                      className="flex items-center space-x-2 rounded-xl border border-white/[0.08] bg-black/35 p-2.5"
                                    >
                                      <span className="text-xs text-slate-500 font-mono w-6">{index + 1}.</span>
                                      <div className="flex-1 min-w-0">
                                        <a
                                          href={`/dashboard/catalog/${songPageId}`}
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            // If it's a nested song, navigate to parent album/EP instead
                                            if (!catalogSong && item.id !== songPageId) {
                                              e.preventDefault()
                                              window.location.href = `/dashboard/catalog/${item.id}`
                                            }
                                          }}
                                          className="text-sm text-white hover:text-red-400 transition truncate block"
                                        >
                                          {song.song}
                                        </a>
                                        {song.isrc && (
                                          <div className="flex items-center space-x-2 mt-1">
                                            <p className="text-xs text-slate-400 font-mono truncate">ISRC: {song.isrc}</p>
                                            {user?.role === 'admin' && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  e.preventDefault()
                                                  const info = `Song: ${song.song}\nISRC: ${song.isrc || 'Not set'}\nTrack #${index + 1}`
                                                  alert(info)
                                                }}
                                                className="text-xs text-blue-400 hover:text-blue-300 underline"
                                                title="View details"
                                              >
                                                (info)
                                              </button>
                                            )}
                                          </div>
                                        )}
                                        {!song.isrc && user?.role === 'admin' && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              e.preventDefault()
                                              const info = `Song: ${song.song}\nISRC: Not set\nTrack #${index + 1}`
                                              alert(info)
                                            }}
                                            className="text-xs text-blue-400 hover:text-blue-300 underline mt-1"
                                            title="View details"
                                          >
                                            View details
                                          </button>
                                        )}
                                        {song.streams && (
                                          <p className="text-xs text-slate-400">{song.streams.toLocaleString()} streams</p>
                                        )}
                                        {song.audioUrl && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              e.preventDefault()
                                              if (playingTrackId === song.id && audioRef) {
                                                audioRef.pause()
                                                setPlayingTrackId(null)
                                                setAudioRef(null)
                                              } else {
                                                // Stop any currently playing audio
                                                if (audioRef) {
                                                  audioRef.pause()
                                                  audioRef.src = ''
                                                }
                                                
                                                const audio = new Audio(song.audioUrl)
                                                // Use 'metadata' preload for faster initial load
                                                audio.preload = 'metadata'
                                                
                                                // Try to play immediately - browser will buffer as needed
                                                const playPromise = audio.play()
                                                
                                                playPromise
                                                  .then(() => {
                                                    // Successfully started playing
                                                    audio.onended = () => {
                                                      setPlayingTrackId(null)
                                                      setAudioRef(null)
                                                    }
                                                    setPlayingTrackId(song.id)
                                                    setAudioRef(audio)
                                                    // Switch to auto preload once playing for better buffering
                                                    audio.preload = 'auto'
                                                  })
                                                  .catch(() => {
                                                    // If immediate play fails, wait for 'loadeddata' (faster than 'canplay')
                                                    const onLoadedData = () => {
                                                      audio.removeEventListener('loadeddata', onLoadedData)
                                                      audio.removeEventListener('error', onError)
                                                      audio.play()
                                                        .then(() => {
                                                          audio.onended = () => {
                                                            setPlayingTrackId(null)
                                                            setAudioRef(null)
                                                          }
                                                          setPlayingTrackId(song.id)
                                                          setAudioRef(audio)
                                                          audio.preload = 'auto'
                                                        })
                                                        .catch(() => {
                                                          // Silent fail
                                                        })
                                                    }
                                                    
                                                    const onError = () => {
                                                      audio.removeEventListener('loadeddata', onLoadedData)
                                                      audio.removeEventListener('error', onError)
                                                      // Silent fail
                                                    }
                                                    
                                                    audio.addEventListener('loadeddata', onLoadedData, { once: true })
                                                    audio.addEventListener('error', onError, { once: true })
                                                  })
                                              }
                                            }}
                                            className="text-xs text-red-400 hover:text-red-300 transition mt-1"
                                            title={playingTrackId === song.id ? 'Pause' : 'Play'}
                                          >
                                            {playingTrackId === song.id ? '⏸ Pause' : '▶ Play'}
                                          </button>
                                        )}
                                        {catalogSong && (
                                          <div className="mt-1">
                                            <button
                                              onClick={async (e) => {
                                                e.stopPropagation()
                                                e.preventDefault()
                                                if (!songVaultFiles[songPageId]) {
                                                  await fetchVaultFilesForSong(songPageId)
                                                }
                                                const files = songVaultFiles[songPageId] || []
                                                if (files.length > 0) {
                                                  const fileList = files.map((f: any) => `• ${f.fileName} (${f.fileType})`).join('\n')
                                                  alert(`Vault Files for "${song.song}":\n\n${fileList}`)
                                                } else {
                                                  alert(`No vault files found for "${song.song}".\n\nYou can add files by visiting the song page.`)
                                                }
                                              }}
                                              className="text-xs text-purple-400 hover:text-purple-300 underline"
                                              title="View vault files"
                                            >
                                              📁 Vault ({songVaultFiles[songPageId]?.length || 0})
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showRequestChangeModal && requestChangeItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full my-auto">
            <div className="p-4 sm:p-6 border-b border-slate-800">
              <h2 className="text-xl font-bold text-white">Request Catalog Change</h2>
              <p className="text-slate-400 text-sm mt-1">
                {requestChangeItem.song} by {requestChangeItem.artist}
              </p>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Describe the change you need</label>
                <textarea
                  value={requestChangeText}
                  onChange={(e) => setRequestChangeText(e.target.value)}
                  placeholder="e.g. Update release date to 2025-02-20, fix UPC to 1234567890123..."
                  rows={4}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowRequestChangeModal(false)
                    setRequestChangeItem(null)
                    setRequestChangeText('')
                  }}
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
                          songId: requestChangeItem.id,
                          songName: requestChangeItem.song,
                          artistName: requestChangeItem.artist,
                          requestedBy: user.id,
                          requestedByName: user.name || user.artistName || 'Staff',
                          changes: requestChangeText.trim(),
                        }),
                      })
                      const data = await res.json()
                      if (data.success) {
                        setShowRequestChangeModal(false)
                        setRequestChangeItem(null)
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

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:p-4">
          <div className="my-auto flex max-h-[95vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl">
            <div className="flex-shrink-0 border-b border-white/[0.06] p-5 sm:p-6">
              <h2 className="font-display text-xl font-semibold text-white sm:text-2xl">
                {editingItem ? 'Edit Release' : 'Add Release'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto space-y-4 p-5 sm:p-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {formData.releaseType === 'single' ? 'Song Name' : `${formData.releaseType === 'album' ? 'Album' : 'EP'} Title`}
                </label>
                <input
                  type="text"
                  value={formData.song}
                  onChange={(e) => setFormData({ ...formData, song: e.target.value })}
                  required
                  placeholder={formData.releaseType === 'single' ? 'Enter song name' : `Enter ${formData.releaseType === 'album' ? 'album' : 'EP'} title`}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-white transition focus:border-red-500/40 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                />
                {formData.releaseType !== 'single' && (
                  <p className="text-xs text-slate-500 mt-1">
                    Select songs below to add to this {formData.releaseType === 'album' ? 'album' : 'EP'}. You can also add more after creating it.
                  </p>
                )}
              </div>

              {/* Song Selection for Albums/EPs */}
              {formData.releaseType !== 'single' && formData.artistIds.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Select Songs for {formData.releaseType === 'album' ? 'Album' : 'EP'} ({formData.selectedSongIds.length} selected)
                  </label>
                  <div className="max-h-60 overflow-y-auto space-y-2 bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                    {(() => {
                      // Get available singles from selected artists
                      const availableSongs = catalog.filter(item => {
                        if (item.releaseType !== 'single') return false
                        // Check if song belongs to any selected artist
                        if (item.artistIds && item.artistIds.length > 0) {
                          return item.artistIds.some(id => formData.artistIds.includes(id))
                        }
                        return formData.artistIds.includes(item.artistId || '')
                      })
                      
                      if (availableSongs.length === 0) {
                        return (
                          <p className="text-slate-400 text-sm text-center py-4">
                            No singles found for selected artist(s). You can add songs after creating the {formData.releaseType}.
                          </p>
                        )
                      }
                      
                      return (
                        <>
                          <p className="text-xs text-slate-400 mb-2">
                            Select existing singles to include in this {formData.releaseType}:
                          </p>
                          {availableSongs.map((item) => (
                            <label
                              key={item.id}
                              className="flex items-center space-x-3 p-2 hover:bg-slate-700/50 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={formData.selectedSongIds.includes(item.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormData({
                                      ...formData,
                                      selectedSongIds: [...formData.selectedSongIds, item.id],
                                    })
                                  } else {
                                    setFormData({
                                      ...formData,
                                      selectedSongIds: formData.selectedSongIds.filter(id => id !== item.id),
                                    })
                                  }
                                }}
                                className="w-4 h-4 text-red-600 bg-slate-700 border-slate-600 rounded focus:ring-red-500"
                              />
                              <div className="flex-1">
                                <p className="text-white text-sm font-medium">{item.song}</p>
                                {item.isrc && (
                                  <p className="text-xs text-slate-400 font-mono">ISRC: {item.isrc}</p>
                                )}
                                {item.totalStreams > 0 && (
                                  <p className="text-xs text-slate-400">{item.totalStreams.toLocaleString()} streams</p>
                                )}
                              </div>
                            </label>
                          ))}
                        </>
                      )
                    })()}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Artist(s) {formData.artistIds.length > 0 && `(${formData.artistIds.length} selected)`}
                </label>
                <div className="space-y-2 mb-2">
                  <input
                    type="text"
                    value={formData.artist}
                    onChange={(e) => {
                      setFormData({ ...formData, artist: e.target.value })
                    }}
                    placeholder="Enter artist name(s), e.g., 'Artist Name' or 'Artist 1 & Artist 2'"
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-white transition focus:border-red-500/40 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  />
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value && !formData.artistIds.includes(e.target.value)) {
                        const selected = users.find(u => u.id === e.target.value)
                        const newArtistIds = [...formData.artistIds, e.target.value]
                        // Always use artistName (display name) like "Od Sleep" instead of real name "Loyce Weaver"
                        const artistNames = newArtistIds.map(id => {
                          const user = users.find(u => u.id === id)
                          // Prioritize artistName - this is the display name (e.g., "Od Sleep")
                          return user?.artistName || user?.name || ''
                        }).filter(Boolean)
                        // Replace artist field with linked user's display names
                        setFormData({ 
                          ...formData, 
                          artistIds: newArtistIds,
                          artistId: newArtistIds[0] || '', // Keep first for backwards compatibility
                          artist: artistNames.join(' & ') // Use display names from linked users
                        })
                        e.target.value = '' // Reset select
                      }
                    }}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-white transition focus:border-red-500/40 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  >
                    <option value="">Link to user account (optional)...</option>
                    {users.filter(u => !formData.artistIds.includes(u.id)).map(u => (
                      <option key={u.id} value={u.id}>{u.artistName || u.name}</option>
                    ))}
                  </select>
                  {formData.artistIds.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.artistIds.map(artistId => {
                        const user = users.find(u => u.id === artistId)
                        return (
                          <span
                            key={artistId}
                            className="inline-flex items-center space-x-1 px-3 py-1 bg-red-500/20 text-red-400 rounded-lg text-sm"
                          >
                            <span>{user?.artistName || user?.name}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const newArtistIds = formData.artistIds.filter(id => id !== artistId)
                                const artistNames = newArtistIds.map(id => {
                                  const u = users.find(us => us.id === id)
                                  return u?.artistName || u?.name || ''
                                }).filter(Boolean)
                                setFormData({
                                  ...formData,
                                  artistIds: newArtistIds,
                                  artistId: newArtistIds[0] || '',
                                  artist: artistNames.join(' & ') || ''
                                })
                              }}
                              className="text-red-400 hover:text-red-300 ml-1"
                            >
                              ×
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  value={formData.artist}
                  onChange={(e) => {
                    // Always save the artist name as typed
                    const artistName = e.target.value
                    
                    // Parse artist string to detect multiple artists and try to match to user accounts
                    const parsedArtists = parseArtistsFromString(artistName)
                    const matchedIds = matchArtistsToUsers(parsedArtists, users)
                    
                    // Always preserve the artist name, even if no user accounts match
                    // This allows saving artists like "Lilpoetiq" without requiring a user account
                    setFormData({ 
                      ...formData, 
                      artist: artistName, // Always save the typed name
                      artistIds: matchedIds.length > 0 ? matchedIds : formData.artistIds, // Only update IDs if matches found
                      artistId: matchedIds[0] || '' // Keep existing artistId if no matches
                    })
                  }}
                  placeholder="Enter artist name(s) - e.g., 'Style One & Lilpoetiq' or 'Lilpoetiq feat. Od Sleep'"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-white transition focus:border-red-500/40 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Type artist names separated by &, feat., or comma. Matching accounts will be auto-selected above.
                </p>
              </div>
              {addModalSuggestedExample && formData.artistIds?.length > 0 && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-sm font-medium text-blue-400 mb-1">Suggested Past Campaign Example</p>
                  {addModalSuggestedExample.hasExample ? (
                    <p className="text-slate-300 text-sm">
                      Use <span className="font-medium">{addModalSuggestedExample.example.song}</span> by {addModalSuggestedExample.example.artist} as a blueprint.
                      {addModalSuggestedExample.useAsLearningOnly && (
                        <span className="text-amber-400 text-xs block mt-1">Use as learning example only (weak outcome).</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-slate-400 text-sm">{addModalSuggestedExample.message}</p>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Release Type</label>
                <select
                  value={formData.releaseType}
                  onChange={(e) => setFormData({ ...formData, releaseType: e.target.value as 'single' | 'ep' | 'album' })}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-white transition focus:border-red-500/40 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                >
                  <option value="single">Single</option>
                  <option value="ep">EP</option>
                  <option value="album">Album</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Release Date</label>
                <input
                  type="date"
                  value={formData.releaseDate}
                  onChange={(e) => setFormData({ ...formData, releaseDate: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-white transition focus:border-red-500/40 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                />
                <p className="text-xs text-slate-500 mt-1">Leave empty for CSV-imported songs</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Distributor</label>
                <input
                  type="text"
                  value={formData.distributor}
                  onChange={(e) => setFormData({ ...formData, distributor: e.target.value })}
                  placeholder="e.g., Empire, Orchard, DistroKid, etc."
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-white transition focus:border-red-500/40 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Song File (Optional)</label>
                <input
                  type="file"
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0]
                    setFormData({ ...formData, file: selectedFile || null })
                  }}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-red-600 file:text-white hover:file:bg-red-700"
                />
                <p className="text-xs text-slate-500 mt-1">Upload audio files, artwork, or other assets</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    UPC {formData.releaseDate && new Date(formData.releaseDate) < new Date() && <span className="text-red-400">*</span>}
                  </label>
                  <input
                    type="text"
                    value={formData.upc}
                    onChange={(e) => setFormData({ ...formData, upc: e.target.value })}
                    required={formData.releaseDate ? new Date(formData.releaseDate) < new Date() : false}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-white transition focus:border-red-500/40 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    ISRC {formData.releaseDate && new Date(formData.releaseDate) < new Date() && <span className="text-red-400">*</span>}
                  </label>
                  <input
                    type="text"
                    value={formData.isrc}
                    onChange={(e) => setFormData({ ...formData, isrc: e.target.value })}
                    required={formData.releaseDate ? new Date(formData.releaseDate) < new Date() : false}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-white transition focus:border-red-500/40 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500">
                * Required for past releases
              </p>
              </div>
              {/* Fixed footer with buttons */}
              <div className="flex-shrink-0 p-4 sm:p-6 pt-4 border-t border-slate-800 flex space-x-3">
                <button
                  type="submit"
                  disabled={isUploading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                >
                  {isUploading ? 'Uploading...' : (editingItem ? 'Update' : 'Add')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setEditingItem(null)
                  }}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 px-4 rounded-lg transition min-h-[44px]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:p-4">
          <div className="my-auto flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl sm:max-w-4xl">
            <div className="flex-shrink-0 border-b border-white/[0.06] p-5 sm:p-6">
              <h2 className="font-display text-xl font-semibold text-white sm:text-2xl">Bulk import</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Paste from Sheets or Excel. We detect columns and ask you to confirm mapping.
              </p>
            </div>
            
            <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Paste data</label>
                <textarea
                  value={pastedData}
                  onChange={async (e) => {
                    setPastedData(e.target.value)
                    await parsePastedData(e.target.value)
                  }}
                  placeholder="Paste your spreadsheet data here (with or without headers)..."
                  className="h-48 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 font-mono text-sm text-white focus:border-red-500/40 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Tip: Copy from Google Sheets/Excel and paste here. We'll detect tabs, commas, or spaces automatically.
                  <br />
                  <span className="text-blue-400">💡 Google Docs links will be automatically fetched for UPC/ISRC data!</span>
                </p>
              </div>

              {/* Column Mapping Step */}
              {showMappingStep && detectedColumns.length > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-4">Confirm Column Mapping</h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Review the detected mapping below. Adjust if needed, then click "Apply Mapping" to continue.
                  </p>
                  
                  {/* Sample row preview */}
                  {sampleRow.length > 0 && (
                    <div className="mb-4 p-3 bg-slate-900/50 rounded border border-slate-600">
                      <p className="text-xs text-slate-400 mb-2">Sample row preview:</p>
                      <div className="flex flex-wrap gap-2">
                        {sampleRow.map((cell, idx) => (
                          <span key={idx} className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300">
                            Col {idx + 1}: {cell.substring(0, 30)}{cell.length > 30 ? '...' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {[
                      { key: 'song', label: 'Song/Title', required: true },
                      { key: 'artist', label: 'Artist', required: true },
                      { key: 'releaseType', label: 'Release Type (Single/EP/Album)', required: false },
                      { key: 'releaseDate', label: 'Release Date', required: false },
                      { key: 'distributor', label: 'Distributor', required: false },
                      { key: 'upc', label: 'UPC', required: false },
                      { key: 'isrc', label: 'ISRC', required: false },
                      { key: 'googleDoc', label: 'Google Docs Link (for UPC/ISRC)', required: false },
                      { key: 'songLinks', label: 'Song Links (Song Vault)', required: false },
                    ].map(({ key, label, required }) => (
                      <div key={key} className="flex items-center space-x-3">
                        <label className="text-sm text-slate-300 w-48">
                          {label} {required && <span className="text-red-400">*</span>}
                        </label>
                        <select
                          value={columnMapping[key] !== null ? columnMapping[key] : ''}
                          onChange={(e) => {
                            setColumnMapping({
                              ...columnMapping,
                              [key]: e.target.value === '' ? null : parseInt(e.target.value),
                            })
                          }}
                          className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        >
                          <option value="">-- Not mapped --</option>
                          {detectedColumns.map((col, idx) => (
                            <option key={idx} value={idx}>
                              Column {idx + 1}: {col.substring(0, 50)}{col.length > 50 ? '...' : ''}
                            </option>
                          ))}
                        </select>
                        {columnMapping[key] !== null && sampleRow[columnMapping[key]!] && (
                          <span className="text-xs text-green-400">
                            → "{sampleRow[columnMapping[key]!].substring(0, 20)}{sampleRow[columnMapping[key]!].length > 20 ? '...' : ''}"
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={applyMappingAndParse}
                    className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition"
                  >
                    Apply Mapping & Parse Data
                  </button>
                </div>
              )}

              {parsedData.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3 flex items-center space-x-2">
                    <span>Preview ({parsedData.length} item{parsedData.length !== 1 ? 's' : ''} found)</span>
                    {isFetchingDocs && (
                      <div className="flex items-center space-x-2 text-blue-400 text-sm">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                        <span>Fetching from Google Docs...</span>
                      </div>
                    )}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="text-left py-2 px-3 text-slate-400">Song</th>
                          <th className="text-left py-2 px-3 text-slate-400">Artist</th>
                          <th className="text-left py-2 px-3 text-slate-400">Type</th>
                          <th className="text-left py-2 px-3 text-slate-400">Date</th>
                          <th className="text-left py-2 px-3 text-slate-400">Distributor</th>
                          <th className="text-left py-2 px-3 text-slate-400">UPC</th>
                          <th className="text-left py-2 px-3 text-slate-400">ISRC</th>
                          <th className="text-left py-2 px-3 text-slate-400">Song Links</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedData.slice(0, 10).map((item, idx) => (
                          <tr key={idx} className="border-b border-slate-800/50">
                            <td className="py-2 px-3 text-white">{item.song}</td>
                            <td className="py-2 px-3 text-slate-300">{item.artist}</td>
                            <td className="py-2 px-3 text-slate-300 capitalize">{item.releaseType}</td>
                            <td className="py-2 px-3 text-slate-300">{item.releaseDate || '—'}</td>
                            <td className="py-2 px-3 text-slate-300">
                              {item.distributor ? (
                                (() => {
                                  const distributorUrl = getDistributorUrl(item.distributor)
                                  return distributorUrl ? (
                                    <a
                                      href={distributorUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center space-x-1 text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                                    >
                                      <span>{item.distributor}</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  ) : (
                                    <span>{item.distributor}</span>
                                  )
                                })()
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-300 font-mono text-xs">
                              {(item.upc && item.upc.toLowerCase() !== 'unknown') ? item.upc : (item.googleDocUrl ? '📄 Fetching...' : '')}
                            </td>
                            <td className="py-2 px-3 text-slate-300 font-mono text-xs">
                              {item.isrc || (item.googleDocUrl ? '📄 Fetching...' : '—')}
                            </td>
                            <td className="py-2 px-3 text-slate-300 text-xs">
                              {item.songLinks ? (
                                <span className="text-blue-400">📁 Will add to vault</span>
                              ) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {parsedData.length > 10 && (
                      <p className="text-xs text-slate-500 mt-2">Showing first 10 of {parsedData.length} items</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            {/* Fixed footer with buttons */}
            <div className="flex-shrink-0 p-4 sm:p-6 pt-4 border-t border-slate-800 flex space-x-3">
              <button
                onClick={async () => {
                  if (!showMappingStep) {
                    setShowMappingStep(true)
                  } else {
                    await handleBulkImport()
                  }
                }}
                disabled={isImporting || (showMappingStep && parsedData.length === 0)}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center space-x-2"
              >
                {isImporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Importing {parsedData.length} Item{parsedData.length !== 1 ? 's' : ''}...</span>
                  </>
                ) : showMappingStep ? (
                  <>
                    <Check className="w-5 h-5" />
                    <span>Import {parsedData.length} Item{parsedData.length !== 1 ? 's' : ''}</span>
                  </>
                ) : (
                  'Continue to Mapping'
                )}
              </button>
              <button
                onClick={() => {
                  setShowBulkImportModal(false)
                  setPastedData('')
                  setParsedData([])
                  setShowMappingStep(false)
                  setColumnMapping({
                    song: null,
                    artist: null,
                    releaseType: null,
                    releaseDate: null,
                    distributor: null,
                    upc: null,
                    isrc: null,
                    googleDoc: null,
                  })
                  setDetectedColumns([])
                  setSampleRow([])
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 px-4 rounded-lg transition min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Songs Modal for EP/Album */}
      {showSongsModal && selectedRelease && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full my-auto max-h-[95vh] flex flex-col">
            <div className="p-4 sm:p-6 pb-4 flex-shrink-0 border-b border-slate-800">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
                {selectedRelease.releaseType === 'album' ? 'Album' : selectedRelease.releaseType === 'ep' ? 'EP' : 'Release'} Tracklist: {selectedRelease.song}
              </h2>
              <p className="text-sm text-slate-400">
                {selectedRelease.releaseType === 'album' ? 'Add songs to this album. You can select existing singles or add new songs.' : 
                 selectedRelease.releaseType === 'ep' ? 'Add songs to this EP. You can select existing singles or add new songs.' :
                 'Manage songs for this release.'}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              <div className="space-y-4">
              {/* Total Streams and Divide Button */}
              {selectedRelease && (
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm text-slate-400">Total Album Streams</p>
                      <div className="flex items-center space-x-2">
                        <p className="text-white font-semibold text-xl">{selectedRelease.totalStreams.toLocaleString()}</p>
                        {user?.role !== 'artist' && (
                          <button
                            onClick={async () => {
                              const newTotal = prompt('Enter new total album streams:', selectedRelease.totalStreams.toString())
                              if (newTotal !== null) {
                                const parsedTotal = parseInt(newTotal.replace(/,/g, '')) || 0
                                try {
                                  const res = await fetch('/api/catalog', {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      id: selectedRelease.id,
                                      totalStreams: parsedTotal,
                                      userRole: user?.role || '',
                                    }),
                                  })
                                  const data = await res.json()
                                  if (data.success) {
                                    setSelectedRelease({ ...selectedRelease, totalStreams: parsedTotal })
                                    fetchCatalog()
                                  } else {
                                    alert(data.error || 'Failed to update total streams')
                                  }
                                } catch (error) {
                                  console.error('Failed to update total streams:', error)
                                  alert('Failed to update total streams')
                                }
                              }
                            }}
                            className="text-xs text-blue-400 hover:text-blue-300 underline"
                            title="Edit total album streams"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                    {releaseSongs.length > 0 && (
                      <div className="text-right">
                        <p className="text-sm text-slate-400">Songs Total</p>
                        <p className={`text-white font-semibold text-xl ${
                          releaseSongs.reduce((sum, song) => sum + (song.streams || 0), 0) !== selectedRelease.totalStreams
                            ? 'text-yellow-400' 
                            : ''
                        }`}>
                          {releaseSongs.reduce((sum, song) => sum + (song.streams || 0), 0).toLocaleString()}
                        </p>
                        {releaseSongs.reduce((sum, song) => sum + (song.streams || 0), 0) !== selectedRelease.totalStreams && (
                          <p className="text-xs text-yellow-400 mt-1">
                            {releaseSongs.reduce((sum, song) => sum + (song.streams || 0), 0) > selectedRelease.totalStreams 
                              ? 'Exceeds album total' 
                              : 'Less than album total'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  {releaseSongs.length > 0 && (
                    <div className="flex space-x-2 mt-2">
                      {selectedRelease.totalStreams > 0 && (
                        <button
                          onClick={handleDivideStreams}
                          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold py-2 px-4 rounded-lg transition"
                          title="Divide total album streams evenly among all songs"
                        >
                          Divide Streams Evenly ({Math.floor(selectedRelease.totalStreams / releaseSongs.length).toLocaleString()} per song)
                        </button>
                      )}
                      <button
                        onClick={() => {
                          // Update album total to match songs total
                          const songsTotal = releaseSongs.reduce((sum, song) => sum + (song.streams || 0), 0)
                          if (songsTotal !== selectedRelease.totalStreams) {
                            if (confirm(`Update album total streams to ${songsTotal.toLocaleString()} (sum of all songs)?`)) {
                              setSelectedRelease({ ...selectedRelease, totalStreams: songsTotal })
                            }
                          }
                        }}
                        className={`flex-1 text-sm font-semibold py-2 px-4 rounded-lg transition ${
                          releaseSongs.reduce((sum, song) => sum + (song.streams || 0), 0) !== selectedRelease.totalStreams
                            ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                            : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                        }`}
                        disabled={releaseSongs.reduce((sum, song) => sum + (song.streams || 0), 0) === selectedRelease.totalStreams}
                        title="Set album total to sum of all songs"
                      >
                        Sync to Songs Total
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              {/* Select from existing catalog */}
              <div className="border-b border-slate-700 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-white">Select from Catalog</h3>
                  <button
                    onClick={() => setShowSongSelector(!showSongSelector)}
                    className="text-sm text-blue-400 hover:text-blue-300 transition"
                  >
                    {showSongSelector ? 'Hide' : 'Show'} Available Songs
                  </button>
                </div>
                
                {showSongSelector && (
                  <div className="max-h-60 overflow-y-auto space-y-2 bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                    {getAvailableSongs().length === 0 ? (
                      <p className="text-slate-400 text-sm">No singles found for this artist. Add songs manually below.</p>
                    ) : (
                      <>
                        <p className="text-xs text-slate-400 mb-2">Select existing singles to add to this {selectedRelease.releaseType}:</p>
                        {getAvailableSongs().map((item) => (
                          <label
                            key={item.id}
                            className="flex items-center space-x-3 p-2 hover:bg-slate-700/50 rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedSongIds.has(item.id)}
                              onChange={() => handleToggleSongSelection(item.id, item.song, item.isrc, item.totalStreams)}
                              className="w-4 h-4 text-red-600 bg-slate-700 border-slate-600 rounded focus:ring-red-500"
                            />
                            <div className="flex-1">
                              <p className="text-white text-sm font-medium">{item.song}</p>
                              {item.isrc && (
                                <p className="text-xs text-slate-400 font-mono">ISRC: {item.isrc}</p>
                              )}
                              {item.totalStreams > 0 && (
                                <p className="text-xs text-slate-400">{item.totalStreams.toLocaleString()} streams</p>
                              )}
                            </div>
                            <a
                              href={`/dashboard/catalog/${item.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-blue-400 hover:text-blue-300"
                            >
                              View →
                            </a>
                          </label>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
              
              {/* Manually add new song */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Add New Song</h3>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newSongName}
                  onChange={(e) => setNewSongName(e.target.value)}
                  placeholder="Song name"
                  className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddSongToRelease()}
                />
                <input
                  type="text"
                  value={newSongISRC}
                  onChange={(e) => setNewSongISRC(e.target.value)}
                  placeholder="ISRC (optional)"
                  className="w-48 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddSongToRelease()}
                />
                <button
                  onClick={handleAddSongToRelease}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
                >
                  Add Song
                </button>
                </div>
              </div>
            </div>

            <div className="space-y-2 mb-6">
              {releaseSongs.length === 0 ? (
                <div className="text-center py-8 bg-slate-800/30 rounded-lg border border-slate-700">
                  <p className="text-slate-400 text-sm mb-2">No songs added yet</p>
                  <p className="text-xs text-slate-500">Select songs from the catalog above or add new songs manually</p>
                </div>
              ) : (
                releaseSongs.map((song, index) => (
                  <div
                    key={song.id}
                    className="flex items-center space-x-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700 group"
                  >
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <GripVertical className="w-4 h-4 text-slate-500" />
                      <span className="text-xs text-slate-500 font-mono w-6">{index + 1}.</span>
                      <button
                        onClick={() => {
                          if (index > 0) {
                            const newSongs = [...releaseSongs]
                            const temp = newSongs[index]
                            newSongs[index] = newSongs[index - 1]
                            newSongs[index - 1] = temp
                            setReleaseSongs(newSongs)
                          }
                        }}
                        disabled={index === 0}
                        className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
                        title="Move up"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (index < releaseSongs.length - 1) {
                            const newSongs = [...releaseSongs]
                            const temp = newSongs[index]
                            newSongs[index] = newSongs[index + 1]
                            newSongs[index + 1] = temp
                            setReleaseSongs(newSongs)
                          }
                        }}
                        disabled={index === releaseSongs.length - 1}
                        className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
                        title="Move down"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium">{song.song}</p>
                      {editingISRC === song.id ? (
                        <div className="flex items-center space-x-2 mt-1">
                          <input
                            type="text"
                            value={editingISRCValue}
                            onChange={(e) => setEditingISRCValue(e.target.value)}
                            placeholder="Enter ISRC"
                            className="flex-1 px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-white font-mono focus:outline-none focus:ring-1 focus:ring-red-500"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                const newSongs = releaseSongs.map(s => 
                                  s.id === song.id 
                                    ? { ...s, isrc: editingISRCValue.trim() || undefined }
                                    : s
                                )
                                setReleaseSongs(newSongs)
                                setEditingISRC(null)
                                setEditingISRCValue('')
                              } else if (e.key === 'Escape') {
                                setEditingISRC(null)
                                setEditingISRCValue('')
                              }
                            }}
                            autoFocus
                          />
                          <button
                            onClick={() => {
                              const newSongs = releaseSongs.map(s => 
                                s.id === song.id 
                                  ? { ...s, isrc: editingISRCValue.trim() || undefined }
                                  : s
                              )
                              setReleaseSongs(newSongs)
                              setEditingISRC(null)
                              setEditingISRCValue('')
                            }}
                            className="text-xs text-green-400 hover:text-green-300 px-2"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => {
                              setEditingISRC(null)
                              setEditingISRCValue('')
                            }}
                            className="text-xs text-red-400 hover:text-red-300 px-2"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 mt-1">
                          {song.isrc ? (
                            <>
                              <p className="text-xs text-slate-400 font-mono">ISRC: {song.isrc}</p>
                              <button
                                onClick={() => {
                                  setEditingISRC(song.id)
                                  setEditingISRCValue(song.isrc || '')
                                }}
                                className="text-xs text-blue-400 hover:text-blue-300 underline"
                                title="Edit ISRC"
                              >
                                Edit
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingISRC(song.id)
                                setEditingISRCValue('')
                              }}
                              className="text-xs text-blue-400 hover:text-blue-300 underline"
                              title="Add ISRC"
                            >
                              Add ISRC
                            </button>
                          )}
                        </div>
                      )}
                      {editingSongStreams === song.id ? (
                        <div className="flex items-center space-x-2 mt-1">
                          <input
                            type="number"
                            value={editingSongStreamsValue}
                            onChange={(e) => setEditingSongStreamsValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const newStreams = parseInt(editingSongStreamsValue.replace(/,/g, '')) || 0
                                const newSongs = releaseSongs.map(s => 
                                  s.id === song.id 
                                    ? { ...s, streams: newStreams }
                                    : s
                                )
                                setReleaseSongs(newSongs)
                                setEditingSongStreams(null)
                                setEditingSongStreamsValue('')
                              } else if (e.key === 'Escape') {
                                setEditingSongStreams(null)
                                setEditingSongStreamsValue('')
                              }
                            }}
                            className="w-24 px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                            autoFocus
                            placeholder="0"
                          />
                          <button
                            onClick={() => {
                              const newStreams = parseInt(editingSongStreamsValue.replace(/,/g, '')) || 0
                              const newSongs = releaseSongs.map(s => 
                                s.id === song.id 
                                  ? { ...s, streams: newStreams }
                                  : s
                              )
                              setReleaseSongs(newSongs)
                              setEditingSongStreams(null)
                              setEditingSongStreamsValue('')
                            }}
                            className="text-xs text-green-400 hover:text-green-300 px-1"
                            title="Save"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => {
                              setEditingSongStreams(null)
                              setEditingSongStreamsValue('')
                            }}
                            className="text-xs text-red-400 hover:text-red-300 px-1"
                            title="Cancel"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 mt-1 group/stream">
                          <p className="text-xs text-slate-400">
                            {song.streams ? `${song.streams.toLocaleString()} streams` : '0 streams'}
                          </p>
                          {user?.role !== 'artist' && (
                            <button
                              onClick={() => {
                                setEditingSongStreams(song.id)
                                setEditingSongStreamsValue((song.streams || 0).toString())
                              }}
                              className="opacity-0 group-hover/stream:opacity-100 text-xs text-blue-400 hover:text-blue-300 underline transition-opacity"
                              title="Edit streams"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveSong(song.id)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
              </div>
            </div>
            {/* Fixed footer with buttons */}
            <div className="flex-shrink-0 p-4 sm:p-6 pt-4 border-t border-slate-800 flex space-x-3">
              <button
                onClick={handleSaveReleaseSongs}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-lg transition min-h-[44px]"
              >
                Save Tracklist ({releaseSongs.length} {releaseSongs.length === 1 ? 'song' : 'songs'})
              </button>
              <button
                onClick={() => {
                  setShowSongsModal(false)
                  setSelectedRelease(null)
                  setReleaseSongs([])
                  setNewSongName('')
                  setNewSongISRC('')
                  setAddingToAlbum(null)
                  fetchCatalog() // Refresh to show updated tracklist
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 px-4 rounded-lg transition min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audio Upload Modal */}
      {showAudioUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:p-4">
          <div className="my-auto flex max-h-[95vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl">
            <div className="flex-shrink-0 border-b border-white/[0.06] p-5 sm:p-6">
              <h2 className="font-display text-xl font-semibold text-white sm:text-2xl">Upload audio</h2>
            </div>
            <form onSubmit={handleAudioUpload} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Song Name *
                </label>
                <input
                  type="text"
                  value={audioUploadData.songName}
                  onChange={(e) => setAudioUploadData({ ...audioUploadData, songName: e.target.value })}
                  required
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-white transition focus:border-red-500/40 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  placeholder="Enter song name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Release Date (Optional)
                </label>
                <input
                  type="date"
                  value={audioUploadData.releaseDate}
                  onChange={(e) => setAudioUploadData({ ...audioUploadData, releaseDate: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-white transition focus:border-red-500/40 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Audio File (Any Format) *
                </label>
                <input
                  type="file"
                  accept="audio/*,*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      // Validate file size
                      if (file.size === 0) {
                        alert('Selected file is empty. Please choose a valid audio file.')
                        return
                      }
                      setAudioUploadData({ ...audioUploadData, file })
                    }
                  }}
                  required
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-red-600 file:text-white hover:file:bg-red-700"
                />
                {audioUploadData.file && (
                  <p className="text-sm text-slate-400 mt-2">
                    Selected: {audioUploadData.file.name} ({(audioUploadData.file.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>
              <p className="text-xs text-slate-400 text-center">
                Your audio file will be added to the catalog after admin approval.
              </p>
              </div>
              {/* Fixed footer with buttons */}
              <div className="flex-shrink-0 p-4 sm:p-6 pt-4 border-t border-slate-800 flex space-x-3">
                <button
                  type="submit"
                  disabled={isUploadingAudio}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                >
                  {isUploadingAudio ? 'Uploading...' : 'Upload'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAudioUploadModal(false)
                    setAudioUploadData({ file: null, songName: '', releaseDate: '' })
                  }}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 px-4 rounded-lg transition min-h-[44px]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Combine Songs Modal */}
      {showCombineModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full my-auto max-h-[95vh] flex flex-col">
            <div className="p-4 sm:p-6 pb-4 flex-shrink-0 border-b border-slate-800">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Combine Songs into Album/EP</h2>
              <p className="text-sm text-slate-400">
                Combining {selectedItems.size} selected song{selectedItems.size !== 1 ? 's' : ''}. 
                The original songs will be removed from the catalog and combined into the new release.
              </p>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault()
              const formData = new FormData(e.target as HTMLFormElement)
              handleCombineSongs(
                formData.get('albumName') as string,
                formData.get('releaseType') as 'album' | 'ep',
                formData.get('artist') as string,
                formData.get('releaseDate') as string,
                formData.get('distributor') as string,
                formData.get('upc') as string,
                formData.get('isrc') as string
              )
            }} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-4 space-y-4">
                <div className="mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <p className="text-xs text-slate-400 mb-2">Selected Songs:</p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {Array.from(selectedItems).map(songId => {
                      const song = catalog.find(s => s.id === songId)
                      return song ? (
                        <div key={songId} className="text-sm text-slate-300">
                          • {song.song} - {song.artist} ({song.totalStreams.toLocaleString()} streams)
                        </div>
                      ) : null
                    })}
                  </div>
                </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Release Type
                </label>
                <select
                  name="releaseType"
                  required
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="ep">EP</option>
                  <option value="album">Album</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Album/EP Name *
                </label>
                <input
                  type="text"
                  name="albumName"
                  required
                  placeholder="Enter album or EP name"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Artist *
                </label>
                <input
                  type="text"
                  name="artist"
                  required
                  placeholder="Enter artist name"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Release Date (Optional)
                </label>
                <input
                  type="date"
                  name="releaseDate"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Distributor (Optional)
                </label>
                <input
                  type="text"
                  name="distributor"
                  placeholder="Enter distributor"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    UPC (Optional)
                  </label>
                  <input
                    type="text"
                    name="upc"
                    placeholder="Enter UPC"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    ISRC (Optional)
                  </label>
                  <input
                    type="text"
                    name="isrc"
                    placeholder="Enter ISRC"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
              </div>
              {/* Fixed footer with buttons */}
              <div className="flex-shrink-0 p-4 sm:p-6 pt-4 border-t border-slate-800 flex space-x-3">
                <button
                  type="submit"
                  disabled={isUploading}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-lg transition min-h-[44px]"
                >
                  {isUploading ? 'Combining...' : 'Combine Songs'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCombineModal(false)
                    setSelectedItems(new Set())
                  }}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 px-4 rounded-lg transition min-h-[44px]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collaborative Song Account Modal */}
      {showCollaborativeModal && selectedCollaborativeSong && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold text-white mb-4">Set Collaborative Song Account</h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Song</label>
                <input
                  type="text"
                  value={selectedCollaborativeSong.song}
                  disabled
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 cursor-not-allowed"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Artists</label>
                <input
                  type="text"
                  value={selectedCollaborativeSong.artist}
                  disabled
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Link to Account (Primary)
                </label>
                <select
                  value={collaborativePrimaryUserId && users.some(u => u.id === collaborativePrimaryUserId && selectedCollaborativeSong.artistIds?.includes(u.id)) ? collaborativePrimaryUserId : ''}
                  onChange={(e) => setCollaborativePrimaryUserId(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-white transition focus:border-red-500/40 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                >
                  <option value="">Select account...</option>
                  {users.filter(u => selectedCollaborativeSong.artistIds?.includes(u.id)).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} {u.username ? `(@${u.username})` : ''} {u.email ? `- ${u.email}` : ''}
                    </option>
                  ))}
                </select>
                {collaborativePrimaryUserId && !users.some(u => u.id === collaborativePrimaryUserId && selectedCollaborativeSong.artistIds?.includes(u.id)) && (
                  <p className="text-xs text-yellow-400 mt-1">
                    Selected account not found. Please select an account from the list.
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-1">
                  This song will appear on the selected account's artist page. Other collaborators will still see it but it won't count toward their song totals.
                </p>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleSaveCollaborativeAccount}
                disabled={!collaborativePrimaryUserId}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setShowCollaborativeModal(false)
                  setSelectedCollaborativeSong(null)
                  setCollaborativePrimaryUserId('')
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
