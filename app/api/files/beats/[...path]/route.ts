import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'
import { updateBeat, getBeats } from '@/lib/storage'
import { generateDownloadFingerprint } from '@/lib/audioMetadata'
import { getUploadPath } from '@/lib/uploadConfig'

const BEATS_DIR = getUploadPath('beats')

/**
 * Serve beat files with download tracking
 * GET /api/files/beats/[packName]/[fileName]?beatId=xxx&artistId=xxx&sessionId=xxx
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params
  try {
    // Decode URL-encoded path segments
    const decodedPath = resolvedParams.path.map(segment => {
      try {
        return decodeURIComponent(segment)
      } catch {
        return segment
      }
    })
    
    const filePath = path.join(BEATS_DIR, ...decodedPath)
    
    // Security: ensure path is within BEATS_DIR
    const normalizedPath = path.normalize(filePath)
    const resolvedBeatsDir = path.resolve(BEATS_DIR)
    const resolvedFilePath = path.resolve(normalizedPath)
    
    if (!resolvedFilePath.startsWith(resolvedBeatsDir)) {
      console.error('[GET /api/files/beats] Security check failed:', {
        requested: resolvedFilePath,
        allowed: resolvedBeatsDir,
      })
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }
    
    // Track download if beatId and artistId are provided (do this before file check to avoid extra work)
    const { searchParams } = new URL(request.url)
    const beatId = searchParams.get('beatId')
    const artistId = searchParams.get('artistId')
    const sessionId = searchParams.get('sessionId') || `session_${Date.now()}`
    
    if (beatId && artistId) {
      try {
        const beats = getBeats()
        const beat = beats.find(b => b.id === beatId)
        
        if (beat) {
          const timestamp = new Date().toISOString()
          const fingerprint = generateDownloadFingerprint(artistId, beatId, timestamp, sessionId)
          
          const downloadFingerprints = beat.downloadFingerprints || []
          downloadFingerprints.push({
            artistId,
            timestamp,
            sessionId,
            fingerprint,
          })
          
          updateBeat(beatId, {
            downloadFingerprints,
          })
        }
      } catch (trackingError) {
        console.error('[GET /api/files/beats] Download tracking error:', trackingError)
        // Continue even if tracking fails
      }
    }
    
    // Check if file exists, try sanitized path if not found
    let finalPath = normalizedPath
    if (!existsSync(finalPath)) {
      // Try with sanitized path segments (for legacy files or encoding issues)
      const sanitizedPath = decodedPath.map(segment => 
        segment.replace(/[^a-zA-Z0-9._-]/g, '_')
      )
      const sanitizedFilePath = path.join(BEATS_DIR, ...sanitizedPath)
      const normalizedSanitizedPath = path.normalize(sanitizedFilePath)
      
      if (normalizedSanitizedPath.startsWith(resolvedBeatsDir) && existsSync(normalizedSanitizedPath)) {
        finalPath = normalizedSanitizedPath
      } else {
        console.error('[GET /api/files/beats] File not found:', {
          normalizedPath,
          decodedPath,
          originalPath: resolvedParams.path,
          sanitizedPath: normalizedSanitizedPath,
        })
        return NextResponse.json({ error: 'File not found' }, { status: 404 })
      }
    }
    
    const ext = path.extname(finalPath).toLowerCase()
    
    // Set appropriate content type
    let contentType = 'application/octet-stream'
    if (ext === '.mp3') contentType = 'audio/mpeg'
    if (ext === '.wav') contentType = 'audio/wav'
    
    // Support HTTP range requests for audio streaming
    const rangeHeader = request.headers.get('range')
    const fileStats = await import('fs/promises').then(fs => fs.stat(finalPath))
    const fileSize = fileStats.size
    
    if (rangeHeader) {
      // Parse range header
      const parts = rangeHeader.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
      const chunkSize = (end - start) + 1
      
      // Read only the requested chunk
      const fileHandle = await import('fs/promises').then(fs => fs.open(finalPath, 'r'))
      const buffer = Buffer.alloc(chunkSize)
      await fileHandle.read(buffer, 0, chunkSize, start)
      await fileHandle.close()
      
      return new NextResponse(buffer, {
        status: 206, // Partial Content
        headers: {
          'Content-Type': contentType,
          'Content-Length': chunkSize.toString(),
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    }
    
    // Full file request - read file
    const fileBuffer = await readFile(finalPath)
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error: any) {
    console.error('[GET /api/files/beats] Error:', error)
    return NextResponse.json(
      { error: 'Failed to serve file', details: error.message },
      { status: 500 }
    )
  }
}

