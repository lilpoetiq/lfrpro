'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { TrendingUp, TrendingDown, Clock, CheckCircle, AlertCircle, BarChart3, Music, Instagram, Play, Users, Info, HelpCircle, Link2, X, ExternalLink, Sparkles, Lock, Video, Target, Zap, Gauge, Shield, AlertTriangle, MessageSquare, Send, Lightbulb, Loader2, TrendingUp as GrowthIcon, ArrowUpRight, ArrowDownRight, Activity, Award, Rocket, Star, TrendingDown as DeclineIcon, Calendar, DollarSign, Hash, TrendingUp as TrendIcon, Bell, CheckCircle2, Circle, Plus, Edit, Trash2, Filter, RefreshCw, PieChart, LineChart, BarChart, TrendingDown as DownIcon, Eye, EyeOff, Copy, Share2, ThumbsUp, MessageCircle, Heart, Bookmark, Repeat, Compass, Globe, MapPin, Timer, Flame, Crown, Trophy, Gift, Megaphone, UserPlus, Coins, Wallet, FileText, ClipboardList, Calendar as CalendarIcon, Clock as ClockIcon, TrendingUp as UpIcon, XCircle } from 'lucide-react'
import { useReadinessData } from '@/hooks/useReadinessData'
import { LANE_DEFINITIONS } from '@/lib/laneDefinitions'
import ReleaseDecisionUI from '@/components/ReleaseDecisionUI'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Add custom styles for animations
const customStyles = `
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }
  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 5px rgba(59, 130, 246, 0.5); }
    50% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.8); }
  }
  .animate-fade-in {
    animation: fade-in 0.5s ease-out;
  }
  .animate-shake {
    animation: shake 0.5s ease-in-out;
  }
  .animate-pulse-glow {
    animation: pulse-glow 2s ease-in-out infinite;
  }
  .hover-lift {
    transition: transform 0.2s ease-out, box-shadow 0.2s ease-out;
  }
  .hover-lift:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  }
`

interface ReleaseReadinessData {
  readiness: {
    id: string
    artistId: string
    state: 'cooling' | 'building' | 'ready'
    lastUpdated: string
  } | null
  explanations: Array<{
    id: string
    artistId: string
    explanationText: string
    actionSteps: string[]
    laneContext?: string
    adminNotes?: string
    generatedAt: string
  }>
  instagramMetrics: Array<{
    id: string
    artistId: string
    metricDate: string
    views: number
    saves: number
    shares: number
    comments: number
    likes?: number
    completionRate: number
    retention?: number
    skipRate?: number
    interactions?: number
    watchTime?: number
    audience?: number
    facebookVsInstagram?: {
      facebook: number
      instagram: number
    }
    followers: number
    manuallyAdded?: boolean
    addedBy?: string
  }>
  spotifySnapshots: Array<{
    id: string
    artistId: string
    releaseId?: string
    weekStart: string
    streams: number
    listeners: number
    saveRate: number
    playlistAdds: number
    topCities: string[]
    confidence: number
    rawImageUrl?: string
    createdAt: string
  }>
  tikTokMetrics?: Array<{
    id: string
    artistId: string
    metricDate: string
    views: number
    likes?: number
    comments?: number
    shares?: number
    followers: number
    engagementRate?: number
    watchTime?: number
    retention?: number
    manuallyAdded?: boolean
    addedBy?: string
  }>
  tikTokSongViews?: Array<{
    id: string
    songId: string
    songName: string
    artistName: string
    views: number
    metricDate: string
    videoUrl?: string
    manuallyAdded?: boolean
    addedBy?: string
    createdAt: string
  }>
}

interface User {
  id: string
  name: string
  artistName?: string
  role: string
}

export default function ReleaseReadinessPage() {
  const { user, isLoading: authLoading, staffViewMode } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<ReleaseReadinessData | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [selectedArtistId, setSelectedArtistId] = useState<string>('')
  const [instagramStatus, setInstagramStatus] = useState<{
    connected: boolean
    expired: boolean
    instagramAccountId?: string
    tokenExpiresAt?: string
  } | null>(null)
  const [showInstagramConnect, setShowInstagramConnect] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectError, setConnectError] = useState('')
  const [connectForm, setConnectForm] = useState({
    accessToken: '',
    pageId: '',
    instagramAccountId: '',
  })
  const [showManualInput, setShowManualInput] = useState(false)
  const [showTikTokInput, setShowTikTokInput] = useState(false)
  const [showTikTokSongViews, setShowTikTokSongViews] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [manualForm, setManualForm] = useState({
    metricDate: new Date().toISOString().split('T')[0],
    views: '',
    saves: '',
    shares: '',
    comments: '',
    likes: '',
    completionRate: '',
    retention: '',
    skipRate: '',
    interactions: '',
    watchTime: '',
    audience: '',
    facebookViews: '',
    instagramViews: '',
    followers: '',
    videoTitle: '',
    videoLink: '',
  })
  const [instagramEntries, setInstagramEntries] = useState<Array<typeof manualForm>>([])
  const [isUploadingScreenshot, setIsUploadingScreenshot] = useState(false)
  const [screenshotError, setScreenshotError] = useState('')
  const [screenshotSuccess, setScreenshotSuccess] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: { status: 'uploading' | 'success' | 'error', fileName: string, error?: string } }>({})
  
  const [tikTokForm, setTikTokForm] = useState({
    metricDate: new Date().toISOString().split('T')[0],
    views: '',
    likes: '',
    comments: '',
    shares: '',
    followers: '',
    engagementRate: '',
    watchTime: '',
    retention: '',
    videoTitle: '',
    videoLink: '',
  })
  const [tikTokEntries, setTikTokEntries] = useState<Array<typeof tikTokForm>>([])
  const [tikTokSongForm, setTikTokSongForm] = useState({
    songId: '',
    songName: '',
    artistName: '',
    views: '',
    metricDate: new Date().toISOString().split('T')[0],
    videoUrl: '',
  })
  const [catalog, setCatalog] = useState<any[]>([])
  const [enhancedData, setEnhancedData] = useState<any>(null)
  const [releaseGoal, setReleaseGoal] = useState<'streams' | 'discovery' | 'fan-conversion' | 'algorithm-push' | 'revenue'>('streams')
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [overrideForm, setOverrideForm] = useState({
    reason: '',
    overriddenState: 'ready' as 'cooling' | 'building' | 'ready',
  })
  const [showAIIdeas, setShowAIIdeas] = useState(false)
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [aiIdeas, setAiIdeas] = useState<Array<{ id: string, question: string, answer: string, timestamp: string }>>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  
  // Growth Center State
  const [growthData, setGrowthData] = useState<any>(null)
  const [loadingGrowth, setLoadingGrowth] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'content' | 'goals' | 'insights' | 'revenue'>('overview')
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [showCalendarModal, setShowCalendarModal] = useState(false)
  const [newGoal, setNewGoal] = useState({ type: 'followers' as any, target: '', deadline: '', description: '' })
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  // Ref to track if auto-analysis has been triggered for current artist
  const autoAnalysisTriggeredRef = useRef<string>('')
  // Ref to track if we've already checked for auto-analysis (prevents infinite loops)
  const hasCheckedAutoAnalysisRef = useRef(false)

  // Use readiness data hook for the selected artist
  const readinessData = useReadinessData(selectedArtistId || undefined)
  
  // Check if user is staff or admin (can add manual metrics)
  const isStaff = user?.role === 'artist' && 
    Array.isArray(user?.staffPermissions) && 
    user.staffPermissions.length > 0
  const isAdmin = user?.role === 'admin'
  // Staff sees admin view only when in staff mode, otherwise sees their own artist view
  const isStaffView = isStaff && !isAdmin && staffViewMode === 'staff'
  // Only admins and staff in staff mode can add manual metrics (not staff in artist mode)
  const canAddManualMetrics = isAdmin || (isStaff && staffViewMode === 'staff')

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login')
        return
      }
      if (user.role !== 'artist' && user.role !== 'admin') {
        router.push('/dashboard')
        return
      }
      
      // For admins and staff (when in staff mode), fetch users list
      if (user.role === 'admin' || (isStaff && staffViewMode === 'staff')) {
        fetchUsers()
      }
      
      // Set initial artist ID
      if (user.role === 'artist' && user.id) {
        // Staff in artist mode: use their own ID (see own data)
        // Staff in staff mode: will be set after users are fetched (see admin view)
        // Regular artists: use their own ID
        if (isStaff && staffViewMode === 'staff') {
          // Will be set after users are fetched to first artist
        } else {
          // Staff in artist mode or regular artist - see own data
          setSelectedArtistId(user.id)
        }
      }
    }
    // Dependencies: user, authLoading, staffViewMode, isStaff, router
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, staffViewMode])

  useEffect(() => {
    if (selectedArtistId) {
      fetchData()
      checkInstagramConnection()
      fetchGrowthData()
      if (canAddManualMetrics) {
        fetchCatalog()
      }
    }
    // Dependencies: selectedArtistId, canAddManualMetrics, releaseGoal
    // Functions (fetchData, checkInstagramConnection, etc.) are stable and don't need to be in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedArtistId, canAddManualMetrics, releaseGoal])

  // Use readiness data from hook (preferred) or fallback to fetched data
  const readiness = readinessData.readiness || data?.readiness
  const latestExplanation = readinessData.explanation || (data?.explanations && data.explanations.length > 0
    ? data.explanations[data.explanations.length - 1]
    : null)

  const instagramMetrics = useMemo(() => data?.instagramMetrics || [], [data?.instagramMetrics])
  
  const latestInstagram = useMemo(() => {
    if (instagramMetrics.length === 0) return null
    return instagramMetrics.sort((a, b) => new Date(b.metricDate).getTime() - new Date(a.metricDate).getTime())[0]
  }, [instagramMetrics])

  const latestSpotify = useMemo(() => {
    if (!data?.spotifySnapshots || data.spotifySnapshots.length === 0) return null
    return data.spotifySnapshots.sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime())[0]
  }, [data?.spotifySnapshots])

  const latestTikTok = useMemo(() => {
    if (!data?.tikTokMetrics || data.tikTokMetrics.length === 0) return null
    return data.tikTokMetrics.sort((a, b) => new Date(b.metricDate).getTime() - new Date(a.metricDate).getTime())[0]
  }, [data?.tikTokMetrics])

  const tikTokSongViewsList = useMemo(() => data?.tikTokSongViews || [], [data?.tikTokSongViews])

  // Check if we have sufficient data to show detailed analysis
  const hasSufficientData = useMemo(() => 
    instagramMetrics.length >= 3 || (latestInstagram && latestInstagram.views > 0),
    [instagramMetrics.length, latestInstagram]
  )
  
  const hasAnyData = useMemo(() => 
    readiness || latestExplanation || latestInstagram || latestSpotify || latestTikTok,
    [readiness, latestExplanation, latestInstagram, latestSpotify, latestTikTok]
  )

  // Handle AI analysis request - must be defined before useEffect that uses it
  const handleAIAnalysis = useCallback(async (question?: string) => {
    if (!selectedArtistId) return
    
    setIsAnalyzing(true)
    try {
      const res = await fetch('/api/release-readiness/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistId: selectedArtistId,
          question: question || aiQuestion,
          releaseGoal,
        }),
      })
      
      const result = await res.json()
      if (result.success) {
        const newIdea = {
          id: `idea_${Date.now()}`,
          question: question || aiQuestion,
          answer: result.analysis,
          timestamp: new Date().toISOString(),
        }
        setAiIdeas(prev => [newIdea, ...prev])
        setAiAnalysis(result.analysis)
        setAiQuestion('')
      }
    } catch (error) {
      console.error('AI analysis error:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }, [selectedArtistId, aiQuestion, releaseGoal])

  // Auto-analyze on load if we have sufficient data
  useEffect(() => {
    // Reset check flag when artist changes
    if (autoAnalysisTriggeredRef.current !== selectedArtistId) {
      hasCheckedAutoAnalysisRef.current = false
      autoAnalysisTriggeredRef.current = selectedArtistId
    }

    const shouldTrigger = hasSufficientData && 
      selectedArtistId && 
      !hasCheckedAutoAnalysisRef.current &&
      aiIdeas.length === 0 && 
      !isAnalyzing
    
    if (shouldTrigger) {
      hasCheckedAutoAnalysisRef.current = true
      handleAIAnalysis('Analyze my current release readiness and provide strategic recommendations.')
    }
  }, [hasSufficientData, selectedArtistId, handleAIAnalysis])

  const fetchGrowthData = async () => {
    if (!selectedArtistId) return
    setLoadingGrowth(true)
    try {
      const res = await fetch(`/api/growth-analytics?artistId=${selectedArtistId}&type=all`)
      const result = await res.json()
      if (result.success) {
        setGrowthData(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch growth data:', error)
    } finally {
      setLoadingGrowth(false)
    }
  }

  const fetchCatalog = async () => {
    try {
      const res = await fetch('/api/catalog')
      const result = await res.json()
      if (result.success) {
        setCatalog(result.catalog || [])
      }
    } catch (error) {
      console.error('Failed to fetch catalog:', error)
    }
  }

  const checkInstagramConnection = async () => {
    if (!selectedArtistId) return
    
    try {
      const res = await fetch(`/api/instagram/connect?artistId=${selectedArtistId}`)
      const result = await res.json()
      if (result.success) {
        setInstagramStatus(result.data)
        // Show connect modal if not connected and user is artist (not admin viewing)
        if (!result.data.connected && user?.role === 'artist' && user.id === selectedArtistId) {
          setShowInstagramConnect(true)
        }
      }
    } catch (error) {
      console.error('Failed to check Instagram connection:', error)
    }
  }

  const handleConnectInstagram = async () => {
    if (!selectedArtistId) return
    
    setIsConnecting(true)
    setConnectError('')

    try {
      const res = await fetch('/api/instagram/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistId: selectedArtistId,
          accessToken: connectForm.accessToken,
          pageId: connectForm.pageId || undefined,
          instagramAccountId: connectForm.instagramAccountId || undefined,
          exchangeToken: true, // Exchange for long-lived token
          adminUserId: isAdmin ? user?.id : undefined, // Include admin ID if admin is connecting
        }),
      })

      const result = await res.json()

      if (result.success) {
        setShowInstagramConnect(false)
        setConnectForm({ accessToken: '', pageId: '', instagramAccountId: '' })
        await checkInstagramConnection()
        // Refresh readiness data
        if (selectedArtistId) {
          fetchData()
        }
      } else {
        // Show detailed error message
        const errorMessage = result.details 
          ? `${result.error}\n\n${result.details}`
          : result.error || 'Failed to connect Instagram account'
        setConnectError(errorMessage)
      }
    } catch (error: any) {
      setConnectError(error.message || 'Failed to connect Instagram account')
    } finally {
      setIsConnecting(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users')
      const result = await res.json()
      if (result.success) {
        const artistUsers = result.users.filter((u: User) => u.role === 'artist')
        setUsers(artistUsers)
        // Auto-select first artist if available (for admin/staff view)
        if (artistUsers.length > 0 && !selectedArtistId) {
          // For staff in staff mode, default to first artist; for admins, same behavior
          if (isStaff && staffViewMode === 'staff') {
            setSelectedArtistId(artistUsers[0].id)
          } else if (isAdmin) {
            setSelectedArtistId(artistUsers[0].id)
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  const fetchData = async () => {
    if (!selectedArtistId) return
    
    try {
      const [basicRes, enhancedRes] = await Promise.all([
        fetch(`/api/release-readiness?artistId=${selectedArtistId}&type=all`),
        fetch(`/api/release-readiness?artistId=${selectedArtistId}&type=all&enhanced=true&goal=${releaseGoal}`),
      ])
      
      const basicResult = await basicRes.json()
      const enhancedResult = await enhancedRes.json()
      
      if (basicResult.success) {
        setData(basicResult.data)
      }
      
      if (enhancedResult.success && enhancedResult.data.enhanced) {
        setEnhancedData(enhancedResult.data.enhanced)
      }
    } catch (error) {
      console.error('Failed to fetch release readiness data:', error)
    }
  }

  const resetInstagramForm = () => ({
    metricDate: new Date().toISOString().split('T')[0],
    views: '',
    saves: '',
    shares: '',
    comments: '',
    likes: '',
    completionRate: '',
    retention: '',
    skipRate: '',
    interactions: '',
    watchTime: '',
    audience: '',
    facebookViews: '',
    instagramViews: '',
    followers: '',
    videoTitle: '',
    videoLink: '',
  })

  const handleAddInstagramEntry = () => {
    if (!manualForm.metricDate || !manualForm.followers || !manualForm.views) {
      setSubmitError('Please fill in required fields (Date, Followers, Views) before adding another entry')
      return
    }
    setInstagramEntries([...instagramEntries, { ...manualForm }])
    setManualForm(resetInstagramForm())
    setSubmitError('')
  }

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    if (!selectedArtistId) {
      setScreenshotError('No artist selected')
      return
    }

    setIsUploadingScreenshot(true)
    setScreenshotError('')
    setScreenshotSuccess(false)
    
    // Initialize progress tracking for all files
    const initialProgress: typeof uploadProgress = {}
    Array.from(files).forEach((file, index) => {
      initialProgress[`file-${index}`] = { status: 'uploading', fileName: file.name }
    })
    setUploadProgress(initialProgress)

    let successCount = 0
    let errorCount = 0
    let lastSuccessfulData: any = null

    // Process all files
    const uploadPromises = Array.from(files).map(async (file, index) => {
      const fileKey = `file-${index}`
      
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('artistId', selectedArtistId)
        if (user?.id) {
          formData.append('addedBy', user.id)
        }

        const res = await fetch('/api/instagram-screenshot', {
          method: 'POST',
          body: formData,
        })

        const result = await res.json()

        if (result.success) {
          successCount++
          setUploadProgress(prev => ({
            ...prev,
            [fileKey]: { status: 'success', fileName: file.name }
          }))
          
          // Store the last successful data for form population
          if (result.data && result.processed) {
            lastSuccessfulData = result.data
          }
        } else {
          errorCount++
          setUploadProgress(prev => ({
            ...prev,
            [fileKey]: { 
              status: 'error', 
              fileName: file.name,
              error: result.error || 'Failed to process screenshot'
            }
          }))
        }
      } catch (error: any) {
        errorCount++
        setUploadProgress(prev => ({
          ...prev,
          [fileKey]: { 
            status: 'error', 
            fileName: file.name,
            error: error.message || 'Failed to upload screenshot'
          }
        }))
      }
    })

    // Wait for all uploads to complete
    await Promise.all(uploadPromises)

    // Refresh data if any uploads succeeded
    if (successCount > 0) {
      setScreenshotSuccess(true)
      await fetchData()
      
      // Auto-populate form with last successful data
      if (lastSuccessfulData) {
        setManualForm({
          ...manualForm,
          metricDate: lastSuccessfulData.metricDate || manualForm.metricDate,
          views: lastSuccessfulData.views?.toString() || manualForm.views,
          saves: lastSuccessfulData.saves?.toString() || manualForm.saves,
          shares: lastSuccessfulData.shares?.toString() || manualForm.shares,
          comments: lastSuccessfulData.comments?.toString() || manualForm.comments,
          likes: lastSuccessfulData.likes?.toString() || manualForm.likes,
          completionRate: lastSuccessfulData.completionRate ? (lastSuccessfulData.completionRate * 100).toFixed(1) : manualForm.completionRate,
          retention: lastSuccessfulData.retention?.toString() || manualForm.retention,
          skipRate: lastSuccessfulData.skipRate?.toString() || manualForm.skipRate,
          interactions: lastSuccessfulData.interactions?.toString() || manualForm.interactions,
          watchTime: lastSuccessfulData.watchTime?.toString() || manualForm.watchTime,
          audience: lastSuccessfulData.audience?.toString() || manualForm.audience,
          followers: lastSuccessfulData.followers?.toString() || manualForm.followers,
          videoTitle: lastSuccessfulData.videoTitle || manualForm.videoTitle,
          videoLink: lastSuccessfulData.videoLink || manualForm.videoLink,
        })
      }
      
      if (errorCount > 0) {
        setScreenshotError(`${successCount} screenshot(s) processed successfully, ${errorCount} failed`)
      }
    } else {
      setScreenshotError(`All ${files.length} screenshot(s) failed to process`)
    }

    // Clear file input
    e.target.value = ''
    
    // Clear progress after delay
    setTimeout(() => {
      setScreenshotSuccess(false)
      setUploadProgress({})
    }, 5000)
    
    setIsUploadingScreenshot(false)
  }

  const handleDeleteMetric = async (type: 'instagram' | 'spotify' | 'tiktok' | 'tiktok-song-views', id: string) => {
    if (!confirm(`Are you sure you want to delete this ${type} metric? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/release-readiness?type=${type}&id=${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete metric')
      }

      // Refresh data after deletion
      await fetchData()
    } catch (error) {
      console.error('Failed to delete metric:', error)
      alert(`Failed to delete metric: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleSubmitManualMetrics = async () => {
    if (!selectedArtistId || !canAddManualMetrics) return
    
    // Collect all entries to submit (including current form if it has data)
    const allEntries = [...instagramEntries]
    if (manualForm.metricDate && manualForm.followers && manualForm.views) {
      allEntries.push({ ...manualForm })
    }
    
    if (allEntries.length === 0) {
      setSubmitError('Please add at least one entry before submitting')
      return
    }
    
    setIsSubmitting(true)
    setSubmitError('')
    
    try {
      // Submit all entries
      const promises = allEntries.map(entry => {
        const payload: any = {
          type: 'instagram',
          artistId: selectedArtistId,
          metricDate: entry.metricDate,
          views: parseInt(entry.views) || 0,
          saves: parseInt(entry.saves) || 0,
          shares: parseInt(entry.shares) || 0,
          comments: parseInt(entry.comments) || 0,
          completionRate: entry.completionRate ? parseFloat(entry.completionRate) / 100 : 0,
          followers: parseInt(entry.followers) || 0,
          manuallyAdded: true,
          addedBy: user?.id,
        }
        
        if (entry.likes) payload.likes = parseInt(entry.likes)
        if (entry.retention) payload.retention = parseFloat(entry.retention)
        if (entry.skipRate) payload.skipRate = parseFloat(entry.skipRate)
        if (entry.interactions) payload.interactions = parseInt(entry.interactions)
        if (entry.watchTime) payload.watchTime = parseInt(entry.watchTime)
        if (entry.audience) payload.audience = parseInt(entry.audience)
        if (entry.videoTitle) payload.videoTitle = entry.videoTitle.trim()
        if (entry.videoLink) payload.videoLink = entry.videoLink.trim()
        if (entry.facebookViews && entry.instagramViews) {
          payload.facebookVsInstagram = {
            facebook: parseInt(entry.facebookViews),
            instagram: parseInt(entry.instagramViews),
          }
        }
        
        return fetch('/api/release-readiness', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      })
      
      const results = await Promise.all(promises)
      const jsonResults = await Promise.all(results.map(r => r.json()))
      
      const failed = jsonResults.filter(r => !r.success)
      if (failed.length > 0) {
        setSubmitError(`Failed to save ${failed.length} of ${allEntries.length} entries: ${failed[0].error || 'Unknown error'}`)
      } else {
        setShowManualInput(false)
        setManualForm(resetInstagramForm())
        setInstagramEntries([])
        await fetchData()
      }
    } catch (error: any) {
      setSubmitError(error.message || 'Failed to save metrics')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetTikTokForm = () => ({
    metricDate: new Date().toISOString().split('T')[0],
    views: '',
    likes: '',
    comments: '',
    shares: '',
    followers: '',
    engagementRate: '',
    watchTime: '',
    retention: '',
    videoTitle: '',
    videoLink: '',
  })

  const handleAddTikTokEntry = () => {
    if (!tikTokForm.metricDate || !tikTokForm.followers || !tikTokForm.views) {
      setSubmitError('Please fill in required fields (Date, Followers, Views) before adding another entry')
      return
    }
    setTikTokEntries([...tikTokEntries, { ...tikTokForm }])
    setTikTokForm(resetTikTokForm())
    setSubmitError('')
  }

  const handleSubmitTikTokMetrics = async () => {
    if (!selectedArtistId || !canAddManualMetrics) return
    
    // Collect all entries to submit (including current form if it has data)
    const allEntries = [...tikTokEntries]
    if (tikTokForm.metricDate && tikTokForm.followers && tikTokForm.views) {
      allEntries.push({ ...tikTokForm })
    }
    
    if (allEntries.length === 0) {
      setSubmitError('Please add at least one entry before submitting')
      return
    }
    
    setIsSubmitting(true)
    setSubmitError('')
    
    try {
      // Submit all entries
      const promises = allEntries.map(entry => {
        const payload: any = {
          type: 'tiktok',
          artistId: selectedArtistId,
          metricDate: entry.metricDate,
          views: parseInt(entry.views) || 0,
          followers: parseInt(entry.followers) || 0,
          manuallyAdded: true,
          addedBy: user?.id,
        }
        
        if (entry.likes) payload.likes = parseInt(entry.likes)
        if (entry.comments) payload.comments = parseInt(entry.comments)
        if (entry.shares) payload.shares = parseInt(entry.shares)
        if (entry.engagementRate) payload.engagementRate = parseFloat(entry.engagementRate)
        if (entry.watchTime) payload.watchTime = parseInt(entry.watchTime)
        if (entry.retention) payload.retention = parseFloat(entry.retention)
        if (entry.videoTitle) payload.videoTitle = entry.videoTitle.trim()
        if (entry.videoLink) payload.videoLink = entry.videoLink.trim()
        
        return fetch('/api/release-readiness', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      })
      
      const results = await Promise.all(promises)
      const jsonResults = await Promise.all(results.map(r => r.json()))
      
      const failed = jsonResults.filter(r => !r.success)
      if (failed.length > 0) {
        setSubmitError(`Failed to save ${failed.length} of ${allEntries.length} entries: ${failed[0].error || 'Unknown error'}`)
      } else {
        setShowTikTokInput(false)
        setTikTokForm(resetTikTokForm())
        setTikTokEntries([])
        await fetchData()
      }
    } catch (error: any) {
      setSubmitError(error.message || 'Failed to save TikTok metrics')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitTikTokSongViews = async () => {
    if (!canAddManualMetrics) return
    
    setIsSubmitting(true)
    setSubmitError('')
    
    try {
      const payload = {
        type: 'tiktok-song-views',
        songId: tikTokSongForm.songId,
        songName: tikTokSongForm.songName,
        artistName: tikTokSongForm.artistName,
        views: parseInt(tikTokSongForm.views) || 0,
        metricDate: tikTokSongForm.metricDate,
        videoUrl: tikTokSongForm.videoUrl || undefined,
        addedBy: user?.id,
      }
      
      const res = await fetch('/api/release-readiness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      
      const result = await res.json()
      
      if (result.success) {
        setShowTikTokSongViews(false)
        setTikTokSongForm({
          songId: '',
          songName: '',
          artistName: '',
          views: '',
          metricDate: new Date().toISOString().split('T')[0],
          videoUrl: '',
        })
        await fetchData()
      } else {
        setSubmitError(result.error || 'Failed to save TikTok song views')
      }
    } catch (error: any) {
      setSubmitError(error.message || 'Failed to save TikTok song views')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStaffOverride = async () => {
    if (!selectedArtistId || !canAddManualMetrics) return
    
    setIsSubmitting(true)
    setSubmitError('')
    
    try {
      const currentState = readiness?.state || 'building'
      const payload = {
        type: 'override',
        artistId: selectedArtistId,
        overriddenState: overrideForm.overriddenState,
        originalState: currentState,
        reason: overrideForm.reason,
        overriddenBy: user?.id,
      }
      
      const res = await fetch('/api/release-readiness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      
      const result = await res.json()
      
      if (result.success) {
        setShowOverrideModal(false)
        setOverrideForm({
          reason: '',
          overriddenState: 'ready',
        })
        await fetchData()
      } else {
        setSubmitError(result.error || 'Failed to override readiness state')
      }
    } catch (error: any) {
      setSubmitError(error.message || 'Failed to override readiness state')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (authLoading || readinessData.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  if (!user || (user.role !== 'artist' && user.role !== 'admin')) {
    return null
  }

  const selectedArtist = (isAdmin || isStaffView) && selectedArtistId 
    ? users.find(u => u.id === selectedArtistId)
    : null

  const stateConfig = {
    cooling: {
      label: 'Cooling Period',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
      icon: Clock,
      description: 'Building momentum before release',
    },
    building: {
      label: 'Building',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
      icon: TrendingUp,
      description: 'Growing audience and engagement',
    },
    ready: {
      label: 'Ready to Release',
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      icon: CheckCircle,
      description: 'Optimal conditions for release',
    },
  }

  const currentState = readiness?.state || 'cooling'
  const config = stateConfig[currentState]
  const StateIcon = config.icon

  // Get lane info for current artist
  const artistLane = (user as any)?.lane && Object.keys(LANE_DEFINITIONS).includes((user as any).lane)
    ? LANE_DEFINITIONS[(user as any).lane as keyof typeof LANE_DEFINITIONS]
    : null

  // Get the most recent update timestamp from any data source
  const getLastUpdated = () => {
    const timestamps: Date[] = []
    
    // Use actual timestamps when data was added/updated, not metric dates
    if (readiness?.lastUpdated) {
      timestamps.push(new Date(readiness.lastUpdated))
    }
    
    // Spotify snapshots have createdAt field (when it was added to system)
    if (latestSpotify?.createdAt) {
      timestamps.push(new Date(latestSpotify.createdAt))
    }
    
    // Explanations have createdAt/generatedAt (when it was generated)
    if (latestExplanation?.generatedAt) {
      timestamps.push(new Date(latestExplanation.generatedAt))
    }
    
    // TikTok song views have createdAt
    if (tikTokSongViewsList && tikTokSongViewsList.length > 0) {
      const latestSongView = tikTokSongViewsList.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0]
      if (latestSongView?.createdAt) {
        timestamps.push(new Date(latestSongView.createdAt))
      }
    }
    
    // Note: Instagram and TikTok metrics don't have createdAt fields,
    // so we can't accurately show when they were added. We only use
    // actual timestamps from when data was added to the system.
    
    if (timestamps.length === 0) return null
    return new Date(Math.max(...timestamps.map(d => d.getTime())))
  }

  const lastUpdated = getLastUpdated()

  // Calculate growth metrics
  const calculateGrowthMetrics = () => {
    if (instagramMetrics.length < 2) return null

    const sorted = [...instagramMetrics].sort((a, b) => 
      new Date(a.metricDate).getTime() - new Date(b.metricDate).getTime()
    )
    
    const oldest = sorted[0]
    const newest = sorted[sorted.length - 1]
    const daysDiff = Math.max(1, Math.floor((new Date(newest.metricDate).getTime() - new Date(oldest.metricDate).getTime()) / (1000 * 60 * 60 * 24)))
    
    const followerGrowth = newest.followers - oldest.followers
    const followerGrowthPercent = oldest.followers > 0 ? (followerGrowth / oldest.followers) * 100 : 0
    const followerGrowthRate = daysDiff > 0 ? followerGrowth / daysDiff : 0
    
    const viewsGrowth = newest.views - oldest.views
    const viewsGrowthPercent = oldest.views > 0 ? (viewsGrowth / oldest.views) * 100 : 0
    
    const engagementOld = oldest.views > 0 
      ? ((oldest.comments + oldest.shares + oldest.saves) / oldest.views) * 100 
      : 0
    const engagementNew = newest.views > 0 
      ? ((newest.comments + newest.shares + newest.saves) / newest.views) * 100 
      : 0
    const engagementGrowth = engagementNew - engagementOld

    return {
      followerGrowth,
      followerGrowthPercent,
      followerGrowthRate: Math.round(followerGrowthRate),
      viewsGrowth,
      viewsGrowthPercent,
      engagementGrowth,
      period: daysDiff,
      trend: followerGrowth > 0 ? 'up' : followerGrowth < 0 ? 'down' : 'stable',
    }
  }

  const growthMetrics = calculateGrowthMetrics()

  // Check if artist has been denied
  const readinessWithDecision = readiness as any
  const isDenied = readinessWithDecision?.decision?.decision === 'DENIED' || readinessWithDecision?.decisionState === 'DENIED'
  const denialDecision = readinessWithDecision?.decision

  // DENIAL-FOCUSED VIEW - Show when artist is denied
  if (isDenied && denialDecision && user?.role === 'artist' && !isStaff && !isAdmin) {
    const avgCompletionRate = instagramMetrics.length > 0
      ? instagramMetrics.reduce((sum, m) => sum + (m.completionRate || 0), 0) / instagramMetrics.length
      : 0
    const totalViews = instagramMetrics.reduce((sum, m) => sum + (m.views || 0), 0)
    const totalSaves = instagramMetrics.reduce((sum, m) => sum + (m.saves || 0), 0)
    const avgSaveRate = totalViews > 0 ? (totalSaves / totalViews) * 100 : 0
    const latestMetric = latestInstagram || instagramMetrics[instagramMetrics.length - 1]
    
    // Calculate stream metrics
    const readinessDataAny = readinessData as any
    const spotifySnapshots = (readinessDataAny?.spotifySnapshots || (data as any)?.spotifySnapshots || []) as any[]
    const totalStreams = spotifySnapshots.reduce((sum: number, s: any) => sum + (s.streams || 0), 0)
    const avgStreamsPerWeek = spotifySnapshots.length > 0 ? totalStreams / spotifySnapshots.length : 0
    const totalListeners = spotifySnapshots.reduce((sum: number, s: any) => sum + (s.listeners || 0), 0)
    const avgListenersPerWeek = spotifySnapshots.length > 0 ? totalListeners / spotifySnapshots.length : 0
    
    const cooldownDays = denialDecision.cooldownUntil
      ? Math.ceil((new Date(denialDecision.cooldownUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : denialDecision.cooldownPeriodDays || 14

    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: customStyles }} />
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white p-6">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white mb-1 flex items-center">
                  <XCircle className="w-8 h-8 mr-3 text-red-400" />
                  Release Not Recommended Right Now
                </h1>
                <p className="text-slate-400">Here's what your data shows and why waiting is the smart move</p>
              </div>
            </div>

            {/* Denial Status Banner */}
            <div className="bg-gradient-to-r from-red-500/20 to-red-600/20 border-2 border-red-500 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <XCircle className="w-10 h-10 text-red-400 mr-4" />
                  <div>
                    <h2 className="text-2xl font-bold text-white">Not Ready to Release</h2>
                    <p className="text-red-300 mt-1">
                      {cooldownDays > 0 
                        ? `Re-evaluate in ${cooldownDays} days` 
                        : 'Focus on building momentum first'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Why This Was Denied */}
            <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                <AlertTriangle className="w-6 h-6 mr-2 text-red-400" />
                Why Releasing Now Isn't Recommended
              </h3>
              <p className="text-slate-300 mb-6 text-lg">{denialDecision.denialReason}</p>
              
              {denialDecision.expectedOutcome && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
                  <h4 className="text-sm font-semibold text-red-400 mb-2">Expected Outcome If Released Now:</h4>
                  <p className="text-slate-300">{denialDecision.expectedOutcome}</p>
                </div>
              )}
            </div>

            {/* Your Current Numbers */}
            <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                <BarChart3 className="w-6 h-6 mr-2 text-blue-400" />
                Your Current Metrics
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
                {/* Data Points */}
                <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-lg p-5 border border-slate-700 shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-slate-400 uppercase tracking-wide">Data Points</div>
                    <BarChart3 className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="text-3xl font-bold text-white mb-1">{instagramMetrics.length}</div>
                  <div className={`text-xs font-medium mt-1 ${instagramMetrics.length < 2 ? 'text-red-400' : 'text-green-400'}`}>
                    {instagramMetrics.length < 2 ? '⚠ Need at least 2' : '✓ Sufficient'}
                  </div>
                </div>

                {/* Completion Rate */}
                <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-lg p-5 border border-slate-700 shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-slate-400 uppercase tracking-wide">Completion Rate</div>
                    <Activity className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="text-3xl font-bold text-white mb-1">{avgCompletionRate.toFixed(1)}%</div>
                  <div className={`text-xs font-medium mt-1 ${avgCompletionRate < 30 ? 'text-red-400' : 'text-green-400'}`}>
                    {avgCompletionRate < 30 ? '⚠ Below 30% threshold' : '✓ Good'}
                  </div>
                </div>

                {/* Save Rate */}
                <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-lg p-5 border border-slate-700 shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-slate-400 uppercase tracking-wide">Save Rate</div>
                    <Bookmark className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="text-3xl font-bold text-white mb-1">{avgSaveRate.toFixed(2)}%</div>
                  <div className={`text-xs font-medium mt-1 ${avgSaveRate < 2 ? 'text-red-400' : 'text-green-400'}`}>
                    {avgSaveRate < 2 ? '⚠ Below 2% threshold' : '✓ Converting'}
                  </div>
                </div>

                {/* Streams */}
                {spotifySnapshots.length > 0 ? (
                  <div className="bg-gradient-to-br from-green-800/30 to-emerald-900/20 rounded-lg p-5 border border-green-500/30 shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-green-300 uppercase tracking-wide">Avg Streams/Week</div>
                      <Music className="w-4 h-4 text-green-400" />
                    </div>
                    <div className="text-3xl font-bold text-white mb-1">{Math.round(avgStreamsPerWeek).toLocaleString()}</div>
                    <div className="text-xs text-green-300 mt-1">
                      {spotifySnapshots.length} week{spotifySnapshots.length !== 1 ? 's' : ''} tracked
                    </div>
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-lg p-5 border border-slate-700 shadow-lg opacity-60">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-slate-400 uppercase tracking-wide">Streams</div>
                      <Music className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="text-3xl font-bold text-slate-500 mb-1">—</div>
                    <div className="text-xs text-slate-500 mt-1">No data available</div>
                  </div>
                )}

                {/* Latest Views */}
                {latestMetric ? (
                  <div className="bg-gradient-to-br from-purple-800/30 to-pink-900/20 rounded-lg p-5 border border-purple-500/30 shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-purple-300 uppercase tracking-wide">Latest Views</div>
                      <Eye className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="text-3xl font-bold text-white mb-1">{latestMetric.views.toLocaleString()}</div>
                    <div className="text-xs text-purple-300 mt-1">
                      {new Date(latestMetric.metricDate).toLocaleDateString()}
                    </div>
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-lg p-5 border border-slate-700 shadow-lg opacity-60">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-slate-400 uppercase tracking-wide">Views</div>
                      <Eye className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="text-3xl font-bold text-slate-500 mb-1">—</div>
                    <div className="text-xs text-slate-500 mt-1">No data available</div>
                  </div>
                )}
              </div>

              {/* Detailed Metrics Table */}
              {instagramMetrics.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-slate-400 mb-3 flex items-center">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Your Recent Instagram Performance
                  </h4>
                  <div className="overflow-x-auto rounded-lg border border-slate-700">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-800/50">
                        <tr>
                          <th className="text-left py-3 px-4 text-slate-300 font-semibold">Date</th>
                          <th className="text-right py-3 px-4 text-slate-300 font-semibold">Views</th>
                          <th className="text-right py-3 px-4 text-slate-300 font-semibold">Saves</th>
                          <th className="text-right py-3 px-4 text-slate-300 font-semibold">Completion</th>
                          <th className="text-right py-3 px-4 text-slate-300 font-semibold">Save Rate</th>
                          {canAddManualMetrics && (
                            <th className="text-center py-3 px-4 text-slate-300 font-semibold">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {instagramMetrics.slice(-5).reverse().map((metric, idx) => {
                          const saveRate = metric.views > 0 ? ((metric.saves || 0) / metric.views) * 100 : 0
                          return (
                            <tr key={metric.id} className={`border-b border-slate-800 ${idx % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-900/10'}`}>
                              <td className="py-3 px-4 text-slate-300">{new Date(metric.metricDate).toLocaleDateString()}</td>
                              <td className="text-right py-3 px-4 text-white font-medium">{metric.views.toLocaleString()}</td>
                              <td className="text-right py-3 px-4 text-white font-medium">{metric.saves.toLocaleString()}</td>
                              <td className="text-right py-3 px-4 text-white font-medium">{(metric.completionRate || 0).toFixed(1)}%</td>
                              <td className="text-right py-3 px-4 text-white font-medium">{saveRate.toFixed(2)}%</td>
                              {canAddManualMetrics && (
                                <td className="text-center py-3 px-4">
                                  <button
                                    onClick={() => handleDeleteMetric('instagram', metric.id)}
                                    className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                                    title="Delete metric"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Spotify Streams Table */}
              {spotifySnapshots.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-slate-400 mb-3 flex items-center">
                    <Music className="w-4 h-4 mr-2" />
                    Your Recent Spotify Performance
                  </h4>
                  <div className="overflow-x-auto rounded-lg border border-slate-700">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-800/50">
                        <tr>
                          <th className="text-left py-3 px-4 text-slate-300 font-semibold">Week</th>
                          <th className="text-right py-3 px-4 text-slate-300 font-semibold">Streams</th>
                          <th className="text-right py-3 px-4 text-slate-300 font-semibold">Listeners</th>
                          <th className="text-right py-3 px-4 text-slate-300 font-semibold">Save Rate</th>
                          {canAddManualMetrics && (
                            <th className="text-center py-3 px-4 text-slate-300 font-semibold">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {spotifySnapshots.slice(-5).reverse().map((snapshot: any, idx: number) => (
                          <tr key={snapshot.id} className={`border-b border-slate-800 ${idx % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-900/10'}`}>
                            <td className="py-3 px-4 text-slate-300">{new Date(snapshot.weekStart).toLocaleDateString()}</td>
                            <td className="text-right py-3 px-4 text-white font-medium">{snapshot.streams?.toLocaleString() || '0'}</td>
                            <td className="text-right py-3 px-4 text-white font-medium">{snapshot.listeners?.toLocaleString() || '0'}</td>
                            <td className="text-right py-3 px-4 text-white font-medium">{(snapshot.saveRate || 0).toFixed(2)}%</td>
                            {canAddManualMetrics && (
                              <td className="text-center py-3 px-4">
                                <button
                                  onClick={() => handleDeleteMetric('spotify', snapshot.id)}
                                  className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                                  title="Delete snapshot"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Evidence Used */}
            {denialDecision.evidence && (
              <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
                <h3 className="text-lg font-semibold text-white mb-4">How This Decision Was Made</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {denialDecision.evidence.heatScore !== undefined && typeof denialDecision.evidence.heatScore === 'number' && (
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <div className="text-sm text-slate-400 mb-1">Heat Score</div>
                      <div className="text-2xl font-bold text-white">{denialDecision.evidence.heatScore.toFixed(1)}</div>
                    </div>
                  )}
                  {denialDecision.evidence.confidenceIndex !== undefined && typeof denialDecision.evidence.confidenceIndex === 'number' && (
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <div className="text-sm text-slate-400 mb-1">Confidence Index</div>
                      <div className="text-2xl font-bold text-white">{denialDecision.evidence.confidenceIndex.toFixed(1)}</div>
                    </div>
                  )}
                  {denialDecision.evidence.metrics && (
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <div className="text-sm text-slate-400 mb-1">Data Points Analyzed</div>
                      <div className="text-2xl font-bold text-white">{denialDecision.evidence.metrics.dataPoints || instagramMetrics.length}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Rebuild Plan */}
            {denialDecision.rebuildPlan && denialDecision.rebuildPlan.length > 0 && (
              <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                  <Target className="w-6 h-6 mr-2 text-blue-400" />
                  What to Focus On
                </h3>
                <div className="space-y-3">
                  {denialDecision.rebuildPlan.map((step: string, idx: number) => (
                    <div key={idx} className="flex items-start space-x-3 bg-slate-800/30 rounded-lg p-4 border border-slate-700">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-semibold text-sm">
                        {idx + 1}
                      </div>
                      <p className="text-slate-300 flex-1">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-start">
                <Info className="w-5 h-5 text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-slate-300">
                    This decision is based on your actual performance data. Focus on improving these metrics, 
                    and when you're ready, request guidance again. This isn't about stopping you—it's about 
                    protecting your momentum and ensuring your release has the best chance to succeed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: customStyles }} />
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white p-6">
        <div className="space-y-8 pb-8">
          {/* Main Content */}
          <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg">
                <Rocket className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white mb-1">Artist Growth Center</h1>
                <p className="text-slate-400">
                  {(isAdmin || isStaffView)
                    ? selectedArtist 
                      ? `Growth insights for ${selectedArtist.artistName || selectedArtist.name}${isStaffView ? ' (Read-Only View)' : ''}`
                      : 'Track growth and optimize releases across all artists'
                    : 'Your command center for growth, releases, and audience insights'}
                </p>
              </div>
            </div>
          </div>

        {/* Instagram Connection Status */}
        {!isAdmin && !isStaffView && user?.id === selectedArtistId && (
          <div className="flex items-center space-x-3">
            {instagramStatus?.connected ? (
              <div className="flex items-center space-x-2 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-sm text-green-400">Instagram Connected</span>
                {instagramStatus.expired && (
                  <span className="text-xs text-yellow-400">(Token expired - reconnect needed)</span>
                )}
              </div>
                ) : (
                  isStaffView ? (
                    <div className="flex items-center space-x-2 px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg cursor-not-allowed opacity-50">
                      <Instagram className="w-5 h-5 text-slate-400" />
                      <span className="text-sm text-slate-400">Connect Instagram (Admin Only)</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowInstagramConnect(true)}
                      className="flex items-center space-x-2 px-4 py-2 bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/50 rounded-lg transition-colors"
                    >
                      <Instagram className="w-5 h-5 text-pink-400" />
                      <span className="text-sm text-pink-400">Connect Instagram</span>
                    </button>
                  )
                )}
          </div>
        )}
        {(isAdmin || isStaffView) && users.length > 0 && (
          <div className="flex items-center space-x-3 flex-wrap gap-3">
            <div className="flex items-center space-x-3">
              <Users className="w-5 h-5 text-slate-400" />
              <select
                value={selectedArtistId}
                onChange={(e) => setSelectedArtistId(e.target.value)}
                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 min-w-[200px]"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.artistName || u.name}
                  </option>
                ))}
              </select>
            </div>
            {selectedArtistId && (
              <div className="flex items-center space-x-3">
                {instagramStatus?.connected ? (
                  <div className="flex items-center space-x-2 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="text-sm text-green-400">Instagram Connected</span>
                    {instagramStatus.expired && (
                      <span className="text-xs text-yellow-400">(Token expired)</span>
                    )}
                  </div>
                ) : (
                  <div className={`flex items-center space-x-2 px-4 py-2 ${isStaffView ? 'bg-slate-700/50 border border-slate-600 cursor-not-allowed opacity-50' : 'bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/50'} rounded-lg transition-colors`}>
                    <Instagram className="w-5 h-5 text-pink-400" />
                    <span className="text-sm text-pink-400">
                      {isStaffView ? 'Connect Instagram (Admin Only)' : 'Connect Instagram'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Release Decision UI - Primary Flow - Only for Artists (not staff/admin) */}
      {selectedArtistId && user?.role === 'artist' && !isStaff && !isAdmin && (
        <ErrorBoundary sectionName="Release Decision">
          <ReleaseDecisionUI
          artistId={selectedArtistId}
          decision={(readiness as any)?.decision}
          releaseRequest={(readiness as any)?.releaseRequest}
          onSubmitRequest={async (request) => {
            try {
              const res = await fetch('/api/release-readiness', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'release-request',
                  artistId: selectedArtistId,
                  ...request,
                }),
              })
              
              if (!res.ok) {
                const errorText = await res.text()
                throw new Error(`API error: ${res.status} ${res.statusText}`)
              }
              
              const result = await res.json()
              
              if (result.success) {
                await fetchData()
              } else {
                throw new Error(result.error || 'Failed to submit request')
              }
            } catch (error: any) {
              console.error('Failed to submit release request:', error)
              throw error
            }
          }}
          onConfirmRelease={async () => {
            // Handle release confirmation
            alert('Release confirmed! This will trigger the release process.')
          }}
        />
        </ErrorBoundary>
      )}

      {/* Growth Overview Section */}
      {hasAnyData && (
        <ErrorBoundary sectionName="Growth Overview">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Follower Growth */}
          {growthMetrics && (
            <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-xl p-5 border border-blue-500/30 shadow-lg hover-lift">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                {growthMetrics && growthMetrics.followerGrowth > 0 ? (
                  <ArrowUpRight className="w-5 h-5 text-green-400" />
                ) : growthMetrics && growthMetrics.followerGrowth < 0 ? (
                  <ArrowDownRight className="w-5 h-5 text-red-400" />
                ) : (
                  <Activity className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <h3 className="text-sm text-slate-400 mb-1">Follower Growth</h3>
              <p className={`text-2xl font-bold mb-1 ${
                growthMetrics && growthMetrics.followerGrowth > 0 ? 'text-green-400' :
                growthMetrics && growthMetrics.followerGrowth < 0 ? 'text-red-400' :
                'text-slate-300'
              }`}>
                {growthMetrics && growthMetrics.followerGrowth > 0 ? '+' : ''}{growthMetrics ? growthMetrics.followerGrowth.toLocaleString() : '0'}
              </p>
              <p className="text-xs text-slate-500">
                {growthMetrics && growthMetrics.followerGrowthPercent > 0 ? '+' : ''}{growthMetrics ? growthMetrics.followerGrowthPercent.toFixed(1) : '0'}% over {growthMetrics ? growthMetrics.period : 0} days
              </p>
              {growthMetrics && growthMetrics.followerGrowthRate > 0 && (
                <p className="text-xs text-blue-400 mt-1">~{growthMetrics.followerGrowthRate} per day</p>
              )}
            </div>
          )}

          {/* Views Growth */}
          {growthMetrics && (
            <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 rounded-xl p-5 border border-purple-500/30 shadow-lg hover-lift">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Play className="w-5 h-5 text-purple-400" />
                </div>
                {growthMetrics && growthMetrics.viewsGrowth > 0 ? (
                  <ArrowUpRight className="w-5 h-5 text-green-400" />
                ) : growthMetrics && growthMetrics.viewsGrowth < 0 ? (
                  <ArrowDownRight className="w-5 h-5 text-red-400" />
                ) : (
                  <Activity className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <h3 className="text-sm text-slate-400 mb-1">Views Growth</h3>
              <p className={`text-2xl font-bold mb-1 ${
                growthMetrics && growthMetrics.viewsGrowth > 0 ? 'text-green-400' :
                growthMetrics && growthMetrics.viewsGrowth < 0 ? 'text-red-400' :
                'text-slate-300'
              }`}>
                {growthMetrics && growthMetrics.viewsGrowth > 0 ? '+' : ''}{growthMetrics ? growthMetrics.viewsGrowth.toLocaleString() : '0'}
              </p>
              <p className="text-xs text-slate-500">
                {growthMetrics && growthMetrics.viewsGrowthPercent > 0 ? '+' : ''}{growthMetrics ? growthMetrics.viewsGrowthPercent.toFixed(1) : '0'}% change
              </p>
            </div>
          )}

          {/* Engagement Growth */}
          {growthMetrics && (
            <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 rounded-xl p-5 border border-green-500/30 shadow-lg hover-lift">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Zap className="w-5 h-5 text-green-400" />
                </div>
                {growthMetrics && growthMetrics.engagementGrowth > 0 ? (
                  <ArrowUpRight className="w-5 h-5 text-green-400" />
                ) : growthMetrics && growthMetrics.engagementGrowth < 0 ? (
                  <ArrowDownRight className="w-5 h-5 text-red-400" />
                ) : (
                  <Activity className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <h3 className="text-sm text-slate-400 mb-1">Engagement Rate</h3>
              <p className={`text-2xl font-bold mb-1 ${
                growthMetrics && growthMetrics.engagementGrowth > 0 ? 'text-green-400' :
                growthMetrics && growthMetrics.engagementGrowth < 0 ? 'text-red-400' :
                'text-slate-300'
              }`}>
                {growthMetrics && growthMetrics.engagementGrowth > 0 ? '+' : ''}{growthMetrics ? growthMetrics.engagementGrowth.toFixed(1) : '0'}%
              </p>
              <p className="text-xs text-slate-500">
                {latestInstagram && latestInstagram.views > 0 
                  ? ((latestInstagram.comments + latestInstagram.shares + latestInstagram.saves) / latestInstagram.views * 100).toFixed(1)
                  : 0}% current rate
              </p>
            </div>
          )}

          {/* Data Points */}
          <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-5 border border-slate-800 shadow-lg hover-lift">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-slate-700 rounded-lg">
                <BarChart3 className="w-5 h-5 text-slate-400" />
              </div>
              <Award className="w-5 h-5 text-yellow-400" />
            </div>
            <h3 className="text-sm text-slate-400 mb-1">Data Points</h3>
            <p className="text-2xl font-bold text-white mb-1">{instagramMetrics.length}</p>
            <p className="text-xs text-slate-500">
              {hasSufficientData ? (
                <span className="text-green-400">Ready for analysis</span>
              ) : (
                <span className="text-yellow-400">Building profile</span>
              )}
            </p>
            {lastUpdated && (
              <p className="text-xs text-slate-600 mt-1">
                Updated {lastUpdated.toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
        </ErrorBoundary>
      )}

      {/* How This Works - Explanation Section */}
      {!isAdmin && !isStaffView && (
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <div className="flex items-start space-x-3 mb-4">
            <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-white mb-3">Your Growth Command Center</h2>
              <p className="text-slate-300 mb-4">
                This center helps you understand your audience growth, optimize release timing, and make data-driven decisions. 
                We track your engagement patterns to help you grow while ensuring your releases land at the right moment.
              </p>
              <p className="text-slate-400 text-sm mb-4 italic">
                Growth isn't just about numbers — it's about timing, strategy, and understanding your audience.
              </p>
              
              {artistLane && (
                <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <p className="text-xs text-slate-400 mb-1">Your Lane: {artistLane.name}</p>
                  <p className="text-sm text-slate-300">{artistLane.description}</p>
                  <p className="text-xs text-slate-500 mt-2">Your growth strategy is tailored to your artist lane.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Release Goal Selector */}
      {canAddManualMetrics && (
        <div className="bg-gradient-to-br from-slate-900 via-indigo-900/20 to-black rounded-xl p-4 border border-slate-800 shadow-2xl hover:shadow-indigo-500/20 transition-all duration-300 backdrop-blur-sm hover-lift">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Target className="w-5 h-5 text-blue-400" />
              <span className="text-sm font-medium text-slate-300">Release Goal:</span>
            </div>
            <select
              value={releaseGoal}
              onChange={(e) => setReleaseGoal(e.target.value as any)}
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="streams">Streams</option>
              <option value="discovery">Discovery</option>
              <option value="fan-conversion">Fan Conversion</option>
              <option value="algorithm-push">Algorithm Push</option>
              <option value="revenue">Revenue</option>
            </select>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {releaseGoal === 'streams' && 'Optimized for maximum streams (saves + completion rate)'}
            {releaseGoal === 'discovery' && 'Optimized for reach and new audience (shares + followers)'}
            {releaseGoal === 'fan-conversion' && 'Optimized for converting listeners to fans (comments + followers)'}
            {releaseGoal === 'algorithm-push' && 'Optimized for algorithm signals (views + saves + shares)'}
            {releaseGoal === 'revenue' && 'Optimized for revenue potential (saves + completion rate)'}
          </p>
        </div>
      )}

      {/* Release Readiness & Growth Strategy Card - Only show if we have sufficient data */}
      {hasSufficientData && (
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-black rounded-xl p-6 border border-slate-800 shadow-2xl hover:shadow-3xl transition-all duration-300 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className={`p-3 ${config.bgColor} rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-200`}>
              <StateIcon className={`w-6 h-6 ${config.color} animate-pulse`} />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-white">Release Readiness & Growth Strategy</h2>
              {enhancedData?.window ? (
                <div>
                  <p className={`text-sm ${config.color} font-medium`}>
                    {config.label} — {enhancedData.window.window === '24-48-hour-peak' ? '24-48 Hour Peak' :
                      enhancedData.window.window === '3-5-day-window' ? '3-5 Day Window' :
                      enhancedData.window.window === 'fading' ? 'Fading (Act Now)' :
                      enhancedData.window.window === 'extended' ? 'Extended Window' :
                      config.label}
                  </p>
                  {enhancedData.window.estimatedDaysRemaining && (
                    <p className="text-xs text-slate-400 mt-1">
                      {enhancedData.window.estimatedDaysRemaining} days remaining
                    </p>
                  )}
                </div>
              ) : (
                <p className={`text-sm ${config.color} font-medium`}>{config.label}</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {readiness && (
              <div className="text-right">
                <p className="text-xs text-slate-400">Last Updated</p>
                <p className="text-sm text-slate-300">
                  {readiness?.lastUpdated ? new Date(readiness.lastUpdated).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            )}
          </div>
        </div>
        
        {/* Enhanced Window Description */}
        {enhancedData?.window && (
          <div className={`mb-4 p-3 rounded-lg ${
            enhancedData.window.urgency === 'critical' ? 'bg-red-500/20 border border-red-500/50' :
            enhancedData.window.urgency === 'high' ? 'bg-orange-500/20 border border-orange-500/50' :
            enhancedData.window.urgency === 'medium' ? 'bg-yellow-500/20 border border-yellow-500/50' :
            'bg-slate-800/50 border border-slate-700'
          }`}>
            <p className={`text-sm ${
              enhancedData.window.urgency === 'critical' ? 'text-red-400' :
              enhancedData.window.urgency === 'high' ? 'text-orange-400' :
              enhancedData.window.urgency === 'medium' ? 'text-yellow-400' :
              'text-slate-300'
            }`}>
              {enhancedData.window.description}
            </p>
          </div>
        )}
        
        <p className="text-slate-400 text-sm">{config.description}</p>
        
        {/* "Why This Matters" - Human-readable explanation */}
        {enhancedData?.whyThisMatters && (
          <div className="mt-4 p-4 bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent border-l-4 border-blue-500/50 rounded-lg shadow-lg animate-fade-in">
            <p className="text-sm font-semibold text-blue-400 mb-2 flex items-center">
              <Info className="w-4 h-4 mr-2" />
              Why This Matters:
            </p>
            <p className="text-sm text-slate-300 leading-relaxed">{enhancedData.whyThisMatters}</p>
          </div>
        )}
        
        {/* False Green Warning */}
        {enhancedData?.falseGreen?.isFalseGreen && (
          <div className="mt-4 p-4 bg-gradient-to-r from-yellow-500/20 via-yellow-500/10 to-transparent border-l-4 border-yellow-500/70 rounded-lg shadow-lg animate-shake">
            <p className="text-sm font-semibold text-yellow-400 mb-2 flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2 animate-pulse" />
              False Green Protection
            </p>
            <p className="text-sm text-yellow-300 mb-2">{enhancedData.falseGreen.reason}</p>
            <p className="text-xs text-yellow-400 font-medium">{enhancedData.falseGreen.recommendation}</p>
          </div>
        )}
        
        {/* Last Updated Timestamp */}
        {lastUpdated && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="flex items-center space-x-2 text-xs text-slate-400">
              <Clock className="w-3 h-3" />
              <span>Last updated: <span className="text-slate-300 font-medium">{lastUpdated.toLocaleDateString()} at {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></span>
            </div>
          </div>
        )}

        {/* Growth Recommendations */}
        {!isAdmin && !isStaffView && enhancedData && (
          <div className="mt-6 p-4 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-lg border border-blue-500/20">
            <h3 className="text-sm font-semibold text-blue-400 mb-2 flex items-center">
              <Rocket className="w-4 h-4 mr-2" />
              Growth Strategy Recommendations
            </h3>
            <div className="space-y-2 text-sm text-slate-300">
              {currentState === 'ready' && (
                <>
                  <p>• <strong className="text-green-400">Release Window Active:</strong> Your audience is engaged — this is the optimal time to drop new music.</p>
                  <p>• <strong className="text-blue-400">Capitalize on Momentum:</strong> Your engagement is peaking. Consider a surprise drop or visual-first release.</p>
                  {growthMetrics && growthMetrics.followerGrowthRate > 0 && (
                    <p>• <strong className="text-purple-400">Growing Audience:</strong> You're gaining {growthMetrics.followerGrowthRate} followers/day. Strike while momentum is hot.</p>
                  )}
                </>
              )}
              {currentState === 'building' && (
                <>
                  <p>• <strong className="text-yellow-400">Building Phase:</strong> Focus on consistent content to build anticipation before your next release.</p>
                  <p>• <strong className="text-blue-400">Engagement Strategy:</strong> Post teasers, behind-the-scenes content, or snippets to warm up your audience.</p>
                  {growthMetrics && growthMetrics.engagementGrowth < 0 && (
                    <p>• <strong className="text-orange-400">Engagement Dip:</strong> Try new content formats or posting times to re-engage your audience.</p>
                  )}
                </>
              )}
              {currentState === 'cooling' && (
                <>
                  <p>• <strong className="text-red-400">Cooling Phase:</strong> Your audience attention is low. Hold releases and focus on rebuilding engagement.</p>
                  <p>• <strong className="text-blue-400">Rebuild Strategy:</strong> Take a short break, then return with fresh content formats or collaborations.</p>
                  {growthMetrics && growthMetrics.followerGrowth < 0 && (
                    <p>• <strong className="text-orange-400">Audience Decline:</strong> Focus on re-engaging existing followers before seeking new ones.</p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* State-specific explanation */}
        {!isAdmin && !isStaffView && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            {currentState === 'ready' && (
              <div>
                <h3 className="text-sm font-semibold text-green-400 mb-2">🟩 WHEN YOU ARE READY TO RELEASE</h3>
                <p className="text-sm text-slate-300 mb-2">
                  You'll see Ready when multiple signals line up at the same time.
                </p>
                <p className="text-xs text-slate-400 mb-2">What's happening:</p>
                <ul className="text-xs text-slate-400 space-y-1 ml-4 list-disc">
                  <li>Your recent posts are performing above your normal average</li>
                  <li>Engagement is coming naturally (not forced)</li>
                  <li>Fans are saving, sharing, or commenting consistently</li>
                  <li>Your audience is active at predictable times</li>
                  <li>Momentum is steady or rising (not spiking then crashing)</li>
                </ul>
                <p className="text-sm text-slate-300 mt-3">
                  If you release now, your audience is most likely to notice, engage, and carry the song forward.
                </p>
              </div>
            )}
            {currentState === 'building' && (
              <div>
                <h3 className="text-sm font-semibold text-blue-400 mb-2">🟨 WHEN YOU ARE BUILDING</h3>
                <p className="text-sm text-slate-300 mb-2">
                  This is the most common state — and it's healthy.
                </p>
                <p className="text-xs text-slate-400 mb-2">What's happening:</p>
                <ul className="text-xs text-slate-400 space-y-1 ml-4 list-disc">
                  <li>Engagement is steady but not peaking</li>
                  <li>Posts are landing, but not spreading</li>
                  <li>Audience attention is present, just not concentrated yet</li>
                  <li>Momentum is growing but hasn't stacked long enough</li>
                </ul>
                <p className="text-sm text-slate-300 mt-3">
                  Releasing right now wouldn't fail — but it wouldn't hit as hard as it could.
                </p>
                <p className="text-xs text-slate-400 mt-2">
                  This stage is about setting up the moment, not forcing it.
                </p>
              </div>
            )}
            {currentState === 'cooling' && (
              <div>
                <h3 className="text-sm font-semibold text-yellow-400 mb-2">🟥 WHEN YOU ARE COOLING</h3>
                <p className="text-sm text-slate-300 mb-2">
                  This is not punishment. This is timing.
                </p>
                <p className="text-xs text-slate-400 mb-2">What's happening:</p>
                <ul className="text-xs text-slate-400 space-y-1 ml-4 list-disc">
                  <li>Engagement is below your usual baseline</li>
                  <li>Audience attention is scattered or quiet</li>
                  <li>Recent posts aren't being saved or shared</li>
                  <li>Fans are consuming, not reacting</li>
                </ul>
                <p className="text-sm text-slate-300 mt-3">
                  Dropping right now would likely get overlooked — even if the song is good.
                </p>
                <p className="text-xs text-slate-400 mt-2">
                  This stage protects your music from dying on arrival.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Growth & Strategy Section Header */}
      {hasSufficientData && enhancedData && (
        <div className="mt-8 mb-4">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <Star className="w-6 h-6 mr-2 text-yellow-400" />
            Growth Insights & Release Strategy
          </h2>
          <p className="text-slate-400 mt-1">Deep dive into your performance metrics and strategic recommendations</p>
        </div>
      )}

      {/* Enhanced Analysis Cards - Only show if we have sufficient data */}
      {hasSufficientData && enhancedData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Heat Scores */}
          <div className="bg-gradient-to-br from-slate-900 via-purple-900/20 to-black rounded-xl p-6 border border-slate-800 shadow-2xl hover:shadow-purple-500/20 transition-all duration-300 backdrop-blur-sm">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Zap className="w-5 h-5 mr-2 text-yellow-400" />
              Heat Analysis
            </h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-400">Audience Heat</span>
                  <span className="text-white font-semibold">{enhancedData.heat?.audienceHeat || 0}/100</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-3 shadow-inner overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-cyan-400 h-3 rounded-full transition-all duration-500 ease-out shadow-lg"
                    style={{ width: `${enhancedData.heat?.audienceHeat || 0}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">Follower activity, comment velocity, repeat viewers</p>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-400">Content Heat</span>
                  <span className="text-white font-semibold">{enhancedData.heat?.contentHeat || 0}/100</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-3 shadow-inner overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-pink-500 to-rose-400 h-3 rounded-full transition-all duration-500 ease-out shadow-lg"
                    style={{ width: `${enhancedData.heat?.contentHeat || 0}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">Reel saves, shares, completion rate, watch time</p>
              </div>
              
              <div className="pt-3 border-t border-slate-700">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300 font-medium">Combined Heat</span>
                  <span className="text-white font-bold text-lg">{enhancedData.heat?.combinedHeat || 0}/100</span>
                </div>
                {enhancedData.heat?.audienceHeat > 70 && enhancedData.heat?.contentHeat < 50 && (
                  <p className="text-xs text-yellow-400 mt-2">⚠️ Audience hot but content needs work — push teaser, not full drop</p>
                )}
                {enhancedData.heat?.contentHeat > 70 && enhancedData.heat?.audienceHeat < 50 && (
                  <p className="text-xs text-yellow-400 mt-2">⚠️ Content viral but audience quiet — build anticipation first</p>
                )}
              </div>
            </div>
          </div>

          {/* Momentum Speed */}
          <div className="bg-gradient-to-br from-slate-900 via-green-900/20 to-black rounded-xl p-6 border border-slate-800 shadow-2xl hover:shadow-green-500/20 transition-all duration-300 backdrop-blur-sm">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Gauge className="w-5 h-5 mr-2 text-green-400" />
              Momentum Speed
            </h2>
            {enhancedData.momentumSpeed && (
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-400">Speed</span>
                    <span className={`font-semibold ${
                      enhancedData.momentumSpeed.speed.includes('fast') ? 'text-red-400' :
                      enhancedData.momentumSpeed.speed.includes('slow') ? 'text-yellow-400' :
                      'text-blue-400'
                    }`}>
                      {enhancedData.momentumSpeed.speed.replace('-', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">{enhancedData.momentumSpeed.description}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-700">
                  <div>
                    <span className="text-xs text-slate-400">Velocity</span>
                    <p className="text-lg font-semibold text-white">{enhancedData.momentumSpeed.velocity}%</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Acceleration</span>
                    <p className={`text-lg font-semibold ${
                      enhancedData.momentumSpeed.acceleration > 0 ? 'text-green-400' :
                      enhancedData.momentumSpeed.acceleration < 0 ? 'text-red-400' :
                      'text-slate-400'
                    }`}>
                      {enhancedData.momentumSpeed.acceleration > 0 ? '+' : ''}{enhancedData.momentumSpeed.acceleration}%
                    </p>
                  </div>
                </div>
                
                <div className="pt-3 border-t border-slate-700">
                  <p className="text-sm font-semibold text-blue-400 mb-1">Recommendation:</p>
                  <p className="text-sm text-slate-300">{enhancedData.momentumSpeed.recommendation}</p>
                </div>
              </div>
            )}
          </div>

          {/* Risk Tolerance */}
          {enhancedData.riskTolerance && (
            <div className="bg-gradient-to-br from-slate-900 via-purple-900/20 to-black rounded-xl p-6 border border-slate-800 shadow-2xl hover:shadow-purple-500/20 transition-all duration-300 backdrop-blur-sm hover-lift">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <Shield className="w-5 h-5 mr-2 text-purple-400" />
                Lane Risk Tolerance
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Can Drop at Building</span>
                  <span className={`font-semibold ${enhancedData.riskTolerance.canDropAtBuilding ? 'text-green-400' : 'text-red-400'}`}>
                    {enhancedData.riskTolerance.canDropAtBuilding ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Can Drop at Cooling</span>
                  <span className={`font-semibold ${enhancedData.riskTolerance.canDropAtCooling ? 'text-green-400' : 'text-red-400'}`}>
                    {enhancedData.riskTolerance.canDropAtCooling ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Requires Ready</span>
                  <span className={`font-semibold ${enhancedData.riskTolerance.requiresReady ? 'text-yellow-400' : 'text-green-400'}`}>
                    {enhancedData.riskTolerance.requiresReady ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="pt-3 border-t border-slate-700">
                  <p className="text-xs text-slate-400 mb-1">Risk Level:</p>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                    enhancedData.riskTolerance.riskLevel === 'low' ? 'bg-green-500/20 text-green-400' :
                    enhancedData.riskTolerance.riskLevel === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {enhancedData.riskTolerance.riskLevel.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-slate-300 mt-3">{enhancedData.riskTolerance.explanation}</p>
              </div>
            </div>
          )}

          {/* Goal-Based Scores */}
          {enhancedData.goalScores && (
            <div className="bg-gradient-to-br from-slate-900 via-cyan-900/20 to-black rounded-xl p-6 border border-slate-800 shadow-2xl hover:shadow-cyan-500/20 transition-all duration-300 backdrop-blur-sm hover-lift">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <Target className="w-5 h-5 mr-2 text-cyan-400" />
                Goal-Based Scores
              </h2>
              <div className="space-y-3">
                {Object.entries(enhancedData.goalScores).map(([goal, score]: [string, any]) => (
                  <div key={goal}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-slate-400 capitalize">{goal.replace('-', ' ')}</span>
                      <span className={`font-semibold ${
                        goal === releaseGoal ? 'text-cyan-400' : 'text-slate-400'
                      }`}>
                        {Math.round(score * 100)}/100
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-3 shadow-inner overflow-hidden">
                      <div 
                        className={`h-3 rounded-full transition-all duration-500 ease-out shadow-lg ${
                          goal === releaseGoal 
                            ? 'bg-gradient-to-r from-cyan-500 to-blue-400' 
                            : 'bg-gradient-to-r from-slate-600 to-slate-500'
                        }`}
                        style={{ width: `${Math.min(score * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
                <p className="text-xs text-slate-500 mt-3">
                  Current goal: <span className="text-cyan-400 capitalize">{releaseGoal.replace('-', ' ')}</span>
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TikTok Sync Recommendations */}
      {enhancedData?.tikTokSync && enhancedData.tikTokSync.urgency !== 'low' && (
        <div className="bg-gradient-to-br from-slate-900 via-cyan-900/30 to-black rounded-xl p-6 border border-cyan-500/50 shadow-2xl hover:shadow-cyan-500/30 transition-all duration-300 backdrop-blur-sm hover-lift animate-fade-in">
          <div className="flex items-start space-x-3">
            <Video className="w-6 h-6 text-cyan-400 mt-0.5" />
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-white mb-2">TikTok Sync Analysis</h2>
              <p className={`text-sm ${
                enhancedData.tikTokSync.urgency === 'high' ? 'text-red-400' : 'text-yellow-400'
              } font-medium mb-2`}>
                {enhancedData.tikTokSync.recommendation}
              </p>
              {enhancedData.tikTokSync.tikTokSpikeBeforeIG && (
                <p className="text-xs text-slate-400">TikTok spiked before Instagram — delay drop, push snippet first</p>
              )}
              {enhancedData.tikTokSync.tikTokSpikeAfterIG && (
                <p className="text-xs text-slate-400">TikTok spiked after Instagram — accelerate release to ride both waves</p>
              )}
              {enhancedData.tikTokSync.tikTokStableHigh && (
                <p className="text-xs text-slate-400">Stable high TikTok views — perfect for long-tail release</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* NEW FEATURES GRID - Only show if we have sufficient data */}
      {hasSufficientData && enhancedData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Fatigue Detection */}
          {enhancedData.fatigue && enhancedData.fatigue.hasFatigue && (
            <div className="bg-gradient-to-br from-slate-900 via-red-900/20 to-black rounded-xl p-6 border border-red-500/50 shadow-2xl hover:shadow-red-500/30 transition-all duration-300 backdrop-blur-sm hover-lift animate-fade-in">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2 text-red-400" />
                Fatigue Detection
              </h2>
              <div className="space-y-3">
                {enhancedData.fatigue.fatigueTypes.map((fatigue: any, idx: number) => (
                  <div key={idx} className="p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-red-400 capitalize">
                        {fatigue.type.replace('-', ' ')}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        fatigue.severity === 'high' ? 'bg-red-500/30 text-red-300' :
                        fatigue.severity === 'medium' ? 'bg-yellow-500/30 text-yellow-300' :
                        'bg-orange-500/30 text-orange-300'
                      }`}>
                        {fatigue.severity}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mb-2">{fatigue.description}</p>
                    <p className="text-xs text-red-400 font-medium">{fatigue.recommendation}</p>
                  </div>
                ))}
                <p className="text-sm text-red-300 font-semibold mt-3">
                  {enhancedData.fatigue.overallRecommendation}
                </p>
              </div>
            </div>
          )}

          {/* Pre-Release Simulation */}
          {enhancedData.simulation && (
            <div className="bg-gradient-to-br from-slate-900 via-purple-900/20 to-black rounded-xl p-6 border border-slate-800 shadow-2xl hover:shadow-purple-500/20 transition-all duration-300 backdrop-blur-sm hover-lift animate-fade-in">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-purple-400" />
                Pre-Release Simulation
              </h2>
              <div className="space-y-3">
                <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                  <p className="text-xs text-green-400 font-semibold mb-1">High Chance</p>
                  <p className="text-sm text-slate-300">{enhancedData.simulation.highChance}</p>
                </div>
                <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                  <p className="text-xs text-yellow-400 font-semibold mb-1">Moderate Chance</p>
                  <p className="text-sm text-slate-300">{enhancedData.simulation.moderateChance}</p>
                </div>
                <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                  <p className="text-xs text-red-400 font-semibold mb-1">Low Chance</p>
                  <p className="text-sm text-slate-300">{enhancedData.simulation.lowChance}</p>
                </div>
                <div className="pt-3 border-t border-slate-700 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-green-400 font-semibold mb-1">Best Case</p>
                    <p className="text-xs text-slate-300">{enhancedData.simulation.bestCase}</p>
                  </div>
                  <div>
                    <p className="text-xs text-red-400 font-semibold mb-1">Worst Case</p>
                    <p className="text-xs text-slate-300">{enhancedData.simulation.worstCase}</p>
                  </div>
                </div>
                <div className="pt-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    enhancedData.simulation.confidence === 'high' ? 'bg-green-500/30 text-green-300' :
                    enhancedData.simulation.confidence === 'medium' ? 'bg-yellow-500/30 text-yellow-300' :
                    'bg-red-500/30 text-red-300'
                  }`}>
                    Confidence: {enhancedData.simulation.confidence}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Audience Segmentation */}
          {enhancedData.audienceSegmentation && (
            <div className="bg-gradient-to-br from-slate-900 via-blue-900/20 to-black rounded-xl p-6 border border-slate-800 shadow-2xl hover:shadow-blue-500/20 transition-all duration-300 backdrop-blur-sm hover-lift animate-fade-in">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2 text-blue-400" />
                Audience Segmentation
              </h2>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-400">Core Fans</span>
                    <span className="text-white font-semibold">{enhancedData.audienceSegmentation.coreFans}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-3 shadow-inner overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-cyan-400 h-3 rounded-full transition-all duration-500 ease-out shadow-lg"
                      style={{ width: `${enhancedData.audienceSegmentation.coreFans}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-400">Casual Followers</span>
                    <span className="text-white font-semibold">{enhancedData.audienceSegmentation.casualFollowers}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-3 shadow-inner overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-yellow-500 to-orange-400 h-3 rounded-full transition-all duration-500 ease-out shadow-lg"
                      style={{ width: `${enhancedData.audienceSegmentation.casualFollowers}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-400">New Viewers</span>
                    <span className="text-white font-semibold">{enhancedData.audienceSegmentation.newViewers}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-3 shadow-inner overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-emerald-400 h-3 rounded-full transition-all duration-500 ease-out shadow-lg"
                      style={{ width: `${enhancedData.audienceSegmentation.newViewers}%` }}
                    />
                  </div>
                </div>
                <div className="pt-3 border-t border-slate-700">
                  <p className="text-sm text-blue-400 font-semibold mb-1">Insight:</p>
                  <p className="text-sm text-slate-300 mb-2">{enhancedData.audienceSegmentation.insight}</p>
                  <p className="text-xs text-yellow-400">{enhancedData.audienceSegmentation.recommendation}</p>
                </div>
              </div>
            </div>
          )}

          {/* Content-to-Song Match */}
          {enhancedData.contentSongMatch && (
            <div className="bg-gradient-to-br from-slate-900 via-pink-900/20 to-black rounded-xl p-6 border border-slate-800 shadow-2xl hover:shadow-pink-500/20 transition-all duration-300 backdrop-blur-sm hover-lift animate-fade-in">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <Music className="w-5 h-5 mr-2 text-pink-400" />
                Content-to-Song Match
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Match Score</span>
                  <span className={`text-2xl font-bold ${
                    enhancedData.contentSongMatch.matchScore >= 70 ? 'text-green-400' :
                    enhancedData.contentSongMatch.matchScore >= 50 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {enhancedData.contentSongMatch.matchScore}/100
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-slate-400">Mood</span>
                    <p className="text-sm text-white font-semibold">{enhancedData.contentSongMatch.moodMatch}%</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Tempo</span>
                    <p className="text-sm text-white font-semibold">{enhancedData.contentSongMatch.tempoMatch}%</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Message</span>
                    <p className="text-sm text-white font-semibold">{enhancedData.contentSongMatch.messageMatch}%</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Visual Energy</span>
                    <p className="text-sm text-white font-semibold">{enhancedData.contentSongMatch.visualEnergyMatch}%</p>
                  </div>
                </div>
                {enhancedData.contentSongMatch.mismatch && (
                  <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                    <p className="text-xs text-red-400 font-semibold mb-1">⚠️ Mismatch Detected</p>
                    <p className="text-xs text-slate-300">{enhancedData.contentSongMatch.recommendation}</p>
                  </div>
                )}
                {!enhancedData.contentSongMatch.mismatch && (
                  <p className="text-xs text-green-400">{enhancedData.contentSongMatch.recommendation}</p>
                )}
              </div>
            </div>
          )}

          {/* Drop Type Recommendation */}
          {enhancedData.dropTypeRecommendation && (
            <div className="bg-gradient-to-br from-slate-900 via-cyan-900/20 to-black rounded-xl p-6 border border-slate-800 shadow-2xl hover:shadow-cyan-500/20 transition-all duration-300 backdrop-blur-sm hover-lift animate-fade-in">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <Target className="w-5 h-5 mr-2 text-cyan-400" />
                Drop Type Recommendation
              </h2>
              <div className="space-y-3">
                <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <p className="text-sm font-semibold text-blue-400 mb-1 capitalize">
                    {enhancedData.dropTypeRecommendation.recommendedType.replace('-', ' ')}
                  </p>
                  <p className="text-sm text-slate-300 mb-2">{enhancedData.dropTypeRecommendation.reasoning}</p>
                  <p className="text-xs text-blue-400">{enhancedData.dropTypeRecommendation.timing}</p>
                </div>
                {enhancedData.dropTypeRecommendation.alternatives.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-400 mb-2">Alternatives:</p>
                    <div className="flex flex-wrap gap-2">
                      {enhancedData.dropTypeRecommendation.alternatives.map((alt: string, idx: number) => (
                        <span key={idx} className="text-xs px-2 py-1 bg-slate-800 rounded capitalize">
                          {alt.replace('-', ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Narrative Continuity */}
          {enhancedData.narrativeContinuity && (
            <div className="bg-gradient-to-br from-slate-900 via-purple-900/20 to-black rounded-xl p-6 border border-slate-800 shadow-2xl hover:shadow-purple-500/20 transition-all duration-300 backdrop-blur-sm hover-lift animate-fade-in">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <Sparkles className="w-5 h-5 mr-2 text-purple-400" />
                Narrative Continuity
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Continuity Score</span>
                  <span className={`text-xl font-bold ${
                    enhancedData.narrativeContinuity.continuityScore >= 70 ? 'text-green-400' :
                    enhancedData.narrativeContinuity.continuityScore >= 50 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {enhancedData.narrativeContinuity.continuityScore}/100
                  </span>
                </div>
                <div>
                  <span className={`text-sm px-2 py-1 rounded ${
                    enhancedData.narrativeContinuity.narrativeStrength === 'strong' ? 'bg-green-500/30 text-green-300' :
                    enhancedData.narrativeContinuity.narrativeStrength === 'moderate' ? 'bg-yellow-500/30 text-yellow-300' :
                    enhancedData.narrativeContinuity.narrativeStrength === 'weak' ? 'bg-orange-500/30 text-orange-300' :
                    'bg-red-500/30 text-red-300'
                  }`}>
                    {enhancedData.narrativeContinuity.narrativeStrength.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-slate-300">{enhancedData.narrativeContinuity.recommendation}</p>
              </div>
            </div>
          )}

          {/* Market Noise */}
          {enhancedData.marketNoise && enhancedData.marketNoise.hasNoise && (
            <div className="bg-gradient-to-br from-slate-900 via-orange-900/20 to-black rounded-xl p-6 border border-orange-500/50 shadow-2xl hover:shadow-orange-500/30 transition-all duration-300 backdrop-blur-sm hover-lift animate-fade-in">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2 text-orange-400" />
                Market Noise Awareness
              </h2>
              <div className="space-y-3">
                {enhancedData.marketNoise.noiseTypes.map((noise: any, idx: number) => (
                  <div key={idx} className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-orange-400 capitalize">
                        {noise.type.replace('-', ' ')}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        noise.severity === 'high' ? 'bg-red-500/30 text-red-300' :
                        noise.severity === 'medium' ? 'bg-yellow-500/30 text-yellow-300' :
                        'bg-orange-500/30 text-orange-300'
                      }`}>
                        {noise.severity}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">{noise.description}</p>
                  </div>
                ))}
                <p className="text-sm text-orange-300 font-semibold mt-3">
                  {enhancedData.marketNoise.recommendation}
                </p>
              </div>
            </div>
          )}

          {/* Confidence Index */}
          {enhancedData.confidenceIndex && (
            <div className="bg-gradient-to-br from-slate-900 via-green-900/20 to-black rounded-xl p-6 border border-slate-800 shadow-2xl hover:shadow-green-500/20 transition-all duration-300 backdrop-blur-sm hover-lift animate-fade-in">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                <Gauge className="w-5 h-5 mr-2 text-green-400" />
                Confidence Index
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Confidence Level</span>
                  <span className={`text-xl font-bold ${
                    enhancedData.confidenceIndex.level === 'high' ? 'text-green-400' :
                    enhancedData.confidenceIndex.level === 'medium' ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {enhancedData.confidenceIndex.level.toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-400">Score</span>
                    <span className="text-white font-semibold">{enhancedData.confidenceIndex.score}/100</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-3 shadow-inner overflow-hidden">
                    <div 
                      className={`h-3 rounded-full transition-all duration-500 ease-out shadow-lg ${
                        enhancedData.confidenceIndex.score >= 70 ? 'bg-gradient-to-r from-green-500 to-emerald-400' :
                        enhancedData.confidenceIndex.score >= 50 ? 'bg-gradient-to-r from-yellow-500 to-orange-400' :
                        'bg-gradient-to-r from-red-500 to-rose-400'
                      }`}
                      style={{ width: `${enhancedData.confidenceIndex.score}%` }}
                    />
                  </div>
                </div>
                <p className="text-sm text-slate-300">{enhancedData.confidenceIndex.message}</p>
                {enhancedData.confidenceIndex.factors.length > 0 && (
                  <div className="pt-2 border-t border-slate-700">
                    <p className="text-xs text-slate-400 mb-1">Factors:</p>
                    <ul className="space-y-1">
                      {enhancedData.confidenceIndex.factors.map((factor: string, idx: number) => (
                        <li key={idx} className="text-xs text-slate-400">• {factor}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recommendations List */}
      {enhancedData?.recommendations && enhancedData.recommendations.length > 0 && (
        <div className="bg-gradient-to-br from-slate-900 via-blue-900/20 to-black rounded-xl p-6 border border-slate-800 shadow-2xl hover:shadow-blue-500/20 transition-all duration-300 backdrop-blur-sm hover-lift animate-fade-in">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2 text-blue-400" />
            Action Recommendations
          </h2>
          <ul className="space-y-2">
            {enhancedData.recommendations.map((rec: string, idx: number) => (
              <li key={idx} className="flex items-start space-x-2 text-sm text-slate-300">
                <span className="text-blue-500 mt-1">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Advanced Growth Center - Tabs Navigation */}
      {hasAnyData && (
        <ErrorBoundary sectionName="Growth Center">
          <div className="mt-8 mb-6">
            <div className="flex space-x-2 border-b border-slate-800 overflow-x-auto">
              {['overview', 'content', 'goals', 'insights', 'revenue'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === tab
                      ? 'border-purple-500 text-purple-400'
                      : 'border-transparent text-slate-400 hover:text-slate-300'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

      {/* Growth Center Content by Tab */}
      {hasAnyData && activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Wins Section */}
          {growthData?.actionItems && growthData.actionItems.length > 0 && (
            <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/20 rounded-xl p-6 border border-green-500/30 shadow-lg">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                <Zap className="w-5 h-5 mr-2 text-green-400" />
                Quick Wins - Action Items
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {growthData.actionItems.slice(0, 6).map((item: any) => (
                  <div key={item.id} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-white font-medium">{item.title}</h4>
                      <span className={`text-xs px-2 py-1 rounded ${
                        item.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                        item.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {item.priority}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mb-2">{item.description}</p>
                    {item.estimatedTime && (
                      <p className="text-xs text-slate-500">⏱ {item.estimatedTime} min</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Best Posting Times */}
          {growthData?.bestPostingHours && growthData.bestPostingHours.length > 0 && (
            <div className="bg-gradient-to-br from-blue-900/30 to-indigo-900/20 rounded-xl p-6 border border-blue-500/30 shadow-lg">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-blue-400" />
                Best Posting Times
              </h3>
              <div className="flex flex-wrap gap-3">
                {growthData.bestPostingHours.map((hour: number) => {
                  const timeStr = `${hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`
                  return (
                    <div key={hour} className="bg-blue-500/20 rounded-lg px-4 py-2 border border-blue-500/30">
                      <span className="text-blue-400 font-medium">{timeStr}</span>
                    </div>
                  )
                })}
              </div>
              <p className="text-sm text-slate-400 mt-4">Based on your historical performance data</p>
            </div>
          )}

          {/* Content Type Performance */}
          {growthData?.contentTypePerformance && Object.keys(growthData.contentTypePerformance).length > 0 && (
            <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/20 rounded-xl p-6 border border-purple-500/30 shadow-lg">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-purple-400" />
                Content Type Performance
              </h3>
              <div className="space-y-3">
                {Object.entries(growthData.contentTypePerformance).map(([type, perf]: [string, any]) => (
                  <div key={type} className="bg-slate-800/50 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white font-medium capitalize">{type}</span>
                      <span className="text-purple-400 font-semibold">{perf.avgEngagement.toFixed(1)}% engagement</span>
                    </div>
                    <div className="flex justify-between text-sm text-slate-400">
                      <span>{perf.count} posts</span>
                      <span>{perf.totalViews.toLocaleString()} total views</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Streaming Correlation */}
          {growthData?.streamingCorrelation && (
            <div className="bg-gradient-to-br from-yellow-900/30 to-orange-900/20 rounded-xl p-6 border border-yellow-500/30 shadow-lg">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                <Music className="w-5 h-5 mr-2 text-yellow-400" />
                Social → Streaming Correlation
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-slate-400 mb-1">Total Streams</p>
                  <p className="text-2xl font-bold text-white">{growthData.streamingCorrelation.totalStreams.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400 mb-1">Avg Followers</p>
                  <p className="text-2xl font-bold text-white">{Math.round(growthData.streamingCorrelation.avgFollowers).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400 mb-1">Streams/Follower</p>
                  <p className="text-2xl font-bold text-yellow-400">{growthData.streamingCorrelation.streamsPerFollower.toFixed(1)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content Tab */}
      {hasAnyData && activeTab === 'content' && (
        <div className="space-y-6">
          {/* Content Calendar */}
          {growthData?.contentCalendar && growthData.contentCalendar.length > 0 && (
            <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-blue-400" />
                  Content Calendar
                </h3>
                <button
                  onClick={() => setShowCalendarModal(true)}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Schedule</span>
                </button>
              </div>
              <div className="space-y-2">
                {growthData.contentCalendar.slice(0, 10).map((item: any) => (
                  <div key={item.id} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-white font-medium">{item.title}</h4>
                        <p className="text-sm text-slate-400">{new Date(item.scheduledDate).toLocaleDateString()}</p>
                      </div>
                      <span className={`px-3 py-1 rounded text-xs ${
                        item.status === 'posted' ? 'bg-green-500/20 text-green-400' :
                        item.status === 'scheduled' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Content Ideas */}
          {growthData?.contentIdeas && growthData.contentIdeas.length > 0 && (
            <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/20 rounded-xl p-6 border border-purple-500/30 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white flex items-center">
                  <Lightbulb className="w-5 h-5 mr-2 text-purple-400" />
                  AI Content Ideas
                </h3>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/growth-analytics', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'generate_content_ideas', artistId: selectedArtistId }),
                      })
                      const result = await res.json()
                      if (result.success) {
                        fetchGrowthData()
                      }
                    } catch (error) {
                      console.error('Failed to generate ideas:', error)
                    }
                  }}
                  className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm flex items-center space-x-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Generate</span>
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {growthData.contentIdeas.slice(0, 6).map((idea: any) => (
                  <div key={idea.id} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <div className="flex items-start justify-between mb-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        idea.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                        idea.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {idea.contentType}
                      </span>
                      {idea.used && <CheckCircle className="w-4 h-4 text-green-400" />}
                    </div>
                    <h4 className="text-white font-medium mb-2">{idea.idea}</h4>
                    <p className="text-sm text-slate-400 mb-2">{idea.reasoning}</p>
                    {idea.suggestedHashtags && idea.suggestedHashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {idea.suggestedHashtags.slice(0, 3).map((tag: string) => (
                          <span key={tag} className="text-xs text-purple-400">#{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hashtag Performance */}
          {growthData?.hashtagPerformance && growthData.hashtagPerformance.length > 0 && (
            <div className="bg-gradient-to-br from-cyan-900/30 to-blue-900/20 rounded-xl p-6 border border-cyan-500/30 shadow-lg">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                <Hash className="w-5 h-5 mr-2 text-cyan-400" />
                Top Performing Hashtags
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {growthData.hashtagPerformance.slice(0, 8).map((hashtag: any) => (
                  <div key={hashtag.id} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                    <p className="text-cyan-400 font-medium mb-1">#{hashtag.hashtag}</p>
                    <p className="text-xs text-slate-400">{hashtag.avgEngagementRate.toFixed(1)}% engagement</p>
                    <p className="text-xs text-slate-500">Used {hashtag.usageCount}x</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Goals Tab */}
      {hasAnyData && activeTab === 'goals' && (
        <div className="space-y-6">
          {/* Goals List */}
          {growthData?.goals && (
            <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white flex items-center">
                  <Target className="w-5 h-5 mr-2 text-green-400" />
                  Your Goals
                </h3>
                <button
                  onClick={() => setShowGoalModal(true)}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Goal</span>
                </button>
              </div>
              <div className="space-y-4">
                {growthData.goals.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">No goals set yet. Create your first goal!</p>
                ) : (
                  growthData.goals.map((goal: any) => (
                    <div key={goal.id} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-white font-medium capitalize">{goal.type.replace('_', ' ')}</h4>
                        {goal.isCompleted ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                          <span className="text-sm text-slate-400">{Math.round(goal.progress)}%</span>
                        )}
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
                        <div
                          className="bg-gradient-to-r from-green-500 to-emerald-400 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(100, goal.progress)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">{goal.current.toLocaleString()}</span>
                        <span className="text-white font-medium">{goal.target.toLocaleString()}</span>
                      </div>
                      {goal.deadline && (
                        <p className="text-xs text-slate-500 mt-2">
                          Deadline: {new Date(goal.deadline).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Milestones */}
          {growthData?.milestones && growthData.milestones.length > 0 && (
            <div className="bg-gradient-to-br from-yellow-900/30 to-amber-900/20 rounded-xl p-6 border border-yellow-500/30 shadow-lg">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                <Trophy className="w-5 h-5 mr-2 text-yellow-400" />
                Recent Milestones
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {growthData.milestones.slice(0, 6).map((milestone: any) => (
                  <div key={milestone.id} className="bg-slate-800/50 rounded-lg p-4 border border-yellow-500/30">
                    <div className="flex items-center justify-between mb-2">
                      <Crown className="w-5 h-5 text-yellow-400" />
                      <span className="text-xs text-slate-400">{new Date(milestone.achievedAt).toLocaleDateString()}</span>
                    </div>
                    <h4 className="text-white font-medium mb-1">{milestone.title}</h4>
                    <p className="text-2xl font-bold text-yellow-400">{milestone.value.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Insights Tab */}
      {hasAnyData && activeTab === 'insights' && (
        <div className="space-y-6">
          {/* Benchmarks */}
          {growthData?.benchmarks && growthData.benchmarks.length > 0 && (
            <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/20 rounded-xl p-6 border border-indigo-500/30 shadow-lg">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                <BarChart className="w-5 h-5 mr-2 text-indigo-400" />
                Industry Benchmarks
              </h3>
              <div className="space-y-4">
                {growthData.benchmarks.map((bench: any) => (
                  <div key={bench.id} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium capitalize">{bench.metric.replace('_', ' ')}</span>
                      <span className={`px-3 py-1 rounded text-xs ${
                        bench.comparison === 'above' ? 'bg-green-500/20 text-green-400' :
                        bench.comparison === 'below' ? 'bg-red-500/20 text-red-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {bench.comparison}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-400">You: {bench.artistValue.toLocaleString()}</span>
                      <span className="text-slate-400">Avg: {bench.industryAverage.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          bench.comparison === 'above' ? 'bg-green-500' :
                          bench.comparison === 'below' ? 'bg-red-500' :
                          'bg-yellow-500'
                        }`}
                        style={{ width: `${Math.min(100, bench.percentile)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cross-Platform Comparison */}
          {growthData?.crossPlatform && growthData.crossPlatform.length > 0 && (
            <div className="bg-gradient-to-br from-pink-900/30 to-rose-900/20 rounded-xl p-6 border border-pink-500/30 shadow-lg">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                <Globe className="w-5 h-5 mr-2 text-pink-400" />
                Instagram vs TikTok
              </h3>
              {growthData.crossPlatform[0] && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-pink-500/30">
                    <h4 className="text-pink-400 font-medium mb-3">Instagram</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Followers</span>
                        <span className="text-white">{growthData.crossPlatform[0].instagram.followers.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Engagement</span>
                        <span className="text-white">{growthData.crossPlatform[0].instagram.avgEngagementRate.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Growth</span>
                        <span className="text-green-400">+{growthData.crossPlatform[0].instagram.growthRate.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-cyan-500/30">
                    <h4 className="text-cyan-400 font-medium mb-3">TikTok</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Followers</span>
                        <span className="text-white">{growthData.crossPlatform[0].tiktok.followers.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Engagement</span>
                        <span className="text-white">{growthData.crossPlatform[0].tiktok.avgEngagementRate.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Growth</span>
                        <span className="text-green-400">+{growthData.crossPlatform[0].tiktok.growthRate.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Audience Insights */}
          {growthData?.audienceInsights && growthData.audienceInsights.length > 0 && (
            <div className="bg-gradient-to-br from-indigo-900/30 to-blue-900/20 rounded-xl p-6 border border-indigo-500/30 shadow-lg">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2 text-indigo-400" />
                Audience Insights
              </h3>
              <div className="space-y-4">
                {growthData.audienceInsights.slice(0, 3).map((insight: any) => (
                  <div key={insight.id} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium capitalize">{insight.insightType.replace('_', ' ')}</span>
                      <span className="text-xs text-slate-400 capitalize">{insight.period}</span>
                    </div>
                    {insight.data && (
                      <div className="text-sm text-slate-300">
                        {insight.insightType === 'active_times' && insight.data.bestHours && (
                          <p>Most active: {insight.data.bestHours.join(', ')}</p>
                        )}
                        {insight.insightType === 'demographics' && insight.data.ageRange && (
                          <p>Age: {insight.data.ageRange}</p>
                        )}
                        {insight.insightType === 'growth_source' && insight.data.topSource && (
                          <p>Top source: {insight.data.topSource}</p>
                        )}
                        {insight.insightType === 'quality_score' && insight.data.score && (
                          <p>Quality Score: {insight.data.score}/100</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Engagement Response Metrics */}
          {growthData?.engagementResponses && growthData.engagementResponses.length > 0 && (
            <div className="bg-gradient-to-br from-emerald-900/30 to-teal-900/20 rounded-xl p-6 border border-emerald-500/30 shadow-lg">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                <MessageCircle className="w-5 h-5 mr-2 text-emerald-400" />
                Engagement Response Metrics
              </h3>
              <div className="space-y-3">
                {(() => {
                  const avgResponseTime = growthData.engagementResponses.reduce((sum: number, r: any) => sum + r.responseTime, 0) / growthData.engagementResponses.length
                  const responseTypes: Record<string, number> = {}
                  growthData.engagementResponses.forEach((r: any) => {
                    responseTypes[r.responseType] = (responseTypes[r.responseType] || 0) + 1
                  })
                  return (
                    <>
                      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <p className="text-sm text-slate-400 mb-1">Average Response Time</p>
                        <p className="text-2xl font-bold text-emerald-400">{Math.round(avgResponseTime)} minutes</p>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {Object.entries(responseTypes).map(([type, count]) => (
                          <div key={type} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                            <p className="text-xs text-slate-400 capitalize">{type}</p>
                            <p className="text-lg font-bold text-white">{count}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
          )}

          {/* Story Performance */}
          {growthData?.storyPerformance && growthData.storyPerformance.length > 0 && (
            <div className="bg-gradient-to-br from-violet-900/30 to-purple-900/20 rounded-xl p-6 border border-violet-500/30 shadow-lg">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                <Video className="w-5 h-5 mr-2 text-violet-400" />
                Story Performance
              </h3>
              <div className="space-y-3">
                {(() => {
                  const avgViews = growthData.storyPerformance.reduce((sum: number, s: any) => sum + s.views, 0) / growthData.storyPerformance.length
                  const avgCompletion = growthData.storyPerformance.reduce((sum: number, s: any) => sum + s.completionRate, 0) / growthData.storyPerformance.length
                  const totalInteractions = growthData.storyPerformance.reduce((sum: number, s: any) => sum + s.interactions, 0)
                  return (
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <p className="text-sm text-slate-400 mb-1">Avg Views</p>
                        <p className="text-2xl font-bold text-white">{Math.round(avgViews).toLocaleString()}</p>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <p className="text-sm text-slate-400 mb-1">Completion Rate</p>
                        <p className="text-2xl font-bold text-violet-400">{(avgCompletion * 100).toFixed(1)}%</p>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <p className="text-sm text-slate-400 mb-1">Total Interactions</p>
                        <p className="text-2xl font-bold text-white">{totalInteractions.toLocaleString()}</p>
                      </div>
                    </div>
                  )
                })()}
                <div className="pt-3 border-t border-slate-700">
                  <p className="text-xs text-slate-400">Based on {growthData.storyPerformance.length} recent stories</p>
                </div>
              </div>
            </div>
          )}

          {/* Weekly Reports */}
          {growthData?.weeklyReports && growthData.weeklyReports.length > 0 && (
            <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-400" />
                Weekly Growth Reports
              </h3>
              <div className="space-y-4">
                {growthData.weeklyReports.map((report: any) => (
                  <div key={report.id} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-white font-medium">
                        {new Date(report.weekStart).toLocaleDateString()} - {new Date(report.weekEnd).toLocaleDateString()}
                      </h4>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-slate-400">Follower Growth</p>
                        <p className={`text-lg font-bold ${report.summary.followerGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {report.summary.followerGrowth >= 0 ? '+' : ''}{report.summary.followerGrowth}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Engagement</p>
                        <p className={`text-lg font-bold ${report.summary.engagementChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {report.summary.engagementChange >= 0 ? '+' : ''}{report.summary.engagementChange.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Views</p>
                        <p className={`text-lg font-bold ${report.summary.viewsChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {report.summary.viewsChange >= 0 ? '+' : ''}{report.summary.viewsChange}
                        </p>
                      </div>
                    </div>
                    {report.summary.recommendations && report.summary.recommendations.length > 0 && (
                      <div className="pt-3 border-t border-slate-700">
                        <p className="text-xs text-slate-400 mb-2">Recommendations:</p>
                        <ul className="space-y-1">
                          {report.summary.recommendations.slice(0, 3).map((rec: string, idx: number) => (
                            <li key={idx} className="text-xs text-slate-300">• {rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Revenue Tab */}
      {hasAnyData && activeTab === 'revenue' && (
        <div className="space-y-6">
          {/* Revenue Projections */}
          {growthData?.revenueProjections && growthData.revenueProjections.length > 0 && (
            <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/20 rounded-xl p-6 border border-green-500/30 shadow-lg">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                <DollarSign className="w-5 h-5 mr-2 text-green-400" />
                Revenue Projections
              </h3>
              <div className="space-y-4">
                {growthData.revenueProjections.map((projection: any) => (
                  <div key={projection.id} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium capitalize">{projection.period}</span>
                      <span className={`px-3 py-1 rounded text-xs ${
                        projection.confidence === 'high' ? 'bg-green-500/20 text-green-400' :
                        projection.confidence === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {projection.confidence} confidence
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div>
                        <p className="text-sm text-slate-400 mb-1">Projected Revenue</p>
                        <p className="text-2xl font-bold text-green-400">${projection.projectedRevenue.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-400 mb-1">Projected Streams</p>
                        <p className="text-2xl font-bold text-white">{projection.projectedStreams.toLocaleString()}</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">Target: {new Date(projection.targetDate).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Collaboration Opportunities */}
          {growthData?.collaborations && growthData.collaborations.length > 0 && (
            <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/20 rounded-xl p-6 border border-purple-500/30 shadow-lg">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                <UserPlus className="w-5 h-5 mr-2 text-purple-400" />
                Collaboration Opportunities
              </h3>
              <div className="space-y-3">
                {growthData.collaborations.slice(0, 5).map((collab: any) => (
                  <div key={collab.id} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-white font-medium">{collab.suggestedArtistName}</h4>
                      <span className={`px-3 py-1 rounded text-xs ${
                        collab.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                        collab.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {collab.priority}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mb-2">{collab.reason}</p>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>{collab.audienceOverlap}% audience overlap</span>
                      <span>{collab.potentialReach.toLocaleString()} potential reach</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
        </ErrorBoundary>
      )}

      {/* AI Release Ideas - Collapsible Section */}
      <ErrorBoundary sectionName="AI Release Ideas">
        <div className="bg-gradient-to-br from-slate-900 via-purple-900/20 to-black rounded-xl border border-purple-500/30 shadow-lg overflow-hidden">
        <button
          onClick={() => setShowAIIdeas(!showAIIdeas)}
          className="w-full p-4 border-b border-purple-500/30 bg-purple-900/20 hover:bg-purple-900/30 transition-colors text-left"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Lightbulb className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg font-semibold text-white">AI Release Ideas</h3>
            </div>
            {showAIIdeas ? <X className="w-5 h-5 text-purple-400" /> : <MessageSquare className="w-5 h-5 text-purple-400" />}
          </div>
        </button>

        {showAIIdeas && (
          <div className="p-6 space-y-4">
            {/* Quick Stats - Artist's Own Numbers */}
            {hasAnyData && (
              <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-lg p-4 border border-blue-500/30 shadow-lg">
                <h4 className="text-sm font-semibold text-white mb-3 flex items-center">
                  <BarChart3 className="w-4 h-4 mr-2 text-blue-400" />
                  Your Numbers
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {latestInstagram && (
                    <>
                      <div className="bg-slate-900/50 rounded p-2 border border-slate-700/50">
                        <p className="text-xs text-slate-400 mb-1">Instagram Followers</p>
                        <p className="text-xl font-bold text-white">{latestInstagram.followers.toLocaleString()}</p>
                      </div>
                      <div className="bg-slate-900/50 rounded p-2 border border-slate-700/50">
                        <p className="text-xs text-slate-400 mb-1">Latest Views</p>
                        <p className="text-xl font-bold text-white">{latestInstagram.views.toLocaleString()}</p>
                      </div>
                      <div className="bg-slate-900/50 rounded p-2 border border-slate-700/50">
                        <p className="text-xs text-slate-400 mb-1">Engagement Rate</p>
                        <p className="text-xl font-bold text-green-400">
                          {latestInstagram.views > 0 
                            ? ((latestInstagram.comments + latestInstagram.shares + latestInstagram.saves) / latestInstagram.views * 100).toFixed(1)
                            : 0}%
                        </p>
                      </div>
                      <div className="bg-slate-900/50 rounded p-2 border border-slate-700/50">
                        <p className="text-xs text-slate-400 mb-1">Completion Rate</p>
                        <p className="text-xl font-bold text-blue-400">{(latestInstagram.completionRate * 100).toFixed(0)}%</p>
                      </div>
                    </>
                  )}
                  {latestTikTok && (
                    <>
                      <div className="bg-slate-900/50 rounded p-2 border border-slate-700/50">
                        <p className="text-xs text-slate-400 mb-1">TikTok Followers</p>
                        <p className="text-xl font-bold text-white">{latestTikTok.followers.toLocaleString()}</p>
                      </div>
                      <div className="bg-slate-900/50 rounded p-2 border border-slate-700/50">
                        <p className="text-xs text-slate-400 mb-1">TikTok Views</p>
                        <p className="text-xl font-bold text-white">{latestTikTok.views.toLocaleString()}</p>
                      </div>
                    </>
                  )}
                  {enhancedData && (
                    <>
                      <div className="bg-slate-900/50 rounded p-2 border border-slate-700/50">
                        <p className="text-xs text-slate-400 mb-1">Heat Score</p>
                        <p className="text-xl font-bold text-yellow-400">{enhancedData.heat.combinedHeat}/100</p>
                      </div>
                      <div className="bg-slate-900/50 rounded p-2 border border-slate-700/50">
                        <p className="text-xs text-slate-400 mb-1">Confidence</p>
                        <p className={`text-xl font-bold ${
                          enhancedData.confidenceIndex?.level === 'high' ? 'text-green-400' :
                          enhancedData.confidenceIndex?.level === 'medium' ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {enhancedData.confidenceIndex?.level || 'N/A'}
                        </p>
                      </div>
                    </>
                  )}
                </div>
                {latestInstagram && (
                  <div className="mt-3 pt-3 border-t border-slate-700/50">
                    <p className="text-xs text-slate-400">
                      Data Points: <span className="text-white font-semibold">{instagramMetrics.length}</span>
                      {hasSufficientData ? (
                        <span className="text-green-400 ml-2">✓ Ready for analysis</span>
                      ) : (
                        <span className="text-yellow-400 ml-2">• Building profile</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* AI Analysis Display */}
            {aiAnalysis && (
              <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-lg p-3 border border-purple-500/30">
                <h4 className="text-xs font-semibold text-purple-400 mb-2 flex items-center">
                  <Sparkles className="w-3 h-3 mr-2" />
                  AI Analysis
                </h4>
                <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{aiAnalysis}</p>
              </div>
            )}

            {/* Question Input */}
            <div className="space-y-2">
              <textarea
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                placeholder="Ask about release timing, strategy..."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !isAnalyzing) {
                    handleAIAnalysis()
                  }
                }}
              />
              <button
                onClick={() => handleAIAnalysis()}
                disabled={!aiQuestion.trim() || isAnalyzing}
                className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-xs rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3 h-3" />
                    <span>Get AI Ideas</span>
                  </>
                )}
              </button>
              <p className="text-xs text-slate-600 text-center">Cmd+Enter to send</p>
            </div>

            {/* Previous Ideas */}
            {aiIdeas.length > 1 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Previous Ideas</h4>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {aiIdeas.slice(1).map((idea) => (
                    <div key={idea.id} className="bg-slate-800/30 rounded-lg p-2 border border-slate-700/50">
                      <p className="text-xs text-purple-400 font-medium mb-1 line-clamp-1">{idea.question}</p>
                      <p className="text-xs text-slate-400 line-clamp-2">{idea.answer}</p>
                      <p className="text-xs text-slate-600 mt-1">
                        {new Date(idea.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!hasAnyData && (
              <div className="text-center py-8">
                <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-400">
                  Once your data is available, AI will provide personalized release ideas here.
                </p>
              </div>
            )}

            {hasAnyData && !hasSufficientData && !aiAnalysis && (
              <div className="text-center py-6">
                <Loader2 className="w-8 h-8 text-purple-400 mx-auto mb-3 animate-spin" />
                <p className="text-sm text-slate-400">
                  Collecting more data for accurate analysis...
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      </ErrorBoundary>

      {/* Important Clarity Section */}
      {!isAdmin && (
        <ErrorBoundary sectionName="Important Clarity">
          <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center">
            <HelpCircle className="w-5 h-5 mr-2 text-blue-400" />
            Important Clarity
          </h2>
          <div className="space-y-2 text-sm text-slate-300">
            <p className="flex items-start">
              <span className="text-red-500 mr-2">❌</span>
              <span>Being "not ready" does not mean the song isn't good</span>
            </p>
            <p className="flex items-start">
              <span className="text-red-500 mr-2">❌</span>
              <span>It does not mean you can't release</span>
            </p>
            <p className="flex items-start mt-3">
              <span className="text-green-500 mr-2">✅</span>
              <span>It means waiting gives the song a better chance</span>
            </p>
            <p className="text-slate-400 text-xs mt-4 italic">
              Release Readiness is about protecting your momentum, not slowing you down.
            </p>
          </div>
        </div>
        </ErrorBoundary>
      )}

      {/* Explanation Card */}
      {latestExplanation && (
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2 text-yellow-400" />
            Latest Assessment
          </h2>
          {(latestExplanation as any).laneContext && (
            <p className="text-xs text-slate-500 mb-3 italic">{(latestExplanation as any).laneContext}</p>
          )}
          <p className="text-slate-300 mb-4">{latestExplanation.explanationText}</p>
          {latestExplanation.actionSteps && latestExplanation.actionSteps.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-400 mb-2">Action Steps:</h3>
              <ul className="space-y-2">
                {latestExplanation.actionSteps.map((step, idx) => (
                  <li key={idx} className="flex items-start space-x-2 text-slate-300">
                    <span className="text-red-500 mt-1">•</span>
                    <span className="text-sm">{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(isAdmin || isStaffView) && (latestExplanation as any).adminNotes && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <h3 className="text-sm font-semibold text-yellow-400 mb-2">Admin Notes:</h3>
              <p className="text-sm text-slate-300">{(latestExplanation as any).adminNotes}</p>
            </div>
          )}
          <p className="text-xs text-slate-500 mt-4">
            Generated: {new Date(latestExplanation.generatedAt).toLocaleString()}
          </p>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Instagram Metrics */}
        {latestInstagram && (
          <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white flex items-center">
                <Instagram className="w-5 h-5 mr-2 text-pink-400" />
                Instagram Metrics
              </h2>
              {canAddManualMetrics && (
                <button
                  onClick={() => setShowManualInput(true)}
                  className="px-3 py-1.5 text-xs bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded-lg text-blue-400 transition-colors"
                >
                  Add Manual Data
                </button>
              )}
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Followers</span>
                <span className="text-white font-semibold">{latestInstagram?.followers?.toLocaleString() || '0'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Views</span>
                <span className="text-white font-semibold">{latestInstagram?.views?.toLocaleString() || '0'}</span>
              </div>
              {latestInstagram?.likes !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Likes</span>
                  <span className="text-white font-semibold">{latestInstagram.likes.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Saves</span>
                <span className="text-white font-semibold">{latestInstagram?.saves?.toLocaleString() || '0'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Shares</span>
                <span className="text-white font-semibold">{latestInstagram?.shares?.toLocaleString() || '0'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Comments</span>
                <span className="text-white font-semibold">{latestInstagram?.comments?.toLocaleString() || '0'}</span>
              </div>
              {latestInstagram?.interactions !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Interactions</span>
                  <span className="text-white font-semibold">{latestInstagram.interactions.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Completion Rate</span>
                <span className="text-white font-semibold">{latestInstagram?.completionRate ? (latestInstagram.completionRate * 100).toFixed(1) : '0.0'}%</span>
              </div>
              {latestInstagram?.retention !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Retention</span>
                  <span className="text-white font-semibold">{latestInstagram.retention.toFixed(1)}%</span>
                </div>
              )}
              {latestInstagram?.skipRate !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Skip Rate</span>
                  <span className="text-white font-semibold">{latestInstagram.skipRate.toFixed(1)}%</span>
                </div>
              )}
              {latestInstagram?.watchTime !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Watch Time</span>
                  <span className="text-white font-semibold">
                    {latestInstagram?.watchTime ? `${Math.floor(latestInstagram.watchTime / 60)}m ${latestInstagram.watchTime % 60}s` : '0m 0s'}
                  </span>
                </div>
              )}
              {latestInstagram?.audience !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Audience</span>
                  <span className="text-white font-semibold">{latestInstagram?.audience?.toLocaleString() || '0'}</span>
                </div>
              )}
              {latestInstagram.facebookVsInstagram && (
                <div className="pt-2 border-t border-slate-700">
                  <div className="text-xs text-slate-400 mb-2">Facebook vs Instagram</div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-400 text-sm">Facebook</span>
                    <span className="text-white font-semibold text-sm">
                      {latestInstagram.facebookVsInstagram.facebook.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-sm">Instagram</span>
                    <span className="text-white font-semibold text-sm">
                      {latestInstagram.facebookVsInstagram.instagram.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-700">
              <p className="text-xs text-slate-500">
                Date: {new Date(latestInstagram.metricDate).toLocaleDateString()}
                {latestInstagram.manuallyAdded && (
                  <span className="ml-2 text-blue-400">(Manually Added)</span>
                )}
              </p>
            </div>
          </div>
        )}
        
        {/* Show manual input button if no Instagram metrics and user can add manual metrics */}
        {!latestInstagram && canAddManualMetrics && (
          <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg flex items-center justify-center">
            <button
              onClick={() => setShowManualInput(true)}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center space-x-2"
            >
              <Instagram className="w-5 h-5" />
              <span>Add Instagram Analytics</span>
            </button>
          </div>
        )}

        {/* Spotify Snapshot */}
        {latestSpotify && (
          <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Music className="w-5 h-5 mr-2 text-green-400" />
              Spotify Snapshot
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Streams</span>
                <span className="text-white font-semibold">{latestSpotify?.streams?.toLocaleString() || '0'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Listeners</span>
                <span className="text-white font-semibold">{latestSpotify?.listeners?.toLocaleString() || '0'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Save Rate</span>
                <span className="text-white font-semibold">{latestSpotify?.saveRate ? (latestSpotify.saveRate * 100).toFixed(1) : '0.0'}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Playlist Adds</span>
                <span className="text-white font-semibold">{latestSpotify?.playlistAdds?.toLocaleString() || '0'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Confidence</span>
                <span className="text-white font-semibold">{latestSpotify?.confidence ? (latestSpotify.confidence * 100).toFixed(1) : '0.0'}%</span>
              </div>
              {latestSpotify?.topCities && latestSpotify.topCities.length > 0 && (
                <div>
                  <span className="text-slate-400 text-sm">Top Cities:</span>
                  <p className="text-white text-sm mt-1">{latestSpotify.topCities.slice(0, 3).join(', ')}</p>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-4">
              Week: {latestSpotify?.weekStart ? new Date(latestSpotify.weekStart).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        )}

        {/* TikTok Metrics */}
        {latestTikTok && (
          <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white flex items-center">
                <Video className="w-5 h-5 mr-2 text-cyan-400" />
                TikTok Metrics
              </h2>
              {canAddManualMetrics && (
                <button
                  onClick={() => setShowTikTokInput(true)}
                  className="px-3 py-1.5 text-xs bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded-lg text-blue-400 transition-colors"
                >
                  Add Manual Data
                </button>
              )}
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Followers</span>
                <span className="text-white font-semibold">{latestTikTok?.followers?.toLocaleString() || '0'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Views</span>
                <span className="text-white font-semibold">{latestTikTok?.views?.toLocaleString() || '0'}</span>
              </div>
              {latestTikTok?.likes !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Likes</span>
                  <span className="text-white font-semibold">{latestTikTok.likes.toLocaleString()}</span>
                </div>
              )}
              {latestTikTok?.comments !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Comments</span>
                  <span className="text-white font-semibold">{latestTikTok.comments.toLocaleString()}</span>
                </div>
              )}
              {latestTikTok?.shares !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Shares</span>
                  <span className="text-white font-semibold">{latestTikTok?.shares?.toLocaleString() || '0'}</span>
                </div>
              )}
              {latestTikTok?.engagementRate !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Engagement Rate</span>
                  <span className="text-white font-semibold">{latestTikTok?.engagementRate ? latestTikTok.engagementRate.toFixed(1) : '0.0'}%</span>
                </div>
              )}
              {latestTikTok?.watchTime !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Watch Time</span>
                  <span className="text-white font-semibold">
                    {latestTikTok?.watchTime ? `${Math.floor(latestTikTok.watchTime / 60)}m ${latestTikTok.watchTime % 60}s` : '0m 0s'}
                  </span>
                </div>
              )}
              {latestTikTok.retention !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Retention</span>
                  <span className="text-white font-semibold">{latestTikTok.retention.toFixed(1)}%</span>
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-700">
              <p className="text-xs text-slate-500">
                Date: {new Date(latestTikTok.metricDate).toLocaleDateString()}
                {latestTikTok.manuallyAdded && (
                  <span className="ml-2 text-blue-400">(Manually Added)</span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Show manual input button if no TikTok metrics and user can add manual metrics */}
        {!latestTikTok && canAddManualMetrics && (
          <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg flex items-center justify-center">
            <button
              onClick={() => setShowTikTokInput(true)}
              className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors flex items-center space-x-2"
            >
              <Video className="w-5 h-5" />
              <span>Add TikTok Analytics</span>
            </button>
          </div>
        )}
      </div>

      {/* Release Memory */}
      {(data as any)?.releaseMemory && (
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-purple-500/50 shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
            <Sparkles className="w-5 h-5 mr-2 text-purple-400" />
            Release Memory (Artist-Specific Intelligence)
          </h2>
          <div className="space-y-4">
            {(data as any).releaseMemory.successfulStates.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-green-400 mb-2">✅ Successful States:</p>
                <div className="space-y-2">
                  {(data as any).releaseMemory.successfulStates.map((state: any, idx: number) => (
                    <div key={idx} className="p-2 bg-green-500/10 rounded border border-green-500/30">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-white capitalize">{state.state}</span>
                        <span className="text-xs text-green-400">
                          {state.count} releases • {(state.successRate * 100).toFixed(0)}% success • 
                          {state.avgStreams > 0 ? ` ${Math.round(state.avgStreams).toLocaleString()} avg streams` : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(data as any).releaseMemory.failedStates.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-red-400 mb-2">❌ Failed States:</p>
                <div className="space-y-2">
                  {(data as any).releaseMemory.failedStates.map((state: any, idx: number) => (
                    <div key={idx} className="p-2 bg-red-500/10 rounded border border-red-500/30">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-white capitalize">{state.state}</span>
                        <span className="text-xs text-red-400">
                          {state.count} releases • {(state.successRate * 100).toFixed(0)}% success
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="pt-3 border-t border-slate-700">
              <p className="text-sm font-semibold text-blue-400 mb-2">Lane Rules (Learned):</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Can Drop at Building</span>
                  <span className={`font-semibold ${(data as any).releaseMemory.laneRules.canDropAtBuilding ? 'text-green-400' : 'text-red-400'}`}>
                    {(data as any).releaseMemory.laneRules.canDropAtBuilding ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Can Drop at Cooling</span>
                  <span className={`font-semibold ${(data as any).releaseMemory.laneRules.canDropAtCooling ? 'text-green-400' : 'text-red-400'}`}>
                    {(data as any).releaseMemory.laneRules.canDropAtCooling ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
              <div className="mt-2">
                <span className="text-xs text-slate-400">Overall Success Rate: </span>
                <span className="text-sm font-semibold text-white">
                  {((data as any).releaseMemory.laneRules.successRate * 100).toFixed(0)}% ({(data as any).releaseMemory.laneRules.totalReleases} releases)
                </span>
              </div>
            </div>
            {(data as any).releaseMemory.insights.length > 0 && (
              <div className="pt-3 border-t border-slate-700">
                <p className="text-sm font-semibold text-purple-400 mb-2">Key Insights:</p>
                <ul className="space-y-1">
                  {(data as any).releaseMemory.insights.map((insight: string, idx: number) => (
                    <li key={idx} className="text-sm text-slate-300">• {insight}</li>
                  ))}
                </ul>
              </div>
            )}
            {(data as any).releaseMemory.personalRhythm.optimalWindow && (
              <div className="pt-3 border-t border-slate-700">
                <p className="text-xs text-slate-400">Optimal Window: <span className="text-white">{(data as any).releaseMemory.personalRhythm.optimalWindow}</span></p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Post-Drop Health Monitor */}
      {(data as any)?.postDropHealth && (data as any).postDropHealth.length > 0 && (
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-green-400" />
            Post-Drop Health Monitor
          </h2>
          <div className="space-y-4">
            {(data as any).postDropHealth.map((health: any) => (
              <div key={health.id} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Release: {health.releaseId}</p>
                    <p className="text-xs text-slate-400">
                      Dropped: {new Date(health.releaseDate).toLocaleDateString()}
                    </p>
                  </div>
                  {health.overallClassification && (
                    <span className={`text-xs px-2 py-1 rounded ${
                      health.overallClassification.includes('Held') ? 'bg-green-500/30 text-green-300' :
                      health.overallClassification.includes('spike') ? 'bg-yellow-500/30 text-yellow-300' :
                      health.overallClassification.includes('Underperformed') ? 'bg-red-500/30 text-red-300' :
                      'bg-blue-500/30 text-blue-300'
                    }`}>
                      {health.overallClassification}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {health.health6h && (
                    <div className="p-2 bg-slate-900/50 rounded">
                      <p className="text-xs text-slate-400 mb-1">6 Hours</p>
                      <p className={`text-sm font-semibold ${
                        health.health6h.status === 'held-attention' ? 'text-green-400' :
                        health.health6h.status === 'initial-spike' ? 'text-yellow-400' :
                        health.health6h.status === 'underperformed' ? 'text-red-400' :
                        'text-blue-400'
                      }`}>
                        {health.health6h.status.replace('-', ' ')}
                      </p>
                      {health.health6h.streams && (
                        <p className="text-xs text-slate-400">{health.health6h.streams.toLocaleString()} streams</p>
                      )}
                    </div>
                  )}
                  {health.health24h && (
                    <div className="p-2 bg-slate-900/50 rounded">
                      <p className="text-xs text-slate-400 mb-1">24 Hours</p>
                      <p className={`text-sm font-semibold ${
                        health.health24h.status === 'held-attention' ? 'text-green-400' :
                        health.health24h.status === 'initial-spike' ? 'text-yellow-400' :
                        health.health24h.status === 'underperformed' ? 'text-red-400' :
                        'text-blue-400'
                      }`}>
                        {health.health24h.status.replace('-', ' ')}
                      </p>
                      {health.health24h.streams && (
                        <p className="text-xs text-slate-400">{health.health24h.streams.toLocaleString()} streams</p>
                      )}
                    </div>
                  )}
                  {health.health72h && (
                    <div className="p-2 bg-slate-900/50 rounded">
                      <p className="text-xs text-slate-400 mb-1">72 Hours</p>
                      <p className={`text-sm font-semibold ${
                        health.health72h.status === 'held-attention' ? 'text-green-400' :
                        health.health72h.status === 'initial-spike' ? 'text-yellow-400' :
                        health.health72h.status === 'underperformed' ? 'text-red-400' :
                        'text-blue-400'
                      }`}>
                        {health.health72h.status.replace('-', ' ')}
                      </p>
                      {health.health72h.streams && (
                        <p className="text-xs text-slate-400">{health.health72h.streams.toLocaleString()} streams</p>
                      )}
                    </div>
                  )}
                </div>
                {health.lessonsLearned && health.lessonsLearned.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <p className="text-xs text-slate-400 mb-1">Lessons Learned:</p>
                    <ul className="space-y-1">
                      {health.lessonsLearned.map((lesson: string, idx: number) => (
                        <li key={idx} className="text-xs text-slate-300">• {lesson}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TikTok Song Views Section */}
      {tikTokSongViewsList.length > 0 && (
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white flex items-center">
              <Video className="w-5 h-5 mr-2 text-cyan-400" />
              TikTok Song Views
            </h2>
            {canAddManualMetrics && (
              <button
                onClick={() => setShowTikTokSongViews(true)}
                className="px-3 py-1.5 text-xs bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded-lg text-blue-400 transition-colors"
              >
                Link Song Views
              </button>
            )}
          </div>
          <div className="space-y-3">
            {tikTokSongViewsList.map((view: any) => (
              <div key={view.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <div className="flex-1">
                  <div className="text-white font-medium">{view.songName}</div>
                  <div className="text-sm text-slate-400">{view.artistName}</div>
                  {view.videoUrl && (
                    <a
                      href={view.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cyan-400 hover:text-cyan-300 mt-1 inline-flex items-center space-x-1"
                    >
                      <span>View Video</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-white font-semibold">{view.views.toLocaleString()} views</div>
                  <div className="text-xs text-slate-400">{new Date(view.metricDate).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Show button to link TikTok song views if none exist and user can add manual metrics */}
      {tikTokSongViewsList.length === 0 && canAddManualMetrics && (
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg flex items-center justify-center">
          <button
            onClick={() => setShowTikTokSongViews(true)}
            className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors flex items-center space-x-2"
          >
            <Video className="w-5 h-5" />
            <span>Link TikTok Views to Songs</span>
          </button>
        </div>
      )}

      {/* Empty State - Only show if there's NO data at all */}
      {!hasAnyData && (
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-12 border border-slate-800 text-center">
          <BarChart3 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Your Information is Getting Input Soon</h3>
          <p className="text-slate-400 mb-4">
            We're adding information for streams and engagement metrics. 
            Release readiness data will appear here once your metrics are collected and processed. 
            Our team is working on gathering your analytics data.
          </p>
          {instagramStatus?.connected && (
            <div className="mt-4 inline-flex items-center space-x-2 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-sm text-green-400">Instagram Connected</span>
            </div>
          )}
        </div>
      )}

      {/* Insufficient Data Warning */}
      {hasAnyData && !hasSufficientData && (
        <div className="bg-gradient-to-br from-yellow-900/20 to-orange-900/20 rounded-xl p-6 border border-yellow-500/30 shadow-lg">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-yellow-400 mb-2">Building Your Profile</h3>
              <p className="text-slate-300 mb-2">
                We're adding information for streams and engagement metrics to provide accurate release readiness analysis.
                {latestInstagram && (
                  <span className="text-yellow-400"> You currently have {instagramMetrics.length} data point{instagramMetrics.length !== 1 ? 's' : ''}.</span>
                )}
              </p>
              <p className="text-sm text-slate-400 mb-3">
                Once we have at least 3 data points with engagement metrics, you'll see detailed analysis and recommendations.
              </p>
              {lastUpdated ? (
                <div className="flex items-center space-x-2 text-xs text-slate-400 pt-2 border-t border-yellow-500/20">
                  <Clock className="w-3 h-3" />
                  <span>Last updated: <span className="text-yellow-400 font-medium">{lastUpdated.toLocaleDateString()} at {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></span>
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-xs text-slate-500 pt-2 border-t border-yellow-500/20">
                  <Clock className="w-3 h-3" />
                  <span>Data collection in progress - timestamps will appear as information is added</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Instagram Connection Modal - Admin Only */}
      {showInstagramConnect && isAdmin && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 to-black border border-slate-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <Instagram className="w-6 h-6 text-pink-400" />
                <div>
                  <h2 className="text-2xl font-semibold text-white">
                    {(isAdmin || isStaffView) && selectedArtist 
                      ? `Connect Instagram for ${selectedArtist.artistName || selectedArtist.name}${isStaffView ? ' (Admin Only)' : ''}`
                      : 'Connect Instagram Account'}
                  </h2>
                  {isAdmin && selectedArtist && (
                    <p className="text-sm text-slate-400 mt-1">Admin: Connecting account on behalf of artist</p>
                  )}
                  {isStaffView && selectedArtist && (
                    <p className="text-sm text-yellow-400 mt-1">Staff View: This action is read-only. Only admins can connect Instagram accounts.</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setShowInstagramConnect(false)
                  setConnectError('')
                  setConnectForm({ accessToken: '', pageId: '', instagramAccountId: '' })
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <h3 className="text-sm font-semibold text-white mb-2">
                  {isAdmin ? 'Connecting Instagram Account' : isStaffView ? 'Instagram Connection (Admin Only)' : 'Why Connect Instagram?'}
                </h3>
                <p className="text-sm text-slate-300 mb-3">
                  {isAdmin 
                    ? `You are connecting the Instagram account for ${selectedArtist?.artistName || selectedArtist?.name || 'this artist'}. Release Readiness will analyze their Instagram performance to determine the best time to release music.`
                    : isStaffView
                    ? `This feature is read-only for staff members. Only admins can connect Instagram accounts.`
                    : 'Release Readiness analyzes your Instagram performance to determine the best time to release music. We only read your performance data - we never post, comment, or modify your content.'}
                </p>
                <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                  <li>Track engagement metrics (views, saves, shares, comments)</li>
                  <li>Calculate momentum based on your audience activity</li>
                  <li>Get personalized release timing recommendations</li>
                  <li>All data is read-only and secure</li>
                </ul>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-400 mb-2">How to Get Your Instagram Access Token</h3>
                <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside">
                  <li>Go to <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Meta for Developers</a> and create or select your app</li>
                  <li>Add the "Instagram Graph API" product to your app</li>
                  <li>In your app dashboard, go to "Tools" → "Graph API Explorer"</li>
                  <li>Select your app and add permissions: <code className="bg-slate-800 px-1 rounded">instagram_basic</code>, <code className="bg-slate-800 px-1 rounded">instagram_manage_insights</code>, <code className="bg-slate-800 px-1 rounded">pages_read_engagement</code></li>
                  <li>Generate a User Token (short-lived, expires in 1 hour)</li>
                  <li>Paste the token below - we'll automatically exchange it for a long-lived token (60 days)</li>
                </ol>
                <p className="text-xs text-slate-400 mt-2">
                  <strong>Note:</strong> You need an Instagram Business Account connected to a Facebook Page. Personal accounts won't work.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Instagram Access Token <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={connectForm.accessToken}
                    onChange={(e) => setConnectForm({ ...connectForm, accessToken: e.target.value })}
                    placeholder="Paste your Instagram access token here"
                    disabled={isStaffView}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Get your access token from{' '}
                    <a
                      href="https://developers.facebook.com/docs/instagram-api/getting-started"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-pink-400 hover:text-pink-300 inline-flex items-center space-x-1"
                    >
                      <span>Meta for Developers</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    {' '}or use{' '}
                    <a
                      href="https://developers.facebook.com/apps/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-pink-400 hover:text-pink-300 inline-flex items-center space-x-1"
                    >
                      <span>your app dashboard</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    {' '}to generate tokens. You'll need an Instagram Business Account connected to a Facebook Page.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Facebook Page ID <span className="text-yellow-400">(Recommended)</span>
                  </label>
                  <input
                    type="text"
                    value={connectForm.pageId}
                    onChange={(e) => setConnectForm({ ...connectForm, pageId: e.target.value })}
                    placeholder="Your Facebook Page ID"
                    disabled={isStaffView}
                    className={`w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500 ${isStaffView ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    The Facebook Page that your Instagram Business Account is connected to. We'll automatically find your Instagram Account ID from this.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Instagram Business Account ID <span className="text-yellow-400">(Alternative)</span>
                  </label>
                  <input
                    type="text"
                    value={connectForm.instagramAccountId}
                    onChange={(e) => setConnectForm({ ...connectForm, instagramAccountId: e.target.value })}
                    placeholder="Your Instagram Business Account ID"
                    disabled={isStaffView}
                    className={`w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500 ${isStaffView ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    If you know your Instagram Business Account ID directly, enter it here. Otherwise, provide your Facebook Page ID above.
                  </p>
                  <p className="text-xs text-yellow-400 mt-2 font-medium">
                    ⚠️ Note: If you only provide an access token without Page ID or Instagram Account ID, the connection will fail unless your token has "pages_show_list" permission and you have Facebook Pages.
                  </p>
                </div>
              </div>

              {connectError && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3">
                  <p className="text-sm text-red-400 whitespace-pre-line">{connectError}</p>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-700">
                <button
                  onClick={() => {
                    setShowInstagramConnect(false)
                    setConnectError('')
                    setConnectForm({ accessToken: '', pageId: '', instagramAccountId: '' })
                  }}
                  className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConnectInstagram}
                  disabled={!connectForm.accessToken || isConnecting}
                  className="px-6 py-2 bg-pink-500 hover:bg-pink-600 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2"
                >
                  {isConnecting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <Link2 className="w-4 h-4" />
                      <span>Connect Account</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Instagram Analytics Input Modal (Staff/Admin Only) */}
      {showManualInput && canAddManualMetrics && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 to-black border border-slate-800 rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <Instagram className="w-6 h-6 text-pink-400" />
                <div>
                  <h2 className="text-2xl font-semibold text-white">Add Instagram Analytics</h2>
                  <p className="text-sm text-slate-400 mt-1">Manually enter Instagram metrics for {selectedArtist?.artistName || selectedArtist?.name || 'this artist'}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowManualInput(false)
                  setSubmitError('')
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Screenshot Upload Section */}
              <div className="bg-gradient-to-br from-pink-900/20 to-purple-900/20 rounded-lg p-4 border border-pink-500/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Instagram className="w-5 h-5 text-pink-400" />
                    <h3 className="text-sm font-semibold text-white">Upload Instagram Analytics Screenshot</h3>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  Upload one or more screenshots of your Instagram analytics and we'll automatically extract the metrics for you.
                </p>
                <div className="flex items-center space-x-3">
                  <label className="flex-1">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      onChange={handleScreenshotUpload}
                      disabled={isUploadingScreenshot}
                      multiple
                      className="hidden"
                      id="instagram-screenshot-upload"
                    />
                    <div className={`w-full px-4 py-3 bg-slate-800 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                      isUploadingScreenshot 
                        ? 'border-slate-600 cursor-not-allowed opacity-50' 
                        : 'border-pink-500/50 hover:border-pink-500'
                    }`}>
                      <div className="flex items-center justify-center space-x-2">
                        {isUploadingScreenshot ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-pink-400"></div>
                            <span className="text-sm text-slate-300">Processing screenshots...</span>
                          </>
                        ) : (
                          <>
                            <Instagram className="w-5 h-5 text-pink-400" />
                            <span className="text-sm text-slate-300">Click to upload screenshot(s) (PNG/JPG) - Multiple files supported</span>
                          </>
                        )}
                      </div>
                    </div>
                  </label>
                </div>
                
                {/* Upload Progress */}
                {Object.keys(uploadProgress).length > 0 && (
                  <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
                    {Object.entries(uploadProgress).map(([key, progress]) => (
                      <div 
                        key={key} 
                        className={`rounded-lg p-2 border ${
                          progress.status === 'success' 
                            ? 'bg-green-500/20 border-green-500/50' 
                            : progress.status === 'error'
                            ? 'bg-red-500/20 border-red-500/50'
                            : 'bg-blue-500/20 border-blue-500/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-300 truncate flex-1 mr-2">{progress.fileName}</span>
                          {progress.status === 'uploading' && (
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-400"></div>
                          )}
                          {progress.status === 'success' && (
                            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                          )}
                          {progress.status === 'error' && (
                            <X className="w-4 h-4 text-red-400 flex-shrink-0" />
                          )}
                        </div>
                        {progress.error && (
                          <p className="text-xs text-red-400 mt-1">{progress.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {screenshotError && (
                  <div className="mt-3 bg-red-500/20 border border-red-500/50 rounded-lg p-2">
                    <p className="text-xs text-red-400">{screenshotError}</p>
                  </div>
                )}
                {screenshotSuccess && (
                  <div className="mt-3 bg-green-500/20 border border-green-500/50 rounded-lg p-2">
                    <p className="text-xs text-green-400">✓ Screenshot(s) processed successfully! Metrics extracted and added.</p>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2 my-4">
                <div className="flex-1 border-t border-slate-700"></div>
                <span className="text-xs text-slate-500">OR</span>
                <div className="flex-1 border-t border-slate-700"></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Metric Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={manualForm.metricDate}
                    onChange={(e) => setManualForm({ ...manualForm, metricDate: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Followers <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    value={manualForm.followers}
                    onChange={(e) => setManualForm({ ...manualForm, followers: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Views <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    value={manualForm.views}
                    onChange={(e) => setManualForm({ ...manualForm, views: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Likes
                  </label>
                  <input
                    type="number"
                    value={manualForm.likes}
                    onChange={(e) => setManualForm({ ...manualForm, likes: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Comments <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    value={manualForm.comments}
                    onChange={(e) => setManualForm({ ...manualForm, comments: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Saves <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    value={manualForm.saves}
                    onChange={(e) => setManualForm({ ...manualForm, saves: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Shares <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    value={manualForm.shares}
                    onChange={(e) => setManualForm({ ...manualForm, shares: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Interactions
                  </label>
                  <input
                    type="number"
                    value={manualForm.interactions}
                    onChange={(e) => setManualForm({ ...manualForm, interactions: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Completion Rate (%) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={manualForm.completionRate}
                    onChange={(e) => setManualForm({ ...manualForm, completionRate: e.target.value })}
                    placeholder="0.0"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Retention (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={manualForm.retention}
                    onChange={(e) => setManualForm({ ...manualForm, retention: e.target.value })}
                    placeholder="0.0"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Skip Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={manualForm.skipRate}
                    onChange={(e) => setManualForm({ ...manualForm, skipRate: e.target.value })}
                    placeholder="0.0"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Watch Time (seconds)
                  </label>
                  <input
                    type="number"
                    value={manualForm.watchTime}
                    onChange={(e) => setManualForm({ ...manualForm, watchTime: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Audience
                  </label>
                  <input
                    type="number"
                    value={manualForm.audience}
                    onChange={(e) => setManualForm({ ...manualForm, audience: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-700">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">Video Information</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Video Title / Description
                    </label>
                    <input
                      type="text"
                      value={manualForm.videoTitle}
                      onChange={(e) => setManualForm({ ...manualForm, videoTitle: e.target.value })}
                      placeholder="e.g., New song snippet, Behind the scenes..."
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Video Link
                    </label>
                    <input
                      type="url"
                      value={manualForm.videoLink}
                      onChange={(e) => setManualForm({ ...manualForm, videoLink: e.target.value })}
                      placeholder="https://instagram.com/p/..."
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-700">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">Facebook vs Instagram</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Facebook Views
                    </label>
                    <input
                      type="number"
                      value={manualForm.facebookViews}
                      onChange={(e) => setManualForm({ ...manualForm, facebookViews: e.target.value })}
                      placeholder="0"
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Instagram Views
                    </label>
                    <input
                      type="number"
                      value={manualForm.instagramViews}
                      onChange={(e) => setManualForm({ ...manualForm, instagramViews: e.target.value })}
                      placeholder="0"
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Show added entries */}
              {instagramEntries.length > 0 && (
                <div className="pt-4 border-t border-slate-700">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">
                    Added Entries ({instagramEntries.length})
                  </h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {instagramEntries.map((entry, index) => (
                      <div key={index} className="bg-slate-800/50 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm text-white">
                            {entry.videoTitle || `Entry ${index + 1}`} - {entry.metricDate}
                          </p>
                          <p className="text-xs text-slate-400">
                            {entry.views} views, {entry.followers} followers
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setInstagramEntries(instagramEntries.filter((_, i) => i !== index))
                          }}
                          className="text-red-400 hover:text-red-300 transition-colors ml-2"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {submitError && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3">
                  <p className="text-sm text-red-400">{submitError}</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                <button
                  onClick={handleAddInstagramEntry}
                  disabled={!manualForm.metricDate || !manualForm.followers || !manualForm.views || isSubmitting}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Another Entry</span>
                </button>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => {
                      setShowManualInput(false)
                      setSubmitError('')
                      setInstagramEntries([])
                      setManualForm(resetInstagramForm())
                    }}
                    className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitManualMetrics}
                    disabled={(instagramEntries.length === 0 && (!manualForm.metricDate || !manualForm.followers || !manualForm.views)) || isSubmitting}
                    className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Saving {instagramEntries.length + (manualForm.metricDate && manualForm.followers && manualForm.views ? 1 : 0)} entries...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Save {instagramEntries.length + (manualForm.metricDate && manualForm.followers && manualForm.views ? 1 : 0)} {instagramEntries.length + (manualForm.metricDate && manualForm.followers && manualForm.views ? 1 : 0) === 1 ? 'Entry' : 'Entries'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual TikTok Analytics Input Modal (Staff/Admin Only) */}
      {showTikTokInput && canAddManualMetrics && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 to-black border border-slate-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <Video className="w-6 h-6 text-cyan-400" />
                <div>
                  <h2 className="text-2xl font-semibold text-white">Add TikTok Analytics</h2>
                  <p className="text-sm text-slate-400 mt-1">Manually enter TikTok metrics for {selectedArtist?.artistName || selectedArtist?.name || 'this artist'}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowTikTokInput(false)
                  setSubmitError('')
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Metric Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={tikTokForm.metricDate}
                    onChange={(e) => setTikTokForm({ ...tikTokForm, metricDate: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Followers <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    value={tikTokForm.followers}
                    onChange={(e) => setTikTokForm({ ...tikTokForm, followers: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Views <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    value={tikTokForm.views}
                    onChange={(e) => setTikTokForm({ ...tikTokForm, views: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Likes
                  </label>
                  <input
                    type="number"
                    value={tikTokForm.likes}
                    onChange={(e) => setTikTokForm({ ...tikTokForm, likes: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Comments
                  </label>
                  <input
                    type="number"
                    value={tikTokForm.comments}
                    onChange={(e) => setTikTokForm({ ...tikTokForm, comments: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Shares
                  </label>
                  <input
                    type="number"
                    value={tikTokForm.shares}
                    onChange={(e) => setTikTokForm({ ...tikTokForm, shares: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Engagement Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={tikTokForm.engagementRate}
                    onChange={(e) => setTikTokForm({ ...tikTokForm, engagementRate: e.target.value })}
                    placeholder="0.0"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Watch Time (seconds)
                  </label>
                  <input
                    type="number"
                    value={tikTokForm.watchTime}
                    onChange={(e) => setTikTokForm({ ...tikTokForm, watchTime: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Retention (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={tikTokForm.retention}
                    onChange={(e) => setTikTokForm({ ...tikTokForm, retention: e.target.value })}
                    placeholder="0.0"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-700">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">Video Information</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Video Title / Description
                    </label>
                    <input
                      type="text"
                      value={tikTokForm.videoTitle}
                      onChange={(e) => setTikTokForm({ ...tikTokForm, videoTitle: e.target.value })}
                      placeholder="e.g., New song snippet, Behind the scenes..."
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Video Link
                    </label>
                    <input
                      type="url"
                      value={tikTokForm.videoLink}
                      onChange={(e) => setTikTokForm({ ...tikTokForm, videoLink: e.target.value })}
                      placeholder="https://tiktok.com/@username/video/..."
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Show added entries */}
              {tikTokEntries.length > 0 && (
                <div className="pt-4 border-t border-slate-700">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">
                    Added Entries ({tikTokEntries.length})
                  </h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {tikTokEntries.map((entry, index) => (
                      <div key={index} className="bg-slate-800/50 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm text-white">
                            {entry.videoTitle || `Entry ${index + 1}`} - {entry.metricDate}
                          </p>
                          <p className="text-xs text-slate-400">
                            {entry.views} views, {entry.followers} followers
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setTikTokEntries(tikTokEntries.filter((_, i) => i !== index))
                          }}
                          className="text-red-400 hover:text-red-300 transition-colors ml-2"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {submitError && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3">
                  <p className="text-sm text-red-400">{submitError}</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                <button
                  onClick={handleAddTikTokEntry}
                  disabled={!tikTokForm.metricDate || !tikTokForm.followers || !tikTokForm.views || isSubmitting}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Another Entry</span>
                </button>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => {
                      setShowTikTokInput(false)
                      setSubmitError('')
                      setTikTokEntries([])
                      setTikTokForm(resetTikTokForm())
                    }}
                    className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitTikTokMetrics}
                    disabled={(tikTokEntries.length === 0 && (!tikTokForm.metricDate || !tikTokForm.followers || !tikTokForm.views)) || isSubmitting}
                    className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Saving {tikTokEntries.length + (tikTokForm.metricDate && tikTokForm.followers && tikTokForm.views ? 1 : 0)} entries...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Save {tikTokEntries.length + (tikTokForm.metricDate && tikTokForm.followers && tikTokForm.views ? 1 : 0)} {tikTokEntries.length + (tikTokForm.metricDate && tikTokForm.followers && tikTokForm.views ? 1 : 0) === 1 ? 'Entry' : 'Entries'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TikTok Song Views Input Modal (Staff/Admin Only) */}
      {showTikTokSongViews && canAddManualMetrics && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 to-black border border-slate-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <Video className="w-6 h-6 text-cyan-400" />
                <div>
                  <h2 className="text-2xl font-semibold text-white">Link TikTok Views to Song</h2>
                  <p className="text-sm text-slate-400 mt-1">Track TikTok views for specific songs (for payment tracking)</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowTikTokSongViews(false)
                  setSubmitError('')
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Select Song <span className="text-red-400">*</span>
                </label>
                <select
                  value={tikTokSongForm.songId}
                  onChange={(e) => {
                    const selected = catalog.find(s => s.id === e.target.value)
                    setTikTokSongForm({
                      ...tikTokSongForm,
                      songId: e.target.value,
                      songName: selected?.song || '',
                      artistName: selected?.artist || '',
                    })
                  }}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a song...</option>
                  {catalog.map((song) => (
                    <option key={song.id} value={song.id}>
                      {song.song} by {song.artist}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Song Name
                  </label>
                  <input
                    type="text"
                    value={tikTokSongForm.songName}
                    readOnly
                    className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-400 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Artist Name
                  </label>
                  <input
                    type="text"
                    value={tikTokSongForm.artistName}
                    readOnly
                    className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-400 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Views <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    value={tikTokSongForm.views}
                    onChange={(e) => setTikTokSongForm({ ...tikTokSongForm, views: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Metric Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={tikTokSongForm.metricDate}
                    onChange={(e) => setTikTokSongForm({ ...tikTokSongForm, metricDate: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    TikTok Video URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={tikTokSongForm.videoUrl}
                    onChange={(e) => setTikTokSongForm({ ...tikTokSongForm, videoUrl: e.target.value })}
                    placeholder="https://www.tiktok.com/@username/video/..."
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {submitError && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3">
                  <p className="text-sm text-red-400">{submitError}</p>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-700">
                <button
                  onClick={() => {
                    setShowTikTokSongViews(false)
                    setSubmitError('')
                  }}
                  className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitTikTokSongViews}
                  disabled={!tikTokSongForm.songId || !tikTokSongForm.views || !tikTokSongForm.metricDate || isSubmitting}
                  className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Link Views</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Staff Override Modal */}
      {/* Staff Override Modal - Admin Only */}
      {showOverrideModal && isAdmin && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 to-black border border-slate-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <Shield className="w-6 h-6 text-purple-400" />
                <div>
                  <h2 className="text-2xl font-semibold text-white">Override Readiness State</h2>
                  <p className="text-sm text-slate-400 mt-1">Manually override the calculated readiness state (will be tracked for learning)</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowOverrideModal(false)
                  setSubmitError('')
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <p className="text-sm text-slate-400 mb-2">Current State:</p>
                <p className="text-lg font-semibold text-white capitalize">{readiness?.state || 'building'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Override To <span className="text-red-400">*</span>
                </label>
                <select
                  value={overrideForm.overriddenState}
                  onChange={(e) => setOverrideForm({ ...overrideForm, overriddenState: e.target.value as any })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="cooling">Cooling</option>
                  <option value="building">Building</option>
                  <option value="ready">Ready</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Reason for Override <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={overrideForm.reason}
                  onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                  placeholder="Explain why you're overriding the calculated state (e.g., 'Special event coming up', 'TikTok momentum', 'Strategic timing')"
                  rows={4}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  This override will be tracked and compared to outcomes to improve the system.
                </p>
              </div>

              {submitError && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3">
                  <p className="text-sm text-red-400">{submitError}</p>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-700">
                <button
                  onClick={() => {
                    setShowOverrideModal(false)
                    setSubmitError('')
                  }}
                  className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStaffOverride}
                  disabled={!overrideForm.reason || isSubmitting}
                  className="px-6 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Overriding...</span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4" />
                      <span>Override State</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Goal Creation Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 to-black border border-slate-800 rounded-xl p-6 max-w-2xl w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-white flex items-center">
                <Target className="w-6 h-6 mr-2 text-green-400" />
                Create New Goal
              </h2>
              <button
                onClick={() => {
                  setShowGoalModal(false)
                  setNewGoal({ type: 'followers', target: '', deadline: '', description: '' })
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Goal Type</label>
                <select
                  value={newGoal.type}
                  onChange={(e) => setNewGoal({ ...newGoal, type: e.target.value as any })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                >
                  <option value="followers">Followers</option>
                  <option value="engagement_rate">Engagement Rate</option>
                  <option value="views">Views</option>
                  <option value="streams">Streams</option>
                  <option value="revenue">Revenue</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Target Value</label>
                <input
                  type="number"
                  value={newGoal.target}
                  onChange={(e) => setNewGoal({ ...newGoal, target: e.target.value })}
                  placeholder="Enter target number"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Deadline</label>
                <input
                  type="date"
                  value={newGoal.deadline}
                  onChange={(e) => setNewGoal({ ...newGoal, deadline: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description (Optional)</label>
                <textarea
                  value={newGoal.description}
                  onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                  placeholder="Add notes about this goal..."
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-700">
                <button
                  onClick={() => {
                    setShowGoalModal(false)
                    setNewGoal({ type: 'followers', target: '', deadline: '', description: '' })
                  }}
                  className="px-4 py-2 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!selectedArtistId || !newGoal.target) return
                    try {
                      const metricKey = newGoal.type === 'followers' ? 'followers' : newGoal.type === 'views' ? 'views' : null
                      const current = (metricKey && latestInstagram?.[metricKey as keyof typeof latestInstagram]) || 0
                      const res = await fetch('/api/growth-analytics', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          action: 'add_goal',
                          artistId: selectedArtistId,
                          data: {
                            type: newGoal.type,
                            target: parseFloat(newGoal.target),
                            current,
                            deadline: newGoal.deadline,
                            description: newGoal.description,
                          },
                        }),
                      })
                      if (res.ok) {
                        fetchGrowthData()
                        setShowGoalModal(false)
                        setNewGoal({ type: 'followers', target: '', deadline: '', description: '' })
                      }
                    } catch (error) {
                      console.error('Failed to create goal:', error)
                    }
                  }}
                  className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg"
                >
                  Create Goal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content Calendar Modal */}
      {showCalendarModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 to-black border border-slate-800 rounded-xl p-6 max-w-2xl w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-white flex items-center">
                <Calendar className="w-6 h-6 mr-2 text-blue-400" />
                Schedule Content
              </h2>
              <button
                onClick={() => {
                  setShowCalendarModal(false)
                  setSelectedDate(new Date().toISOString().split('T')[0])
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Platform</label>
                <select className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white">
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Content Type</label>
                <select className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white">
                  <option value="reel">Reel</option>
                  <option value="post">Post</option>
                  <option value="story">Story</option>
                  <option value="carousel">Carousel</option>
                  <option value="video">Video</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Title</label>
                <input
                  type="text"
                  placeholder="Content title..."
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setShowCalendarModal(false)}
                  className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
                >
                  Cancel
                </button>
                <button className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg">
                  Schedule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
          </div>
        </div>
      </div>
    </>
  )
}