import { NextRequest, NextResponse } from 'next/server'
import { getUploads } from '@/lib/storage'
import { cleanSongName, isDateString } from '@/lib/utils'
import { logActivity } from '@/lib/activityLog'
import { getDataPath } from '@/lib/uploadConfig'
import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'

const DATA_DIR = getDataPath()

const openaiApiKey = process.env.OPENAI_API_KEY

if (!openaiApiKey) {
  console.warn('OPENAI_API_KEY is not set in environment variables')
}

const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null

export async function POST(request: NextRequest) {
  try {
    if (!openaiApiKey || !openai) {
      return NextResponse.json(
        { error: 'OpenAI API key missing. Set OPENAI_API_KEY in environment.' },
        { status: 500 }
      )
    }

    const { uploadId } = await request.json()

    // Get the uploaded CSV data
    const uploads = getUploads()
    const upload = uploadId 
      ? uploads.find(u => u.id === uploadId)
      : uploads.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0]
    
    if (!upload) {
      return NextResponse.json(
        { error: 'No CSV data found' },
        { status: 404 }
      )
    }

    // Prepare data summary for AI analysis with proper artist separation
    const groupedData = upload.groupedByArtist || {}
    const artistsFound = upload.artistsFound || []
    
    // Create a comprehensive summary for each artist - process ALL data, not just samples
    const artistSummaries: Record<string, any> = {}
    Object.keys(groupedData).forEach((artistName) => {
      const artistRows = groupedData[artistName]
      
      // Process ALL rows to get accurate totals and statistics
      // Clean sample rows to emphasize correct song/artist info with ALL numeric data
      // Use more sample rows (up to 20) for better analysis, but process all for stats
      const cleanedSampleRows = artistRows.slice(0, 20).map((row: any) => {
        // Create a cleaned version that highlights the primary song/artist
        const cleaned: any = {
          PRIMARY_SONG: cleanSongName(row._parsedSong || 'N/A'),
          PRIMARY_ARTIST: row._parsedArtist || artistName,
          Spotify: row.Spotify || row.spotify || 'N/A',
        }
        
        // Add stream counts - sum all Total columns
        let totalStreams = 0
        const totalColumns: Record<string, number> = {}
        Object.keys(row).forEach((key) => {
          if (key === 'Total' || key.startsWith('Total_')) {
            const value = row[key]
            if (value && value !== '') {
              const num = parseInt(String(value).replace(/,/g, '')) || 0
              totalStreams += num
              totalColumns[key] = num
            }
          }
        })
        
        // If no Total columns, try standard streams column
        if (totalStreams === 0) {
          totalStreams = parseInt(String(row.streams || row.Streams || row.STREAMS || 0).replace(/,/g, '')) || 0
        }
        
        // Add all numeric data so AI can see the actual numbers
        cleaned.Total_Streams = totalStreams
        cleaned.Total_Columns = totalColumns
        
        // Add all platform-specific numeric columns
        Object.keys(row).forEach((key) => {
          const value = row[key]
          // Include any numeric values (stream counts, plays, etc.)
          if (typeof value === 'number' && value > 0) {
            cleaned[key] = value
          } else if (typeof value === 'string') {
            const numValue = parseInt(value.replace(/,/g, ''))
            if (!isNaN(numValue) && numValue > 0 && !key.toLowerCase().includes('date') && !key.toLowerCase().includes('song') && !key.toLowerCase().includes('artist')) {
              cleaned[key] = numValue
            }
          }
        })
        
        return cleaned
      })
      
      // Calculate comprehensive aggregate stats for this artist - process ALL rows
      let artistTotalStreams = 0
      let songCount = 0
      const songStreams: Record<string, number> = {}
      const platformStreams: Record<string, number> = {}
      const distributorCounts: Record<string, number> = {}
      
      // Process ALL rows to get accurate statistics
      artistRows.forEach((row: any) => {
        const songName = cleanSongName(row._parsedSong || '')
        if (songName && !isDateString(songName)) {
          let streams = 0
          
          // Sum all Total columns first
          Object.keys(row).forEach((key) => {
            if (key === 'Total' || key.startsWith('Total_')) {
              const value = row[key]
              if (value && value !== '') {
                const num = parseInt(String(value).replace(/,/g, '')) || 0
                streams += num
              }
            }
          })
          
          // If no Total columns, sum individual platform columns
          if (streams === 0) {
            const platformKeywords = [
              'youtube', 'yt', 'you tube', 'spotify', 'spot',
              'apple', 'apple music', 'itunes', 'soundcloud', 'sc',
              'tidal', 'amazon', 'amazon music', 'deezer', 'pandora',
              'iheartradio', 'iheart', 'tiktok', 'tik tok',
              'instagram', 'ig', 'facebook', 'fb', 'twitter', 'tw',
              'streams', 'plays', 'views', 'listens'
            ]
            
            Object.keys(row).forEach((key) => {
              const keyLower = key.toLowerCase().trim()
              const isPlatformColumn = platformKeywords.some(keyword => keyLower.includes(keyword))
              const value = row[key]
              
              if (isPlatformColumn || (typeof value === 'number' && value > 0) || 
                  (typeof value === 'string' && /^\d+[,\d]*$/.test(value.replace(/,/g, '')))) {
                const numValue = parseInt(String(value).replace(/,/g, '')) || 0
                if (numValue > 0) {
                  streams += numValue
                  // Track platform-specific streams
                  if (isPlatformColumn) {
                    const platformName = key
                    platformStreams[platformName] = (platformStreams[platformName] || 0) + numValue
                  }
                }
              }
            })
          }
          
          // Final fallback: try standard streams column
          if (streams === 0) {
            streams = parseInt(String(row.streams || row.Streams || row.STREAMS || 0).replace(/,/g, '')) || 0
          }
          
          // Track distributor
          const distributor = row.distributor || row.Distributor || row.DISTRIBUTOR || 'Unknown'
          distributorCounts[distributor] = (distributorCounts[distributor] || 0) + 1
          
          if (streams > 0) {
            artistTotalStreams += streams
            songCount++
            if (!songStreams[songName]) {
              songStreams[songName] = 0
            }
            songStreams[songName] += streams
          }
        }
      })
      
      // Find top songs (more comprehensive - top 10)
      const topSongs = Object.entries(songStreams)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([song, streams]) => ({ song, streams }))
      
      // Find top platforms
      const topPlatforms = Object.entries(platformStreams)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([platform, streams]) => ({ platform, streams }))
      
      // Calculate additional metrics
      const uniqueSongs = Object.keys(songStreams).length
      const medianStreams = uniqueSongs > 0 
        ? Object.values(songStreams).sort((a, b) => a - b)[Math.floor(uniqueSongs / 2)]
        : 0
      
      artistSummaries[artistName] = {
        rowCount: artistRows.length,
        columns: artistRows.length > 0 ? Object.keys(artistRows[0]) : [],
        sampleRows: cleanedSampleRows,
        totalStreams: artistTotalStreams,
        songCount: songCount,
        uniqueSongCount: uniqueSongs,
        topSongs: topSongs,
        topPlatforms: topPlatforms,
        distributorBreakdown: distributorCounts,
        averageStreamsPerSong: songCount > 0 ? Math.round(artistTotalStreams / songCount) : 0,
        medianStreamsPerSong: medianStreams,
        maxStreamsPerSong: uniqueSongs > 0 ? Math.max(...Object.values(songStreams)) : 0,
        minStreamsPerSong: uniqueSongs > 0 ? Math.min(...Object.values(songStreams)) : 0,
      }
    })

    // Create AI prompt with artist separation
    const prompt = `Analyze the following music label streaming data. IMPORTANT: The data contains multiple artists. You MUST analyze each artist separately and provide insights for EACH artist individually. Do not mix data between artists.

CRITICAL: For each artist, the PRIMARY_SONG and PRIMARY_ARTIST fields are the CORRECT song and artist for that row. Other platform columns (like YouTube, Apple Music, etc.) may contain DIFFERENT songs from OTHER artists - these are just showing what's playing on those platforms and should NOT be used to identify the artist's songs. Always use PRIMARY_SONG and PRIMARY_ARTIST when referring to songs.

Data Structure:
- Total rows: ${upload.rowCount}
- Artists found: ${artistsFound.join(', ')}
- Columns: ${upload.data && upload.data.length > 0 ? Object.keys(upload.data[0]).join(', ') : 'N/A'}

Artist-specific data:
${Object.keys(artistSummaries).map(artist => {
  const summary = artistSummaries[artist]
  return `
Artist: ${artist}
- Total Rows Processed: ${summary.rowCount}
- Total Streams: ${summary.totalStreams.toLocaleString()}
- Total Songs: ${summary.songCount}
- Unique Songs: ${summary.uniqueSongCount}
- Average Streams per Song: ${summary.averageStreamsPerSong.toLocaleString()}
- Median Streams per Song: ${summary.medianStreamsPerSong.toLocaleString()}
- Max Streams (Single Song): ${summary.maxStreamsPerSong.toLocaleString()}
- Min Streams (Single Song): ${summary.minStreamsPerSong.toLocaleString()}
- Top 10 Songs with Exact Stream Counts:
${summary.topSongs.map((s: any) => `  • "${s.song}": ${s.streams.toLocaleString()} streams`).join('\n')}
- Top Platforms by Streams:
${summary.topPlatforms.map((p: any) => `  • ${p.platform}: ${p.streams.toLocaleString()} streams`).join('\n')}
- Distributor Breakdown:
${Object.entries(summary.distributorBreakdown).map(([dist, count]) => `  • ${dist}: ${count} songs`).join('\n')}
- Sample data rows with ALL numeric values (PRIMARY_SONG is the correct song name):
${JSON.stringify(summary.sampleRows, null, 2)}
`
}).join('\n')}

For EACH artist, provide COMPREHENSIVE, DETAILED insights. Each insight should be 3-5 paragraphs long with in-depth analysis. Do NOT provide single-sentence insights.

For EACH artist, provide detailed insights on:
1. Streaming trends and patterns specific to that artist (use PRIMARY_SONG field for song names)
   - Analyze the total streams, average streams per song, median streams, and top performing songs
   - Compare the top song with the lowest performing song using exact stream counts
   - Identify patterns in performance (which songs are doing well, which need attention) using the exact stream counts provided
   - Discuss growth trends and trajectory based on the distribution of streams across songs
   - Reference specific numbers from the topSongs data: "Song X has X streams, while Song Y has Y streams"
   - Analyze the spread between highest and lowest performing songs using maxStreamsPerSong and minStreamsPerSong

2. Performance breakdown by platform for that artist - USE THE ACTUAL NUMBERS provided
   - Break down which platforms are driving the most streams using the platform breakdown data
   - Compare platform performance with specific numbers from the topPlatforms data
   - Calculate percentage distribution: "Platform X accounts for Y% of total streams"
   - Identify platform-specific opportunities based on which platforms show strong performance
   - Discuss cross-platform strategies considering the actual distribution
   - Reference exact platform stream counts from the topPlatforms array

3. Engagement patterns and growth opportunities for that artist
   - Analyze engagement metrics using the median, average, and distribution data
   - Identify specific growth opportunities based on songs that are underperforming relative to top performers
   - Compare performance across different songs using the exact stream counts from topSongs
   - Calculate growth potential: "If Song X (currently at Y streams) reached Song Z's level (Z streams), that would represent W additional streams"
   - Provide data-driven recommendations with specific targets based on the numbers

4. Detailed recommendations for optimization specific to that artist
   - Provide actionable strategies based on the actual numbers and patterns identified
   - Suggest specific next steps with measurable goals (e.g., "Focus on promoting Song X to reach Y streams")
   - Reference which songs should be prioritized based on their current performance and potential from topSongs data
   - Give concrete examples based on the data: "Song A has X streams and could benefit from Y strategy"
   - Use distributor breakdown to identify which distribution channels are most effective

CRITICAL REQUIREMENTS: 
- Each insight MUST be 3-5 paragraphs long - NO single sentences
- Always reference the ACTUAL NUMBERS (stream counts, totals) when providing insights
- Use the PRIMARY_SONG field when mentioning specific songs
- Do NOT use song names from other platform columns (YouTube, Apple Music, etc.) as those may be different songs from other artists
- When discussing stream counts, ALWAYS use the exact numbers: "5,234 streams" not "a few thousand" or "little streams"
- Provide comprehensive analysis, not brief summaries
- Include specific examples from the data in each insight
- Make insights actionable and detailed

You MUST respond with valid JSON only. Format the response as JSON with the following EXACT structure:
{
  "insights": [
    {
      "title": "Insight title",
      "category": "streaming_trends",
      "insight": "COMPREHENSIVE 3-5 paragraph detailed insight description. This must be multiple paragraphs, not a single sentence. Include specific numbers, comparisons, trends, and detailed analysis. Specify which artist this applies to and reference actual stream counts.",
      "recommendation": "Detailed actionable recommendation with specific steps (2-3 paragraphs)",
      "trend": "up",
      "artist": "Artist name this insight applies to",
      "PRIMARY_SONG": "The main song title for this insight",
      "PRIMARY_ARTIST": "The main artist for this insight"
    }
  ],
  "summary": "Comprehensive overall summary of findings across all artists (3-5 paragraphs)",
  "artistSummaries": {
    "Artist Name": {
      "summary": "Comprehensive summary for this specific artist (3-5 paragraphs with detailed analysis)",
      "keyMetrics": "Detailed key metrics analysis for this artist (2-3 paragraphs)"
    }
  }
}

REMEMBER: 
- Each "insight" field MUST be 3-5 paragraphs long - NO single sentences
- Each "recommendation" field MUST be 2-3 paragraphs long
- Each "summary" field MUST be 3-5 paragraphs long
- Each "keyMetrics" field MUST be 2-3 paragraphs long
- Use actual numbers from the data provided
- Be comprehensive and detailed in your analysis`

    // Call OpenAI API with comprehensive settings for thorough analysis
    console.log(`Starting comprehensive AI analysis for ${artistsFound.length} artist(s) with ${upload.rowCount} total rows...`)
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o', // Using gpt-4o for best quality and accuracy
      messages: [
        {
          role: 'system',
          content: `You are an expert music industry data analyst specializing in streaming analytics, performance metrics, and engagement patterns. 
          
CRITICAL INSTRUCTIONS:
- You MUST analyze ALL the data provided thoroughly and accurately
- Use EXACT numbers from the data - never approximate or round significantly
- Provide comprehensive, detailed analysis - each insight must be 3-5 paragraphs
- Reference specific songs, stream counts, platforms, and metrics by their exact values
- Compare and contrast different songs, platforms, and time periods using actual numbers
- Identify patterns, trends, and anomalies using the precise data provided
- Make actionable recommendations based on the specific numbers shown

You MUST respond with valid JSON only. Do not include any text before or after the JSON object.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Lower temperature for more accurate, consistent analysis
      max_tokens: 8000, // Significantly increased for comprehensive paragraph-length insights
      response_format: { type: 'json_object' },
    }, {
      timeout: 120000, // 2 minute timeout to allow thorough analysis (in options, not params)
    })
    
    console.log(`AI analysis completed. Tokens used: ${completion.usage?.total_tokens || 'unknown'}`)

    const responseContent = completion.choices[0].message.content || '{}'
    
    // Try to extract JSON if wrapped in markdown code blocks
    let jsonString = responseContent.trim()
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }
    
    let analysis
    try {
      analysis = JSON.parse(jsonString)
    } catch (parseError: any) {
      console.error('JSON parse error:', parseError)
      console.error('Response content:', responseContent)
      // Return a default structure if parsing fails
      analysis = {
        insights: [{
          title: 'Analysis Error',
          category: 'error',
          insight: 'Failed to parse AI response. Please try again.',
          recommendation: 'Check the data format and try regenerating insights.',
          trend: 'stable',
          artist: 'Unknown'
        }],
        summary: 'Analysis could not be completed due to parsing error.',
        artistSummaries: {}
      }
    }

    // Validate analysis structure
    if (!analysis.insights || !Array.isArray(analysis.insights)) {
      analysis.insights = []
    }
    if (!analysis.summary) {
      analysis.summary = 'Analysis completed.'
    }
    if (!analysis.artistSummaries) {
      analysis.artistSummaries = {}
    }

    // Store analysis locally
    const analysesFile = path.join(DATA_DIR, 'analyses.json')
    let analyses: any[] = []
    
    if (fs.existsSync(analysesFile)) {
      analyses = JSON.parse(fs.readFileSync(analysesFile, 'utf-8'))
    }
    
    const analysisData = {
      id: `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      uploadId: upload.id,
      analysis,
      generatedAt: new Date().toISOString(),
      model: 'gpt-4o-mini',
    }
    
    analyses.push(analysisData)
    fs.writeFileSync(analysesFile, JSON.stringify(analyses, null, 2))

    // Log activity
    logActivity({
      action: 'AI analysis completed',
      user: 'System',
      category: 'analysis',
      details: {
        uploadId: upload.id,
        fileName: upload.fileName,
        artistsAnalyzed: artistsFound.length,
        analysisId: analysisData.id,
      },
    })

    return NextResponse.json({
      success: true,
      analysisId: analysisData.id,
      analysis,
    })
  } catch (error: any) {
    console.error('Analysis error:', error)
    console.error('Error stack:', error.stack)
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
      status: error.status,
    })
    
    // More descriptive error message
    let errorMessage = 'Failed to analyze data'
    if (error.message) {
      errorMessage += `: ${error.message}`
    }
    if (error.code === 'insufficient_quota') {
      errorMessage = 'OpenAI API quota exceeded. Please check your API key limits.'
    } else if (error.code === 'invalid_api_key') {
      errorMessage = 'Invalid OpenAI API key. Please check your API key.'
    } else if (error.message?.includes('timeout')) {
      errorMessage = 'Analysis timed out. The data might be too large. Please try again.'
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: error.message,
        errorType: error.name || 'Unknown',
        code: error.code,
      },
      { status: 500 }
    )
  }
}
