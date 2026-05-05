import { NextRequest, NextResponse } from 'next/server'
import { getCatalog, updateCatalogItem } from '@/lib/storage'
import { existsSync } from 'fs'
import path from 'path'
import { UPLOAD_BASE } from '@/lib/uploadConfig'

const UPLOAD_DIR = UPLOAD_BASE

function checkFileExists(fileUrl: string | undefined): boolean {
  if (!fileUrl) return false
  
  try {
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

export async function POST(request: NextRequest) {
  try {
    const catalog = getCatalog()
    const results: any[] = []
    let fixedCount = 0
    
    catalog.forEach((item) => {
      const updates: any = {}
      const issues: string[] = []
      const fixes: string[] = []
      
      // Fix 1: Ensure songs array exists and has audioUrl for singles
      if (item.releaseType === 'single') {
        if (!item.songs || item.songs.length === 0) {
          if (item.fileUrl) {
            updates.songs = [{
              id: item.id,
              song: item.song,
              isrc: item.isrc,
              streams: item.totalStreams || 0,
              audioUrl: item.fileUrl,
            }]
            fixes.push('Created songs array from fileUrl')
          } else {
            updates.songs = [{
              id: item.id,
              song: item.song,
              isrc: item.isrc,
              streams: item.totalStreams || 0,
            }]
          }
        } else if (item.songs.length > 0 && !item.songs[0].audioUrl && item.fileUrl) {
          updates.songs = item.songs.map((song: any) => ({
            ...song,
            audioUrl: song.audioUrl || item.fileUrl,
          }))
          fixes.push('Added audioUrl from fileUrl to songs array')
        }
        
        // Verify audio file exists
        const audioUrl = item.songs?.[0]?.audioUrl || item.fileUrl
        if (audioUrl && !checkFileExists(audioUrl)) {
          issues.push(`Audio file not found: ${audioUrl}`)
        } else if (audioUrl) {
          // File exists, ensure it's in songs array
          if (item.songs && item.songs.length > 0 && !item.songs[0].audioUrl && item.fileUrl) {
            if (!updates.songs) {
              updates.songs = item.songs.map((song: any) => ({
                ...song,
                audioUrl: song.audioUrl || item.fileUrl,
              }))
              fixes.push('Added audioUrl from fileUrl')
            }
          }
        }
      }
      
      // Fix 2: For albums/EPs, verify audio files
      if ((item.releaseType === 'album' || item.releaseType === 'ep') && item.songs) {
        item.songs.forEach((song: any) => {
          if (song.audioUrl && !checkFileExists(song.audioUrl)) {
            issues.push(`Audio file not found for "${song.song}": ${song.audioUrl}`)
          }
        })
      }
      
      // Fix 3: Verify album cover exists
      if (item.albumCover && !checkFileExists(item.albumCover)) {
        issues.push(`Album cover not found: ${item.albumCover}`)
      }
      
      // Fix 4: Ensure required fields
      if (!item.releaseType) {
        updates.releaseType = 'single'
        fixes.push('Set default releaseType')
      }
      
      if (item.totalStreams === undefined || item.totalStreams === null) {
        updates.totalStreams = 0
        fixes.push('Set totalStreams to 0')
      }
      
      // Fix 5: Ensure credits array exists
      if (!item.credits || !Array.isArray(item.credits)) {
        updates.credits = []
        fixes.push('Initialized credits array')
      }
      
      // Apply fixes
      if (Object.keys(updates).length > 0) {
        const success = updateCatalogItem(item.id, updates)
        if (success) {
          fixedCount++
        } else {
          issues.push('Failed to apply fixes')
        }
      }
      
      if (fixes.length > 0 || issues.length > 0) {
        results.push({
          songId: item.id,
          song: item.song,
          artist: item.artist,
          fixes,
          issues,
        })
      }
    })
    
    return NextResponse.json({
      success: true,
      totalItems: catalog.length,
      itemsFixed: fixedCount,
      itemsWithIssues: results.length,
      results,
    })
  } catch (error: any) {
    console.error('Catalog validation error:', error)
    return NextResponse.json(
      { error: 'Failed to validate catalog', details: error.message },
      { status: 500 }
    )
  }
}
