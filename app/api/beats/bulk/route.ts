import { NextRequest, NextResponse } from 'next/server'
import { getUsers, updateBeat, deleteBeat, getBeatById, findOrCreateProducer } from '@/lib/storage'
import { logActivity } from '@/lib/activityLog'

export const dynamic = 'force-dynamic'

/**
 * POST /api/beats/bulk
 * Bulk update or delete beats
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, beatIds, userId, updates } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    if (!beatIds || !Array.isArray(beatIds) || beatIds.length === 0) {
      return NextResponse.json({ error: 'Beat IDs array required' }, { status: 400 })
    }

    // Verify authentication and permissions
    const { getUserById } = await import('@/lib/storage')
    const { logError, ErrorCode } = await import('@/lib/errorLogger')

    const user = getUserById(userId)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can perform bulk operations' }, { status: 403 })
    }

    if (action === 'update') {
      if (!updates) {
        return NextResponse.json({ error: 'Updates object required for update action' }, { status: 400 })
      }

      const results = {
        success: [] as string[],
        failed: [] as Array<{ id: string; error: string }>,
      }

      for (const beatId of beatIds) {
        try {
          const beat = getBeatById(beatId)
          if (!beat) {
            results.failed.push({ id: beatId, error: 'Beat not found' })
            continue
          }

          const updateData: any = { ...updates }

          // Handle producer name updates - need to find/create producer and convert to IDs
          if (updates.producerNames && Array.isArray(updates.producerNames)) {
            const producerIds: string[] = []
            for (const producerName of updates.producerNames) {
              if (producerName && producerName.trim()) {
                const producer = findOrCreateProducer(producerName.trim())
                producerIds.push(producer.id)
              }
            }
            updateData.producerIds = producerIds
            delete updateData.producerNames
          }

          // Recalculate incomplete status if producerIds are being updated
          if (updateData.producerIds !== undefined) {
            updateData.isIncomplete = !updateData.producerIds || updateData.producerIds.length === 0
            updateData.canPublish = updateData.producerIds && updateData.producerIds.length > 0
          }

          const success = updateBeat(beatId, updateData)
          if (success) {
            results.success.push(beatId)
          } else {
            results.failed.push({ id: beatId, error: 'Update failed' })
          }
        } catch (error: any) {
          results.failed.push({ id: beatId, error: error.message || 'Unknown error' })
        }
      }

      // Log activity
      logActivity({
        action: 'Bulk beat update',
        user: user.name,
        userId: userId,
        details: {
          beatCount: beatIds.length,
          successful: results.success.length,
          failed: results.failed.length,
          updates: Object.keys(updates),
        },
        category: 'beats',
      })

      return NextResponse.json({
        success: true,
        results,
        message: `Updated ${results.success.length} of ${beatIds.length} beats`,
      })
    } else if (action === 'delete') {
      const results = {
        success: [] as string[],
        failed: [] as Array<{ id: string; error: string }>,
      }

      for (const beatId of beatIds) {
        try {
          const beat = getBeatById(beatId)
          if (!beat) {
            results.failed.push({ id: beatId, error: 'Beat not found' })
            continue
          }

          // Prevent deletion of exclusive sold beats
          if (beat.status === 'exclusive_sold') {
            results.failed.push({ id: beatId, error: 'Cannot delete exclusive sold beats' })
            continue
          }

          const success = deleteBeat(beatId)
          if (success) {
            results.success.push(beatId)
          } else {
            results.failed.push({ id: beatId, error: 'Delete failed' })
          }
        } catch (error: any) {
          results.failed.push({ id: beatId, error: error.message || 'Unknown error' })
        }
      }

      // Log activity
      logActivity({
        action: 'Bulk beat delete',
        user: user.name,
        userId: userId,
        details: {
          beatCount: beatIds.length,
          successful: results.success.length,
          failed: results.failed.length,
        },
        category: 'beats',
      })

      return NextResponse.json({
        success: true,
        results,
        message: `Deleted ${results.success.length} of ${beatIds.length} beats`,
      })
    } else {
      return NextResponse.json({ error: 'Invalid action. Use "update" or "delete"' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('[POST /api/beats/bulk] Error:', error)
    return NextResponse.json(
      { error: 'Failed to perform bulk operation', details: error.message },
      { status: 500 }
    )
  }
}
