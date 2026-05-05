import { NextRequest, NextResponse } from 'next/server'
import {
  getBeatSelections,
  getBeats,
  getProducers,
} from '@/lib/storage'

/**
 * Calculate cost breakdown for selected beats
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const artistId = searchParams.get('artistId')
    const sessionId = searchParams.get('sessionId')

    if (!artistId && !sessionId) {
      return NextResponse.json(
        { error: 'Artist ID or Session ID required' },
        { status: 400 }
      )
    }

    // Get selections
    const selections = getBeatSelections(artistId || undefined, sessionId || undefined)
    
    // Filter to pending/approved selections only
    const activeSelections = selections.filter(
      s => s.status === 'pending' || s.status === 'approved'
    )

    // Get all beats and producers
    const beats = getBeats()
    const producers = getProducers()

    // Calculate totals
    let totalCost = 0
    const producerPayouts = new Map<string, { name: string; amount: number }>()
    let labelCut = 0

    activeSelections.forEach(selection => {
      const beat = beats.find(b => b.id === selection.beatId)
      if (!beat) return

      totalCost += selection.cost || 0

      // Calculate producer payouts
      selection.producerPayouts?.forEach(payout => {
        const current = producerPayouts.get(payout.producerId) || {
          name: payout.producerName || 'Unknown',
          amount: 0,
        }
        current.amount += payout.amount
        producerPayouts.set(payout.producerId, current)
      })

      labelCut += selection.labelCut || 0
    })

    // Convert producer payouts map to array
    const producerPayoutsArray = Array.from(producerPayouts.values())

    return NextResponse.json({
      success: true,
      summary: {
        totalCost,
        labelCut,
        producerPayoutsTotal: producerPayoutsArray.reduce((sum, p) => sum + p.amount, 0),
        selectionCount: activeSelections.length,
      },
      producerPayouts: producerPayoutsArray,
      selections: activeSelections.map(s => {
        const beat = beats.find(b => b.id === s.beatId)
        return {
          ...s,
          beatName: beat?.name || 'Unknown',
        }
      }),
    })
  } catch (error: any) {
    console.error('[GET /api/beats/cost-tracking] Error:', error)
    return NextResponse.json(
      { error: 'Failed to calculate costs', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Calculate cost for a selection of beats (before creating selection records)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { beats: beatSelections } = body // Array of { beatId, licenseType }

    if (!beatSelections || !Array.isArray(beatSelections)) {
      return NextResponse.json(
        { error: 'Beats array required' },
        { status: 400 }
      )
    }

    const beats = getBeats()
    const producers = getProducers()

    let totalCost = 0
    const producerPayouts = new Map<string, { name: string; amount: number; percentage: number }>()
    const labelCutPercentage = 50 // Default 50% label cut
    let labelCut = 0

    beatSelections.forEach(({ beatId, licenseType }: { beatId: string; licenseType: string }) => {
      const beat = beats.find(b => b.id === beatId)
      if (!beat) return

      // Get price for license type
      let price = 0
      if (licenseType === 'lease' && beat.leasePrice) {
        price = beat.leasePrice
      } else if (licenseType === 'premium_lease' && beat.premiumLeasePrice) {
        price = beat.premiumLeasePrice
      } else if (licenseType === 'exclusive' && beat.exclusivePrice) {
        price = beat.exclusivePrice
      }

      totalCost += price

      // Calculate producer payouts
      beat.producerIds.forEach(producerId => {
        const producer = producers.find(p => p.id === producerId)
        if (!producer) return

        // Use producer's default royalty split or 50%
        const producerSplit = producer.defaultRoyaltySplit || 50
        const producerAmount = (price * producerSplit) / 100
        const labelAmount = price - producerAmount

        const current = producerPayouts.get(producerId) || {
          name: producer.name,
          amount: 0,
          percentage: producerSplit,
        }
        current.amount += producerAmount
        producerPayouts.set(producerId, current)

        labelCut += labelAmount
      })
    })

    const producerPayoutsArray = Array.from(producerPayouts.values())

    return NextResponse.json({
      success: true,
      summary: {
        totalCost,
        labelCut,
        producerPayoutsTotal: producerPayoutsArray.reduce((sum, p) => sum + p.amount, 0),
        selectionCount: beatSelections.length,
      },
      producerPayouts: producerPayoutsArray,
      breakdown: {
        labelCutPercentage,
        totalCost,
        labelCut,
        producerPayoutsTotal: producerPayoutsArray.reduce((sum, p) => sum + p.amount, 0),
      },
    })
  } catch (error: any) {
    console.error('[POST /api/beats/cost-tracking] Error:', error)
    return NextResponse.json(
      { error: 'Failed to calculate costs', details: error.message },
      { status: 500 }
    )
  }
}



