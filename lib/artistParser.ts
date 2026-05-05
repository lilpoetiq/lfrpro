/**
 * Parse artist names from a string that may contain collaborations
 * Handles formats like:
 * - "Style One & Lilpoetiq"
 * - "Lilpoetiq feat. Od Sleep & Picasso"
 * - "Artist1, Artist2, Artist3"
 * - "Artist1 x Artist2"
 */
export function parseArtistsFromString(artistString: string): string[] {
  if (!artistString || !artistString.trim()) return []
  
  // Common collaboration separators
  const separators = [
    /\s+feat\.\s+/i,
    /\s+featuring\s+/i,
    /\s+ft\.\s+/i,
    /\s+ft\s+/i,
    /\s+&\s+/,
    /\s+x\s+/i,
    /\s+X\s+/,
    /\s*,\s*/,
    /\s+and\s+/i,
  ]
  
  let artists: string[] = [artistString.trim()]
  
  // Split by separators
  for (const separator of separators) {
    const newArtists: string[] = []
    for (const artist of artists) {
      const split = artist.split(separator)
      newArtists.push(...split.map(a => a.trim()).filter(a => a.length > 0))
    }
    artists = newArtists
  }
  
  // Clean up artist names
  artists = artists.map(artist => {
    // Remove common prefixes/suffixes
    artist = artist.replace(/^(feat\.|featuring|ft\.|ft)\s+/i, '').trim()
    artist = artist.replace(/\s+(feat\.|featuring|ft\.|ft)$/i, '').trim()
    return artist
  }).filter(artist => artist.length > 0)
  
  return artists
}

/**
 * Match artist names to user accounts
 * SIMPLIFIED: Names are cosmetic. Only uses manual mappings for linking.
 * @param artistNames - Array of artist names to match
 * @param users - Array of user objects to match against
 * @param manualMappings - REQUIRED object mapping artist names to user IDs
 */
export function matchArtistsToUsers(artistNames: string[], users: any[], manualMappings?: Record<string, string>): string[] {
  const matchedIds: string[] = []
  
  if (!users || users.length === 0) {
    console.warn('matchArtistsToUsers: No users provided')
    return []
  }
  
  for (const artistName of artistNames) {
    if (!artistName || artistName.trim() === '') continue
    
    // ONLY use manual mappings - names are cosmetic
    if (manualMappings) {
      const normalizedName = artistName.toLowerCase().trim()
      const manualMapping = manualMappings[normalizedName]
      if (manualMapping && !matchedIds.includes(manualMapping)) {
        matchedIds.push(manualMapping)
        continue
      }
      
      // Also check aliases in mappings (support multiple name variations)
      for (const [mappedName, userId] of Object.entries(manualMappings)) {
        if (normalizedName === mappedName.toLowerCase().trim() && !matchedIds.includes(userId)) {
          matchedIds.push(userId)
          break
        }
      }
    }
    
    // No fallback matching - names are cosmetic, only mappings work
    // This ensures simplicity: "Zion Johnson" = "555wick" only if explicitly mapped
    
    const normalized = artistName.toLowerCase().trim()
    
    // Find matching user
    const matchedUser = users.find(user => {
      if (!user || !user.id) return false
      
      const userName = user.name?.toLowerCase().trim() || ''
      const username = user.username?.toLowerCase().trim() || ''
      const artistNameLower = user.artistName?.toLowerCase().trim() || ''
      const realNameLower = user.realName?.toLowerCase().trim() || ''
      
      // Exact matches
      if (normalized === userName || normalized === username || normalized === artistNameLower || normalized === realNameLower) {
        return true
      }
      
      // Normalized match with username (remove spaces and special chars)
      const normalizeForMatch = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '')
      const normalizedArtist = normalizeForMatch(artistName)
      const normalizedUsername = normalizeForMatch(username)
      if (normalizedArtist && normalizedUsername && normalizedArtist === normalizedUsername) {
        return true
      }
      
      // Contains matches (but avoid false positives with very short strings)
      if (normalized.length >= 3 && userName.length >= 3) {
        if (normalized.includes(userName) || userName.includes(normalized)) return true
      }
      if (username && username.length >= 3 && normalized.length >= 3) {
        // Normalize both for comparison (remove spaces)
        const normalizedUsername = normalizeForMatch(username)
        const normalizedArtist = normalizeForMatch(artistName)
        if (normalizedArtist && normalizedUsername && 
            (normalizedArtist.includes(normalizedUsername) || normalizedUsername.includes(normalizedArtist))) {
          return true
        }
      }
      if (artistNameLower && artistNameLower.length >= 3 && normalized.length >= 3) {
        if (normalized.includes(artistNameLower) || artistNameLower.includes(normalized)) return true
      }
      if (realNameLower && realNameLower.length >= 3 && normalized.length >= 3) {
        if (normalized.includes(realNameLower) || realNameLower.includes(normalized)) return true
      }
      
      // Check aliases
      if (user.aliases && Array.isArray(user.aliases)) {
        for (const alias of user.aliases) {
          if (!alias) continue
          const aliasLower = alias.toLowerCase().trim()
          if (normalized === aliasLower) return true
          if (normalized.length >= 3 && aliasLower.length >= 3) {
            if (normalized.includes(aliasLower) || aliasLower.includes(normalized)) return true
          }
        }
      }
      
      // Normalized match (remove special chars and spaces) - handles "OD Sleep" vs "ODSleep" vs "Od Sleep" vs "odsleep"
      const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '')
      const normalizedSearch = normalize(artistName)
      if (normalizedSearch && normalizedSearch.length >= 2) {
        if (userName && normalize(userName) === normalizedSearch) return true
        if (username && normalize(username) === normalizedSearch) return true
        if (artistNameLower && normalize(artistNameLower) === normalizedSearch) return true
        if (realNameLower && normalize(realNameLower) === normalizedSearch) return true
      }
      
      // Handle space variations: "OD Sleep" vs "ODSleep" vs "Od Sleep" vs "odsleep"
      const normalizeSpaces = (str: string) => str.toLowerCase().replace(/\s+/g, '').trim()
      const normalizedSearchNoSpaces = normalizeSpaces(artistName)
      if (normalizedSearchNoSpaces && normalizedSearchNoSpaces.length >= 2) {
        if (userName && normalizeSpaces(userName) === normalizedSearchNoSpaces) return true
        if (username && normalizeSpaces(username) === normalizedSearchNoSpaces) return true
        if (artistNameLower && normalizeSpaces(artistNameLower) === normalizedSearchNoSpaces) return true
        if (realNameLower && normalizeSpaces(realNameLower) === normalizedSearchNoSpaces) return true
      }
      
      // Handle case-insensitive partial word matching for multi-word names
      // "OD Sleep" should match "Od Sleep", "ODSleep", "od sleep", etc.
      const words = normalized.split(/\s+/).filter((w: string) => w.length >= 2)
      if (words.length > 1) {
        const userNameWords = userName.split(/\s+/).filter((w: string) => w.length >= 2)
        const artistNameWords = artistNameLower.split(/\s+/).filter((w: string) => w.length >= 2)
        const realNameWords = realNameLower.split(/\s+/).filter((w: string) => w.length >= 2)
        
        // Check if all words match (order doesn't matter, partial matches allowed)
        const allWordsMatch = (searchWords: string[], targetWords: string[]): boolean => {
          if (targetWords.length === 0) return false
          // Try exact word match first
          const exactMatch = searchWords.length === targetWords.length && 
            searchWords.every(word => targetWords.includes(word))
          if (exactMatch) return true
          
          // Try partial matching - each search word should match at least one target word
          return searchWords.every(searchWord => 
            targetWords.some(targetWord => 
              targetWord === searchWord || 
              targetWord.includes(searchWord) || 
              searchWord.includes(targetWord)
            )
          )
        }
        
        if (userNameWords.length > 0 && allWordsMatch(words, userNameWords)) return true
        if (artistNameWords.length > 0 && allWordsMatch(words, artistNameWords)) return true
        if (realNameWords.length > 0 && allWordsMatch(words, realNameWords)) return true
      }
      
      return false
    })
    
    if (matchedUser && matchedUser.id && !matchedIds.includes(matchedUser.id)) {
      matchedIds.push(matchedUser.id)
    } else if (!matchedUser) {
      console.warn(`matchArtistsToUsers: Could not find user for artist name: "${artistName}"`)
      console.log('Available users:', users.map(u => ({ id: u.id, name: u.name, artistName: u.artistName, realName: u.realName })))
    }
  }
  
  return matchedIds
}

/**
 * Check if a collaboration already exists in catalog
 */
export function findExistingCollaboration(
  songName: string,
  artistIds: string[],
  catalog: any[]
): any[] {
  const normalizedSong = songName.toLowerCase().trim()
  
  return catalog.filter(item => {
    const itemSong = item.song.toLowerCase().trim()
    if (itemSong !== normalizedSong) return false
    
    // Check if any artist IDs match
    const itemArtistIds = item.artistIds || (item.artistId ? [item.artistId] : [])
    
    // Check if all artist IDs are present (exact match)
    const allMatch = artistIds.every(id => itemArtistIds.includes(id)) &&
                     itemArtistIds.length === artistIds.length
    
    // Check if there's any overlap (partial match)
    const hasOverlap = artistIds.some(id => itemArtistIds.includes(id))
    
    return allMatch || hasOverlap
  })
}

