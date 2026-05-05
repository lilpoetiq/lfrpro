import { NextRequest, NextResponse } from 'next/server'
import { getUploads } from '@/lib/storage'

export async function GET(request: NextRequest) {
  try {
    const uploads = getUploads()
    
    const formattedUploads = uploads.map(upload => ({
      id: upload.id,
      fileName: upload.fileName,
      uploadedAt: upload.uploadedAt,
      lastUpdated: upload.uploadedAt,
      rowCount: upload.rowCount,
    })).sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())

    return NextResponse.json({ success: true, uploads: formattedUploads })
  } catch (error: any) {
    console.error('Get uploads error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch uploads', details: error.message },
      { status: 500 }
    )
  }
}
