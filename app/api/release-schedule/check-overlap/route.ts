import { NextRequest, NextResponse } from 'next/server'
import { getCatalog } from '@/lib/storage'
import { formatLocalDateString, parseLocalDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')

    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    }

    const catalog = getCatalog()
    const requestedDate = parseLocalDate(date)
    if (!requestedDate) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    const requestedDateStr = formatLocalDateString(requestedDate)

    // Check for conflicts (same date)
    const conflicts = catalog.filter(item => {
      if (item.releaseDate) {
        const releaseDate = parseLocalDate(item.releaseDate)
        if (releaseDate) {
          return formatLocalDateString(releaseDate) === requestedDateStr
        }
      }
      if (item.releaseDateRequested) {
        const requested = parseLocalDate(item.releaseDateRequested)
        if (requested) {
          return formatLocalDateString(requested) === requestedDateStr
        }
      }
      return false
    })

    if (conflicts.length > 0) {
      const conflictingRelease = conflicts[0]
      return NextResponse.json({
        hasOverlap: true,
        conflictingRelease: `${conflictingRelease.song} by ${conflictingRelease.artist}`,
        conflictingReleases: conflicts.map(c => `${c.song} by ${c.artist}`),
      })
    }

    return NextResponse.json({
      hasOverlap: false,
    })
  } catch (error: any) {
    console.error('Check overlap error:', error)
    return NextResponse.json(
      { error: 'Failed to check overlap', details: error.message },
      { status: 500 }
    )
  }
}

