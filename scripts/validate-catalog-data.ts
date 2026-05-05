import { getCatalog, updateCatalogItem } from '../lib/storage'
import { existsSync } from 'fs'
import path from 'path'

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads')

interface ValidationResult {
  songId: string
  song: string
  artist: string
  issues: string[]
  fixes: string[]
}

function checkFileExists(fileUrl: string | undefined): boolean {
  if (!fileUrl) return false
  
  try {
    // Extract path from URL (e.g., /api/files/track-audio/file.mp3)
    let filePath = fileUrl
    if (filePath.startsWith('/api/files/')) {
      filePath = filePath.replace('/api/files/', '')
    }
    
    const fullPath = path.join(UPLOAD_DIR, ...filePath.split('/'))
    return existsSync(fullPath)
  } catch {
    return false
  }
}

function validateAndFixCatalog(): ValidationResult[] {
  const catalog = getCatalog()
  const results: ValidationResult[] = []
  
  catalog.forEach((item) => {
    const result: ValidationResult = {
      songId: item.id,
      song: item.song,
      artist: item.artist,
      issues: [],
      fixes: [],
    }
    
    const updates: any = {}
    
    // Check 1: Ensure songs array exists and has audioUrl for singles
    if (item.releaseType === 'single') {
      if (!item.songs || item.songs.length === 0) {
        // Create songs array from fileUrl if it exists
        if (item.fileUrl) {
          updates.songs = [{
            id: item.id,
            song: item.song,
            isrc: item.isrc,
            streams: item.totalStreams || 0,
            audioUrl: item.fileUrl,
          }]
          result.fixes.push('Created songs array from fileUrl')
        } else {
          // Create empty songs array for play/upload functionality
          updates.songs = [{
            id: item.id,
            song: item.song,
            isrc: item.isrc,
            streams: item.totalStreams || 0,
          }]
          result.issues.push('No audio file found (fileUrl missing)')
        }
      } else if (item.songs.length > 0 && !item.songs[0].audioUrl && item.fileUrl) {
        // Update existing songs array with audioUrl from fileUrl
        updates.songs = item.songs.map((song: any) => ({
          ...song,
          audioUrl: song.audioUrl || item.fileUrl,
        }))
        result.fixes.push('Added audioUrl from fileUrl to songs array')
      }
      
      // Verify audio file exists
      const audioUrl = item.songs?.[0]?.audioUrl || item.fileUrl
      if (audioUrl && !checkFileExists(audioUrl)) {
        result.issues.push(`Audio file not found: ${audioUrl}`)
      }
    }
    
    // Check 2: For albums/EPs, ensure all tracks have audioUrl if they should
    if ((item.releaseType === 'album' || item.releaseType === 'ep') && item.songs) {
      const tracksWithoutAudio = item.songs.filter((song: any) => !song.audioUrl)
      if (tracksWithoutAudio.length > 0) {
        result.issues.push(`${tracksWithoutAudio.length} track(s) missing audio files`)
      }
      
      // Verify audio files exist
      item.songs.forEach((song: any) => {
        if (song.audioUrl && !checkFileExists(song.audioUrl)) {
          result.issues.push(`Audio file not found for "${song.song}": ${song.audioUrl}`)
        }
      })
    }
    
    // Check 3: Verify album cover exists
    if (item.albumCover && !checkFileExists(item.albumCover)) {
      result.issues.push(`Album cover not found: ${item.albumCover}`)
    }
    
    // Check 4: Ensure required fields exist
    if (!item.releaseType) {
      updates.releaseType = 'single'
      result.fixes.push('Set default releaseType to single')
    }
    
    if (item.totalStreams === undefined || item.totalStreams === null) {
      updates.totalStreams = 0
      result.fixes.push('Set totalStreams to 0')
    }
    
    // Check 5: Ensure credits array exists
    if (!item.credits || !Array.isArray(item.credits)) {
      updates.credits = []
      result.fixes.push('Initialized credits array')
    }
    
    // Apply fixes if any
    if (Object.keys(updates).length > 0) {
      const success = updateCatalogItem(item.id, updates)
      if (success) {
        console.log(`✅ Fixed ${item.song} by ${item.artist}:`, result.fixes)
      } else {
        result.issues.push('Failed to apply fixes')
      }
    }
    
    if (result.issues.length > 0 || result.fixes.length > 0) {
      results.push(result)
    }
  })
  
  return results
}

// Run validation
const results = validateAndFixCatalog()

console.log('\n=== Catalog Validation Results ===\n')
console.log(`Total items checked: ${getCatalog().length}`)
console.log(`Items with issues/fixes: ${results.length}\n`)

results.forEach((result) => {
  console.log(`\n${result.song} by ${result.artist} (${result.songId})`)
  if (result.fixes.length > 0) {
    console.log('  ✅ Fixes applied:')
    result.fixes.forEach(fix => console.log(`    - ${fix}`))
  }
  if (result.issues.length > 0) {
    console.log('  ⚠️  Issues found:')
    result.issues.forEach(issue => console.log(`    - ${issue}`))
  }
})

console.log('\n=== Validation Complete ===\n')
