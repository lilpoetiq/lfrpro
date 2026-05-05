import { NextResponse } from 'next/server'
import { getRecentChanges } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const changes = getRecentChanges(100)
    return NextResponse.json({ changes })
  } catch (error: any) {
    console.error('[GET /api/changes] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch changes', details: error.message },
      { status: 500 }
    )
  }
}
