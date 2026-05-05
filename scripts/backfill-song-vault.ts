import { getCatalog, getSongVaultFiles, addSongVaultFile } from '../lib/storage'
import { existsSync, statSync } from 'fs'
import path from 'path'

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads')

interface BackfillResult {
  songId: string
  song: string
  artist: string
  added: string[]
  skipped: string[]
  errors: string[]
}

function getFileSize(filePath: string): number | undefined {
  try {
    if (existsSync(filePath)) {
      return statSync(filePath).size
    }
  } catch (error) {
    // File doesn't exist or can't be accessed
  }
  return undefined
}

function extractFilePath(fileUrl: string): string | null {
  if (!fileUrl) return null
  
  // Handle URLs like /api/files/album-covers/filename.jpg
  if (fileUrl.startsWith('/api/files/')) {
    const relativePath = fileUrl.replace('/api/files/', '')
    return path.join(UPLOAD_DIR, relativePath)
  }
  
  // Handle other URL formats
  if (fileUrl.startsWith('http')) {
    // External URL, skip
    return null
  }
  
  return null
}

function backfillSongVault(): BackfillResult[] {
  const catalog = getCatalog()
  const existingVaultFiles = getSongVaultFiles()
  
  // Create a set of existing file URLs to avoid duplicates
  const existingFileUrls = new Set(
    existingVaultFiles
      .map(f => f.fileUrl)
      .filter((url): url is string => !!url)
  )
  
  const results: BackfillResult[] = []
  
  catalog.forEach((item) => {
    const result: BackfillResult = {
      songId: item.id,
      song: item.song,
      artist: item.artist,
      added: [],
      skipped: [],
      errors: [],
    }
    
    // 1. Add album cover if it exists
    if (item.albumCover && !existingFileUrls.has(item.albumCover)) {
      const filePath = extractFilePath(item.albumCover)
      if (filePath) {
        const fileSize = getFileSize(filePath)
        if (fileSize !== undefined) {
          try {
            const fileName = path.basename(filePath)
            addSongVaultFile({
              songId: item.id,
              fileName: fileName,
              fileType: 'other', // Album cover
              fileUrl: item.albumCover,
              fileSize: fileSize,
              uploadedBy: 'System (Backfill)',
              isFolder: false,
            })
            existingFileUrls.add(item.albumCover)
            result.added.push(`Album cover: ${fileName}`)
          } catch (error: any) {
            result.errors.push(`Album cover: ${error.message}`)
          }
        } else {
          result.errors.push(`Album cover file not found: ${item.albumCover}`)
        }
      } else {
        result.skipped.push(`Album cover (external URL): ${item.albumCover}`)
      }
    } else if (item.albumCover) {
      result.skipped.push(`Album cover already in vault: ${item.albumCover}`)
    }
    
    // 2. Add single audio file (fileUrl)
    if (item.releaseType === 'single' && item.fileUrl && !existingFileUrls.has(item.fileUrl)) {
      const filePath = extractFilePath(item.fileUrl)
      if (filePath) {
        const fileSize = getFileSize(filePath)
        if (fileSize !== undefined) {
          try {
            const fileName = path.basename(filePath)
            const ext = path.extname(fileName).toLowerCase()
            let fileType = 'other'
            if (ext === '.wav') {
              fileType = 'master'
            } else if (ext === '.mp3') {
              fileType = 'bounced'
            }
            
            addSongVaultFile({
              songId: item.id,
              fileName: fileName,
              fileType: fileType,
              fileUrl: item.fileUrl,
              fileSize: fileSize,
              uploadedBy: 'System (Backfill)',
              isFolder: false,
            })
            existingFileUrls.add(item.fileUrl)
            result.added.push(`Audio file: ${fileName}`)
          } catch (error: any) {
            result.errors.push(`Audio file: ${error.message}`)
          }
        } else {
          result.errors.push(`Audio file not found: ${item.fileUrl}`)
        }
      } else {
        result.skipped.push(`Audio file (external URL): ${item.fileUrl}`)
      }
    } else if (item.releaseType === 'single' && item.fileUrl) {
      result.skipped.push(`Audio file already in vault: ${item.fileUrl}`)
    }
    
    // 3. Add album/EP track audio files
    if (item.songs && Array.isArray(item.songs)) {
      item.songs.forEach((track) => {
        if (track.audioUrl && !existingFileUrls.has(track.audioUrl)) {
          const filePath = extractFilePath(track.audioUrl)
          if (filePath) {
            const fileSize = getFileSize(filePath)
            if (fileSize !== undefined) {
              try {
                const fileName = path.basename(filePath)
                const ext = path.extname(fileName).toLowerCase()
                let fileType = 'other'
                if (ext === '.wav') {
                  fileType = 'master'
                } else if (ext === '.mp3') {
                  fileType = 'bounced'
                }
                
                addSongVaultFile({
                  songId: item.id,
                  fileName: `${track.song} - ${fileName}`,
                  fileType: fileType,
                  fileUrl: track.audioUrl,
                  fileSize: fileSize,
                  uploadedBy: 'System (Backfill)',
                  isFolder: false,
                })
                existingFileUrls.add(track.audioUrl)
                result.added.push(`Track "${track.song}": ${fileName}`)
              } catch (error: any) {
                result.errors.push(`Track "${track.song}": ${error.message}`)
              }
            } else {
              result.errors.push(`Track "${track.song}" file not found: ${track.audioUrl}`)
            }
          } else {
            result.skipped.push(`Track "${track.song}" (external URL): ${track.audioUrl}`)
          }
        } else if (track.audioUrl) {
          result.skipped.push(`Track "${track.song}" already in vault: ${track.audioUrl}`)
        }
      })
    }
    
    // Only add result if there's something to report
    if (result.added.length > 0 || result.skipped.length > 0 || result.errors.length > 0) {
      results.push(result)
    }
  })
  
  return results
}

// Run the backfill
console.log('Starting song vault backfill...\n')
const results = backfillSongVault()

// Print summary
let totalAdded = 0
let totalSkipped = 0
let totalErrors = 0

results.forEach((result) => {
  totalAdded += result.added.length
  totalSkipped += result.skipped.length
  totalErrors += result.errors.length
  
  if (result.added.length > 0 || result.errors.length > 0) {
    console.log(`\n${result.song} by ${result.artist} (${result.songId}):`)
    if (result.added.length > 0) {
      console.log(`  ✅ Added (${result.added.length}):`)
      result.added.forEach(item => console.log(`     - ${item}`))
    }
    if (result.errors.length > 0) {
      console.log(`  ❌ Errors (${result.errors.length}):`)
      result.errors.forEach(item => console.log(`     - ${item}`))
    }
  }
})

console.log(`\n\n=== Summary ===`)
console.log(`Total songs processed: ${results.length}`)
console.log(`Files added to vault: ${totalAdded}`)
console.log(`Files skipped (already in vault or external): ${totalSkipped}`)
console.log(`Errors: ${totalErrors}`)
console.log(`\nBackfill complete!`)
