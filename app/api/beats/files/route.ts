import { NextRequest, NextResponse } from 'next/server'
import { getBeatFiles, addBeatFile, deleteBeatFile, updateBeatFile } from '@/lib/storage'
import { logActivity } from '@/lib/activityLog'

/**
 * GET /api/beats/files?beatId=xxx
 * Get files for a beat (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const beatId = searchParams.get('beatId')
    const userRole = searchParams.get('userRole')
    
    // Only admins can see beat files
    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin only.' },
        { status: 403 }
      )
    }
    
    const files = getBeatFiles(beatId || undefined)
    return NextResponse.json({ success: true, files })
  } catch (error: any) {
    console.error('[GET /api/beats/files] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch beat files', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/beats/files
 * Add a file to a beat (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      beatId,
      fileName,
      fileType,
      fileUrl,
      fileSize,
      folderPath,
      isFolder,
      uploadedBy,
      userRole,
    } = body
    
    // Only admins can add beat files
    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin only.' },
        { status: 403 }
      )
    }
    
    if (!beatId || !fileName) {
      return NextResponse.json(
        { error: 'Beat ID and file name are required' },
        { status: 400 }
      )
    }
    
    // For folders, fileUrl is optional
    if (!isFolder && !fileUrl) {
      return NextResponse.json(
        { error: 'File URL is required for non-folder files' },
        { status: 400 }
      )
    }
    
    const file = addBeatFile({
      beatId,
      fileName,
      fileType: fileType || 'other',
      fileUrl: isFolder ? undefined : fileUrl,
      fileSize: isFolder ? undefined : fileSize,
      folderPath: folderPath || undefined,
      isFolder: isFolder || false,
      uploadedBy: uploadedBy || 'Admin',
    })
    
    // Log activity
    logActivity({
      action: 'Beat file added',
      user: uploadedBy || 'Admin',
      details: {
        beatId,
        fileName,
        fileType,
      },
      category: 'beats',
    })
    
    return NextResponse.json({ success: true, file })
  } catch (error: any) {
    console.error('[POST /api/beats/files] Error:', error)
    return NextResponse.json(
      { error: 'Failed to add beat file', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/beats/files?id=xxx&userRole=admin
 * Delete a beat file (admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const userRole = searchParams.get('userRole')
    
    // Only admins can delete beat files
    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin only.' },
        { status: 403 }
      )
    }
    
    if (!id) {
      return NextResponse.json({ error: 'File ID required' }, { status: 400 })
    }
    
    const success = deleteBeatFile(id)
    
    if (!success) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[DELETE /api/beats/files] Error:', error)
    return NextResponse.json(
      { error: 'Failed to delete beat file', details: error.message },
      { status: 500 }
    )
  }
}







