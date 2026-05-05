/**
 * Parse a date string as a local date (not UTC) to avoid timezone issues
 * This ensures dates like "2025-01-30" display as January 30th, not January 29th
 */
export function parseLocalDate(dateStr: string | Date | undefined | null): Date | null {
  if (!dateStr) return null
  
  // If already a Date object, return it
  if (dateStr instanceof Date) {
    return dateStr
  }
  
  // Handle ISO date strings (e.g., "2025-01-30" or "2025-01-30T00:00:00.000Z")
  if (typeof dateStr === 'string') {
    // Extract date part (YYYY-MM-DD)
    const dateMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (dateMatch) {
      const [, year, month, day] = dateMatch
      // Create date in local timezone (month is 0-indexed in Date constructor)
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    }
    
    // Fallback to standard Date parsing
    return new Date(dateStr)
  }
  
  return null
}

/**
 * Format a date as YYYY-MM-DD in local timezone (not UTC)
 * This prevents timezone shifts that cause dates to appear a day off
 */
export function formatLocalDateString(date: Date | string | undefined | null): string {
  if (!date) return ''
  
  const d = date instanceof Date ? date : parseLocalDate(date)
  if (!d) return ''
  
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

/**
 * Format a date string as a local date string
 * This ensures dates display correctly without timezone shifts
 */
export function formatLocalDate(dateStr: string | Date | undefined | null, options?: Intl.DateTimeFormatOptions): string {
  const date = parseLocalDate(dateStr)
  if (!date) return 'Not set'
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }
  
  return date.toLocaleDateString('en-US', { ...defaultOptions, ...options })
}

export function formatTimeAgo(date: Date | string | any): string {
  if (!date) return 'N/A'
  
  const now = new Date()
  const then = date instanceof Date ? date : date?.toDate ? date.toDate() : new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)

  if (diffHours < 1) {
    const diffMins = Math.floor(diffMs / (1000 * 60))
    return diffMins < 1 ? 'Just now' : `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  } else if (diffDays <= 5) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  } else {
    return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
}

// Check if a string is a date (not a song title)
export function isDateString(text: string): boolean {
  if (!text || text.trim().length === 0) return false
  
  const trimmed = text.trim()
  
  // Check for date patterns
  const datePatterns = [
    // "January 17th, 2024" or "January 17, 2024"
    /^(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}$/i,
    // "1/17/2024" or "01/17/2024"
    /^\d{1,2}\/\d{1,2}\/\d{4}$/,
    // "2024-01-17"
    /^\d{4}-\d{1,2}-\d{1,2}$/,
    // "Jan 17, 2024"
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\.?\s+\d{1,2},?\s+\d{4}$/i,
    // Just a year (4 digits)
    /^\d{4}$/,
  ]
  
  // If it matches a date pattern, it's a date
  if (datePatterns.some(pattern => pattern.test(trimmed))) {
    return true
  }
  
  // If it's very short and looks like a date component
  if (trimmed.length < 10 && /^\d{1,2}[\/\-]\d{1,2}/.test(trimmed)) {
    return true
  }
  
  return false
}

// Check if a string is just a number (not a valid song title)
export function isNumericOnly(text: string): boolean {
  if (!text || text.trim().length === 0) return false
  
  const trimmed = text.trim()
  
  // Check if it's just digits (with optional leading/trailing whitespace)
  // Examples: "1", "2", "123", " 5 ", etc.
  return /^\d+$/.test(trimmed)
}

// Remove [Explicit] tags from song names and filter out dates
export function cleanSongName(songName: string): string {
  if (!songName) return ''
  
  // Check if it's a date - if so, return empty string
  if (isDateString(songName)) {
    return ''
  }
  
  // Remove [Explicit] or {explicit} tags in various formats
  return songName
    .replace(/\s*\[Explicit\]\s*/gi, ' ')
    .replace(/\s*\{explicit\}\s*/gi, ' ')
    .replace(/\s*\{Explicit\}\s*/gi, ' ')
    .replace(/\s*\(Explicit\)\s*/gi, ' ')
    .replace(/\s*\(explicit\)\s*/gi, ' ')
    .trim()
}

// Parse song title from format like "But You [Explicit] by Sariya" or "[title] {explicit} by [artist]"
export function parseSongFromSpotify(spotifyText: string): { song: string; artist: string } {
  if (!spotifyText) return { song: '', artist: '' }
  
  // Pattern: "[song title] [Explicit] by [artist]" or "[song title] {explicit} by [artist]" or "[song title] by [artist]"
  const byMatch = spotifyText.match(/^(.+?)\s+by\s+(.+)$/i)
  if (byMatch) {
    let song = byMatch[1].trim()
    const artist = byMatch[2].trim()
    
    // Remove [Explicit] or {explicit} tags if present
    song = cleanSongName(song)
    
    return { song, artist }
  }
  
  // Fallback: clean the song name even if no artist found
  return { song: cleanSongName(spotifyText), artist: '' }
}

export function groupDataByArtist(data: any[]): Record<string, any[]> {
  const grouped: Record<string, any[]> = {}
  
  // Import parseArtistsFromString - using require to avoid potential circular dependency issues
  const { parseArtistsFromString } = require('./artistParser')
  
  data.forEach((row) => {
    let artistName = ''
    let songName = ''
    
    // First, try to parse from Spotify column if it exists
    const spotifyCol = row.Spotify || row.spotify || row['Spotify']
    if (spotifyCol) {
      const parsed = parseSongFromSpotify(spotifyCol)
      artistName = parsed.artist
      songName = parsed.song
    }
    
    // Fallback to standard artist columns
    if (!artistName) {
      artistName = row.artist || row.Artist || row.ARTIST || row['Artist Name'] || row['artist_name'] || 'Unknown'
    }
    
    // Extract song name if not already found
    if (!songName) {
      songName = row.song || row.Song || row.SONG || row['Song Name'] || row['song_name'] || row.title || row.Title || row['Track Name'] || ''
    }
    
    // Clean song name of [Explicit] tags and filter out dates
    songName = cleanSongName(songName)
    
    // If song name is empty or is a date, try to find it in other columns
    if (!songName || isDateString(songName)) {
      // Try to find song name in other columns, excluding date columns
      const allKeys = Object.keys(row)
      for (const key of allKeys) {
        const keyLower = key.toLowerCase()
        // Skip date-related columns
        if (keyLower.includes('date') || keyLower.includes('release') || keyLower === 'total' || keyLower.startsWith('total_')) {
          continue
        }
        const value = row[key]
        if (value && typeof value === 'string' && value.trim() && !isDateString(value)) {
          const cleaned = cleanSongName(value)
          if (cleaned && !isDateString(cleaned)) {
            songName = cleaned
            break
          }
        }
      }
    }
    
    // Store parsed values back in row
    row._parsedArtist = artistName
    row._parsedSong = songName
    
    // Parse collaborative artist names (e.g., "Lilpoetiq & Style One" -> ["Lilpoetiq", "Style One"])
    const individualArtists = parseArtistsFromString(artistName)
    
    // Add this row to each individual artist's group
    individualArtists.forEach((individualArtist: string) => {
      if (!grouped[individualArtist]) {
        grouped[individualArtist] = []
      }
      grouped[individualArtist].push(row)
    })
  })
  
  return grouped
}

export function extractArtistsFromCSV(data: any[]): string[] {
  const artists = new Set<string>()
  
  // Import parseArtistsFromString - using require to avoid potential circular dependency issues
  const { parseArtistsFromString } = require('./artistParser')
  
  data.forEach((row) => {
    let artistName = ''
    
    // Try Spotify column first
    const spotifyCol = row.Spotify || row.spotify || row['Spotify']
    if (spotifyCol) {
      const parsed = parseSongFromSpotify(spotifyCol)
      artistName = parsed.artist
    }
    
    // Fallback to standard columns
    if (!artistName) {
      artistName = row.artist || row.Artist || row.ARTIST || row['Artist Name'] || row['artist_name'] || row._parsedArtist || ''
    }
    
    if (artistName && artistName !== 'Unknown') {
      // Parse collaborative artist names and add each individual artist
      const individualArtists = parseArtistsFromString(artistName)
      individualArtists.forEach((individualArtist: string) => {
        if (individualArtist && individualArtist !== 'Unknown') {
          artists.add(individualArtist)
        }
      })
    }
  })
  
  return Array.from(artists)
}

// Extract songs from CSV data
export function extractSongsFromCSV(data: any[]): Array<{ song: string; artist: string; streams?: number }> {
  const songs = new Map<string, { song: string; artist: string; streams: number }>()
  
  data.forEach((row) => {
    let songName = ''
    let artistName = ''
    
    // Try Spotify column first
    const spotifyCol = row.Spotify || row.spotify || row['Spotify']
    if (spotifyCol) {
      const parsed = parseSongFromSpotify(spotifyCol)
      songName = parsed.song
      artistName = parsed.artist
    }
    
    // Fallback
    if (!songName) {
      songName = row.song || row.Song || row.SONG || row['Song Name'] || row['song_name'] || row.title || row.Title || row['Track Name'] || ''
    }
    if (!artistName) {
      artistName = row.artist || row.Artist || row.ARTIST || row['Artist Name'] || row['artist_name'] || row._parsedArtist || 'Unknown'
    }
    
    // Clean song name of [Explicit] tags
    songName = cleanSongName(songName)
    
    if (songName && artistName) {
      const key = `${songName}-${artistName}`
      const streams = parseInt(row.Total || row.total || row.TOTAL || row.Streams || row.streams || row.STREAMS || '0')
      
      if (!songs.has(key)) {
        songs.set(key, { song: songName, artist: artistName, streams: 0 })
      }
      
      const existing = songs.get(key)!
      existing.streams += streams
    }
  })
  
  return Array.from(songs.values())
}

/**
 * Check if a user has admin access (either admin role OR staff with staffPermissions)
 * @param user - The user object to check
 * @returns true if user has admin access, false otherwise
 */
export function hasAdminAccess(user: { role: string; staffPermissions?: string[] } | null | undefined): boolean {
  if (!user) return false
  
  // Admin role always has access
  if (user.role === 'admin') return true
  
  // Staff (artist with staffPermissions) also has admin access
  if (user.role === 'artist' && Array.isArray(user.staffPermissions) && user.staffPermissions.length > 0) {
    return true
  }
  
  return false
}
