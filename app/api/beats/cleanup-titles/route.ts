import { NextRequest, NextResponse } from 'next/server'
import { getBeats, updateBeat, getUsers, findOrCreateProducer } from '@/lib/storage'
import { parseBeatFilename } from '@/lib/beatParser'
import { logActivity } from '@/lib/activityLog'

export const dynamic = 'force-dynamic'

/**
 * POST /api/beats/cleanup-titles
 * Clean up existing beat titles by re-parsing them and extracting BPM, key, and producer names
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, dryRun = false } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Verify authentication and permissions
    const { getUserById } = await import('@/lib/storage')
    const { logError, ErrorCode } = await import('@/lib/errorLogger')

    const user = getUserById(userId)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can cleanup beats' }, { status: 403 })
    }

    const beats = getBeats()
    const results = {
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: [] as Array<{ id: string; name: string; error: string }>,
      changes: [] as Array<{ id: string; oldName: string; newName: string; extracted: { bpm?: number; key?: string; producers: string[] } }>,
    }

    for (const beat of beats) {
      try {
        results.processed++

        // Re-parse the beat name to extract metadata
        const parsed = parseBeatFilename(beat.name + '.wav') // Add extension for parsing

        // Check if anything needs updating
        const needsUpdate = 
          parsed.name !== beat.name ||
          (parsed.bpm && parsed.bpm !== beat.bpm) ||
          (parsed.key && parsed.key !== beat.key) ||
          (parsed.producers.length > 0 && beat.producerIds.length === 0)

        if (!needsUpdate && beat.bpm && beat.key && beat.producerIds.length > 0) {
          results.skipped++
          continue
        }

        if (dryRun) {
          // Just track what would change
          const changes: any = {}
          if (parsed.name !== beat.name) changes.name = { old: beat.name, new: parsed.name }
          if (parsed.bpm && parsed.bpm !== beat.bpm) changes.bpm = { old: beat.bpm, new: parsed.bpm }
          if (parsed.key && parsed.key !== beat.key) changes.key = { old: beat.key, new: parsed.key }
          if (parsed.producers.length > 0) changes.producers = { extracted: parsed.producers }

          results.changes.push({
            id: beat.id,
            oldName: beat.name,
            newName: parsed.name,
            extracted: {
              bpm: parsed.bpm,
              key: parsed.key,
              producers: parsed.producers,
            },
          })
          continue
        }

        // Prepare updates
        const updates: any = {}

        // Update name if it changed
        if (parsed.name !== beat.name && parsed.name !== 'Untitled Beat') {
          updates.name = parsed.name
        }

        // Update BPM if extracted and not already set
        if (parsed.bpm && !beat.bpm) {
          updates.bpm = parsed.bpm
        }

        // Update key if extracted and not already set
        if (parsed.key && !beat.key) {
          updates.key = parsed.key
        }

        // Update producers if extracted and beat has no producers
        if (parsed.producers.length > 0 && beat.producerIds.length === 0) {
          const producerIds: string[] = []
          for (const producerName of parsed.producers) {
            const producer = findOrCreateProducer(producerName)
            if (!producerIds.includes(producer.id)) {
              producerIds.push(producer.id)
            }
          }
          if (producerIds.length > 0) {
            updates.producerIds = producerIds
            updates.isIncomplete = false
            updates.canPublish = true
          }
        }

        // Apply updates if any
        if (Object.keys(updates).length > 0) {
          const success = updateBeat(beat.id, updates)
          if (success) {
            results.updated++
            results.changes.push({
              id: beat.id,
              oldName: beat.name,
              newName: updates.name || beat.name,
              extracted: {
                bpm: parsed.bpm,
                key: parsed.key,
                producers: parsed.producers,
              },
            })
          } else {
            results.errors.push({ id: beat.id, name: beat.name, error: 'Update failed' })
          }
        } else {
          results.skipped++
        }
      } catch (error: any) {
        results.errors.push({ id: beat.id, name: beat.name, error: error.message || 'Unknown error' })
      }
    }

    // Log activity
    if (!dryRun && results.updated > 0) {
      logActivity({
        action: 'Bulk beat title cleanup',
        user: user.name,
        userId: userId,
        details: {
          totalBeats: beats.length,
          processed: results.processed,
          updated: results.updated,
          skipped: results.skipped,
          errors: results.errors.length,
        },
        category: 'beats',
      })
    }

    return NextResponse.json({
      success: true,
      dryRun,
      results,
      message: dryRun
        ? `Would update ${results.changes.length} of ${results.processed} beats`
        : `Updated ${results.updated} of ${results.processed} beats`,
    })
  } catch (error: any) {
    console.error('[POST /api/beats/cleanup-titles] Error:', error)
    return NextResponse.json(
      { error: 'Failed to cleanup beat titles', details: error.message },
      { status: 500 }
    )
  }
}
