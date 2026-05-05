import { NextRequest, NextResponse } from 'next/server'
import {
  addBeatSelection,
  getBeatById,
  getProducers,
  updateBeat,
} from '@/lib/storage'
import { logActivity } from '@/lib/activityLog'
import { generateDownloadFingerprint } from '@/lib/audioMetadata'

/**
 * Create a beat selection for an artist
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      artistId,
      beatId,
      licenseType,
      sessionId,
    } = body

    if (!artistId || !beatId || !licenseType) {
      return NextResponse.json(
        { error: 'Artist ID, Beat ID, and License Type are required' },
        { status: 400 }
      )
    }

    const beat = getBeatById(beatId)
    if (!beat) {
      return NextResponse.json({ error: 'Beat not found' }, { status: 404 })
    }

    // Check if beat is available
    if (beat.status === 'exclusive_sold') {
      return NextResponse.json(
        { error: 'This beat has already been sold exclusively' },
        { status: 400 }
      )
    }

    // Get price for license type
    let price = 0
    if (licenseType === 'lease' && beat.leasePrice) {
      price = beat.leasePrice
    } else if (licenseType === 'premium_lease' && beat.premiumLeasePrice) {
      price = beat.premiumLeasePrice
    } else if (licenseType === 'exclusive' && beat.exclusivePrice) {
      price = beat.exclusivePrice
    } else {
      return NextResponse.json(
        { error: `Price not set for ${licenseType} license` },
        { status: 400 }
      )
    }

    // Calculate producer payouts
    const producers = getProducers()
    const producerPayouts = beat.producerIds.map(producerId => {
      const producer = producers.find(p => p.id === producerId)
      if (!producer) return null

      const producerSplit = producer.defaultRoyaltySplit || 50
      const producerAmount = (price * producerSplit) / 100

      return {
        producerId: producer.id,
        producerName: producer.name,
        amount: producerAmount,
        percentage: producerSplit,
      }
    }).filter(Boolean) as Array<{
      producerId: string
      producerName: string
      amount: number
      percentage: number
    }>

    const producerPayoutsTotal = producerPayouts.reduce((sum, p) => sum + p.amount, 0)
    const labelCut = price - producerPayoutsTotal

    // Create selection
    const selection = addBeatSelection({
      artistId,
      beatId,
      licenseType: licenseType as 'lease' | 'premium_lease' | 'exclusive',
      selectedAt: new Date().toISOString(),
      sessionId: sessionId || `session_${Date.now()}`,
      cost: price,
      producerPayouts,
      labelCut,
      status: 'pending',
    })

    // If exclusive, mark beat as exclusive_sold
    if (licenseType === 'exclusive') {
      updateBeat(beatId, {
        status: 'exclusive_sold',
        selectedBy: [
          ...(beat.selectedBy || []),
          {
            artistId,
            selectedAt: new Date().toISOString(),
            licenseType: 'exclusive',
          },
        ],
      })
    }

    // Log activity
    logActivity({
      action: 'Beat selected',
      user: 'Artist',
      userId: artistId,
      details: {
        beatId,
        beatName: beat.name,
        licenseType,
        cost: price,
      },
      category: 'beats',
    })

    return NextResponse.json({
      success: true,
      selection,
    })
  } catch (error: any) {
    console.error('[POST /api/beats/select] Error:', error)
    return NextResponse.json(
      { error: 'Failed to create selection', details: error.message },
      { status: 500 }
    )
  }
}







