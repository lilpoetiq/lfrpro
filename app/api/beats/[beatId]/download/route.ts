import { NextRequest, NextResponse } from 'next/server'
import { readFile, readdir, stat, writeFile } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'
import archiver from 'archiver'
import { getBeatById, getBeatFiles } from '@/lib/storage'
import { writeBeatMetadata } from '@/lib/audioMetadata'
import { getProducers } from '@/lib/storage'

import { getUploadPath } from '@/lib/uploadConfig'
const BEATS_DIR = getUploadPath('beats')
const BEAT_FILES_DIR = getUploadPath('beat-files')

/**
 * Download beat as ZIP with all files and metadata
 * GET /api/beats/[beatId]/download
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

    const beatFiles = getBeatFiles(beatId)
    
    // Get producers
    const producers = getProducers()
    const producerNames = beat.producerIds
      .map(id => {
        const producer = producers.find(p => p.id === id)
        return producer?.name || 'Unknown'
      })
      .join(' & ')
    
    // Check if user wants ZIP package (via query param) or direct file
    const { searchParams } = new URL(request.url)
    const downloadType = searchParams.get('type') // 'zip' or null for direct
    
    // Default: download original file directly (unless type=zip is specified)
    if (downloadType !== 'zip' && beat.originalFileUrl) {
      try {
        const urlPath = beat.originalFileUrl.replace('/api/files/beats/', '')
        const decodedPath = urlPath.split('/').map((segment: string) => decodeURIComponent(segment))
        const filePath = path.join(BEATS_DIR, ...decodedPath)
        
        let finalPath = filePath
        if (!existsSync(finalPath)) {
          const sanitizedPath = decodedPath.map((segment: string) => 
            segment.replace(/[^a-zA-Z0-9._-]/g, '_')
          )
          const sanitizedFilePath = path.join(BEATS_DIR, ...sanitizedPath)
          if (existsSync(sanitizedFilePath)) {
            finalPath = sanitizedFilePath
          }
        }
        
        if (existsSync(finalPath)) {
          const fileBuffer = await readFile(finalPath)
          const ext = path.extname(finalPath).toLowerCase()
          
          let contentType = 'application/octet-stream'
          if (ext === '.mp3') contentType = 'audio/mpeg'
          if (ext === '.wav') contentType = 'audio/wav'
          
          return new NextResponse(fileBuffer, {
            headers: {
              'Content-Type': contentType,
              'Content-Disposition': `attachment; filename="${path.basename(finalPath)}"`,
            },
          })
        } else {
          return NextResponse.json({ error: 'File not found' }, { status: 404 })
        }
      } catch (error) {
        console.error('[download] Error serving single file:', error)
        return NextResponse.json(
          { error: 'Failed to download file', details: (error as Error).message },
          { status: 500 }
        )
      }
    }
    
    // ZIP download requested - create package
    
    // More than 3 audio files - create ZIP package
    // Prepare metadata
    const metadata = {
      owner: 'Legendary Fyre Records',
      copyright: '© Legendary Fyre Records',
      license: 'Licensed, not sold',
      contact: 'Distributed by Legendary Fyre Records',
      producer: producerNames,
      producers: beat.producerIds.map(id => {
        const producer = producers.find(p => p.id === id)
        return producer?.name || 'Unknown'
      }),
      title: beat.name,
      bpm: beat.bpm,
    }
    
    // Create zip archive and collect chunks
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Maximum compression
    })
    
    // Track temp files for cleanup
    const tempFiles: string[] = []
    
    // Collect archive data into a buffer
    const chunks: Buffer[] = []
    
    archive.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })
    
    // Wrap in Promise to handle async archive finalization
    return new Promise<NextResponse>(async (resolve, reject) => {
      archive.on('end', async () => {
        try {
          // Combine all chunks into a single buffer
          const buffer = Buffer.concat(chunks)
          
          // Clean up temp files after a delay
          setTimeout(async () => {
            const { unlink } = await import('fs/promises')
            for (const tempFile of tempFiles) {
              try {
                if (existsSync(tempFile)) {
                  await unlink(tempFile)
                }
              } catch (error) {
                console.error('[download] Error cleaning up temp file:', error)
              }
            }
          }, 60000) // Clean up after 60 seconds
          
          // Create response with buffer
          const response = new NextResponse(buffer, {
            headers: {
              'Content-Type': 'application/zip',
              'Content-Disposition': `attachment; filename="${beat.name.replace(/[^a-zA-Z0-9.-]/g, '_')}_Legendary_Fyre_Records.zip"`,
              'Content-Length': buffer.length.toString(),
            },
          })
          
          resolve(response)
        } catch (error) {
          reject(error)
        }
      })
      
      archive.on('error', (error) => {
        reject(error)
      })
      
      try {
        // Add main beat file
    if (beat.originalFileUrl) {
      try {
        // Extract path from URL
        const urlPath = beat.originalFileUrl.replace('/api/files/beats/', '')
        const decodedPath = urlPath.split('/').map(segment => decodeURIComponent(segment))
        const filePath = path.join(BEATS_DIR, ...decodedPath)
        
        // Try sanitized path if original doesn't exist
        let finalPath = filePath
        if (!existsSync(finalPath)) {
          const sanitizedPath = decodedPath.map(segment => 
            segment.replace(/[^a-zA-Z0-9._-]/g, '_')
          )
          const sanitizedFilePath = path.join(BEATS_DIR, ...sanitizedPath)
          if (existsSync(sanitizedFilePath)) {
            finalPath = sanitizedFilePath
          }
        }
        
        if (existsSync(finalPath)) {
          // Read file, tag it, then add to zip
          const fileBuffer = await readFile(finalPath)
          
          // Create temporary file path for tagged version
          const tempDir = path.join(process.cwd(), '.next', 'temp')
          if (!existsSync(tempDir)) {
            await import('fs/promises').then(fs => fs.mkdir(tempDir, { recursive: true }))
          }
          
          const tempFilePath = path.join(tempDir, `tagged_${Date.now()}_${path.basename(finalPath)}`)
          tempFiles.push(tempFilePath)
          
          // Copy file to temp location
          await writeFile(tempFilePath, fileBuffer)
          
          // Write metadata to file BEFORE adding to zip
          try {
            await writeBeatMetadata(tempFilePath, metadata)
            console.log(`[download] Metadata written to ${path.basename(finalPath)}`)
          } catch (metadataError) {
            console.error('[download] Error writing metadata:', metadataError)
            // Continue even if metadata writing fails - file will still be added
          }
          
          // Add tagged file to zip (with original filename)
          archive.file(tempFilePath, { name: path.basename(finalPath) })
        }
      } catch (error) {
        console.error('[download] Error adding main beat file:', error)
      }
    }
    
    // Add additional beat files (Logic projects, stems, etc.)
    for (const beatFile of beatFiles) {
      if (beatFile.fileUrl) {
        try {
          // Extract path from URL
          const urlPath = beatFile.fileUrl.replace('/api/files/beat-files/', '')
          const decodedPath = urlPath.split('/').map((segment: string) => decodeURIComponent(segment))
          const filePath = path.join(BEAT_FILES_DIR, ...decodedPath)
          
          if (existsSync(filePath)) {
            const ext = path.extname(filePath).toLowerCase()
            
            // If it's an audio file, tag it with metadata
            if (ext === '.mp3' || ext === '.wav') {
              const fileBuffer = await readFile(filePath)
              const tempDir = path.join(process.cwd(), '.next', 'temp')
              if (!existsSync(tempDir)) {
                await import('fs/promises').then(fs => fs.mkdir(tempDir, { recursive: true }))
              }
              
              const tempFilePath = path.join(tempDir, `tagged_${Date.now()}_${path.basename(filePath)}`)
              tempFiles.push(tempFilePath)
              await writeFile(tempFilePath, fileBuffer)
              
              // Write metadata
              try {
                await writeBeatMetadata(tempFilePath, metadata)
                console.log(`[download] Metadata written to ${path.basename(filePath)}`)
              } catch (metadataError) {
                console.error('[download] Error writing metadata to beat file:', metadataError)
              }
              
              // Create folder structure in zip based on file type
              const folderName = beatFile.fileType === 'folder' ? beatFile.fileName : beatFile.fileType
              const zipPath = `${folderName}/${path.basename(filePath)}`
              
              archive.file(tempFilePath, { name: zipPath })
            } else {
              // Non-audio files - add as-is
              const folderName = beatFile.fileType === 'folder' ? beatFile.fileName : beatFile.fileType
              const zipPath = `${folderName}/${path.basename(filePath)}`
              archive.file(filePath, { name: zipPath })
            }
          }
        } catch (error) {
          console.error('[download] Error adding beat file:', error)
        }
      }
    }
    
    // Add metadata text file
    const metadataText = `
Legendary Fyre Records - Beat Package
======================================

Beat Name: ${beat.name}
BPM: ${beat.bpm || 'N/A'}
Producer(s): ${producerNames}
Pack: ${beat.packName || 'N/A'}

Distribution Information:
-------------------------
Distributed by: Legendary Fyre Records
Copyright: © Legendary Fyre Records
License: Licensed, not sold
Contact: Distributed by Legendary Fyre Records

IMPORTANT:
----------
This beat is distributed by Legendary Fyre Records.
Licensed, not sold.
Unauthorized use is prohibited.

All files in this package are digitally tagged with distribution information.
`.trim()
    
        archive.append(metadataText, { name: 'METADATA.txt' })
        
        // Finalize archive (this will trigger the 'end' event)
        archive.finalize()
      } catch (error) {
        reject(error)
      }
    })
  } catch (error: any) {
    console.error('[GET /api/beats/[beatId]/download] Error:', error)
    
    // Clean up temp files on error (tempFiles is in outer scope)
    // Note: tempFiles cleanup is handled by setTimeout above
    
    return NextResponse.json(
      { error: 'Failed to create download package', details: error.message },
      { status: 500 }
    )
  }
}

