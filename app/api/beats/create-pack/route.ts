import { NextRequest, NextResponse } from 'next/server'
import { getUsers } from '@/lib/storage'
import { addBeatPack, getBeats, findOrCreateProducer } from '@/lib/storage'
import { extractProducersFromPackTitle } from '@/lib/beatParser'
import { logActivity } from '@/lib/activityLog'

export const runtime = 'nodejs'

/**
 * Create a beat pack after individual files have been uploaded
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, beatIds, userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Check user permissions
    const users = getUsers()
    const user = users.find(u => u.id === userId)
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can create packs' },
        { status: 403 }
      )
    }

    if (!name || !beatIds || !Array.isArray(beatIds)) {
      return NextResponse.json(
        { error: 'Pack name and beat IDs are required' },
        { status: 400 }
      )
    }

    // Extract producers from pack title
    const { producers: packTitleProducers } = extractProducersFromPackTitle(name)
    
    // Get producer IDs from beats
    const beats = getBeats()
    const packProducerIds = new Set<string>()
    
    beatIds.forEach(beatId => {
      const beat = beats.find(b => b.id === beatId)
      if (beat) {
        beat.producerIds.forEach(id => packProducerIds.add(id))
      }
    })

    // Add pack title producers
    packTitleProducers.forEach(producerName => {
      const producer = findOrCreateProducer(producerName)
      packProducerIds.add(producer.id)
    })

    // Create pack
    const pack = addBeatPack({
      name,
      producerIds: Array.from(packProducerIds),
      uploadedAt: new Date().toISOString(),
      uploadedBy: userId,
      beatIds: beatIds,
    })

    // Log activity
    logActivity({
      action: 'Beat pack created',
      user: user.name,
      userId: userId,
      details: {
        packId: pack.id,
        packName: name,
        beatCount: beatIds.length,
        packProducers: packTitleProducers,
      },
      category: 'beats',
    })

    return NextResponse.json({
      success: true,
      pack: {
        id: pack.id,
        name: pack.name,
        beatCount: beatIds.length,
      },
    })
  } catch (error: any) {
    console.error('[create-pack] Error:', error)
    return NextResponse.json(
      { error: 'Failed to create pack', details: error.message },
      { status: 500 }
    )
  }
}
