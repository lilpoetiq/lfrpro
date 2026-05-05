import { NextRequest, NextResponse } from 'next/server'
import { getBeatById, updateBeat } from '@/lib/storage'
import { getProducers } from '@/lib/storage'

/**
 * GET /api/beats/[beatId]
 * Get a single beat by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ beatId: string }> }
) {
  try {
    const { beatId } = await params
    const beat = getBeatById(beatId)
    
    if (!beat) {
      return NextResponse.json({ error: 'Beat not found' }, { status: 404 })
    }
    
    // Enrich with producer names
    const producers = getProducers()
    const enrichedBeat = {
      ...beat,
      producers: beat.producerIds.map(id => {
        const producer = producers.find(p => p.id === id)
        return producer ? { id: producer.id, name: producer.name } : null
      }).filter(Boolean),
    }
    
    return NextResponse.json({
      success: true,
      beat: enrichedBeat,
    })
  } catch (error: any) {
    console.error('[GET /api/beats/[beatId]] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch beat', details: error.message },
      { status: 500 }
    )
  }
}







