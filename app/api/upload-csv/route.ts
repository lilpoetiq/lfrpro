import { NextRequest, NextResponse } from 'next/server'
import Papa from 'papaparse'
import { groupDataByArtist, extractArtistsFromCSV, cleanSongName, isNumericOnly } from '@/lib/utils'
import { saveUpload, saveArtistData, getCatalog, addCatalogItem, updateCatalogItem, CatalogItem, getUploads } from '@/lib/storage'
import { logActivity } from '@/lib/activityLog'
import { parseArtistsFromString } from '@/lib/artistParser'
import OpenAI from 'openai'

const openaiApiKey = process.env.OPENAI_API_KEY
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null

// Configure route for handling large CSV file uploads
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for large CSV processing

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Read file content
    const text = await file.text()
    
    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'CSV file is empty' },
        { status: 400 }
      )
    }
    
    // Parse CSV
    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    })

    if (parsed.errors.length > 0 && parsed.errors.some(e => e.type !== 'Quotes')) {
      return NextResponse.json(
        { error: 'CSV parsing error', details: parsed.errors },
        { status: 400 }
      )
    }

    if (!parsed.data || parsed.data.length === 0) {
      return NextResponse.json(
        { error: 'CSV file contains no data rows' },
        { status: 400 }
      )
    }

    // Group data by artist to ensure proper separation
    const groupedData = groupDataByArtist(parsed.data)
    const artistsFound = extractArtistsFromCSV(parsed.data)

    // AI-Powered Duplicate Detection: Check if this CSV is a duplicate or legitimate update
    // Note: This is non-blocking - if AI check fails, upload proceeds
    if (openai && openaiApiKey) {
      try {
        const duplicateCheck = await checkForDuplicateCSV(parsed.data, file.name)
        if (duplicateCheck.isDuplicate) {
          return NextResponse.json({
            success: false,
            error: 'Duplicate CSV detected',
            message: duplicateCheck.reason,
            suggestion: duplicateCheck.suggestion,
            details: duplicateCheck.details,
          }, { status: 400 })
        }
      } catch (error: any) {
        console.error('AI duplicate check error (non-critical, continuing):', error.message || error)
        // Continue with upload if AI check fails - don't block the upload
      }
    }

    // Save data for each artist
    Object.keys(groupedData).forEach((artistName) => {
      saveArtistData(artistName, groupedData[artistName])
    })

    // Add songs to catalog automatically
    const existingCatalog = getCatalog()
    console.log(`CSV Upload - Existing catalog has ${existingCatalog.length} items`)
    const songsAdded: string[] = []
    let songsSkipped = 0
    let songsUpdated = 0

    Object.keys(groupedData).forEach((artistName) => {
      console.log(`CSV Upload - Processing artist: ${artistName}`)
      const artistRows = groupedData[artistName]
      const songsMap = new Map<string, any>()

      // Aggregate songs from this artist's rows
      artistRows.forEach((row: any) => {
        // Use parsed values from groupDataByArtist if available, otherwise fallback to original fields
        let songName = row._parsedSong || row.song || row.Song || row.SONG || row['Song Name'] || row['song_name'] || row.title || row.Title || row['Track Name'] || ''
        // Clean song name of [Explicit] tags and filter out dates
        songName = cleanSongName(songName)
        
        // Skip if song name is empty, is a date, is numeric-only, or is "Unknown"
        const normalizedSongName = songName.toLowerCase().trim()
        if (!songName || songName.trim() === '' || isNumericOnly(songName) || normalizedSongName === 'unknown') {
          return
        }
        
        // Calculate total streams using improved logic (same as calculateTotalStreams)
        let streams = 0
        
        // Sum all Total columns (Total, Total_1, Total_2, etc.)
        Object.keys(row).forEach((key) => {
          if (key === 'Total' || key.startsWith('Total_')) {
            const value = row[key]
            if (value && value !== '') {
              const num = parseInt(String(value).replace(/,/g, '')) || 0
              streams += num
            }
          }
        })
        
        // If no Total columns found, sum individual platform columns
        if (streams === 0) {
          const platformKeywords = [
            'youtube', 'yt', 'you tube',
            'spotify', 'spot',
            'apple', 'apple music', 'itunes',
            'soundcloud', 'sc',
            'tidal',
            'amazon', 'amazon music',
            'deezer',
            'pandora',
            'iheartradio', 'iheart',
            'tiktok', 'tik tok',
            'instagram', 'ig',
            'facebook', 'fb',
            'twitter', 'tw',
            'streams', 'plays', 'views', 'listens'
          ]
          
          // Sum all platform-specific columns
          Object.keys(row).forEach((key) => {
            const keyLower = key.toLowerCase().trim()
            
            // Skip non-numeric columns
            if (keyLower.includes('song') || keyLower.includes('artist') || 
                keyLower.includes('title') || keyLower.includes('name') ||
                keyLower.includes('date') || keyLower.includes('time') ||
                keyLower.includes('url') || keyLower.includes('link') ||
                keyLower.includes('upc') || keyLower.includes('isrc') ||
                keyLower.includes('distributor') || keyLower.includes('platform')) {
              return
            }
            
            // Check if this looks like a platform column or numeric column
            const isPlatformColumn = platformKeywords.some(keyword => keyLower.includes(keyword))
            const value = row[key]
            
            // If it's a platform column or a numeric value, add it
            if (isPlatformColumn || (typeof value === 'number' && value > 0) || 
                (typeof value === 'string' && /^\d+[,\d]*$/.test(value.replace(/,/g, '')))) {
              const numValue = parseInt(String(value).replace(/,/g, '')) || 0
              if (numValue > 0) {
                streams += numValue
              }
            }
          })
        }
        
        // Final fallback: try standard streams column
        if (streams === 0) {
          streams = parseInt(String(row.streams || row.Streams || row.STREAMS || row.Total || row.total || row.TOTAL || 0).replace(/,/g, '')) || 0
        }
        
        const distributor = row.distributor || row.Distributor || row.DISTRIBUTOR || row.platform || row.Platform || row.PLATFORM || 'Unknown'
        
        if (songName && songName.trim() !== '') {
          const key = `${songName}-${artistName}`
          if (!songsMap.has(key)) {
            songsMap.set(key, {
              song: songName.trim(),
              artist: artistName,
              streams: streams,
              distributor: distributor,
              upc: row.upc || row.UPC || row['UPC Code'],
              isrc: row.isrc || row.ISRC || row['ISRC Code'],
              driveLink: row.driveLink || row['Google Drive Link'] || row['Drive Link'],
            })
          } else {
            const existing = songsMap.get(key)!
            existing.streams += streams  // This should aggregate properly
            if (row.upc && !existing.upc) existing.upc = row.upc
            if (row.isrc && !existing.isrc) existing.isrc = row.isrc
            if (row.driveLink && !existing.driveLink) existing.driveLink = row.driveLink
          }
        }
      })

      // Add to catalog if not already exists (use case-insensitive matching)
      console.log(`CSV Upload - Found ${songsMap.size} unique songs for ${artistName}`)
      
      // Refresh catalog after each artist to catch songs added in this loop
      let currentCatalog = getCatalog()
      
      songsMap.forEach((songData) => {
        // Normalize for comparison (case-insensitive, trimmed)
        const normalize = (str: string) => str.toLowerCase().trim()
        const normalizedSong = normalize(songData.song)
        const normalizedArtist = normalize(songData.artist)
        const csvStreams = songData.streams || 0
        
        // Check against current catalog (refresh each time to catch newly added songs)
        // First, try exact match (song name + artist name) - PRIORITIZE THIS
        let existing = currentCatalog.find(
          (item) => {
            const itemSongNormalized = normalize(item.song)
            const itemArtistNormalized = normalize(item.artist)
            return itemSongNormalized === normalizedSong && itemArtistNormalized === normalizedArtist
          }
        )
        
        // If no exact match, try partial artist match (handles variations like "Paris Monroh" vs "paris monroh")
        // Check if any artist in the existing item matches the CSV artist
        if (!existing) {
          existing = currentCatalog.find((item) => {
            const itemSongNormalized = normalize(item.song)
            if (itemSongNormalized !== normalizedSong) return false
            
            // Parse artists from both sides and compare
            const existingArtists = parseArtistsFromString(item.artist).map(a => normalize(a))
            const csvArtists = parseArtistsFromString(songData.artist).map(a => normalize(a))
            
            // Check if any artist matches
            return csvArtists.some(csvArtist => existingArtists.includes(csvArtist))
          })
        }
        
        // Also check if song exists as a single with a songs array (edge case)
        // Some singles have a songs array - check if the song name matches the main song name
        if (!existing) {
          existing = currentCatalog.find((item) => {
            const itemSongNormalized = normalize(item.song)
            const itemArtistNormalized = normalize(item.artist)
            // Match if song name and artist match, regardless of releaseType
            if (itemSongNormalized === normalizedSong && itemArtistNormalized === normalizedArtist) {
              return true
            }
            // Also check if it's a single with a songs array where one song matches
            if (item.releaseType === 'single' && item.songs && Array.isArray(item.songs)) {
              const hasMatchingSong = item.songs.some((s: any) => {
                const songNameMatch = normalize(s.song) === normalizedSong
                const artistMatch = normalize(item.artist) === normalizedArtist
                return songNameMatch && artistMatch
              })
              return hasMatchingSong
            }
            return false
          })
        }
        
        // Last resort: check for same song name only (for true collaborations)
        // But be more careful - only match if it's clearly the same song
        if (!existing) {
          const potentialMatch = currentCatalog.find(
            (item) => normalize(item.song) === normalizedSong
          )
          
          // Only use this match if the song name is distinctive (not common words)
          // This prevents false matches with generic song names
          if (potentialMatch && normalizedSong.length > 3 && !['song', 'track', 'music', 'title'].includes(normalizedSong)) {
            existing = potentialMatch
          }
        }
        
        // If not found as single, check if it's a song within an album/EP
        let nestedSongMatch: { album: CatalogItem; songIndex: number } | null = null
        if (!existing) {
          for (const item of currentCatalog) {
            if ((item.releaseType === 'album' || item.releaseType === 'ep') && item.songs && Array.isArray(item.songs)) {
              // First try exact match
              let songIndex = item.songs.findIndex((s: any) => 
                normalize(s.song) === normalizedSong && normalize(item.artist) === normalizedArtist
              )
              
              // If no exact match, try song name only (for collaborations)
              if (songIndex === -1) {
                songIndex = item.songs.findIndex((s: any) => 
                  normalize(s.song) === normalizedSong
                )
              }
              
              if (songIndex !== -1) {
                nestedSongMatch = { album: item, songIndex }
                break
              }
            }
          }
        }
        
        // IMPORTANT: If song already exists (as single or nested in album/EP), 
        // DO NOT create a duplicate entry - ALWAYS update the existing entry
        // This ensures "Big Energy by Paris Monroh" updates the existing track, not creates a duplicate
        if (existing) {
          // Found as top-level catalog item - ALWAYS update with CSV streams
          // CSV is the source of truth - use CSV streams directly, not calculations
          const existingStreams = existing.totalStreams || 0
          
          // Debug logging for matching
          console.log(`🔍 Matched "${songData.song}" by ${songData.artist}: existing streams=${existingStreams}, CSV streams=${csvStreams}, catalog ID=${existing.id}`)
          
          // Check if this is a collaboration (same song, different artist)
          const isCollaboration = normalize(existing.artist) !== normalizedArtist
          
          // Always update with CSV streams - CSV is the source of truth
          // This ensures "Big Energy by Paris Monroh" updates the existing track's streams
          try {
            // For collaborations, update artist field to include both artists
            let updatedArtist = existing.artist
            if (isCollaboration) {
              // Parse existing artists to check if the new artist is already included
              const existingArtists = parseArtistsFromString(existing.artist)
              const newArtists = parseArtistsFromString(songData.artist)
              
              // Normalize function for comparison (case-insensitive, trimmed)
              const normalize = (str: string) => str.toLowerCase().trim()
              
              // Check if any of the new artists are already in the existing artists list
              const hasNewArtist = newArtists.some(newArtist => 
                existingArtists.some(existingArtist => 
                  normalize(existingArtist) === normalize(newArtist)
                )
              )
              
              // Only add if the artist isn't already included
              if (!hasNewArtist) {
                // Combine artist names for collaborations (e.g., "Artist1 & Artist2")
                updatedArtist = `${existing.artist} & ${songData.artist}`
              }
            }
            
            // ALWAYS use CSV streams directly - CSV is the source of truth
            // This ensures the catalog reflects the latest CSV data
            updateCatalogItem(existing.id, {
              totalStreams: csvStreams, // Use CSV streams directly, not a calculation
              artist: updatedArtist,
              distributor: songData.distributor || existing.distributor,
              googleDriveUrl: songData.driveLink || existing.googleDriveUrl,
              upc: songData.upc || existing.upc,
              isrc: songData.isrc || existing.isrc,
              fromCSV: true,
            })
            
            songsUpdated++
            const logMsg = isCollaboration 
              ? `🔄 Updated existing track: "${songData.song}" by ${songData.artist} (${existingStreams} → ${csvStreams} streams) - matched existing entry`
              : `🔄 Updated existing track: "${songData.song}" by ${songData.artist} (${existingStreams} → ${csvStreams} streams)`
            console.log(logMsg)
              
              // Refresh catalog after update
              currentCatalog = getCatalog()
              
              // Log activity
              logActivity({
                action: isCollaboration ? 'Collaboration song streams updated in catalog' : 'Song streams updated in catalog',
                user: 'System',
                category: 'catalog',
                details: {
                  song: songData.song,
                  artist: songData.artist,
                  existingArtist: existing.artist,
                  songId: existing.id,
                  oldStreams: existingStreams,
                  streamDifference: csvStreams - existingStreams,
                  newStreams: csvStreams,
                  source: 'CSV upload',
                  isCollaboration,
                },
              })
            } catch (error: any) {
              console.error(`❌ Failed to update song in catalog: "${songData.song}" by ${songData.artist}`, error)
            }
        } else if (nestedSongMatch) {
          // Found as nested song in album/EP - update the nested song's streams
          const { album, songIndex } = nestedSongMatch
          const nestedSong = album.songs![songIndex]
          const existingStreams = nestedSong.streams || 0
          const streamDifference = csvStreams - existingStreams
          
          // Always update nested song streams with CSV value - CSV is source of truth
          const updatedSongs = [...album.songs!]
          updatedSongs[songIndex] = {
            ...nestedSong,
            streams: csvStreams, // Use CSV streams directly
          }
          
          // Update album/EP with new songs array (this will recalculate totalStreams)
          try {
            updateCatalogItem(album.id, {
              songs: updatedSongs,
              distributor: songData.distributor || album.distributor,
              googleDriveUrl: songData.driveLink || album.googleDriveUrl,
              upc: songData.upc || album.upc,
              isrc: nestedSong.isrc || songData.isrc || album.isrc,
            })
            
            songsUpdated++
            console.log(`🔄 Updated nested song in ${album.releaseType}: "${songData.song}" by ${songData.artist} (${existingStreams} → ${csvStreams} streams)`)
              
              // Refresh catalog after update
              currentCatalog = getCatalog()
              
              // Log activity
              logActivity({
                action: 'Nested song streams updated in catalog',
                user: 'System',
                category: 'catalog',
                details: {
                  song: songData.song,
                  artist: songData.artist,
                  albumId: album.id,
                  albumName: album.song,
                  oldStreams: existingStreams,
                  streamDifference: csvStreams - existingStreams,
                  newStreams: csvStreams,
                  source: 'CSV upload',
                },
              })
            } catch (error: any) {
              console.error(`❌ Failed to update nested song in catalog: "${songData.song}" by ${songData.artist}`, error)
            }
        } else if (!existing && !nestedSongMatch) {
          // Song doesn't exist anywhere - add it as a new single
          // Only add if it doesn't exist as a single OR nested in an album/EP
          // Double-check: skip if song name is "Unknown" or empty
          const finalSongName = songData.song.trim()
          const finalArtistName = songData.artist.trim()
          
          // Debug logging for unmatched songs
          if (!existing && !nestedSongMatch) {
            console.log(`⚠️ No match found for "${finalSongName}" by "${finalArtistName}" (CSV streams: ${csvStreams}) - will add as new entry`)
          }
          
          if (!finalSongName || finalSongName.toLowerCase() === 'unknown' || !finalArtistName || finalArtistName.toLowerCase() === 'unknown') {
            songsSkipped++
            console.log(`⏭️ Skipped adding song with invalid name/artist: "${finalSongName}" by "${finalArtistName}"`)
            return
          }
          
          try {
            const newItem = addCatalogItem({
              song: finalSongName,
              artist: finalArtistName,
              releaseType: 'single',
              totalStreams: csvStreams,
              distributor: songData.distributor,
              manuallyAdded: false,
              fromCSV: true,
              googleDriveUrl: songData.driveLink,
              upc: songData.upc,
              isrc: songData.isrc,
            })
            songsAdded.push(`${finalSongName} - ${finalArtistName}`)
            
            console.log(`✅ Added NEW song to catalog: "${finalSongName}" by ${finalArtistName} (${csvStreams} streams) - ID: ${newItem.id}`)
            
            // Refresh catalog to include this newly added song
            currentCatalog = getCatalog()
            
            // Log activity
            logActivity({
              action: 'Song added to catalog from CSV',
              user: 'System',
              category: 'catalog',
              details: {
                song: songData.song,
                artist: songData.artist,
                songId: newItem.id,
                streams: csvStreams,
                source: 'CSV upload',
              },
            })
          } catch (error: any) {
            console.error(`❌ Failed to add song to catalog: "${songData.song}" by ${songData.artist}`, error)
          }
        }
      })
    })
    
    console.log(`CSV Upload Summary - Added: ${songsAdded.length}, Updated: ${songsUpdated}, Skipped: ${songsSkipped}`)

    // Store upload metadata
    const uploadData = {
      id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fileName: file.name,
      uploadedAt: new Date().toISOString(),
      rowCount: parsed.data.length,
      data: parsed.data,
      groupedByArtist: groupedData,
      artistsFound: artistsFound,
      metadata: {
        size: file.size,
        type: file.type,
        artistCount: artistsFound.length,
      },
    }

    saveUpload(uploadData)

    // Log upload activity
    logActivity({
      action: 'CSV file uploaded and processed',
      user: 'System',
      category: 'upload',
      details: {
        fileName: file.name,
        rowCount: parsed.data.length,
        artistsFound: artistsFound,
        songsAdded: songsAdded.length,
        songsAddedList: songsAdded,
      },
    })

    // Auto-trigger AI analysis after upload (fire and forget - don't block upload response)
    const hasApiKey = !!process.env.OPENAI_API_KEY
    if (hasApiKey) {
      // Trigger analysis asynchronously without waiting for response
      // Use setTimeout to ensure it runs after the response is sent
      setTimeout(async () => {
        try {
          console.log('Auto-triggering AI analysis for upload:', uploadData.id)
          // Make internal API call to trigger analysis
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
          const response = await fetch(`${baseUrl}/api/analyze-data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uploadId: uploadData.id }),
          })
          
          const result = await response.json()
          if (!response.ok) {
            console.error('Analysis API error:', result.error || result.details || 'Unknown error')
          } else {
            console.log('Analysis triggered successfully:', result.analysisId)
          }
        } catch (error: any) {
          console.error('Auto-analysis error:', error.message || error)
          console.error('Error stack:', error.stack)
          // Silently fail - don't affect upload
        }
      }, 100)
    }

    return NextResponse.json({
      success: true,
      id: uploadData.id,
      rowCount: parsed.data.length,
      artistsFound: artistsFound,
      songsAdded: songsAdded.length,
      songsAddedList: songsAdded.slice(0, 20), // Include first 20 for debugging
      songsUpdated: songsUpdated,
      songsSkipped: songsSkipped,
      message: `CSV uploaded successfully. ${songsAdded.length} song(s) added to catalog${songsUpdated > 0 ? `, ${songsUpdated} updated` : ''}${songsSkipped > 0 ? `, ${songsSkipped} skipped (no changes)` : ''}.`,
          analysisTriggered: !!process.env.OPENAI_API_KEY,
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload CSV', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * AI-Powered Duplicate Detection
 * Uses OpenAI to intelligently determine if a CSV upload is a duplicate or legitimate update
 * Considers factors like time elapsed, growth patterns, song age, and overall data similarity
 */
async function checkForDuplicateCSV(
  newCSVData: any[],
  fileName: string
): Promise<{
  isDuplicate: boolean
  reason: string
  suggestion: string
  details?: any
}> {
  if (!openai) {
    return { isDuplicate: false, reason: '', suggestion: '' }
  }

  try {
    // Get recent uploads (last 60 days)
    const recentUploads = getUploads()
      .filter(u => {
        const uploadDate = new Date(u.uploadedAt)
        const daysDiff = (Date.now() - uploadDate.getTime()) / (1000 * 60 * 60 * 24)
        return daysDiff <= 60 && u.data && Array.isArray(u.data) && u.data.length > 0
      })
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
      .slice(0, 5) // Check last 5 uploads

    if (recentUploads.length === 0) {
      return { isDuplicate: false, reason: '', suggestion: '' }
    }

    // Create summary of new CSV
    const newCSVSummary = createCSVSummary(newCSVData, 'NEW_UPLOAD')

    // Create summaries of recent uploads
    const recentSummaries = recentUploads.map((upload, index) => ({
      ...createCSVSummary(upload.data || [], `UPLOAD_${index + 1}`),
      uploadedAt: upload.uploadedAt,
      fileName: upload.fileName,
      daysAgo: Math.floor((Date.now() - new Date(upload.uploadedAt).getTime()) / (1000 * 60 * 60 * 24)),
    }))

    // Prepare AI prompt
    const prompt = `You are an expert music industry data analyst. Analyze whether a new CSV upload is a duplicate of a previous upload or represents legitimate growth/updates.

NEW CSV UPLOAD:
${JSON.stringify(newCSVSummary, null, 2)}

RECENT PREVIOUS UPLOADS:
${JSON.stringify(recentSummaries, null, 2)}

CRITICAL CONTEXT:
- Music streaming numbers naturally grow over time, especially for new releases
- An old CSV might have been uploaded when a song just dropped, so numbers could legitimately grow significantly
- Songs typically see rapid growth in the first few weeks/months after release
- Growth rates vary: new songs (0-3 months) can grow 10-50%+ per month, older songs (6+ months) grow slower (1-10% per month)
- Consider the time elapsed since the last upload when evaluating if growth is legitimate

ANALYSIS REQUIREMENTS:
1. Compare song names (case-insensitive, normalized) - are the same songs present?
2. Compare stream totals - are they similar or have they grown?
3. Calculate growth percentage: ((newStreams - oldStreams) / oldStreams) * 100
4. Consider time elapsed: Is the growth reasonable given the days since last upload?
5. Check overall data structure: Are the columns, artists, and song counts similar?

DETERMINE IF DUPLICATE:
- If songs match ≥90% AND stream totals are within 2% AND uploaded within 7 days → LIKELY DUPLICATE
- If songs match ≥90% AND stream totals are within 5% AND uploaded within 14 days → POSSIBLY DUPLICATE (check growth rate)
- If songs match ≥90% BUT streams have grown significantly (>10% growth) → LIKELY LEGITIMATE UPDATE
- If songs match ≥90% BUT time elapsed is >30 days AND growth is reasonable → LIKELY LEGITIMATE UPDATE
- If songs match ≥90% BUT growth rate is consistent with expected patterns (e.g., 20% growth over 30 days for new song) → LIKELY LEGITIMATE UPDATE

You MUST respond with valid JSON only. Do not include any text before or after the JSON object.

Required JSON format:
{
  "isDuplicate": true or false,
  "confidence": "high" or "medium" or "low",
  "reason": "Detailed explanation of why this is/isn't a duplicate (2-3 sentences)",
  "suggestion": "What the user should do",
  "details": {
    "matchingSongs": "X out of Y songs match",
    "streamGrowth": "X% growth",
    "timeElapsed": "X days since last upload",
    "growthRate": "X% per month (calculated)",
    "isReasonableGrowth": true or false,
    "matchedUpload": "Which upload this matches (if any)"
  }
}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Using mini for cost efficiency, still very capable
      messages: [
        {
          role: 'system',
          content: `You are an expert music industry data analyst specializing in streaming data analysis and duplicate detection. You understand that music streaming numbers grow over time, especially for new releases. You can distinguish between duplicate uploads and legitimate updates based on growth patterns, time elapsed, and data similarity.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2, // Low temperature for consistent, accurate analysis
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    }, {
      timeout: 30000, // 30 second timeout
    })

    const responseContent = completion.choices[0].message.content || '{}'
    let jsonString = responseContent.trim()
    
    // Extract JSON if wrapped in markdown
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/```\n?/g, '').trim()
    }

    // Try to extract JSON object if response contains extra text
    try {
      // Try to find JSON object in the response
      const jsonMatch = jsonString.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        jsonString = jsonMatch[0]
      }
      
      const aiResponse = JSON.parse(jsonString)

      return {
        isDuplicate: aiResponse.isDuplicate === true,
        reason: aiResponse.reason || '',
        suggestion: aiResponse.suggestion || '',
        details: aiResponse.details,
      }
    } catch (parseError: any) {
      console.error('AI response JSON parse error:', parseError)
      console.error('Response content:', jsonString.substring(0, 500))
      // If JSON parsing fails, allow upload to proceed (fail open)
      return { isDuplicate: false, reason: '', suggestion: '' }
    }
  } catch (error: any) {
    console.error('AI duplicate check error:', error.message || error)
    // If AI check fails, allow upload to proceed (fail open)
    return { isDuplicate: false, reason: '', suggestion: '' }
  }
}

/**
 * Create a summary of CSV data for AI analysis
 */
function createCSVSummary(data: any[], label: string): {
  label: string
  totalRows: number
  uniqueSongs: number
  totalStreams: number
  songs: Array<{
    name: string
    streams: number
    artist?: string
  }>
  artists: string[]
  averageStreamsPerSong: number
} {
  const songs = new Map<string, { streams: number; artist?: string }>()
  const artists = new Set<string>()
  let totalStreams = 0

  data.forEach((row: any) => {
    const songName = cleanSongName(
      row._parsedSong || row.song || row.Song || row.SONG || row['Song Name'] || row['song_name'] || row.title || row.Title || row['Track Name'] || ''
    )

    if (!songName || songName.trim() === '' || isNumericOnly(songName)) {
      return
    }

    const artist = row.artist || row.Artist || row.ARTIST || row['Artist Name'] || ''
    if (artist) artists.add(artist)

    // Calculate streams (same logic as main function)
    let streams = 0
    Object.keys(row).forEach((key) => {
      if (key === 'Total' || key.startsWith('Total_')) {
        const value = row[key]
        if (value && value !== '') {
          const num = parseInt(String(value).replace(/,/g, '')) || 0
          streams += num
        }
      }
    })

    if (streams === 0) {
      streams = parseInt(String(row.streams || row.Streams || row.STREAMS || row.Total || row.total || row.TOTAL || 0).replace(/,/g, '')) || 0
    }

    if (streams > 0) {
      const normalizedSong = songName.toLowerCase().trim()
      const existing = songs.get(normalizedSong)
      if (existing) {
        existing.streams += streams
      } else {
        songs.set(normalizedSong, { streams, artist: artist || undefined })
      }
      totalStreams += streams
    }
  })

  const songsArray = Array.from(songs.entries()).map(([name, data]) => ({
    name,
    streams: data.streams,
    artist: data.artist,
  }))

  return {
    label,
    totalRows: data.length,
    uniqueSongs: songs.size,
    totalStreams,
    songs: songsArray.slice(0, 50), // Limit to first 50 songs for token efficiency
    artists: Array.from(artists),
    averageStreamsPerSong: songs.size > 0 ? Math.round(totalStreams / songs.size) : 0,
  }
}
