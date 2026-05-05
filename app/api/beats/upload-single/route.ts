import { NextRequest, NextResponse } from 'next/server'
import { mkdir } from 'fs/promises'
import path from 'path'
import { getUsers } from '@/lib/storage'
import {
  addBeat,
  findOrCreateProducer,
} from '@/lib/storage'
import { parseBeatFilename, validateParsedBeat, cleanBeatNameFromPackProducers, extractProducersFromPackTitle } from '@/lib/beatParser'
import { writeBeatMetadata } from '@/lib/audioMetadata'
import { getUploadPath } from '@/lib/uploadConfig'
import { getReadableFileName } from '@/lib/fileNaming'
import { writeUploadToDisk } from '@/lib/writeUploadToDisk'

const BEATS_DIR = getUploadPath('beats')

// Configure route for handling file uploads
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes

async function ensureDirectories() {
  await mkdir(BEATS_DIR, { recursive: true })
}

/**
 * Upload a single beat file (used for pack uploads where files are uploaded individually)
 */
export async function POST(request: NextRequest) {
  try {
    await ensureDirectories()

    const formData = await request.formData()
    const file = formData.get('file') as File
    const packNameFromForm = (formData.get('packName') as string) || 'Untitled Pack'
    const packTitleProducersJson = (formData.get('packTitleProducers') as string) || ''
    const finalCleanPackNameFromForm = (formData.get('finalCleanPackName') as string) || ''
    const packName = packNameFromForm
    let finalCleanPackName = finalCleanPackNameFromForm || packNameFromForm
    const userId = formData.get('userId') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Check user permissions
    const users = getUsers()
    const user = users.find(u => u.id === userId)
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can upload beats' },
        { status: 403 }
      )
    }

    // Validate file type
    const ext = path.extname(file.name).toLowerCase()
    if (!['.wav', '.mp3'].includes(ext)) {
      return NextResponse.json(
        { error: `Invalid file type: ${ext}. Only WAV and MP3 are allowed.` },
        { status: 400 }
      )
    }

    // Parse pack title producers
    let packTitleProducers: string[] = []
    if (packTitleProducersJson) {
      try {
        const parsedProducers = JSON.parse(packTitleProducersJson)
        if (Array.isArray(parsedProducers)) {
          packTitleProducers = parsedProducers.filter(Boolean)
        }
      } catch {
        // ignore
      }
    }

    // If client didn't supply producers/clean name, derive from pack title server-side
    if (packTitleProducers.length === 0 || !finalCleanPackNameFromForm) {
      const derived = extractProducersFromPackTitle(packNameFromForm)
      if (packTitleProducers.length === 0 && derived.producers?.length) {
        packTitleProducers = derived.producers
      }
      if (!finalCleanPackNameFromForm && derived.cleanPackName) {
        finalCleanPackName = derived.cleanPackName
      }
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

    // Create or find producers from pack title
    const packTitleProducerIds: string[] = []
    for (const producerName of packTitleProducers) {
      const producer = findOrCreateProducer(producerName)
      packTitleProducerIds.push(producer.id)
      if (!producerIds.includes(producer.id)) {
        producerIds.push(producer.id)
      }
    }

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

    // Sanitize pack name for directory
    const sanitizedPackName = finalCleanPackName.replace(/[^a-zA-Z0-9._-]/g, '_')
    
    // Create pack directory if it doesn't exist
    const packDir = path.join(BEATS_DIR, sanitizedPackName)
    await mkdir(packDir, { recursive: true })

    const producerLabel = allProducerNames[0] || sanitizedPackName
    const fileName = getReadableFileName({
      baseName: `${producerLabel}_${cleanedBeatName}`,
      extension: ext,
      directory: packDir,
    })
    const filePath = path.join(packDir, fileName)

    await writeUploadToDisk(file, filePath)

    // Write metadata to file (non-blocking)
    setImmediate(() => {
      writeBeatMetadata(filePath, {
        owner: 'Legendary Fyre Records',
        copyright: '© Legendary Fyre Records',
        license: 'Licensed, not sold',
        contact: 'Distributed by Legendary Fyre Records',
        producer: allProducerNames.join(' & ') || 'Unknown',
        producers: allProducerNames,
        title: cleanedBeatName,
      }).catch((error) => {
        console.error(`[upload-single] Error writing metadata for ${file.name}:`, error)
        // Continue even if metadata writing fails
      })
    })

    // Create file URL
    const fileUrl = `/api/files/beats/${encodeURIComponent(sanitizedPackName)}/${encodeURIComponent(fileName)}`

    // Create beat record
    const beat = addBeat({
      name: cleanedBeatName,
      bpm: parsed.bpm,
      key: parsed.key,
      producerIds,
      packName: finalCleanPackName,
      status: 'available',
      originalFileUrl: fileUrl,
      owner: 'Legendary Fyre Records',
      copyright: '© Legendary Fyre Records',
      license: 'Licensed, not sold',
      contact: 'Distributed by Legendary Fyre Records',
      isIncomplete: validation.isIncomplete,
      canPublish: !validation.isIncomplete,
    })

    return NextResponse.json({
      success: true,
      beat: {
        id: beat.id,
        name: cleanedBeatName,
        producers: allProducerNames,
        isIncomplete: validation.isIncomplete,
        fileName: file.name,
      },
    })
  } catch (error: any) {
    console.error('[upload-single] Error:', error)
    return NextResponse.json(
      { error: 'Failed to upload beat', details: error.message },
      { status: 500 }
    )
  }
}
