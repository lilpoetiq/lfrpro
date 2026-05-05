import { NextRequest, NextResponse } from 'next/server'
import { mkdir } from 'fs/promises'
import path from 'path'
import { addSpotifySnapshot } from '@/lib/storage'
import { getUploadPath } from '@/lib/uploadConfig'
import { writeUploadToDisk } from '@/lib/writeUploadToDisk'

const UPLOAD_DIR = getUploadPath('spotify-screenshots')

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true })
  } catch (error) {
    // Directory might already exist
  }
}

/**
 * POST /api/spotify-screenshot
 * Upload Spotify screenshot and process with AI vision
 */
export async function POST(request: NextRequest) {
  try {
    await ensureUploadDir()

    const formData = await request.formData()
    const file = formData.get('file') as File
    const artistId = formData.get('artistId') as string
    const releaseId = formData.get('releaseId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!artistId) {
      return NextResponse.json({ error: 'Artist ID is required' }, { status: 400 })
    }

    // Validate file type (PNG/JPG only)
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg']
    const fileExtension = path.extname(file.name).toLowerCase()
    const isValidType = allowedTypes.includes(file.type) || ['.png', '.jpg', '.jpeg'].includes(fileExtension)

    if (!isValidType) {
      return NextResponse.json(
        { 
          error: 'Invalid file type',
          details: 'Only PNG and JPG images are allowed',
          code: 'INVALID_FILE_TYPE'
        },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB for images)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { 
          error: 'File too large',
          details: 'File size must be less than 10MB',
          code: 'FILE_TOO_LARGE',
          maxSize: '10MB',
          actualSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`
        },
        { status: 400 }
      )
    }

    // Validate file is actually an image (basic check)
    if (file.size < 100) {
      return NextResponse.json(
        { 
          error: 'Invalid file',
          details: 'File appears to be corrupted or invalid',
          code: 'INVALID_FILE'
        },
        { status: 400 }
      )
    }

    // Generate unique filename
    const extension = fileExtension || (file.type.includes('png') ? '.png' : '.jpg')
    const { getReadableFileName } = await import('@/lib/fileNaming')
    const fileName = getReadableFileName({
      baseName: `spotify_${artistId}`,
      extension,
      directory: UPLOAD_DIR,
    })
    const filePath = path.join(UPLOAD_DIR, fileName)

    await writeUploadToDisk(file, filePath)

    // Create file URL
    const fileUrl = `/api/files/spotify-screenshots/${fileName}`

    // Process with AI vision (with retry logic)
    let processedData: any = null
    let processingError: string | null = null
    const maxRetries = 3
    let retryCount = 0

    while (retryCount < maxRetries && !processedData) {
      try {
        processedData = await processSpotifyScreenshot(filePath, fileUrl, retryCount > 0)
        if (processedData && processedData.success) {
          break // Success, exit retry loop
        }
      } catch (error: any) {
        retryCount++
        console.error(`[Spotify Screenshot] AI processing error (attempt ${retryCount}/${maxRetries}):`, error)
        
        if (retryCount >= maxRetries) {
          processingError = `Failed after ${maxRetries} attempts: ${error.message}`
          // Still save the file URL for manual review
        } else {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount))
        }
      }
    }

    // Save snapshot if processing succeeded (or with low confidence flag)
    if (processedData && processedData.success) {
      const weekStart = processedData.data.weekStart || new Date().toISOString().split('T')[0]
      const confidence = processedData.data.confidence || 0
      
      addSpotifySnapshot({
        artistId,
        releaseId: releaseId || undefined,
        weekStart,
        streams: processedData.data.streams || 0,
        listeners: processedData.data.listeners || 0,
        saveRate: processedData.data.saveRate || 0,
        playlistAdds: processedData.data.playlistAdds || 0,
        topCities: processedData.data.topCities || [],
        confidence,
        rawImageUrl: fileUrl,
        lowConfidenceFlag: confidence < 0.7, // Flag low confidence
        processingError: processingError || undefined,
      })
    } else if (processingError) {
      // Save with error flag for admin review
      addSpotifySnapshot({
        artistId,
        releaseId: releaseId || undefined,
        weekStart: new Date().toISOString().split('T')[0],
        streams: 0,
        listeners: 0,
        saveRate: 0,
        playlistAdds: 0,
        topCities: [],
        confidence: 0,
        rawImageUrl: fileUrl,
        lowConfidenceFlag: true,
        processingError,
      })
    }

    return NextResponse.json({
      success: true,
      fileUrl,
      fileName,
      processed: !!processedData?.success,
      data: processedData?.data || null,
      error: processingError || null,
      warnings: processedData?.data?.confidence < 0.7 
        ? ['Low confidence OCR detected. Please verify extracted data.']
        : [],
    })
  } catch (error: any) {
    console.error('Spotify screenshot upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload screenshot', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Process Spotify screenshot with AI vision
 * @param imagePath - Path to the image file
 * @param imageUrl - URL to access the image
 * @param isRetry - Whether this is a retry attempt
 */
async function processSpotifyScreenshot(
  imagePath: string,
  imageUrl: string,
  isRetry: boolean = false
): Promise<{
  success: boolean
  data: {
    weekStart: string
    streams: number
    listeners: number
    saveRate: number
    playlistAdds: number
    topCities: string[]
    confidence: number
    timePeriod?: '7' | '14' | '30' | '60' | 'all'
    growthTrend?: 'growing' | 'falling' | 'stable'
    adminNotes?: string
  }
}> {
  const openaiApiKey = process.env.OPENAI_API_KEY

  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY in environment variables.')
  }

  // Read image file
  const fs = require('fs')
  const imageBuffer = fs.readFileSync(imagePath)
  const base64Image = imageBuffer.toString('base64')
  const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg'

  // Prepare prompt for AI vision
  const prompt = `Analyze this Spotify for Artists screenshot and extract metrics. Pay close attention to:

1. TIME PERIOD: Identify if the screenshot shows 7, 14, 30, 60 days, or all-time data. This is critical.
2. METRICS: Extract exact numbers for:
   - Total streams (number)
   - Total listeners (number)
   - Save rate (percentage shown, convert to decimal 0-1)
   - Playlist adds (number)
   - Top cities (array of city names, max 5)
3. GROWTH TREND: Analyze the chart/graph to determine if streams are:
   - "growing" (upward trend)
   - "falling" (downward trend)
   - "stable" (flat or minimal change)

4. ADMIN NOTES: Provide detailed analysis for admin/staff:
   - Explain the growth/falling trend clearly
   - If falling: Explain what might be causing the decline and specific steps to stabilize metrics
   - If growing: Explain what's working and how to maintain momentum
   - If stable: Explain how to break through to growth
   - Include actionable recommendations for both artist and admin
   - Consider playlist strategy, release timing, promotional opportunities

IMPORTANT: Understand the time period context. If it's 7 days, compare to previous 7 days. If 30 days, compare to previous 30 days. Provide context-aware analysis.

Return the data as JSON in this exact format:
{
  "weekStart": "YYYY-MM-DD",
  "streams": number,
  "listeners": number,
  "saveRate": 0.0-1.0,
  "playlistAdds": number,
  "topCities": ["city1", "city2", ...],
  "confidence": 0.0-1.0,
  "timePeriod": "7" | "14" | "30" | "60" | "all",
  "growthTrend": "growing" | "falling" | "stable",
  "adminNotes": "Detailed explanation with specific recommendations for stabilizing/improving metrics. Address both artist actions and admin strategy."
}`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o', // or 'gpt-4-vision-preview' if available
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0.3, // Lower temperature for more accurate extraction
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const statusCode = response.status
      
      // Handle specific error cases
      if (statusCode === 401) {
        throw new Error('OpenAI API authentication failed. Check API key.')
      } else if (statusCode === 429) {
        throw new Error('OpenAI API rate limit exceeded. Please try again later.')
      } else if (statusCode >= 500) {
        throw new Error(`OpenAI API server error (${statusCode}). Please try again.`)
      } else {
        throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`)
      }
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('No response from AI vision model')
    }

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content.trim()
    if (jsonStr.includes('```json')) {
      jsonStr = jsonStr.split('```json')[1].split('```')[0].trim()
    } else if (jsonStr.includes('```')) {
      jsonStr = jsonStr.split('```')[1].split('```')[0].trim()
    }

    const extracted = JSON.parse(jsonStr)

    // Validate and normalize data
    return {
      success: true,
      data: {
        weekStart: extracted.weekStart || new Date().toISOString().split('T')[0],
        streams: parseInt(extracted.streams) || 0,
        listeners: parseInt(extracted.listeners) || 0,
        saveRate: Math.max(0, Math.min(1, parseFloat(extracted.saveRate) || 0)),
        playlistAdds: parseInt(extracted.playlistAdds) || 0,
        topCities: Array.isArray(extracted.topCities) ? extracted.topCities.slice(0, 5) : [],
        confidence: Math.max(0, Math.min(1, parseFloat(extracted.confidence) || 0.8)),
        timePeriod: extracted.timePeriod || 'all',
        growthTrend: extracted.growthTrend || 'stable',
        adminNotes: extracted.adminNotes || '',
      },
    }
  } catch (error: any) {
    console.error('[Spotify Screenshot] Vision processing error:', error)
    throw new Error(`Failed to process screenshot: ${error.message}`)
  }
}
