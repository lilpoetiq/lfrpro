import { NextRequest, NextResponse } from 'next/server'
import { deleteUpload } from '@/lib/storage'

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const uploadId = searchParams.get('id')

    if (!uploadId) {
      return NextResponse.json({ error: 'Upload ID required' }, { status: 400 })
    }

    const success = deleteUpload(uploadId)

    if (!success) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: 'Upload deleted successfully' })
  } catch (error: any) {
    console.error('Delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete upload', details: error.message },
      { status: 500 }
    )
  }
}
