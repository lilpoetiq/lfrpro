import { NextRequest, NextResponse } from 'next/server'
import { mkdir, readdir, stat } from 'fs/promises'
import path from 'path'
import { getUsers } from '@/lib/storage'
import { logActivity } from '@/lib/activityLog'
import {
  addBeatPack,
  addBeat,
  findOrCreateProducer,
  getBeatPacks,
} from '@/lib/storage'
import { parseBeatFilename, validateParsedBeat, extractPackName, extractProducersFromPackTitle, cleanBeatNameFromPackProducers } from '@/lib/beatParser'
import { writeBeatMetadata } from '@/lib/audioMetadata'

import { getUploadPath } from '@/lib/uploadConfig'
import { writeUploadToDisk } from '@/lib/writeUploadToDisk'
const BEATS_DIR = getUploadPath('beats')
const PREVIEWS_DIR = getUploadPath('beats', 'previews')

// Configure route for handling large file uploads
export const runtime = 'nodejs'
export const maxDuration = 600 // 10 minutes for large pack uploads

async function ensureDirectories() {
  await mkdir(BEATS_DIR, { recursive: true })
  await mkdir(PREVIEWS_DIR, { recursive: true })
}

/**
 * Process uploaded files from a beat pack folder
 */
export async function POST(request: NextRequest) {
  const uploadStartTime = Date.now()
  console.log('[DEBUG] Upload started at', uploadStartTime)
  try {
    await ensureDirectories()

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const formDataTime = Date.now() - uploadStartTime
    console.log('[DEBUG] FormData parsed:', { fileCount: files.length, timeMs: formDataTime })
    let packName = formData.get('packName') as string
    const folderPath = formData.get('folderPath') as string || ''
    const userId = formData.get('userId') as string
    
    // If pack name not provided, try to extract from folder upload
    if (!packName && files.length > 0) {
      const firstFile = files[0] as any
      if (firstFile.webkitRelativePath) {
        const folderName = firstFile.webkitRelativePath.split('/')[0]
        packName = folderName
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Check user permissions
    const users = getUsers()
    const user = users.find(u => u.id === userId)
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can upload beat packs' },
        { status: 403 }
      )
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    // Extract pack name from folder upload or provided name
    let finalPackName = packName
    if (!finalPackName && files.length > 0) {
      const firstFile = files[0] as any
      if (firstFile.webkitRelativePath) {
        // Extract folder name from webkitRelativePath (e.g., "FolderName/file.wav" -> "FolderName")
        const folderName = firstFile.webkitRelativePath.split('/')[0]
        finalPackName = folderName
      }
    }
    finalPackName = finalPackName || extractPackName(folderPath) || 'Untitled Pack'

    // Extract producers from pack title (e.g., "ProducerName - Pack Name" or "Pack Name by ProducerName")
    const { producers: packTitleProducers, cleanPackName } = extractProducersFromPackTitle(finalPackName)
    const finalCleanPackName = cleanPackName || finalPackName

    // Create or find producers from pack title
    const packTitleProducerIds: string[] = []
    for (const producerName of packTitleProducers) {
      const producer = findOrCreateProducer(producerName)
      packTitleProducerIds.push(producer.id)
    }

    // Sanitize pack name for directory (consistent with URL encoding)
    const sanitizedPackName = finalCleanPackName.replace(/[^a-zA-Z0-9._-]/g, '_')
    
    // Create pack directory
    const packDir = path.join(BEATS_DIR, sanitizedPackName)
    await mkdir(packDir, { recursive: true })

    const processedBeats: Array<{
      id: string
      name: string
      bpm?: number
      producers: string[]
      isIncomplete: boolean
      fileName: string
    }> = []

    const errors: Array<{ fileName: string; error: string }> = []
    const packProducerIds = new Set<string>()
    
    // Add pack title producers to the set
    packTitleProducerIds.forEach(id => packProducerIds.add(id))

    // Process files in parallel batches for faster upload
    const BATCH_SIZE = 10 // Process 10 files at a time
    
    const processFile = async (file: File): Promise<void> => {
      const fileStartTime = Date.now()
      try {
        // Validate file type
        const ext = path.extname(file.name).toLowerCase()
        if (!['.wav', '.mp3'].includes(ext)) {
          errors.push({
            fileName: file.name,
            error: `Invalid file type: ${ext}. Only WAV and MP3 are allowed.`,
          })
          return
        }

        // Parse filename
        const parsed = parseBeatFilename(file.name)
        const validation = validateParsedBeat(parsed)

        // Create or find producers from filename
        const producerIds: string[] = []
        if (parsed.producers.length > 0) {
          for (const producerName of parsed.producers) {
            const producer = findOrCreateProducer(producerName)
            producerIds.push(producer.id)
          }
        }

        // Add pack title producers if not already in the list
        packTitleProducerIds.forEach(id => {
          if (!producerIds.includes(id)) {
            producerIds.push(id)
          }
        })

        // Clean beat name by removing pack producer names
        let cleanedBeatName = parsed.name
        if (packTitleProducers.length > 0) {
          cleanedBeatName = cleanBeatNameFromPackProducers(parsed.name, packTitleProducers)
        }

        // Combine producers from filename and pack title
        const allProducerNames = Array.from(new Set([
          ...parsed.producers,
          ...packTitleProducers
        ]))

        const { getReadableFileName } = await import('@/lib/fileNaming')
        const producerLabel = allProducerNames[0] || finalCleanPackName
        const fileName = getReadableFileName({
          baseName: `${producerLabel}_${cleanedBeatName}`,
          extension: ext,
          directory: packDir,
        })
        const filePath = path.join(packDir, fileName)

        const diskStart = Date.now()
        await writeUploadToDisk(file, filePath)
        console.log(
          `[DEBUG] ${file.name}: stream write ${Date.now() - diskStart}ms (${(file.size / 1024 / 1024).toFixed(2)}MB)`
        )

        // Write metadata to file (truly non-blocking - don't wait for it)
        // This happens in the background and doesn't block the upload
        setImmediate(() => {
          const metadataStart = Date.now()
          writeBeatMetadata(filePath, {
            owner: 'Legendary Fyre Records',
            copyright: '© Legendary Fyre Records',
            license: 'Licensed, not sold',
            contact: 'Distributed by Legendary Fyre Records',
            producer: allProducerNames.join(' & ') || 'Unknown',
            producers: allProducerNames,
            title: cleanedBeatName,
            // BPM will be added after analysis
          }).then(() => {
            const metadataTime = Date.now() - metadataStart
            console.log(`[DEBUG] ${file.name}: Metadata written in ${metadataTime}ms (background)`)
          }).catch((metadataError) => {
            const metadataTime = Date.now() - metadataStart
            console.log(`[DEBUG] ${file.name}: Metadata write failed after ${metadataTime}ms:`, metadataError.message)
            console.error(`[upload-pack] Error writing metadata for ${file.name}:`, metadataError)
            // Continue even if metadata writing fails
          })
        })

        // Create file URL - use sanitized pack name to match directory structure
        const fileUrl = `/api/files/beats/${encodeURIComponent(sanitizedPackName)}/${encodeURIComponent(fileName)}`

        // Create beat record (BPM will be auto-detected later, not from filename)
        const addBeatStart = Date.now()
        const beat = addBeat({
          name: cleanedBeatName,
          bpm: parsed.bpm,
          key: parsed.key,
          producerIds,
          packName: finalCleanPackName,
          status: validation.isIncomplete ? 'available' : 'available',
          originalFileUrl: fileUrl,
          owner: 'Legendary Fyre Records',
          copyright: '© Legendary Fyre Records',
          license: 'Licensed, not sold',
          contact: 'Distributed by Legendary Fyre Records',
          isIncomplete: validation.isIncomplete,
          canPublish: !validation.isIncomplete,
        })
        producerIds.forEach(id => packProducerIds.add(id))

        processedBeats.push({
          id: beat.id,
          name: cleanedBeatName,
          producers: allProducerNames,
          isIncomplete: validation.isIncomplete,
          fileName: file.name,
        })
        const totalFileTime = Date.now() - fileStartTime
        console.log(`[DEBUG] ${file.name}: COMPLETE in ${totalFileTime}ms`)
      } catch (error: any) {
        errors.push({
          fileName: file.name,
          error: error.message || 'Unknown error',
        })
      }
    }

    // Process files in batches for optimal performance
    const batchProcessStart = Date.now()
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE)
      const batchStart = Date.now()
      await Promise.all(batch.map(processFile))
    }

    // Create beat pack record
    const pack = addBeatPack({
      name: finalCleanPackName,
      producerIds: Array.from(packProducerIds),
      uploadedAt: new Date().toISOString(),
      uploadedBy: userId,
      folderPath: packDir,
      beatIds: processedBeats.map(b => b.id),
    })

    // Log activity
    logActivity({
      action: 'Beat pack uploaded',
      user: user.name,
      userId: userId,
      details: {
        packId: pack.id,
        packName: finalCleanPackName,
        beatCount: processedBeats.length,
        incompleteCount: processedBeats.filter(b => b.isIncomplete).length,
        errorCount: errors.length,
        packProducers: packTitleProducers,
      },
      category: 'beats',
    })


    // Always return success if at least some beats were processed
    // Include errors in response even if successful
    const hasSuccess = processedBeats.length > 0
    const totalUploadTime = Date.now() - uploadStartTime
    console.log(`[DEBUG] ===== UPLOAD COMPLETE =====`)
    console.log(`[DEBUG] Total time: ${totalUploadTime}ms (${(totalUploadTime/1000).toFixed(2)}s)`)
    console.log(`[DEBUG] Files: ${files.length}, Processed: ${processedBeats.length}, Errors: ${errors.length}`)
    console.log(`[DEBUG] Average time per file: ${(totalUploadTime/files.length).toFixed(0)}ms`)
    
    return NextResponse.json({
      success: hasSuccess,
      pack: {
        id: pack.id,
        name: finalCleanPackName || finalPackName,
        beatCount: processedBeats.length,
      },
      beats: processedBeats,
      errors: errors.length > 0 ? errors : [],
      summary: {
        total: files.length,
        processed: processedBeats.length,
        incomplete: processedBeats.filter(b => b.isIncomplete).length,
        errors: errors.length,
      },
      message: hasSuccess
        ? `Upload complete. ${processedBeats.length} beat(s) uploaded. ${errors.length > 0 ? `${errors.length} file(s) failed.` : ''}`
        : `Upload failed. All ${files.length} file(s) failed to upload.`,
    })
  } catch (error: any) {
    console.error('[upload-pack] Error:', error)
    return NextResponse.json(
      { error: 'Failed to upload beat pack', details: error.message },
      { status: 500 }
    )
  }
}

