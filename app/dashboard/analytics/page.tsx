'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, BarChart3, DollarSign, Users, Music, Calendar, Target, Zap, Play, Award, Star, Activity, Clock } from 'lucide-react'
import Chart from '@/components/Chart'
import { useAuth } from '@/contexts/AuthContext'

interface ArtistAnalytics {
  name: string
  totalStreams: number
  totalRevenue: number
  songCount: number
  avgStreamsPerSong: number
  topSong: { name: string; streams: number }
  topPlatform: string
  platformBreakdown: Array<{ platform: string; streams: number; percentage: number }>
  songs: Array<{ name: string; streams: number; platforms: string[]; upc?: string; isrc?: string }>
  growthRate: number
  lastUpload?: string
  artistId?: string
}

interface AnalyticsData {
  totalStreams: number
  totalRevenue: number
  avgStreamsPerSong: number
  growthRate: number
  topPlatform: string
  artistCount: number
  songCount: number
  predictions: {
    nextMonthStreams: number
    nextMonthRevenue: number
    growthProjection: number
  }
  platformBreakdown: Array<{ platform: string; streams: number; percentage: number }>
  trendAnalysis: Array<{ period: string; streams: number; trend: 'up' | 'down' | 'stable' }>
  artists: ArtistAnalytics[]
  topSongs: Array<{ name: string; artist: string; streams: number }>
  topArtists: Array<{ name: string; streams: number; revenue: number }>
}

export default function AnalyticsPage() {
  const { user } = useAuth()
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null)

  useEffect(() => {
    fetchAnalytics()
    
    // Listen for catalog updates to refresh analytics
    const channel = new BroadcastChannel('catalog-updates')
    channel.addEventListener('message', (event) => {
      if (event.data.type === 'catalog-updated') {
        // Refresh analytics when catalog is updated
        fetchAnalytics()
      }
    })
    
    return () => {
      channel.close()
    }
  }, [])

  const fetchAnalytics = async () => {
    try {
      const [catalogRes, usersRes, uploadsRes] = await Promise.all([
        fetch('/api/catalog').catch(() => ({ ok: false, json: async () => ({ success: false, catalog: [] }) })),
        fetch('/api/users').catch(() => ({ ok: false, json: async () => ({ success: false, users: [] }) })),
        fetch('/api/get-uploads').catch(() => ({ ok: false, json: async () => ({ success: false, uploads: [] }) })),
      ])

      const catalogData = await catalogRes.json()
      const usersData = await usersRes.json()
      const uploadsData = await uploadsRes.json()
      
      // Handle cases where APIs return errors
      if (!catalogData.success) catalogData.catalog = []
      if (!usersData.success) usersData.users = []
      if (!uploadsData.success) uploadsData.uploads = []

      // Use catalog as single source of truth for stream counts
      const allSongs: any[] = []
      const platformStreams: Record<string, number> = {}
      const artistStats: Record<string, ArtistAnalytics> = {} // Key: userId (not normalized name!)
      const processedSongs: Set<string> = new Set() // Track processed songs globally (catalog item level)
      
      // Helper function to normalize names for comparison
      const normalize = (str: string): string => {
        return (str || '').toLowerCase().trim().replace(/\s+/g, ' ')
      }
      
      // Helper function to create unique song key (for global deduplication)
      const getSongKey = (songName: string, catalogItemId: string): string => {
        return `${normalize(songName)}|${catalogItemId}`
      }

      // Build maps: userId -> display name and metadata
      const userIdToDisplayName: Record<string, string> = {}
      const userIdToMetadata: Record<string, any> = {}
      
      // Map user IDs to display names from user accounts
      if (usersData.success && usersData.users) {
        usersData.users.forEach((user: any) => {
          if (user.id) {
            // Use artistName if available, otherwise use name
            const displayName = user.artistName || user.name || 'Unknown'
            userIdToDisplayName[user.id] = displayName
            userIdToMetadata[user.id] = {
              artistId: user.id,
              userName: user.name,
              artistName: user.artistName,
            }
          }
        })
      }
      
      // Track songs per artist (by userId) to prevent duplicates
      // Key: userId, Value: Set of song keys (songName|catalogItemId)
      const artistSongKeys: Record<string, Set<string>> = {}
      
      // Get users array for filtering
      const users = usersData.success && usersData.users ? usersData.users : []
      
      // Helper function to add song to artists based on catalog artistIds
      const addSongToArtists = (
        songName: string,
        artistString: string,
        streams: number,
        distributor: string,
        artistIds: string[],
        catalogItemId: string,
        releaseDate?: string
      ) => {
        // Create unique song key for global deduplication (use catalog item ID to ensure uniqueness)
        const songKey = getSongKey(songName, catalogItemId)
        
        // Add to allSongs only once per catalog item (not per artist)
        if (!processedSongs.has(songKey)) {
          allSongs.push({
            name: songName,
            artist: artistString, // Keep full collaborative name for display
            streams: streams,
            platforms: distributor !== 'Unknown' ? [distributor] : [],
            date: releaseDate,
          })
          processedSongs.add(songKey)
          
          // Add to platform streams (only once per song)
          if (distributor !== 'Unknown') {
            platformStreams[distributor] = (platformStreams[distributor] || 0) + streams
          }
        }
        
        // Determine which artists this song belongs to - ONLY use artistIds from catalog
        if (!artistIds || artistIds.length === 0) {
          // If no artistIds, skip this song for individual artist stats
          // This prevents songs from being incorrectly assigned
          return
        }
        
        // Filter to only artist accounts (exclude managers, etc.)
        const validArtistIds = artistIds.filter(userId => {
          const user = users.find((u: any) => u.id === userId)
          return user && user.role === 'artist'
        })
        
        // Add song to each artist's stats (using userId as key)
        validArtistIds.forEach((userId) => {
          const displayName = userIdToDisplayName[userId]
          if (!displayName || displayName === 'Unknown') return
          
          // Initialize artist stats if not exists (use userId as key, not name!)
          if (!artistStats[userId]) {
            artistStats[userId] = {
              name: displayName, // Use display name from user account
              totalStreams: 0,
              totalRevenue: 0,
              songCount: 0,
              avgStreamsPerSong: 0,
              topSong: { name: '', streams: 0 },
              topPlatform: '',
              platformBreakdown: [],
              songs: [],
              growthRate: 0,
              artistId: userId,
              ...userIdToMetadata[userId],
            }
          }
          
          // Track songs per artist to prevent duplicates (use userId as key)
          if (!artistSongKeys[userId]) {
            artistSongKeys[userId] = new Set()
          }
          
          // Create unique key for this song for this artist (song name + catalog item ID)
          // This ensures the same song from the same catalog item is only counted once per artist
          const artistSongKey = `${normalize(songName)}|${catalogItemId}`
          
          // Check if this song is already added to this artist
          if (!artistSongKeys[userId].has(artistSongKey)) {
            // Mark as added
            artistSongKeys[userId].add(artistSongKey)
            
            // Add song to this artist's stats
            artistStats[userId].totalStreams += streams
            artistStats[userId].songCount += 1
            artistStats[userId].songs.push({
              name: songName,
              streams: streams,
              platforms: distributor !== 'Unknown' ? [distributor] : [],
            })
            
            // Update top song
            if (streams > artistStats[userId].topSong.streams) {
              artistStats[userId].topSong = { name: songName, streams }
            }
          }
        })
      }

      // Process catalog items - match catalog's exact calculation logic
      if (catalogData.success && catalogData.catalog) {
        catalogData.catalog.forEach((item: any) => {
          // Skip pending releases
          if (item.releaseApprovalStatus === 'pending') return
          
          const artistString = item.artist || 'Unknown'
          const distributor = item.distributor || 'Unknown'
          const catalogItemId = item.id || ''
          
          // Get artistIds from catalog - these tell us which artists actually own this song
          // CRITICAL: Only use artistIds if they exist and are valid
          const artistIds = item.artistIds && Array.isArray(item.artistIds) && item.artistIds.length > 0
            ? item.artistIds
            : (item.artistId ? [item.artistId] : [])
          
          // Match catalog logic exactly: For albums/EPs, use sum of song streams if available, otherwise item.totalStreams
          // For singles, use item.totalStreams
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
                
                // Use helper function to add song to artists based on catalog artistIds
                // Pass catalogItemId to ensure proper deduplication
                addSongToArtists(songName, artistString, songStreams, distributor, artistIds, catalogItemId, item.releaseDate)
              })
            } else {
              // No individual song streams, use item.totalStreams (fallback) - match catalog page logic
              // For albums, use item.song if available, otherwise use item name or a placeholder
              const streams = item.totalStreams || 0
              if (streams > 0) {
                const songName = item.song || item.name || `Album: ${artistString}`
                addSongToArtists(songName, artistString, streams, distributor, artistIds, catalogItemId, item.releaseDate)
              }
            }
          } else {
            // For singles or albums without songs array: use item.totalStreams
            const streams = item.totalStreams || 0
            if (streams > 0) {
              // Use item.song for singles, or item.name for albums without songs array
              const songName = item.song || item.name || 'Unknown Song'
              addSongToArtists(songName, artistString, streams, distributor, artistIds, catalogItemId, item.releaseDate)
            }
          }
        })
      }

      // Calculate artist-level metrics
      Object.values(artistStats).forEach((artist) => {
        artist.totalRevenue = artist.totalStreams * 0.003
        artist.avgStreamsPerSong = artist.songCount > 0 ? artist.totalStreams / artist.songCount : 0
        
        // Calculate platform breakdown per artist
        const artistPlatforms: Record<string, number> = {}
        artist.songs.forEach((song) => {
          // Use first platform as primary, or if no platforms, skip
          if (song.platforms && song.platforms.length > 0) {
            const primaryPlatform = song.platforms[0]
            artistPlatforms[primaryPlatform] = (artistPlatforms[primaryPlatform] || 0) + song.streams
          }
        })
        
        const totalArtistPlatformStreams = Object.values(artistPlatforms).reduce((a, b) => a + b, 0)
        artist.platformBreakdown = Object.entries(artistPlatforms)
          .map(([platform, streams]) => ({
            platform,
            streams,
            percentage: totalArtistPlatformStreams > 0 ? (streams / totalArtistPlatformStreams) * 100 : 0,
          }))
          .sort((a, b) => b.streams - a.streams)
        
        artist.topPlatform = artist.platformBreakdown[0]?.platform || 'N/A'
      })

      const totalStreams = allSongs.reduce((sum, song) => sum + song.streams, 0)
      const totalRevenue = totalStreams * 0.003
      const songCount = allSongs.length
      const artistCount = Object.keys(artistStats).length

      // Calculate growth rate based on catalog data (single source of truth)
      // Compare current total streams with streams from songs released in previous periods
      let growthRate = 0
      
      // Group songs by release date periods to calculate growth
      const now = new Date()
      const currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1) // Start of current month
      const previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1) // Start of previous month
      const twoPeriodsAgoStart = new Date(now.getFullYear(), now.getMonth() - 2, 1) // Start of 2 months ago
      
      let currentPeriodStreams = 0
      let previousPeriodStreams = 0
      
      // Calculate streams for current period (songs released this month)
      allSongs.forEach((song: any) => {
        if (song.date) {
          const releaseDate = new Date(song.date)
          if (releaseDate >= currentPeriodStart) {
            currentPeriodStreams += song.streams
          } else if (releaseDate >= previousPeriodStart && releaseDate < currentPeriodStart) {
            previousPeriodStreams += song.streams
          }
        }
      })
      
      // If we don't have enough period data, compare recent vs older songs
      if (previousPeriodStreams === 0 && currentPeriodStreams === 0) {
        // Fallback: compare songs released in last 30 days vs previous 30 days
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
        
        allSongs.forEach((song: any) => {
          if (song.date) {
            const releaseDate = new Date(song.date)
            if (releaseDate >= thirtyDaysAgo) {
              currentPeriodStreams += song.streams
            } else if (releaseDate >= sixtyDaysAgo && releaseDate < thirtyDaysAgo) {
              previousPeriodStreams += song.streams
            }
          }
        })
      }
      
      // Calculate growth rate
      if (previousPeriodStreams > 0) {
        growthRate = ((currentPeriodStreams - previousPeriodStreams) / previousPeriodStreams) * 100
      } else if (currentPeriodStreams > 0) {
        // If previous was 0 but current has streams, show 100% growth
        growthRate = 100
      } else {
        // If no period-based data, use overall catalog growth trend
        // Compare total streams now vs estimate from upload dates
        const uploads = uploadsData.success ? uploadsData.uploads : []
        if (uploads.length >= 2) {
          const sortedUploads = uploads
            .sort((a: any, b: any) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
          
          // Use catalog totalStreams as current value
          // Estimate previous from catalog items that existed before recent uploads
          const recentUploadDate = new Date(sortedUploads[0]?.uploadedAt || now)
          const previousUploadDate = new Date(sortedUploads[1]?.uploadedAt || now)
          
          // Calculate streams from songs that existed before recent upload
          let previousCatalogStreams = 0
          catalogData.catalog?.forEach((item: any) => {
            // Only count items that existed before the most recent upload
            // This is an approximation - ideally we'd track stream history
            if (item.releaseDate && new Date(item.releaseDate) < recentUploadDate) {
              if (item.releaseType === 'album' || item.releaseType === 'ep') {
                const songsTotal = item.songs?.reduce((sum: number, song: any) => sum + (song.streams || 0), 0) || 0
                previousCatalogStreams += songsTotal > 0 ? songsTotal : (item.totalStreams || 0)
              } else {
                previousCatalogStreams += item.totalStreams || 0
              }
            }
          })
          
          if (previousCatalogStreams > 0) {
            growthRate = ((totalStreams - previousCatalogStreams) / previousCatalogStreams) * 100
          }
        }
      }

      // Platform breakdown
      const totalPlatformStreams = Object.values(platformStreams).reduce((a: number, b: number) => a + b, 0)
      const platformBreakdown = Object.entries(platformStreams)
        .map(([platform, streams]) => ({
          platform,
          streams: streams as number,
          percentage: totalPlatformStreams > 0 ? ((streams as number) / totalPlatformStreams) * 100 : 0,
        }))
        .sort((a, b) => b.streams - a.streams)

      const topPlatform = platformBreakdown[0]?.platform || 'N/A'

      // Predictions - use growth rate to project next month
      const growthMultiplier = growthRate !== 0 ? (1 + growthRate / 100) : 1
      const nextMonthStreams = totalStreams * growthMultiplier
      const nextMonthRevenue = nextMonthStreams * 0.003

      // Trend analysis - use catalog data grouped by release date periods
      // Group catalog items by release date periods (monthly)
      const trendPeriods: Array<{ period: string; streams: number; date: Date }> = []
      
      // Create 6 monthly periods going back
      for (let i = 0; i < 6; i++) {
        const periodStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const periodEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59)
        const periodStreams = allSongs
          .filter((song: any) => {
            if (!song.date) return false
            const releaseDate = new Date(song.date)
            return releaseDate >= periodStart && releaseDate <= periodEnd
          })
          .reduce((sum: number, song: any) => sum + song.streams, 0)
        
        trendPeriods.push({
          period: periodStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          streams: periodStreams,
          date: periodStart,
        })
      }
      
      // Reverse to show oldest to newest
      trendPeriods.reverse()
      
      // Calculate trends
      const trendAnalysis = trendPeriods.map((period, idx) => {
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
        }
      })
      
      // If we don't have enough catalog-based trend data, fall back to upload-based trends
      const totalTrendStreams = trendAnalysis.reduce((sum, t) => sum + t.streams, 0)
      
      if (totalTrendStreams === 0) {
        // Fallback to upload-based trends (historical snapshots) if no catalog trend data
        const uploads = uploadsData.success ? uploadsData.uploads : []
        const sortedUploadsForTrends = uploads
          .sort((a: any, b: any) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
        
        if (sortedUploadsForTrends.length > 0) {
          const uploadTrends = sortedUploadsForTrends.slice(0, 6).map((upload: any, idx: number) => {
            let uploadStreams = 0
            if (upload.groupedByArtist) {
              Object.values(upload.groupedByArtist).forEach((rows: any) => {
                rows.forEach((row: any) => {
                  let rowStreams = 0
                  Object.keys(row).forEach((key) => {
                    if (key === 'Total' || key.startsWith('Total_')) {
                      const value = row[key]
                      if (value && value !== '') {
                        const num = parseInt(String(value).replace(/,/g, '')) || 0
                        if (!isNaN(num) && num > 0) {
                          rowStreams += num
                        }
                      }
                    }
                  })
                  if (rowStreams === 0) {
                    rowStreams = parseInt(String(row.streams || row.Streams || row.Total || 0).replace(/,/g, '')) || 0
                  }
                  uploadStreams += rowStreams
                })
              })
            }
            
            let trend: 'up' | 'down' | 'stable' = 'stable'
            if (idx > 0) {
              const prevUpload = sortedUploadsForTrends[idx - 1]
              let prevStreams = 0
              if (prevUpload.groupedByArtist) {
                Object.values(prevUpload.groupedByArtist).forEach((rows: any) => {
                  rows.forEach((row: any) => {
                    let rowStreams = 0
                    Object.keys(row).forEach((key) => {
                      if (key === 'Total' || key.startsWith('Total_')) {
                        const value = row[key]
                        if (value && value !== '') {
                          const num = parseInt(String(value).replace(/,/g, '')) || 0
                          if (!isNaN(num) && num > 0) {
                            rowStreams += num
                          }
                        }
                      }
                    })
                    if (rowStreams === 0) {
                      rowStreams = parseInt(String(row.streams || row.Streams || row.Total || 0).replace(/,/g, '')) || 0
                    }
                    prevStreams += rowStreams
                  })
                })
              }
              
              if (uploadStreams > prevStreams * 1.05) {
                trend = 'up'
              } else if (uploadStreams < prevStreams * 0.95) {
                trend = 'down'
              } else {
                trend = 'stable'
              }
            }
            
            return {
              period: new Date(upload.uploadedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
              streams: uploadStreams,
              trend,
            }
          })
          
          // Use upload trends if catalog trends are empty
          if (uploadTrends.length > 0) {
            trendAnalysis.splice(0, trendAnalysis.length, ...uploadTrends)
          }
        }
      }

      // Top songs - deduplicate by normalized song name + artist, keeping highest stream count
      const topSongsMap = new Map<string, { name: string; artist: string; streams: number }>()
      
      allSongs.forEach((song: any) => {
        const normalizedSong = normalize(song.name)
        const normalizedArtist = normalize(song.artist)
        const dedupeKey = `${normalizedSong}|${normalizedArtist}`
        
        const existing = topSongsMap.get(dedupeKey)
        // Add if new, or update if this version has more streams
        if (!existing || song.streams > existing.streams) {
          topSongsMap.set(dedupeKey, {
            name: song.name,
            artist: song.artist,
            streams: song.streams,
          })
        }
      })
      
      const topSongs = Array.from(topSongsMap.values())
        .sort((a, b) => b.streams - a.streams)
        .slice(0, 20)

      // Top artists
      const topArtists = Object.values(artistStats)
        .map(artist => ({
          name: artist.name,
          streams: artist.totalStreams,
          revenue: artist.totalRevenue,
        }))
        .sort((a, b) => b.streams - a.streams)
        .slice(0, 10)

      // Artists array sorted by streams
      const artists = Object.values(artistStats)
        .map(artist => ({
          ...artist,
          name: artist.name || 'Unknown',
        }))
        .sort((a, b) => b.totalStreams - a.totalStreams)

      // Only set analytics if we have some data
      if (totalStreams > 0 || artists.length > 0 || topSongs.length > 0) {
        setAnalytics({
          totalStreams,
          totalRevenue,
          avgStreamsPerSong: songCount > 0 ? totalStreams / songCount : 0,
          growthRate,
          topPlatform,
          artistCount,
          songCount,
          predictions: {
            nextMonthStreams,
            nextMonthRevenue,
            growthProjection: growthRate,
          },
          platformBreakdown,
          trendAnalysis,
          artists,
          topSongs,
          topArtists,
        })
      } else {
        // Set empty analytics if no data
        setAnalytics({
          totalStreams: 0,
          totalRevenue: 0,
          avgStreamsPerSong: 0,
          growthRate: 0,
          topPlatform: 'N/A',
          artistCount: 0,
          songCount: 0,
          predictions: {
            nextMonthStreams: 0,
            nextMonthRevenue: 0,
            growthProjection: 0,
          },
          platformBreakdown: [],
          trendAnalysis: [],
          artists: [],
          topSongs: [],
          topArtists: [],
        })
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
      // Set empty analytics on error instead of crashing
      setAnalytics({
        totalStreams: 0,
        totalRevenue: 0,
        avgStreamsPerSong: 0,
        growthRate: 0,
        topPlatform: 'N/A',
        artistCount: 0,
        songCount: 0,
        predictions: {
          nextMonthStreams: 0,
          nextMonthRevenue: 0,
          growthProjection: 0,
        },
        platformBreakdown: [],
        trendAnalysis: [],
        artists: [],
        topSongs: [],
        topArtists: [],
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-12 border border-slate-800 text-center">
        <BarChart3 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">No Data Available</h3>
        <p className="text-slate-400">Upload CSV data to see analytics</p>
      </div>
    )
  }

  const selectedArtistData = selectedArtist ? analytics.artists.find(a => a.name === selectedArtist) : null

  return (
    <div className="space-y-8 pb-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Complete Analytics Dashboard</h1>
        <p className="text-slate-400">Comprehensive insights for every artist, song, and metric</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500/20 rounded-lg">
              <Play className="w-6 h-6 text-green-400" />
            </div>
            {analytics.growthRate >= 0 ? (
              <TrendingUp className="w-5 h-5 text-green-400" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-400" />
            )}
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">
            {analytics.totalStreams.toLocaleString()}
          </h3>
          <p className="text-sm text-slate-400">Total Streams</p>
          <p className="text-xs text-slate-500 mt-1">
            {analytics.growthRate >= 0 ? '+' : ''}{analytics.growthRate.toFixed(1)}% growth
          </p>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-500/20 rounded-lg">
              <DollarSign className="w-6 h-6 text-red-500" />
            </div>
            <Zap className="w-5 h-5 text-yellow-400" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">
            ${analytics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          <p className="text-sm text-slate-400">Total Revenue</p>
          <p className="text-xs text-slate-500 mt-1">
            Est. ${analytics.predictions.nextMonthRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} next month
          </p>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-500/20 rounded-lg">
              <Music className="w-6 h-6 text-purple-400" />
            </div>
            <Target className="w-5 h-5 text-purple-400" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">
            {analytics.avgStreamsPerSong.toLocaleString()}
          </h3>
          <p className="text-sm text-slate-400">Avg Streams/Song</p>
          <p className="text-xs text-slate-500 mt-1">
            {analytics.songCount} total songs
          </p>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
            <BarChart3 className="w-5 h-5 text-blue-400" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">
            {analytics.artistCount}
          </h3>
          <p className="text-sm text-slate-400">Active Artists</p>
          <p className="text-xs text-slate-500 mt-1">
            Top platform: {analytics.topPlatform}
          </p>
        </div>
      </div>

      {/* Top Artists Ranking */}
      <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
          <Award className="w-5 h-5 mr-2 text-yellow-400" />
          Top Artists Ranking
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {analytics.topArtists.map((artist, idx) => (
            <div
              key={idx}
              className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 hover:border-red-500/50 transition cursor-pointer"
              onClick={() => setSelectedArtist(artist.name)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                    idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-600' : 'bg-slate-600'
                  }`}>
                    {idx + 1}
                  </div>
                  <span className="ml-3 font-semibold text-white">{artist.name}</span>
                </div>
                {idx < 3 && <Star className="w-4 h-4 text-yellow-400" />}
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Streams:</span>
                  <span className="text-white font-semibold">{artist.streams.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Revenue:</span>
                  <span className="text-green-400 font-semibold">${artist.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* All Artists Detailed Breakdown */}
      <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
          <Users className="w-5 h-5 mr-2 text-blue-400" />
          All Artists - Complete Breakdown
        </h2>
        <div className="space-y-4 max-h-[600px] overflow-y-auto">
          {analytics.artists.map((artist, idx) => (
            <div
              key={idx}
              className={`bg-slate-800/50 rounded-lg p-5 border ${
                selectedArtist === artist.name ? 'border-red-500' : 'border-slate-700'
              } hover:border-red-500/50 transition cursor-pointer`}
              onClick={() => setSelectedArtist(selectedArtist === artist.name ? null : artist.name)}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">{artist.name}</h3>
                  <p className="text-xs text-slate-400">#{idx + 1} Ranked Artist</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">{artist.totalStreams.toLocaleString()}</p>
                  <p className="text-xs text-slate-400">Total Streams</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Revenue</p>
                  <p className="text-lg font-semibold text-green-400">${artist.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Songs</p>
                  <p className="text-lg font-semibold text-white">{artist.songCount}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Avg/Song</p>
                  <p className="text-lg font-semibold text-white">{artist.avgStreamsPerSong.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Top Platform</p>
                  <p className="text-lg font-semibold text-white">{artist.topPlatform}</p>
                </div>
              </div>

              {selectedArtist === artist.name && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <h4 className="text-sm font-semibold text-white mb-3">Top Song: {artist.topSong.name} ({artist.topSong.streams.toLocaleString()} streams)</h4>
                  
                  <div className="mb-4">
                    <p className="text-xs text-slate-400 mb-2">Platform Distribution:</p>
                    <div className="space-y-2">
                      {artist.platformBreakdown.map((platform, pIdx) => (
                        <div key={pIdx} className="flex items-center justify-between">
                          <span className="text-sm text-slate-300">{platform.platform}</span>
                          <div className="flex items-center space-x-2">
                            <div className="w-32 bg-slate-700 rounded-full h-2">
                              <div
                                className="bg-red-500 h-2 rounded-full"
                                style={{ width: `${platform.percentage}%` }}
                              />
                            </div>
                            <span className="text-sm text-white font-semibold w-20 text-right">
                              {platform.streams.toLocaleString()} ({platform.percentage.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-slate-400 mb-2">All Songs ({artist.songs.length}):</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                      {artist.songs.sort((a, b) => b.streams - a.streams).map((song, sIdx) => (
                        <div key={sIdx} className="bg-slate-900/50 p-2 rounded text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-300">{song.name}</span>
                            <span className="text-white font-semibold">{song.streams.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Top Songs */}
      <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
          <Star className="w-5 h-5 mr-2 text-yellow-400" />
          Top Performing Songs
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto">
          {analytics.topSongs.map((song, idx) => (
            <div key={`${song.name}-${song.artist}-${idx}`} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <span className="text-lg font-bold text-red-500 mr-3">#{idx + 1}</span>
                  <div>
                    <p className="font-semibold text-white">{song.name}</p>
                    <p className="text-xs text-slate-400">{song.artist}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-white">{song.streams.toLocaleString()}</p>
                  <p className="text-xs text-slate-400">streams</p>
                </div>
              </div>
              <div className="mt-2">
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-red-500 h-2 rounded-full"
                    style={{ width: `${(song.streams / analytics.topSongs[0].streams) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Predictions & Platform Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
            <Target className="w-5 h-5 mr-2 text-red-500" />
            Next Month Predictions
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
              <div>
                <p className="text-sm text-slate-400">Projected Streams</p>
                <p className="text-2xl font-bold text-white">
                  {analytics.predictions.nextMonthStreams.toLocaleString()}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-400" />
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
              <div>
                <p className="text-sm text-slate-400">Projected Revenue</p>
                <p className="text-2xl font-bold text-white">
                  ${analytics.predictions.nextMonthRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-400" />
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
              <div>
                <p className="text-sm text-slate-400">Growth Projection</p>
                <p className="text-2xl font-bold text-white">
                  {analytics.predictions.growthProjection >= 0 ? '+' : ''}{analytics.predictions.growthProjection.toFixed(1)}%
                </p>
              </div>
              {analytics.predictions.growthProjection >= 0 ? (
                <TrendingUp className="w-8 h-8 text-green-400" />
              ) : (
                <TrendingDown className="w-8 h-8 text-red-400" />
              )}
            </div>
          </div>
        </div>

        {analytics.platformBreakdown.length > 0 && (
          <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
            <h2 className="text-xl font-semibold text-white mb-4">Platform Distribution</h2>
            <div className="h-64">
              <Chart
                data={analytics.platformBreakdown.map(p => ({
                  platform: p.platform,
                  streams: p.streams / 1000,
                }))}
                type="pie"
                dataKey="streams"
              />
            </div>
            <div className="mt-4 space-y-2">
              {analytics.platformBreakdown.map((platform, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">{platform.platform}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-32 bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-red-500 h-2 rounded-full"
                        style={{ width: `${platform.percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-white font-semibold w-20 text-right">
                      {platform.streams.toLocaleString()} ({platform.percentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Trend Analysis */}
      {analytics.trendAnalysis.length > 0 && (
        <div className="bg-gradient-to-br from-slate-900 to-black rounded-xl p-6 border border-slate-800 shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-green-400" />
            Trend Analysis
          </h2>
          <div className="h-64">
            <Chart
              data={analytics.trendAnalysis}
              type="line"
              dataKey="streams"
              nameKey="period"
              lines={[
                { dataKey: 'streams', name: 'Streams', color: '#ef4444' },
              ]}
            />
          </div>
        </div>
      )}

    </div>
  )
}
