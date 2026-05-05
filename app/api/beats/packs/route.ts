import { NextRequest, NextResponse } from 'next/server'
import { getBeatPacks } from '@/lib/storage'

export async function GET(request: NextRequest) {
  try {
    const packs = getBeatPacks()
    return NextResponse.json({
      success: true,
      packs,
    })
  } catch (error: any) {
    console.error('[GET /api/beats/packs] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch beat packs', details: error.message },
      { status: 500 }
    )
  }
}







