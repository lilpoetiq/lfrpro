import { NextRequest, NextResponse } from 'next/server'
import { getProducers, updateProducer } from '@/lib/storage'

export async function GET(request: NextRequest) {
  try {
    const producers = getProducers()
    return NextResponse.json({
      success: true,
      producers,
    })
  } catch (error: any) {
    console.error('[GET /api/producers] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch producers', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, defaultRoyaltySplit } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Producer name is required' }, { status: 400 })
    }

    const { findOrCreateProducer } = await import('@/lib/storage')
    const producer = findOrCreateProducer(name.trim())

    // Update royalty split if provided
    if (defaultRoyaltySplit !== undefined) {
      const { updateProducer } = await import('@/lib/storage')
      updateProducer(producer.id, { defaultRoyaltySplit })
      producer.defaultRoyaltySplit = defaultRoyaltySplit
    }

    return NextResponse.json({
      success: true,
      producer,
    })
  } catch (error: any) {
    console.error('[POST /api/producers] Error:', error)
    return NextResponse.json(
      { error: 'Failed to create producer', details: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Producer ID required' }, { status: 400 })
    }

    const success = updateProducer(id, updates)

    if (!success) {
      return NextResponse.json({ error: 'Producer not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[PUT /api/producers] Error:', error)
    return NextResponse.json(
      { error: 'Failed to update producer', details: error.message },
      { status: 500 }
    )
  }
}







