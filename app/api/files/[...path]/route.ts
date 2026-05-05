import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import { createReadStream } from 'fs'
import path from 'path'
import { existsSync } from 'fs'
import { UPLOAD_BASE, getProjectRoot } from '@/lib/uploadConfig'

export const runtime = 'nodejs'

const UPLOAD_DIR = UPLOAD_BASE

/** True if resolved `file` is `root` or a path inside it (avoids `proj` vs `proj-evil` prefix traps). */
function isWithinRoot(absFile: string, absRoot: string): boolean {
  const root = path.resolve(absRoot)
  const file = path.resolve(absFile)
  return file === root || file.startsWith(root + path.sep)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params
    const pathArray: string[] = Array.isArray(resolvedParams.path) ? resolvedParams.path : []
    
    if (pathArray.length === 0) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
    }
    
    // Decode URL-encoded path segments
    const decodedPath = pathArray.map(segment => {
      try {
        return decodeURIComponent(segment)
      } catch {
        return segment
      }
    })
    
    let filePath = path.join(UPLOAD_DIR, ...decodedPath)

    const resolvedUploadDir = path.resolve(UPLOAD_DIR)

    // Security: requested path must stay inside upload root (prefix-only checks are unsafe)
    if (!isWithinRoot(path.resolve(filePath), resolvedUploadDir)) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 403 })
    }

    // If file doesn't exist, try multiple fallback strategies
    if (!existsSync(filePath)) {
      // Strategy 1: Try sanitizing the path (for legacy files with special chars)
      if (decodedPath.length > 1) {
        const sanitizedPath = decodedPath.map(segment => 
          segment.replace(/[^a-zA-Z0-9._-]/g, '_')
        )
        const sanitizedFilePath = path.join(UPLOAD_DIR, ...sanitizedPath)
        
        if (isWithinRoot(path.resolve(sanitizedFilePath), resolvedUploadDir) && existsSync(sanitizedFilePath)) {
          filePath = sanitizedFilePath
        }
      }
      
      // Strategy 2: If still not found, try with original segments (no decoding)
      if (!existsSync(filePath)) {
        const originalPath = path.join(UPLOAD_DIR, ...pathArray)
        if (isWithinRoot(path.resolve(originalPath), resolvedUploadDir) && existsSync(originalPath)) {
          filePath = originalPath
        }
      }

      // Strategy 3: Split-storage — files under project root while UPLOAD_DIR points elsewhere.
      if (!existsSync(filePath)) {
        const projectRoot = getProjectRoot()
        const resolvedProjectRoot = path.resolve(projectRoot)
        if (resolvedUploadDir !== resolvedProjectRoot) {
          const projectCandidate = path.join(projectRoot, ...decodedPath)
          if (isWithinRoot(path.resolve(projectCandidate), resolvedProjectRoot) && existsSync(projectCandidate)) {
            filePath = projectCandidate
          }
        }
      }
    }

    const resolvedFinal = path.resolve(filePath)
    const allowedInUpload = isWithinRoot(resolvedFinal, resolvedUploadDir)
    const resolvedProjectRoot = path.resolve(getProjectRoot())
    const allowedInProject =
      isWithinRoot(resolvedFinal, resolvedProjectRoot) &&
      resolvedUploadDir !== resolvedProjectRoot
    if (!allowedInUpload && !allowedInProject) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 403 })
    }

    if (!existsSync(filePath)) {
      console.error('File not found:', filePath)
      console.error('Tried path segments:', decodedPath)
      
      // Log error for admin diagnostics
      try {
        const { logError } = await import('@/lib/errorLogger')
        logError({
          errorCode: 'FILE_NOT_FOUND',
          type: 'file_download',
          message: 'File not found',
          endpoint: request.url,
          method: request.method,
          details: {
            requestedPath: filePath,
            decodedPath,
            originalPath: pathArray,
          },
        })
      } catch (logError) {
        // Silent fail for error logging
      }
      
      return NextResponse.json({ 
        error: 'File not found', 
        details: `Path: ${filePath}`,
        tried: decodedPath,
        errorCode: 'FILE_NOT_FOUND',
      }, { status: 404 })
    }

    const fileName = path.basename(filePath)
    const extension = path.extname(fileName).toLowerCase()
    const fileStats = await stat(filePath)
    const fileSize = fileStats.size

    // Determine content type
    const contentTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.aac': 'audio/aac',
      '.flac': 'audio/flac',
      '.ogg': 'audio/ogg',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska',
      '.zip': 'application/zip',
      '.logicx': 'application/octet-stream',
      '.logic': 'application/octet-stream',
    }

    const contentType = contentTypes[extension] || 'application/octet-stream'
    
    // For audio/video, support range requests for streaming
    const isMedia = extension.match(/\.(mp3|wav|m4a|aac|flac|ogg|mp4|mov|avi|mkv)$/i)
    
    // Check for range request header
    const rangeHeader = request.headers.get('range')
    
    if (isMedia && rangeHeader) {
      // Parse range header
      const parts = rangeHeader.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
      const chunkSize = (end - start) + 1
      
      // Create read stream for the requested range
      const stream = createReadStream(filePath, { start, end })
      
      const headers = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize.toString(),
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      }
      
      return new NextResponse(stream as any, { 
        status: 206, // Partial Content
        headers 
      })
    }
    
    // For non-range requests or non-media files, serve full file
    const fileBuffer = await readFile(filePath)
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    }

    if (isMedia) {
      headers['Accept-Ranges'] = 'bytes'
      headers['Content-Length'] = fileSize.toString()
      headers['Content-Disposition'] = `inline; filename="${encodeURIComponent(fileName)}"`
    } else {
      headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(fileName)}"`
    }

    return new NextResponse(fileBuffer, { headers })
  } catch (error: any) {
    console.error('File serve error:', error)
    
    // Log error for admin diagnostics
    try {
      const resolvedParams = await Promise.resolve(params)
      const errorPathArray: string[] = Array.isArray(resolvedParams.path) ? resolvedParams.path : []
      const { logError } = await import('@/lib/errorLogger')
      logError({
        errorCode: error.code || 'FILE_SERVE_ERROR',
        type: 'file_download',
        message: 'File serve error',
        endpoint: request.url,
        method: request.method,
        details: {
          path: errorPathArray,
        },
        error: error as Error,
      })
    } catch (logError) {
      // Silent fail for error logging
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to serve file', 
        details: error.message,
        errorCode: error.code || 'FILE_SERVE_ERROR',
        errorType: error.name,
      },
      { status: 500 }
    )
  }
}

