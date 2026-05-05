import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { mkdir, writeFile, readFile, rename, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { getUsers, addBeat, findOrCreateProducer } from '@/lib/storage'
import { parseBeatFilename, validateParsedBeat, cleanBeatNameFromPackProducers, extractProducersFromPackTitle } from '@/lib/beatParser'
import { writeBeatMetadata } from '@/lib/audioMetadata'

export const runtime = 'nodejs'
/* Vercel Hobby: max 300s. Pro can raise in dashboard if needed. */
export const maxDuration = 300

import { getUploadPath } from '@/lib/uploadConfig'
const BEATS_DIR = getUploadPath('beats')
const CHUNKS_DIR = getUploadPath('beats', '_chunks')

type ChunkMeta = {
  nextChunkIndex: number
  totalChunks: number
  originalFileName: string
  packName: string
  userId: string
}

function sanitizeForDir(name: string): string {
  return (name || '').replace(/[^a-zA-Z0-9._-]/g, '_')
}

async function readMeta(metaPath: string): Promise<ChunkMeta | null> {
  if (!existsSync(metaPath)) return null
  try {
    const raw = await readFile(metaPath, 'utf-8')
    return JSON.parse(raw) as ChunkMeta
  } catch {
    return null
  }
}

async function writeMeta(metaPath: string, meta: ChunkMeta): Promise<void> {
  await writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8')
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const chunkBlob = formData.get('chunk') as File | null
    const uploadId = String(formData.get('uploadId') || '').trim()
    const originalFileName = String(formData.get('fileName') || '').trim()
    const packNameRaw = String(formData.get('packName') || 'Untitled Pack').trim()
    const userId = String(formData.get('userId') || '').trim()
    const chunkIndex = Number(formData.get('chunkIndex'))
    const totalChunks = Number(formData.get('totalChunks'))

    if (!chunkBlob) return NextResponse.json({ error: 'Missing chunk' }, { status: 400 })
    if (!uploadId) return NextResponse.json({ error: 'Missing uploadId' }, { status: 400 })
    if (!originalFileName) return NextResponse.json({ error: 'Missing fileName' }, { status: 400 })
    if (!userId) return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    if (!Number.isFinite(chunkIndex) || chunkIndex < 0) return NextResponse.json({ error: 'Invalid chunkIndex' }, { status: 400 })
    if (!Number.isFinite(totalChunks) || totalChunks <= 0) return NextResponse.json({ error: 'Invalid totalChunks' }, { status: 400 })

    const users = getUsers()
    const user = users.find(u => u.id === userId)
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can upload beat packs' }, { status: 403 })
    }

    const ext = path.extname(originalFileName).toLowerCase()
    if (!['.wav', '.mp3'].includes(ext)) {
      return NextResponse.json({ error: `Invalid file type: ${ext}. Only WAV and MP3 are allowed.` }, { status: 400 })
    }

    // Derive pack title producers + clean pack name server-side
    const { producers: packTitleProducers, cleanPackName } = extractProducersFromPackTitle(packNameRaw)
    const finalCleanPackName = cleanPackName || packNameRaw || 'Untitled Pack'
    const sanitizedPackName = sanitizeForDir(finalCleanPackName)

    await mkdir(BEATS_DIR, { recursive: true })
    await mkdir(CHUNKS_DIR, { recursive: true })

    const uploadDir = path.join(CHUNKS_DIR, sanitizeForDir(uploadId))
    await mkdir(uploadDir, { recursive: true })

    const tmpFilePath = path.join(uploadDir, 'file.part')
    const metaPath = path.join(uploadDir, 'meta.json')

    const meta = await readMeta(metaPath)
    const expectedIndex = meta?.nextChunkIndex ?? 0

    if (meta) {
      if (meta.totalChunks !== totalChunks || meta.originalFileName !== originalFileName || meta.userId !== userId) {
        return NextResponse.json({ error: 'Chunk session mismatch. Please retry upload.' }, { status: 409 })
      }
    } else {
      // initialize meta for this upload
      await writeMeta(metaPath, {
        nextChunkIndex: 0,
        totalChunks,
        originalFileName,
        packName: finalCleanPackName,
        userId,
      })
    }

    if (chunkIndex !== expectedIndex) {
      return NextResponse.json(
        {
          error: `Out of order chunk. Expected ${expectedIndex}, got ${chunkIndex}`,
          expectedChunkIndex: expectedIndex,
          receivedChunkIndex: chunkIndex,
        },
        { status: 409 }
      )
    }

    const bytes = await chunkBlob.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Append chunk (client sends sequentially)
    if (chunkIndex === 0 && existsSync(tmpFilePath)) {
      // stale partial; clear it
      await unlink(tmpFilePath).catch(() => {})
    }
    await writeFile(tmpFilePath, buffer, { flag: 'a' })

    // Update meta
    const nextChunkIndex = chunkIndex + 1
    await writeMeta(metaPath, {
      nextChunkIndex,
      totalChunks,
      originalFileName,
      packName: finalCleanPackName,
      userId,
    })

    // Not done yet
    if (nextChunkIndex < totalChunks) {
      return NextResponse.json({ success: true, received: true, chunkIndex, totalChunks })
    }

    // Finalize: move into pack dir, create beat record
    const packDir = path.join(BEATS_DIR, sanitizedPackName)
    await mkdir(packDir, { recursive: true })

    const parsed = parseBeatFilename(originalFileName)
    const validation = validateParsedBeat(parsed)

    const producerIds: string[] = []
    if (parsed.producers.length > 0) {
      for (const producerName of parsed.producers) {
        const producer = findOrCreateProducer(producerName)
        producerIds.push(producer.id)
      }
    }
    // add pack title producers too
    for (const producerName of packTitleProducers) {
      const producer = findOrCreateProducer(producerName)
      if (!producerIds.includes(producer.id)) producerIds.push(producer.id)
    }

    let cleanedBeatName = parsed.name
    if (packTitleProducers.length > 0) {
      cleanedBeatName = cleanBeatNameFromPackProducers(parsed.name, packTitleProducers)
    }

    const allProducerNames = Array.from(new Set([...parsed.producers, ...packTitleProducers]))
    const { getReadableFileName } = await import('@/lib/fileNaming')
    const producerLabel = allProducerNames[0] || finalCleanPackName
    const finalFileName = getReadableFileName({
      baseName: `${producerLabel}_${cleanedBeatName}`,
      extension: ext,
      directory: packDir,
    })
    const finalFilePath = path.join(packDir, finalFileName)

    await rename(tmpFilePath, finalFilePath)

    // Best-effort metadata write (non-blocking)
    setImmediate(() => {
      writeBeatMetadata(finalFilePath, {
        owner: 'Legendary Fyre Records',
        copyright: '© Legendary Fyre Records',
        license: 'Licensed, not sold',
        contact: 'Distributed by Legendary Fyre Records',
        producer: allProducerNames.join(' & ') || 'Unknown',
        producers: allProducerNames,
        title: cleanedBeatName,
      }).catch(() => {})
    })

    const fileUrl = `/api/files/beats/${encodeURIComponent(sanitizedPackName)}/${encodeURIComponent(finalFileName)}`

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

    // Cleanup meta dir (best effort)
    await unlink(metaPath).catch(() => {})
    // leave uploadDir (empty) as-is; OS cleanup can handle, or future PR can recursively remove

    return NextResponse.json({
      success: true,
      complete: true,
      beat: {
        id: beat.id,
        name: cleanedBeatName,
        producers: allProducerNames,
        isIncomplete: validation.isIncomplete,
        fileName: originalFileName,
      },
    })
  } catch (error: any) {
    console.error('[upload-chunk] Error:', error)
    return NextResponse.json(
      { error: 'Failed to upload chunk', details: error.message },
      { status: 500 }
    )
  }
}

