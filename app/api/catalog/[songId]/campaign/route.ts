import { NextRequest, NextResponse } from 'next/server'
import { getCatalog, updateCatalogItem, getUsers, defaultCampaignEndDate } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  try {
    const { songId } = await params
    const catalog = getCatalog()
    const song = catalog.find((c: any) => c.id === songId)
    if (!song) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 })
    }
    return NextResponse.json({
      success: true,
      song: {
        ...song,
        campaignEndDate: song.campaignEndDate || (song.releaseDate ? defaultCampaignEndDate(song.releaseDate.split('T')[0]) : null),
      },
    })
  } catch (error: any) {
    console.error('Get campaign error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  try {
    const { songId } = await params
    const body = await request.json()
    const userId = body.userId
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }
    const users = getUsers()
    const user = users.find((u: any) => u.id === userId)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const isAdmin = user.role === 'admin'
    const isManager = user.role === 'manager'
    if (!isAdmin && !isManager) {
      return NextResponse.json({ error: 'Admin or manager required' }, { status: 403 })
    }

    const catalog = getCatalog()
    const song = catalog.find((c: any) => c.id === songId)
    if (!song) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 })
    }

    const updates: Record<string, any> = {}
    if (body.campaignEndDate !== undefined) updates.campaignEndDate = body.campaignEndDate || undefined
    if (body.campaignStatus !== undefined) updates.campaignStatus = body.campaignStatus
    if (body.campaignWins !== undefined) updates.campaignWins = body.campaignWins
    if (body.performanceMetrics !== undefined) updates.performanceMetrics = body.performanceMetrics
    if (body.pastContentLinks !== undefined) updates.pastContentLinks = body.pastContentLinks
    if (body.campaignScore !== undefined) updates.campaignScore = body.campaignScore
    if (body.campaignOutcome !== undefined) updates.campaignOutcome = body.campaignOutcome
    if (body.campaignSummary !== undefined) updates.campaignSummary = body.campaignSummary
    if (body.lessonsLearned !== undefined) updates.lessonsLearned = body.lessonsLearned
    if (body.strategyToRepeat !== undefined) updates.strategyToRepeat = body.strategyToRepeat
    if (body.strategyToAvoid !== undefined) updates.strategyToAvoid = body.strategyToAvoid
    if (body.blueprintReady !== undefined) updates.blueprintReady = body.blueprintReady

    const ok = updateCatalogItem(songId, updates)
    if (!ok) {
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    }

    const updated = getCatalog().find((c: any) => c.id === songId)
    return NextResponse.json({ success: true, song: updated })
  } catch (error: any) {
    console.error('Update campaign error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
