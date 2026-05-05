import { NextRequest, NextResponse } from 'next/server'
import {
  getBeats,
  getBeatById,
  addBeat,
  updateBeat,
  deleteBeat,
  getProducers,
} from '@/lib/storage'
import { logActivity } from '@/lib/activityLog'

/**
 * GET /api/beats
 * Get all beats with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const status = searchParams.get('status') as 'available' | 'reserved' | 'exclusive_sold' | null
    const producerId = searchParams.get('producerId') || undefined
    const genre = searchParams.get('genre') || undefined
    const bpm = searchParams.get('bpm') ? parseInt(searchParams.get('bpm')!, 10) : undefined
    const packId = searchParams.get('packId') || undefined
    const availableOnly = searchParams.get('availableOnly') === 'true'
    
    const filters: any = {}
    if (status) filters.status = status
    if (producerId) filters.producerId = producerId
    if (genre) filters.genre = genre
    if (bpm) filters.bpm = bpm
    if (packId) filters.packId = packId
    if (availableOnly) filters.availableOnly = true
    
    const beats = getBeats(filters)
    const producers = getProducers()
    
    // Enrich beats with producer names
    const enrichedBeats = beats.map(beat => ({
      ...beat,
      producers: beat.producerIds.map(id => {
        const producer = producers.find(p => p.id === id)
        return producer ? { id: producer.id, name: producer.name } : null
      }).filter(Boolean),
    }))
    
    return NextResponse.json({
      success: true,
      beats: enrichedBeats,
      count: enrichedBeats.length,
    })
  } catch (error: any) {
    console.error('[GET /api/beats] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch beats', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/beats
 * Create a new beat (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      bpm,
      producerIds,
      packId,
      packName,
      status,
      genre,
      mood,
      leasePrice,
      premiumLeasePrice,
      exclusivePrice,
      originalFileUrl,
      previewFileUrl,
      tags,
      userId,
      userRole,
    } = body
    
    // Check permissions
    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can create beats' },
        { status: 403 }
      )
    }
    
    if (!name || !originalFileUrl) {
      return NextResponse.json(
        { error: 'Beat name and file URL are required' },
        { status: 400 }
      )
    }
    
    // Validate producer IDs exist
    if (producerIds && producerIds.length > 0) {
      const producers = getProducers()
      const invalidProducers = producerIds.filter(
        (id: string) => !producers.find(p => p.id === id)
      )
      if (invalidProducers.length > 0) {
        return NextResponse.json(
          { error: `Invalid producer IDs: ${invalidProducers.join(', ')}` },
          { status: 400 }
        )
      }
    }
    
    const beat = addBeat({
      name,
      bpm,
      producerIds: producerIds || [],
      packId,
      packName,
      status: status || 'available',
      genre,
      mood,
      leasePrice,
      premiumLeasePrice,
      exclusivePrice,
      originalFileUrl,
      previewFileUrl,
      owner: 'Legendary Fyre Records',
      copyright: '© Legendary Fyre Records',
      license: 'Licensed, not sold',
      contact: 'Distributed by Legendary Fyre Records',
      tags,
      isIncomplete: !producerIds || producerIds.length === 0,
      canPublish: producerIds && producerIds.length > 0,
    })
    
    // Log activity
    logActivity({
      action: 'Beat created',
      user: 'Admin',
      userId: userId,
      details: {
        beatId: beat.id,
        beatName: beat.name,
        producerIds: beat.producerIds,
      },
      category: 'beats',
    })
    
    return NextResponse.json({
      success: true,
      beat,
    })
  } catch (error: any) {
    console.error('[POST /api/beats] Error:', error)
    return NextResponse.json(
      { error: 'Failed to create beat', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/beats
 * Update a beat
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, userId, ...updates } = body
    
    if (!id) {
      return NextResponse.json({ error: 'Beat ID required' }, { status: 400 })
    }
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }
    
    // Verify authentication and permissions server-side
    const { getUserById } = await import('@/lib/storage')
    const { logError, ErrorCode } = await import('@/lib/errorLogger')
    
    const user = getUserById(userId)
    if (!user) {
      logError({
        errorCode: ErrorCode.AUTH_USER_NOT_FOUND,
        type: 'Beat Update',
        message: `User not found for beat update: ${userId}`,
        userId,
        endpoint: '/api/beats',
        method: 'PUT',
        severity: 'high',
      })
      return NextResponse.json({ error: 'User not found', errorCode: ErrorCode.AUTH_USER_NOT_FOUND }, { status: 404 })
    }
    
    // Check permissions - only admins can update beats (verify server-side)
    if (user.role !== 'admin') {
      logError({
        errorCode: ErrorCode.API_FORBIDDEN,
        type: 'Beat Update',
        message: `Non-admin user attempted to update beat: ${id}`,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        endpoint: '/api/beats',
        method: 'PUT',
        details: { beatId: id },
        severity: 'high',
      })
      return NextResponse.json(
        { error: 'Only admins can update beats', errorCode: ErrorCode.API_FORBIDDEN },
        { status: 403 }
      )
    }
    
    const beat = getBeatById(id)
    if (!beat) {
      return NextResponse.json({ error: 'Beat not found' }, { status: 404 })
    }
    
    // If status is being set to exclusive_sold, ensure it's removed from available beats
    if (updates.status === 'exclusive_sold') {
      // This will be handled by the selection system
    }
    
    // Recalculate incomplete status if producerIds are being updated
    if (updates.producerIds !== undefined) {
      updates.isIncomplete = !updates.producerIds || updates.producerIds.length === 0
      updates.canPublish = updates.producerIds && updates.producerIds.length > 0
    } else if (beat.producerIds) {
      // Ensure incomplete status matches current producerIds
      updates.isIncomplete = beat.producerIds.length === 0
      updates.canPublish = beat.producerIds.length > 0
    }
    
    const success = updateBeat(id, updates)
    
    if (!success) {
      return NextResponse.json({ error: 'Failed to update beat' }, { status: 500 })
    }
    
    // Log activity
    logActivity({
      action: 'Beat updated',
      user: 'Admin',
      userId: userId,
      details: {
        beatId: id,
        updates: Object.keys(updates),
      },
      category: 'beats',
    })
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[PUT /api/beats] Error:', error)
    return NextResponse.json(
      { error: 'Failed to update beat', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/beats
 * Delete a beat (admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const userId = searchParams.get('userId')
    const userRole = searchParams.get('userRole')
    
    if (!id) {
      return NextResponse.json({ error: 'Beat ID required' }, { status: 400 })
    }
    
    // Check permissions
    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can delete beats' },
        { status: 403 }
      )
    }
    
    const beat = getBeatById(id)
    if (!beat) {
      return NextResponse.json({ error: 'Beat not found' }, { status: 404 })
    }
    
    // Prevent deletion of exclusive sold beats
    if (beat.status === 'exclusive_sold') {
      return NextResponse.json(
        { error: 'Cannot delete exclusive sold beats' },
        { status: 400 }
      )
    }
    
    const success = deleteBeat(id)
    
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete beat' }, { status: 500 })
    }
    
    // Log activity
    logActivity({
      action: 'Beat deleted',
      user: 'Admin',
      userId: userId || undefined,
      details: {
        beatId: id,
        beatName: beat.name,
      },
      category: 'beats',
    })
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[DELETE /api/beats] Error:', error)
    return NextResponse.json(
      { error: 'Failed to delete beat', details: error.message },
      { status: 500 }
    )
  }
}

