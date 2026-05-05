import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'
import { getUsers } from '@/lib/storage'
import { getUploadPath } from '@/lib/uploadConfig'

const BEAT_FILES_DIR = getUploadPath('beat-files')

/**
 * Serve beat files (admin only)
 * GET /api/files/beat-files/[...path]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params
    
    // Check if user is admin (from query param or header)
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    // Verify admin access
    if (userId) {
      const users = getUsers()
      const user = users.find(u => u.id === userId)
      if (!user || user.role !== 'admin') {
        return NextResponse.json(
          { error: 'Access denied. Admin only.' },
          { status: 403 }
        )
      }
    }
    
    const pathArray = resolvedParams.path || []
    const filePath = path.join(BEAT_FILES_DIR, ...pathArray)
    
    // Security: ensure path is within BEAT_FILES_DIR
    const normalizedPath = path.normalize(filePath)
    if (!normalizedPath.startsWith(BEAT_FILES_DIR)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }
    
    if (!existsSync(normalizedPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    
    const fileBuffer = await readFile(normalizedPath)
    const ext = path.extname(normalizedPath).toLowerCase()
    
    // Set appropriate content type
    let contentType = 'application/octet-stream'
    if (ext === '.mp3') contentType = 'audio/mpeg'
    if (ext === '.wav') contentType = 'audio/wav'
    if (ext === '.logicx' || ext === '.logic') contentType = 'application/x-logic-project'
    if (ext === '.zip') contentType = 'application/zip'
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error: any) {
    console.error('[GET /api/files/beat-files] Error:', error)
    return NextResponse.json(
      { error: 'Failed to serve file', details: error.message },
      { status: 500 }
    )
  }
}







