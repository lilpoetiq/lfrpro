import { NextRequest, NextResponse } from 'next/server'
import { getUsers, updateUser } from '@/lib/storage'

// Send support messages directly to message AI server via support-question endpoint
const AI_SERVER_URL = (process.env as any).AI_SERVER_URL || 'http://localhost:3001'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      message, 
      userId, 
      userName, 
      userRole, 
      artistName, 
      songId, 
      songName, 
      phoneNumber: providedPhoneNumber,
      questionId: providedQuestionId, // Allow client to provide stable questionId for idempotency
    } = body

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Idempotency: the client MUST provide a stable questionId per submission.
    // Do not generate questionId server-side using Date.now() as a fallback,
    // because retries would mint new IDs and create duplicate/spam tickets.
    if (!providedQuestionId || typeof providedQuestionId !== 'string') {
      return NextResponse.json(
        { error: 'questionId is required (stable per submission; reuse on retry).' },
        { status: 400 }
      )
    }

    // Get user's phone number if available
    const users = getUsers()
    const user = userId ? users.find(u => u.id === userId) : null
    let phoneNumber = providedPhoneNumber || user?.phoneNumber || null
    
    // If phone number was provided, save it to user profile
    if (providedPhoneNumber && userId && user) {
      updateUser(userId, { phoneNumber: providedPhoneNumber })
      phoneNumber = providedPhoneNumber
    }
    
    // Check if phone number is missing
    if (!phoneNumber && userId) {
      return NextResponse.json({
        success: false,
        needsPhoneNumber: true,
        error: 'Phone number is required to send support messages via iMessage.',
      })
    }

    const questionId = providedQuestionId.trim()
    if (!questionId) {
      return NextResponse.json(
        { error: 'questionId must be a non-empty string.' },
        { status: 400 }
      )
    }

    // Recommended: X-Idempotency-Key = support:<questionId>
    const idempotencyKey = `support:${questionId}`

    // Send directly to message AI server support-question endpoint
    // This connects the artist with support team via iMessage
    const requestBody = {
      questionId,
      userId: userId || null,
      userName: userName || 'Unknown User',
      artistName: artistName || userName || 'Unknown Artist',
      phoneNumber: phoneNumber,
      question: message,
      message: message, // Some implementations use 'message' instead of 'question'
      songId: songId || null,
      songName: songName || null,
    }
    
    // Check for dry-run mode
    const dryRun = request.headers.get('x-dry-run') === 'true' || 
                   new URL(request.url).searchParams.get('dryRun') === 'true'
    
    console.log(`[Support Chat] Sending to ${AI_SERVER_URL}/api/support-question:`, {
      questionId,
      idempotencyKey,
      userName,
      artistName,
      hasPhoneNumber: !!phoneNumber,
      messageLength: message.length,
      dryRun,
    })
    
    try {
      // Create timeout controller
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
      
      const requestHeaders: HeadersInit = {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      }
      
      if (dryRun) {
        requestHeaders['x-dry-run'] = 'true'
      }
      
      const response = await fetch(`${AI_SERVER_URL}/api/support-question${dryRun ? '?dryRun=true' : ''}`, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify({
          ...requestBody,
          createdAt: new Date().toISOString(),
          context: 'website support form',
        }),
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        console.error(`[Support Chat] Server error ${response.status}:`, errorText)
        throw new Error(`Message AI server error: ${response.status} - ${errorText.substring(0, 200)}`)
      }
      
      console.log(`[Support Chat] Successfully sent support question ${questionId}`)

      let serverResponse
      try {
        serverResponse = await response.json()
      } catch (e) {
        // If response is not JSON, that's okay - the server might just return success
        console.log('Server response was not JSON, assuming success')
        serverResponse = { success: true }
      }

      // Return success - the message AI server will handle routing
      return NextResponse.json({
        success: true,
        response: 'Check your messages. We\'re sending you a text.',
        questionId,
      })
    } catch (error: any) {
      console.error('[Support Chat] Failed to connect to message AI server:', error)
      console.error('[Support Chat] AI_SERVER_URL:', AI_SERVER_URL)
      console.error('[Support Chat] Error details:', {
        message: error.message,
        code: error.code,
        name: error.name,
        cause: error.cause,
      })
      
      // Check if it's a connection error
      const isConnectionError = error.message?.includes('ECONNREFUSED') || 
                                error.message?.includes('fetch failed') ||
                                error.message?.includes('network') ||
                                error.code === 'ECONNREFUSED' ||
                                error.cause?.code === 'ECONNREFUSED' ||
                                error.name === 'AbortError' ||
                                error.name === 'TimeoutError'
      
      let errorMessage = 'Support server unavailable.'
      if (isConnectionError) {
        errorMessage = `Support server unavailable. The message AI server is not running or not accessible at ${AI_SERVER_URL}. Please ensure the server is running on port 3001 (or configure AI_SERVER_URL environment variable).`
      } else if (error.message) {
        errorMessage = `Support server error: ${error.message}`
      }
      
      return NextResponse.json(
        { 
          error: errorMessage,
          details: error.message,
          serverUrl: AI_SERVER_URL,
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Support chat error:', error)
    return NextResponse.json(
      { error: 'Failed to send support message', details: error.message },
      { status: 500 }
    )
  }
}
