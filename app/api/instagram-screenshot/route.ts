import { NextRequest, NextResponse } from 'next/server'
import { mkdir } from 'fs/promises'
import path from 'path'
import { addInstagramMetrics, getUsers } from '@/lib/storage'
import { getUploadPath } from '@/lib/uploadConfig'
import { writeUploadToDisk } from '@/lib/writeUploadToDisk'

const UPLOAD_DIR = getUploadPath('instagram-screenshots')

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true })
  } catch (error) {
    // Directory might already exist
  }
}

/**
 * POST /api/instagram-screenshot
 * Upload Instagram analytics screenshot and process with AI vision
 */
export async function POST(request: NextRequest) {
  try {
    await ensureUploadDir()

    const formData = await request.formData()
    const file = formData.get('file') as File
    const artistId = formData.get('artistId') as string
    const addedBy = formData.get('addedBy') as string | null

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
      baseName: `instagram_${artistId}`,
      extension,
      directory: UPLOAD_DIR,
    })
    const filePath = path.join(UPLOAD_DIR, fileName)

    await writeUploadToDisk(file, filePath)

    // Create file URL
    const fileUrl = `/api/files/instagram-screenshots/${fileName}`

    // Process with AI vision (optimized for speed - single attempt, fast failure)
    let processedData: any = null
    let processingError: string | null = null

    try {
      processedData = await processInstagramScreenshot(filePath, fileUrl, false)
      if (!processedData || !processedData.success) {
        processingError = 'Failed to extract data from screenshot'
      }
    } catch (error: any) {
      console.error(`[Instagram Screenshot] AI processing error:`, error)
      processingError = error.message || 'Failed to process screenshot'
    }

    // Save metrics if processing succeeded
    if (processedData && processedData.success) {
      const metricDate = processedData.data.metricDate || new Date().toISOString().split('T')[0]
      const confidence = processedData.data.confidence || 0
      
      addInstagramMetrics({
        artistId,
        metricDate,
        views: processedData.data.views || 0,
        saves: processedData.data.saves || 0,
        shares: processedData.data.shares || 0,
        comments: processedData.data.comments || 0,
        likes: processedData.data.likes || 0,
        completionRate: processedData.data.completionRate || 0,
        retention: processedData.data.retention,
        skipRate: processedData.data.skipRate,
        interactions: processedData.data.interactions,
        watchTime: processedData.data.watchTime,
        audience: processedData.data.audience,
        followers: processedData.data.followers || 0,
        manuallyAdded: true,
        addedBy: addedBy || undefined,
        videoTitle: processedData.data.videoTitle,
        videoLink: processedData.data.videoLink,
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
    console.error('Instagram screenshot upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload screenshot', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Process Instagram analytics screenshot with AI vision
 * Optimized for speed: single attempt, minimal tokens, zero temperature, JSON mode
 * Expected processing time: ~1-2 seconds per screenshot
 * @param imagePath - Path to the image file
 * @param imageUrl - URL to access the image
 * @param isRetry - Whether this is a retry attempt (unused, kept for compatibility)
 */
async function processInstagramScreenshot(
  imagePath: string,
  imageUrl: string,
  isRetry: boolean = false
): Promise<{
  success: boolean
  data: {
    metricDate: string
    views: number
    saves: number
    shares: number
    comments: number
    likes?: number
    completionRate: number
    retention?: number
    skipRate?: number
    interactions?: number
    watchTime?: number
    audience?: number
    followers: number
    confidence: number
    videoTitle?: string
    videoLink?: string
    timePeriod?: '7' | '14' | '30' | '60' | 'all'
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

  // Optimized prompt for speed - concise and direct, structured for JSON mode
  const prompt = `Extract Instagram analytics metrics from this screenshot. Return a JSON object with these fields: metricDate (YYYY-MM-DD format, use today if not visible), views (number), saves (number), shares (number), comments (number), likes (number, optional), completionRate (decimal 0-1), retention (number 0-100, optional), skipRate (number 0-100, optional), interactions (number, optional), watchTime (number in seconds, optional), audience (number, optional), followers (number), confidence (decimal 0-1), timePeriod (string: "7", "14", "30", "60", or "all"), videoTitle (string, optional), videoLink (string, optional), adminNotes (string, brief summary). Extract all visible numbers from the screenshot.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
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
        max_tokens: 500, // Minimized for fastest response
        temperature: 0.0, // Zero temperature for fastest, most deterministic extraction
        response_format: { type: 'json_object' }, // Force JSON for faster parsing
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

    // Extract JSON from response (optimized parsing)
    let jsonStr = content.trim()
    // Remove markdown code blocks if present
    if (jsonStr.includes('```')) {
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    }
    
    // Try to extract JSON object if wrapped
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      jsonStr = jsonMatch[0]
    }

    const extracted = JSON.parse(jsonStr)

    // Validate and normalize data
    return {
      success: true,
      data: {
        metricDate: extracted.metricDate || new Date().toISOString().split('T')[0],
        views: parseInt(extracted.views) || 0,
        saves: parseInt(extracted.saves) || 0,
        shares: parseInt(extracted.shares) || 0,
        comments: parseInt(extracted.comments) || 0,
        likes: extracted.likes ? parseInt(extracted.likes) : undefined,
        completionRate: Math.max(0, Math.min(1, parseFloat(extracted.completionRate) || 0)),
        retention: extracted.retention ? Math.max(0, Math.min(100, parseFloat(extracted.retention))) : undefined,
        skipRate: extracted.skipRate ? Math.max(0, Math.min(100, parseFloat(extracted.skipRate))) : undefined,
        interactions: extracted.interactions ? parseInt(extracted.interactions) : undefined,
        watchTime: extracted.watchTime ? parseInt(extracted.watchTime) : undefined,
        audience: extracted.audience ? parseInt(extracted.audience) : undefined,
        followers: parseInt(extracted.followers) || 0,
        confidence: Math.max(0, Math.min(1, parseFloat(extracted.confidence) || 0.8)),
        timePeriod: extracted.timePeriod || 'all',
        videoTitle: extracted.videoTitle || undefined,
        videoLink: extracted.videoLink || undefined,
        adminNotes: extracted.adminNotes || '',
      },
    }
  } catch (error: any) {
    console.error('[Instagram Screenshot] Vision processing error:', error)
    throw new Error(`Failed to process screenshot: ${error.message}`)
  }
}
