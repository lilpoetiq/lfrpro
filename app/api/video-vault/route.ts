import { NextRequest, NextResponse } from 'next/server'
import { getVideoVaultItems, addVideoVaultItem } from '@/lib/storage'

export async function GET() {
  try {
    const items = getVideoVaultItems()
    return NextResponse.json({ success: true, items })
  } catch (error: any) {
    console.error('Get video vault error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch video vault', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, videoUrl, caption, description } = body

    if (!title || !videoUrl || !caption) {
      return NextResponse.json(
        { error: 'Title, video URL, and caption are required' },
        { status: 400 }
      )
    }

    const item = addVideoVaultItem({
      title: String(title).trim(),
      videoUrl: String(videoUrl).trim(),
      caption: String(caption).trim(),
      description: description ? String(description).trim() : undefined,
    })

    return NextResponse.json({ success: true, item })
  } catch (error: any) {
    console.error('Add video vault item error:', error)
    return NextResponse.json(
      { error: 'Failed to add video', details: error.message },
      { status: 500 }
    )
  }
}
