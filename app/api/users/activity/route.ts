import { NextRequest, NextResponse } from 'next/server'
import { getArtistUserMappings } from '@/lib/storage'

// GET /api/users/activity - Get artist user mappings
export async function GET(request: NextRequest) {
  try {
    const mappings = getArtistUserMappings()
    return NextResponse.json({ success: true, mappings })
  } catch (error: any) {
    console.error('Get artist user mappings error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch artist user mappings', details: error.message },
      { status: 500 }
    )
  }
}
