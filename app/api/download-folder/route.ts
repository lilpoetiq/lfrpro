import { NextRequest, NextResponse } from 'next/server'
import { getSongVaultFiles } from '@/lib/storage'
import archiver from 'archiver'
import { readFile } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'
import { PassThrough } from 'stream'
import { UPLOAD_BASE } from '@/lib/uploadConfig'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UPLOAD_DIR = UPLOAD_BASE

// Convert Node.js stream to Web ReadableStream
function nodeStreamToWebStream(nodeStream: NodeJS.ReadableStream): ReadableStream {
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)))
      nodeStream.on('end', () => {
        controller.close()
      })
      nodeStream.on('error', (err) => {
        controller.error(err)
      })
    },
    cancel() {
      if ('destroy' in nodeStream && typeof (nodeStream as any).destroy === 'function') {
        (nodeStream as any).destroy()
      }
    }
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const folderPath = searchParams.get('folderPath')
    const songId = searchParams.get('songId')

    if (!folderPath) {
      return NextResponse.json({ error: 'Folder path is required' }, { status: 400 })
    }

    // Get vault files (optionally filtered by songId)
    const allFiles = getSongVaultFiles(songId || undefined)
    
    // Filter files that are in this folder or subfolders
    const filesInFolder = allFiles.filter((file) => {
      if (file.isFolder) return false
      if (!file.folderPath) return false
      
      // Check if file is in the folder or a subfolder
      // Match exact folder path or files within subfolders
      return file.folderPath === folderPath || file.folderPath.startsWith(folderPath + '/')
    })

    if (filesInFolder.length === 0) {
      return NextResponse.json({ error: 'No files found in folder' }, { status: 404 })
    }

    // Create a zip archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    })
    const passThrough = new PassThrough()
    archive.pipe(passThrough)

    // Add files to the archive
    for (const file of filesInFolder) {
      try {
        // Determine file path
        let filePath: string | null = null
        
        if (file.fileUrl) {
          // Extract path from fileUrl (e.g., /api/files/vault/folderPath/fileName)
          // Remove /api/files/ prefix and decode URL-encoded segments
          let urlPath = file.fileUrl
          if (urlPath.startsWith('/api/files/')) {
            urlPath = urlPath.replace('/api/files/', '')
          } else if (urlPath.startsWith('api/files/')) {
            urlPath = urlPath.replace('api/files/', '')
          }
          
          const pathSegments = urlPath.split('/').map(segment => decodeURIComponent(segment)).filter(s => s)
          
          // Handle both vault and other categories
          // Path structure: category/folderPath/fileName
          if (pathSegments.length >= 2) {
            // First segment is category (vault, album-covers, etc.)
            // Remaining segments are folderPath + fileName
            filePath = path.join(UPLOAD_DIR, ...pathSegments)
          } else if (pathSegments.length === 1) {
            // Just category/fileName (no folder)
            filePath = path.join(UPLOAD_DIR, ...pathSegments)
          } else {
            console.warn(`Invalid fileUrl format: ${file.fileUrl}`)
            continue
          }
        } else if (file.googleDriveUrl) {
          // Skip Google Drive files - can't download them directly
          console.log(`Skipping Google Drive file: ${file.fileName}`)
          continue
        } else {
          console.warn(`No fileUrl or googleDriveUrl for file: ${file.fileName}`)
          continue
        }

        if (!filePath || !existsSync(filePath)) {
          console.warn(`File not found: ${filePath || file.fileName} (fileUrl: ${file.fileUrl})`)
          continue
        }

        // Security: Ensure the file is within the upload directory
        const resolvedPath = path.resolve(filePath)
        const resolvedUploadDir = path.resolve(UPLOAD_DIR)
        
        if (!resolvedPath.startsWith(resolvedUploadDir)) {
          console.warn(`Invalid file path: ${filePath}`)
          continue
        }

        // Read file content
        const fileBuffer = await readFile(filePath)
        
        // Calculate relative path within the folder - preserve exact folder structure
        let relativePath = file.fileName
        
        if (file.folderPath) {
          if (file.folderPath === folderPath) {
            // File is directly in the folder (root of this folder)
            relativePath = file.fileName
          } else if (file.folderPath.startsWith(folderPath + '/')) {
            // File is in a subfolder, preserve the full subfolder structure
            const subPath = file.folderPath.substring(folderPath.length + 1)
            relativePath = `${subPath}/${file.fileName}`
          } else {
            // File path doesn't match - skip it
            console.warn(`File ${file.fileName} folderPath ${file.folderPath} doesn't match requested folder ${folderPath}`)
            continue
          }
        }

        // Add file to archive with relative path (preserves folder structure)
        archive.append(fileBuffer, { name: relativePath })
      } catch (error: any) {
        console.error(`Error adding file ${file.fileName} to archive:`, error.message)
        // Continue with other files
      }
    }

    // Finalize the archive
    archive.finalize()

    // Set up response headers for zip download
    const headers = new Headers()
    headers.set('Content-Type', 'application/zip')
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(folderPath.split('/').pop() || 'folder')}.zip"`)

    // Convert Node.js stream to Web ReadableStream
    const webStream = nodeStreamToWebStream(passThrough)

    return new NextResponse(webStream, { headers })
  } catch (error: any) {
    console.error('Download folder error:', error)
    return NextResponse.json(
      { error: 'Failed to create folder download', details: error.message },
      { status: 500 }
    )
  }
}

