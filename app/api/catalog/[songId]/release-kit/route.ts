import { NextRequest, NextResponse } from 'next/server'
import { getCatalog } from '@/lib/storage'
import path from 'path'
import { existsSync, statSync } from 'fs'
import { mkdir } from 'fs/promises'
import archiver from 'archiver'
import { spawn } from 'child_process'
import os from 'os'
import { PassThrough } from 'stream'
import { UPLOAD_BASE } from '@/lib/uploadConfig'

export const runtime = 'nodejs'

const UPLOAD_DIR = UPLOAD_BASE
const TEMP_DIR = path.join(os.tmpdir(), 'release-kit-temp')

function nodeStreamToWebStream(nodeStream: NodeJS.ReadableStream): ReadableStream {
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)))
      nodeStream.on('end', () => controller.close())
      nodeStream.on('error', (err) => controller.error(err))
    },
    cancel() {
      try {
        // @ts-expect-error - destroy exists on Node streams
        nodeStream.destroy()
      } catch {
        // ignore
      }
    },
  })
}

// Helper function to convert audio to WAV 48kHz 16-bit using ffmpeg
async function convertToWav(inputPath: string, outputPath: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath)
    if (!existsSync(outputDir)) {
      try {
        await mkdir(outputDir, { recursive: true })
      } catch (err) {
        reject(err)
        return
      }
    }

    // Find ffmpeg in common locations or use PATH
    const ffmpegPaths = [
      '/opt/homebrew/bin/ffmpeg', // Homebrew on Apple Silicon
      '/usr/local/bin/ffmpeg', // Homebrew on Intel Mac
      '/usr/bin/ffmpeg', // System installation
      'ffmpeg' // Use PATH
    ]
    
    let ffmpegPath = 'ffmpeg'
    for (const testPath of ffmpegPaths) {
      if (existsSync(testPath) || testPath === 'ffmpeg') {
        ffmpegPath = testPath
        break
      }
    }

    // FFmpeg command to convert to WAV 48kHz 16-bit - processes FULL file duration
    // No -t (duration) or -ss (start) parameters means it processes the ENTIRE input file
    // Using -map 0:a ensures all audio streams are copied in full
    const ffmpeg = spawn(ffmpegPath, [
      '-i', inputPath, // Input file - will process FULL duration
      '-ar', '48000', // Sample rate: 48kHz
      '-ac', '2', // Stereo (2 channels)
      '-sample_fmt', 's16', // 16-bit sample format
      '-codec:a', 'pcm_s16le', // PCM 16-bit little-endian codec
      '-map', '0:a', // Map all audio streams from input (ensures full audio duration)
      '-avoid_negative_ts', 'make_zero', // Handle timestamp issues
      '-y', // Overwrite output file
      outputPath
    ], {
      stdio: ['ignore', 'pipe', 'pipe'] // Suppress stdout, capture stderr
    })
    
    // Log conversion start for debugging
    console.log(`[Release Kit] Converting audio: ${inputPath} -> ${outputPath} (full duration)`)

    let stderr = ''
    let stdout = ''
    
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString()
    })
    
    ffmpeg.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    // Set a timeout (5 minutes max for conversion)
    const timeout = setTimeout(() => {
      ffmpeg.kill('SIGTERM')
      reject(new Error('FFmpeg conversion timed out after 5 minutes'))
    }, 5 * 60 * 1000)

    ffmpeg.on('close', (code) => {
      clearTimeout(timeout)
      
      if (code === 0) {
        // Verify output file was created
        if (existsSync(outputPath)) {
          resolve()
        } else {
          reject(new Error(`FFmpeg conversion completed but output file not found: ${outputPath}`))
        }
      } else {
        // FFmpeg often returns non-zero codes even on success, check if file exists
        if (existsSync(outputPath)) {
          resolve()
        } else {
          reject(new Error(`FFmpeg conversion failed (exit code ${code}): ${stderr.substring(0, 500)}`))
        }
      }
    })

    ffmpeg.on('error', (err) => {
      clearTimeout(timeout)
      reject(new Error(`FFmpeg spawn failed: ${err.message}. Make sure ffmpeg is installed and accessible.`))
    })
  })
}

// Helper function to get file size
function getFileSize(filePath: string): string {
  try {
    const stats = statSync(filePath)
    const bytes = stats.size
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  } catch {
    return 'Unknown'
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  let tempDirCreated = false
  try {
    const { songId } = await params
    
    if (!songId) {
      return NextResponse.json({ error: 'Song ID is required' }, { status: 400 })
    }
    
    console.log(`[Release Kit] Generating release kit for song ID: ${songId}`)
    
    const catalog = getCatalog()
    const song = catalog.find(item => item.id === songId)

    if (!song) {
      console.error(`[Release Kit] Song not found: ${songId}`)
      return NextResponse.json({ error: 'Song not found' }, { status: 404 })
    }
    
    console.log(`[Release Kit] Found song: ${song.song} by ${song.artist}`)
    const currentYear = new Date().getFullYear()
    const { searchParams } = new URL(request.url)
    const mode = (searchParams.get('mode') || 'full').toLowerCase()
    const includeAudio = mode !== 'docs'
    console.log(`[Release Kit] mode=${mode} includeAudio=${includeAudio}`)

    // Create temp directory for conversions
    if (!existsSync(TEMP_DIR)) {
      await mkdir(TEMP_DIR, { recursive: true })
      tempDirCreated = true
    }

    // Create a ZIP archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    })
    const passThrough = new PassThrough()
    archive.pipe(passThrough)
    const zipStream = nodeStreamToWebStream(passThrough)

    // Set response headers
    // Keep sanitized names only for ZIP filename (filesystem compatibility)
    const sanitizedSongName = song.song.replace(/[^a-zA-Z0-9.-]/g, '_')
    const sanitizedArtistName = song.artist.replace(/[^a-zA-Z0-9.-]/g, '_')
    const zipFileName = `${sanitizedArtistName}_${sanitizedSongName}_ReleaseKit.zip`
    
    // Use original song name for audio files (preserve formatting)
    const originalSongName = song.song

    // Track what files are included for diagnosis
    const diagnosis: {
      uploaded: Array<{ name: string; type: string; size: string; status: string }>
      missing: Array<{ name: string; type: string; reason: string }>
    } = {
      uploaded: [],
      missing: []
    }
    
    // Get all credits (from song level and track level) - needed for diagnosis
    const allCredits = [
      ...(song.credits || []),
      ...(song.songs?.flatMap(track => track.credits || []) || [])
    ]

    // Add album cover if exists
    if (song.albumCover) {
      const coverPath = song.albumCover.replace('/api/files/', '')
      const fullCoverPath = path.join(UPLOAD_DIR, coverPath)
      
      if (existsSync(fullCoverPath)) {
        const coverExtension = path.extname(fullCoverPath)
        const coverSize = getFileSize(fullCoverPath)
        archive.file(fullCoverPath, { name: `AlbumCover${coverExtension}` })
        diagnosis.uploaded.push({
          name: `AlbumCover${coverExtension}`,
          type: 'Album Cover',
          size: coverSize,
          status: '✓ Included'
        })
      } else {
        diagnosis.missing.push({
          name: 'Album Cover',
          type: 'Image',
          reason: 'File not found on server'
        })
      }
    } else {
      diagnosis.missing.push({
        name: 'Album Cover',
        type: 'Image',
        reason: 'Not uploaded'
      })
    }

    // Add audio files and convert to WAV 48kHz 16-bit
    if (includeAudio && song.releaseType === 'single') {
      // Single song - check both fileUrl and songs array
      let audioAdded = false
      
      // First try songs array (for singles with audio uploaded via track-audio endpoint)
      if (song.songs && song.songs.length > 0 && song.songs[0].audioUrl) {
        const audioPath = song.songs[0].audioUrl.replace('/api/files/', '')
        const fullAudioPath = path.join(UPLOAD_DIR, audioPath)
        
        if (existsSync(fullAudioPath)) {
          const audioFileName = `${originalSongName}.wav`
          const tempWavPath = path.join(TEMP_DIR, `${songId}_${sanitizedSongName}.wav`)
          
          try {
            // Convert to WAV 48kHz 16-bit
            await convertToWav(fullAudioPath, tempWavPath)
            archive.file(tempWavPath, { name: audioFileName })
            diagnosis.uploaded.push({
              name: audioFileName,
              type: 'Master Audio (WAV 48kHz 16-bit)',
              size: getFileSize(tempWavPath),
              status: '✓ Converted & Included'
            })
            audioAdded = true
          } catch (error: any) {
            // If conversion fails, include original file
            console.warn('Audio conversion failed, including original:', error.message)
            const audioExtension = path.extname(fullAudioPath)
            archive.file(fullAudioPath, { name: `${originalSongName}${audioExtension}` })
            diagnosis.uploaded.push({
              name: `${originalSongName}${audioExtension}`,
              type: 'Master Audio (Original)',
              size: getFileSize(fullAudioPath),
              status: `⚠ Included as-is (conversion failed: ${error.message})`
            })
            audioAdded = true
          }
        }
      }
      
      // Fallback to fileUrl if songs array didn't have audio
      if (!audioAdded && song.fileUrl) {
        const audioPath = song.fileUrl.replace('/api/files/', '')
        const fullAudioPath = path.join(UPLOAD_DIR, audioPath)
        
        if (existsSync(fullAudioPath)) {
          const audioFileName = `${originalSongName}.wav`
          const tempWavPath = path.join(TEMP_DIR, `${songId}_${sanitizedSongName}.wav`)
          
          try {
            // Convert to WAV 48kHz 16-bit
            await convertToWav(fullAudioPath, tempWavPath)
            archive.file(tempWavPath, { name: audioFileName })
            diagnosis.uploaded.push({
              name: audioFileName,
              type: 'Master Audio (WAV 48kHz 16-bit)',
              size: getFileSize(tempWavPath),
              status: '✓ Converted & Included'
            })
          } catch (error: any) {
            // If conversion fails, include original file
            console.warn('Audio conversion failed, including original:', error.message)
            const audioExtension = path.extname(fullAudioPath)
            archive.file(fullAudioPath, { name: `${originalSongName}${audioExtension}` })
            diagnosis.uploaded.push({
              name: `${originalSongName}${audioExtension}`,
              type: 'Master Audio (Original)',
              size: getFileSize(fullAudioPath),
              status: `⚠ Included as-is (conversion failed: ${error.message})`
            })
          }
        } else {
          diagnosis.missing.push({
            name: 'Master Audio',
            type: 'Audio',
            reason: 'File not found on server'
          })
        }
      } else if (!audioAdded) {
        diagnosis.missing.push({
          name: 'Master Audio',
          type: 'Audio',
          reason: 'Not uploaded'
        })
      }
    } else if (includeAudio && (song.releaseType === 'album' || song.releaseType === 'ep') && song.songs) {
      // Album/EP - add all track audio files
      for (const [index, track] of song.songs.entries()) {
        if (track.audioUrl) {
          const audioPath = track.audioUrl.replace('/api/files/', '')
          const fullAudioPath = path.join(UPLOAD_DIR, audioPath)
          
          if (existsSync(fullAudioPath)) {
            // Use original track name, preserve formatting
            const originalTrackName = track.song
            const trackNumber = String(index + 1).padStart(2, '0')
            // Format: "10. Range Rover.wav" (with period and space)
            const audioFileName = `${trackNumber}. ${originalTrackName}.wav`
            // Use sanitized name for temp file path (filesystem compatibility)
            const sanitizedTrackName = track.song.replace(/[^a-zA-Z0-9.-]/g, '_')
            const tempWavPath = path.join(TEMP_DIR, `${songId}_track_${index}_${sanitizedTrackName}.wav`)
            
            try {
              // Convert to WAV 48kHz 16-bit
              await convertToWav(fullAudioPath, tempWavPath)
              archive.file(tempWavPath, { name: audioFileName })
              diagnosis.uploaded.push({
                name: audioFileName,
                type: `Track ${index + 1} Audio (WAV 48kHz 16-bit)`,
                size: getFileSize(tempWavPath),
                status: '✓ Converted & Included'
              })
            } catch (error: any) {
              // If conversion fails, include original file
              console.warn(`Track ${index + 1} conversion failed, including original:`, error.message)
              const audioExtension = path.extname(fullAudioPath)
              archive.file(fullAudioPath, { name: `${trackNumber}. ${originalTrackName}${audioExtension}` })
              diagnosis.uploaded.push({
                name: `${trackNumber}. ${originalTrackName}${audioExtension}`,
                type: `Track ${index + 1} Audio (Original)`,
                size: getFileSize(fullAudioPath),
                status: `⚠ Included as-is (conversion failed: ${error.message})`
              })
            }
          } else {
            diagnosis.missing.push({
              name: `Track ${index + 1}: ${track.song}`,
              type: 'Audio',
              reason: 'File not found on server'
            })
          }
        } else {
          diagnosis.missing.push({
            name: `Track ${index + 1}: ${track.song}`,
            type: 'Audio',
            reason: 'Not uploaded'
          })
        }
      }
    }

    // Check for other uploaded files (lyrics, credits, etc.)
    if (song.lyricsArray && song.lyricsArray.length > 0) {
      const lyricsContent = song.lyricsArray.join('\n\n---\n\n')
      archive.append(lyricsContent, { name: 'Lyrics.txt' })
      diagnosis.uploaded.push({
        name: 'Lyrics.txt',
        type: 'Lyrics',
        size: `${lyricsContent.length} characters`,
        status: '✓ Included'
      })
    } else {
      diagnosis.missing.push({
        name: 'Lyrics',
        type: 'Text',
        reason: 'Not uploaded'
      })
    }

    // Check for credits (allCredits already defined above)
    if (allCredits.length > 0) {
      let creditsContent = `CREDITS\n`
      creditsContent += `======\n\n`
      allCredits.forEach(credit => {
        creditsContent += `${credit.role}: ${credit.name}`
        if (credit.ipi) creditsContent += ` (IPI: ${credit.ipi})`
        if (credit.customRole) creditsContent += ` (${credit.customRole})`
        creditsContent += `\n`
      })
      creditsContent += `\n© ${currentYear} Legendary Fyre Records\n`
      archive.append(creditsContent, { name: 'Credits.txt' })
      diagnosis.uploaded.push({
        name: 'Credits.txt',
        type: 'Credits',
        size: `${allCredits.length} entries`,
        status: '✓ Included'
      })
    } else {
      diagnosis.missing.push({
        name: 'Credits',
        type: 'Metadata',
        reason: 'Not uploaded'
      })
    }

    // Check for promo notes
    if (song.promoNotes) {
      archive.append(song.promoNotes, { name: 'PromoNotes.txt' })
      diagnosis.uploaded.push({
        name: 'PromoNotes.txt',
        type: 'Promo Notes',
        size: `${song.promoNotes.length} characters`,
        status: '✓ Included'
      })
    } else {
      diagnosis.missing.push({
        name: 'Promo Notes',
        type: 'Text',
        reason: 'Not uploaded'
      })
    }

    // Create comprehensive metadata file
    const metadata = {
      song: song.song,
      artist: song.artist,
      releaseType: song.releaseType,
      releaseDate: song.releaseDate || '',
      releaseDateRequested: song.releaseDateRequested || '',
      releaseApprovalStatus: song.releaseApprovalStatus || '',
      releaseApprovalNotes: song.releaseApprovalNotes || '',
      upc: song.upc || '',
      isrc: song.isrc || '',
      distributor: song.distributor || '',
      totalStreams: song.totalStreams || 0,
      platforms: song.platforms || [],
      sentToEmpireAt: song.sentToEmpireAt || '',
      tracks: song.songs ? song.songs.map((track, index) => ({
        trackNumber: index + 1,
        song: track.song,
        isrc: track.isrc || song.isrc || '',
        streams: track.streams || 0,
        credits: track.credits || [],
      })) : [{
        trackNumber: 1,
        song: song.song,
        isrc: song.isrc || '',
        streams: song.totalStreams || 0,
        credits: song.credits || [],
      }],
      credits: song.credits || [],
      lyricsAvailable: !!(song.lyricsArray && song.lyricsArray.length > 0),
      promoNotesAvailable: !!song.promoNotes,
      copyright: `© ${currentYear} Legendary Fyre Records`,
      metadata: {
        generatedAt: new Date().toISOString(),
        catalogId: song.id,
        manuallyAdded: song.manuallyAdded || false,
      }
    }

    archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' })

    // Create a text file with release info (for easy reading)
    let releaseInfo = `RELEASE KIT\n`
    releaseInfo += `===========\n\n`
    releaseInfo += `Song: ${song.song}\n`
    releaseInfo += `Artist: ${song.artist}\n`
    releaseInfo += `Release Type: ${song.releaseType}\n`
    releaseInfo += `Release Date: ${song.releaseDate || 'TBD'}\n`
    if (song.releaseDateRequested) {
      releaseInfo += `Requested Date: ${song.releaseDateRequested}\n`
    }
    releaseInfo += `UPC: ${song.upc || 'N/A'}\n`
    releaseInfo += `Distributor: ${song.distributor || 'N/A'}\n`
    if (song.releaseApprovalStatus) {
      releaseInfo += `Approval Status: ${song.releaseApprovalStatus}\n`
    }
    releaseInfo += `\n`
    
    if (song.songs && song.songs.length > 0) {
      releaseInfo += `TRACKLIST:\n`
      song.songs.forEach((track, index) => {
        releaseInfo += `${index + 1}. ${track.song}`
        if (track.isrc) releaseInfo += ` (ISRC: ${track.isrc})`
        releaseInfo += `\n`
      })
    } else {
      releaseInfo += `ISRC: ${song.isrc || 'N/A'}\n`
    }
    
    releaseInfo += `\n© ${currentYear} Legendary Fyre Records\n`
    releaseInfo += `\nGenerated: ${new Date().toLocaleString()}\n`

    archive.append(releaseInfo, { name: 'RELEASE_INFO.txt' })

    // Create diagnosis/checklist document
    let diagnosisDoc = `RELEASE DIAGNOSIS & CHECKLIST\n`
    diagnosisDoc += `============================\n\n`
    diagnosisDoc += `© ${currentYear} Legendary Fyre Records\n\n`
    diagnosisDoc += `Generated: ${new Date().toLocaleString()}\n`
    diagnosisDoc += `Song: ${song.song}\n`
    diagnosisDoc += `Artist: ${song.artist}\n`
    diagnosisDoc += `Release Type: ${song.releaseType}\n\n`
    
    diagnosisDoc += `UPLOADED FILES:\n`
    diagnosisDoc += `---------------\n`
    if (diagnosis.uploaded.length > 0) {
      diagnosis.uploaded.forEach(file => {
        diagnosisDoc += `✓ ${file.name}\n`
        diagnosisDoc += `  Type: ${file.type}\n`
        diagnosisDoc += `  Size: ${file.size}\n`
        diagnosisDoc += `  Status: ${file.status}\n\n`
      })
    } else {
      diagnosisDoc += `(No files uploaded)\n\n`
    }
    
    diagnosisDoc += `MISSING FILES:\n`
    diagnosisDoc += `--------------\n`
    if (diagnosis.missing.length > 0) {
      diagnosis.missing.forEach(file => {
        diagnosisDoc += `✗ ${file.name}\n`
        diagnosisDoc += `  Type: ${file.type}\n`
        diagnosisDoc += `  Reason: ${file.reason}\n\n`
      })
    } else {
      diagnosisDoc += `(All required files present)\n\n`
    }
    
    // Release readiness assessment
    const hasMasterAudio = diagnosis.uploaded.some(f => f.type.includes('Audio'))
    const hasAlbumCover = diagnosis.uploaded.some(f => f.type === 'Album Cover')
    const hasUPC = !!song.upc
    const hasISRC = !!song.isrc || (song.songs && song.songs.some(t => t.isrc))
    const hasDistributor = !!song.distributor
    const hasReleaseDate = !!song.releaseDate
    
    diagnosisDoc += `RELEASE READINESS ASSESSMENT:\n`
    diagnosisDoc += `----------------------------\n`
    diagnosisDoc += `${includeAudio && hasMasterAudio ? '✓' : includeAudio ? '✗' : '—'} Master Audio File\n`
    diagnosisDoc += `${hasAlbumCover ? '✓' : '✗'} Album Cover Artwork\n`
    diagnosisDoc += `${hasUPC ? '✓' : '✗'} UPC Code\n`
    diagnosisDoc += `${hasISRC ? '✓' : '✗'} ISRC Code(s)\n`
    diagnosisDoc += `${hasDistributor ? '✓' : '✗'} Distributor Assigned\n`
    diagnosisDoc += `${hasReleaseDate ? '✓' : '✗'} Release Date Set\n`
    diagnosisDoc += `${song.lyricsArray && song.lyricsArray.length > 0 ? '✓' : '✗'} Lyrics\n`
    diagnosisDoc += `${allCredits.length > 0 ? '✓' : '✗'} Credits\n`
    diagnosisDoc += `${song.promoNotes ? '✓' : '✗'} Promo Notes\n\n`
    
    // Add credits section to diagnosis
    diagnosisDoc += `CREDITS:\n`
    diagnosisDoc += `--------\n`
    if (allCredits.length > 0) {
      allCredits.forEach(credit => {
        diagnosisDoc += `• ${credit.role}: ${credit.name}`
        if (credit.ipi) diagnosisDoc += ` (IPI: ${credit.ipi})`
        if (credit.customRole) diagnosisDoc += ` (${credit.customRole})`
        diagnosisDoc += `\n`
      })
    } else {
      diagnosisDoc += `(No credits added)\n`
    }
    diagnosisDoc += `\n`
    
    const readinessScore = [
      hasMasterAudio,
      hasAlbumCover,
      hasUPC,
      hasISRC,
      hasDistributor,
      hasReleaseDate
    ].filter(Boolean).length
    
    const readinessPercentage = Math.round((readinessScore / 6) * 100)
    diagnosisDoc += `READINESS SCORE: ${readinessScore}/6 (${readinessPercentage}%)\n\n`
    
    if (readinessPercentage === 100) {
      diagnosisDoc += `STATUS: ✅ READY TO RELEASE\n`
      diagnosisDoc += `All mandatory requirements are met.\n`
    } else if (readinessPercentage >= 80) {
      diagnosisDoc += `STATUS: ⚠️ NEARLY READY\n`
      diagnosisDoc += `Most requirements met. Review missing items above.\n`
    } else if (readinessPercentage >= 50) {
      diagnosisDoc += `STATUS: ⚠️ IN PROGRESS\n`
      diagnosisDoc += `Several requirements still missing. Complete missing items before release.\n`
    } else {
      diagnosisDoc += `STATUS: ❌ NOT READY\n`
      diagnosisDoc += `Critical requirements missing. Complete all mandatory items before release.\n`
    }
    
    diagnosisDoc += `\nNOTES:\n`
    diagnosisDoc += `------\n`
    if (song.releaseApprovalNotes) {
      diagnosisDoc += `Approval Notes: ${song.releaseApprovalNotes}\n\n`
    }
    if (song.isDelayed) {
      diagnosisDoc += `⚠️ RELEASE IS DELAYED\n`
      if (song.delayReason) {
        diagnosisDoc += `Reason: ${song.delayReason}\n\n`
      }
    }
    diagnosisDoc += `\n© ${currentYear} Legendary Fyre Records\n\n`
    diagnosisDoc += `This diagnosis was automatically generated based on uploaded files and metadata.\n`
    diagnosisDoc += `Please review all items before proceeding with distribution.\n`

    archive.append(diagnosisDoc, { name: 'RELEASE_DIAGNOSIS.txt' })

    // Finalize the archive (streaming response; do not buffer in memory)
    archive.finalize()

    return new NextResponse(zipStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFileName}"`,
      },
    })
  } catch (error: any) {
    console.error('Release kit generation error:', error)
    console.error('Error stack:', error.stack)
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    })
    return NextResponse.json(
      { error: 'Failed to generate release kit', details: error.message, stack: process.env.NODE_ENV === 'development' ? error.stack : undefined },
      { status: 500 }
    )
  } finally {
    // Clean up temp directory if we created it
    // Note: We don't delete individual files as they may be needed during archive creation
    // The OS will clean up temp files automatically
  }
}

