import { NextRequest, NextResponse } from 'next/server'
import { getBeatById, updateBeat } from '@/lib/storage'
import { readFile } from 'fs/promises'
import path from 'path'

import { getUploadPath } from '@/lib/uploadConfig'
const BEATS_DIR = getUploadPath('beats')

/**
 * Analyze audio file to detect BPM and key
 * Simplified: Quick metadata read with short timeout
 */
async function analyzeAudio(filePath: string): Promise<{ bpm?: number; key?: string }> {
  try {
    const mm = await import('music-metadata')
    
    // Use parseFile with skipCovers for speed - most metadata is in header anyway
    const metadata = await mm.parseFile(filePath, {
      skipCovers: true, // Skip cover art - can be very large and slow
    })
    
    console.log('[analyze] Metadata found:', {
      bpm: metadata.common.bpm,
      key: metadata.common.key,
      title: metadata.common.title,
    })
    
    // Extract BPM - can be in different formats
    let bpm: number | undefined
    if (metadata.common.bpm) {
      if (Array.isArray(metadata.common.bpm)) {
        bpm = typeof metadata.common.bpm[0] === 'number' ? metadata.common.bpm[0] : undefined
      } else if (typeof metadata.common.bpm === 'number') {
        bpm = metadata.common.bpm
      } else if (typeof metadata.common.bpm === 'string') {
        const parsed = parseFloat(metadata.common.bpm)
        if (!isNaN(parsed)) bpm = parsed
      }
    }
    
    // Extract key - can be in different formats
    let key: string | undefined
    if (metadata.common.key) {
      if (Array.isArray(metadata.common.key)) {
        key = typeof metadata.common.key[0] === 'string' ? metadata.common.key[0] : undefined
      } else if (typeof metadata.common.key === 'string') {
        key = metadata.common.key
      }
    }
    
    // Round BPM to nearest integer
    const result: { bpm?: number; key?: string } = {}
    if (bpm !== undefined && !isNaN(bpm) && bpm > 0 && bpm < 300) {
      result.bpm = Math.round(bpm)
      console.log('[analyze] Found BPM:', result.bpm)
    }
    if (key && key.trim()) {
      result.key = key.trim()
      console.log('[analyze] Found Key:', result.key)
    }
    
    return result
    
  } catch (error: any) {
    console.error('[analyze] Error analyzing audio:', error)
    // If it's a file read error, that's expected for some files
    if (error.code === 'ENOENT') {
      console.error('[analyze] File not found:', filePath)
    }
    return {}
  }
}

/**
 * Analyze beat audio for BPM/key.
 * Used internally by POST and can be called from upload-pack route via lib.
 */
async function analyzeBeatAudio(beatId: string): Promise<{ bpm?: number; key?: string }> {
  const beat = getBeatById(beatId)
  if (!beat || !beat.originalFileUrl) {
    throw new Error('Beat not found or has no audio file')
  }

  // Extract file path from URL
  const urlParts = beat.originalFileUrl.replace('/api/files/beats/', '').split('/')
  if (urlParts.length < 2) {
    throw new Error('Invalid file URL format')
  }

  const packName = decodeURIComponent(urlParts[0])
  const fileName = decodeURIComponent(urlParts[1])
  const filePath = path.join(BEATS_DIR, packName, fileName)

  // Check if file exists (quick check)
  try {
    await readFile(filePath)
  } catch (error) {
    throw new Error('Audio file not found on server')
  }

  // Analyze with a very short timeout (1.5 seconds max)
  // If it takes longer, just skip and mark as analyzed so user can enter manually
  let analysis: { bpm?: number; key?: string } = {}
  try {
    const analysisPromise = analyzeAudio(filePath)
    const timeoutPromise = new Promise<{ bpm?: number; key?: string }>((resolve) => {
      setTimeout(() => {
        console.log('[analyze] Timeout after 1.5s - skipping analysis, user can enter manually')
        resolve({}) // Return empty - user can enter manually
      }, 1500) // 1.5 second timeout - very fast
    })
    
    analysis = await Promise.race([analysisPromise, timeoutPromise])
  } catch (error: any) {
    // If analysis fails, just continue - user can enter manually
    console.log('[analyze] Analysis failed, continuing:', error.message)
    analysis = {}
  }

  // Update beat with analysis results
  // Only update if we found values (don't overwrite manual entries with null)
  const updates: any = {}
  if (analysis.bpm !== undefined && analysis.bpm !== null) {
    updates.bpm = analysis.bpm
    updates.bpmAnalyzed = true
  } else {
    // Mark as analyzed even if no BPM found
    updates.bpmAnalyzed = true
  }
  
  if (analysis.key !== undefined && analysis.key !== null && analysis.key.trim()) {
    updates.key = analysis.key
    updates.keyAnalyzed = true
  } else {
    // Mark as analyzed even if no key found
    updates.keyAnalyzed = true
  }

  updateBeat(beatId, updates)
  return analysis
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const beatId = searchParams.get('beatId')

    if (!beatId) {
      return NextResponse.json({ error: 'Beat ID is required' }, { status: 400 })
    }

    const analysis = await analyzeBeatAudio(beatId)

    return NextResponse.json({
      success: true,
      bpm: analysis.bpm,
      key: analysis.key,
      message: analysis.bpm || analysis.key 
        ? `Analysis complete! ${analysis.bpm ? `BPM: ${analysis.bpm}` : ''} ${analysis.key ? `Key: ${analysis.key}` : ''}`.trim()
        : 'Analysis completed but no BPM/key found in file metadata. You can manually enter these values.',
    })
  } catch (error: any) {
    console.error('[analyze] Error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze beat', details: error.message },
      { status: 500 }
    )
  }
}
