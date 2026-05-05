import { NextRequest, NextResponse } from 'next/server'
import { getUsers, updateUser } from '@/lib/storage'
import { getInstagramAccountId, getInstagramAccountIdFromToken, verifyInstagramToken, exchangeForLongLivedToken } from '@/lib/metaApi'
import { logActivity } from '@/lib/activityLog'

/**
 * Connect Instagram account to artist
 * POST /api/instagram/connect
 * Body: { artistId, accessToken, pageId? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { artistId, accessToken, pageId, instagramAccountId, exchangeToken, adminUserId } = body

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/738e3ff4-c1bc-4f87-8364-ca554946b59d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/instagram/connect/route.ts:14',message:'POST /api/instagram/connect - Entry',data:{hasArtistId:!!artistId,hasAccessToken:!!accessToken,hasPageId:!!pageId,hasInstagramAccountId:!!instagramAccountId,exchangeToken,hasAdminUserId:!!adminUserId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    if (!artistId || !accessToken) {
      return NextResponse.json(
        { error: 'Artist ID and access token are required' },
        { status: 400 }
      )
    }

    // Check if admin is connecting for an artist
    let isAdminAction = false
    if (adminUserId) {
      const users = getUsers()
      const adminUser = users.find(u => u.id === adminUserId && u.role === 'admin')
      if (adminUser) {
        isAdminAction = true
      } else {
        return NextResponse.json(
          { error: 'Unauthorized: Admin access required' },
          { status: 403 }
        )
      }
    }

    let finalToken = accessToken
    let expiresIn = 60 * 24 * 60 * 60 * 1000 // Default 60 days in milliseconds

    // Exchange short-lived token for long-lived token if requested
    if (exchangeToken === true) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/738e3ff4-c1bc-4f87-8364-ca554946b59d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/instagram/connect/route.ts:42',message:'Attempting token exchange',data:{hasEnvVars:!!process.env.META_APP_ID && !!process.env.META_APP_SECRET},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      try {
        const longLivedData = await exchangeForLongLivedToken(accessToken)
        finalToken = longLivedData.access_token
        expiresIn = longLivedData.expires_in * 1000 // Convert seconds to milliseconds
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/738e3ff4-c1bc-4f87-8364-ca554946b59d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/instagram/connect/route.ts:46',message:'Token exchange succeeded',data:{expiresIn:longLivedData.expires_in},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
      } catch (error: any) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/738e3ff4-c1bc-4f87-8364-ca554946b59d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/instagram/connect/route.ts:48',message:'Token exchange failed',data:{error:error.message,errorType:error.constructor.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        // If exchange fails due to missing env vars, warn but continue
        if (error.message?.includes('META_APP_ID') || error.message?.includes('META_APP_SECRET')) {
          console.warn('[Connect Instagram] Token exchange skipped: META_APP_ID and META_APP_SECRET not configured. Using provided token as-is.')
        } else {
          console.warn('[Connect Instagram] Token exchange failed, using provided token:', error.message)
        }
        // Continue with original token if exchange fails
      }
    }

    // Verify token is valid
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/738e3ff4-c1bc-4f87-8364-ca554946b59d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/instagram/connect/route.ts:59',message:'Verifying token',data:{tokenLength:finalToken.length,tokenPrefix:finalToken.substring(0,10)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const verificationResult = await verifyInstagramToken(finalToken)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/738e3ff4-c1bc-4f87-8364-ca554946b59d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/instagram/connect/route.ts:60',message:'Token verification result',data:{valid:verificationResult.valid,error:verificationResult.error,userId:verificationResult.userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    if (!verificationResult.valid) {
      return NextResponse.json(
        { error: `Invalid access token: ${verificationResult.error || 'Token verification failed'}` },
        { status: 401 }
      )
    }

    // Get user
    const users = getUsers()
    const user = users.find(u => u.id === artistId && u.role === 'artist')
    
    if (!user) {
      return NextResponse.json(
        { error: 'Artist not found' },
        { status: 404 }
      )
    }

    // Get Instagram account ID if not provided
    let accountId = instagramAccountId
    if (!accountId && pageId) {
      try {
        accountId = await getInstagramAccountId(pageId, finalToken)
      } catch (error: any) {
        return NextResponse.json(
          { error: `Failed to get Instagram account ID from Page ID: ${error.message}` },
          { status: 400 }
        )
      }
    } else if (!accountId) {
      // Try to automatically find Instagram account ID from token
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/738e3ff4-c1bc-4f87-8364-ca554946b59d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/instagram/connect/route.ts:92',message:'Attempting to find Instagram Account ID from token',data:{hasPageId:!!pageId,hasInstagramAccountId:!!instagramAccountId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      try {
        accountId = await getInstagramAccountIdFromToken(finalToken)
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/738e3ff4-c1bc-4f87-8364-ca554946b59d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/instagram/connect/route.ts:94',message:'Found Instagram Account ID',data:{accountId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
      } catch (error: any) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/738e3ff4-c1bc-4f87-8364-ca554946b59d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/instagram/connect/route.ts:96',message:'Failed to find Instagram Account ID',data:{error:error.message,errorType:error.constructor.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        return NextResponse.json(
          { 
            error: `Could not find Instagram Business Account. ${error.message}`,
            details: 'Please provide either an Instagram Business Account ID or a Facebook Page ID that has an Instagram Business Account connected to it.'
          },
          { status: 400 }
        )
      }
    }

    // Calculate token expiration
    const expiresAt = new Date(Date.now() + expiresIn)
    
    // Update user with Instagram credentials
    // Note: In production, encrypt the access token before storing
    const updated = updateUser(artistId, {
      instagramAccountId: accountId,
      instagramAccessToken: finalToken, // TODO: Encrypt this in production
      instagramTokenExpiresAt: expiresAt.toISOString(),
    })

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 500 }
      )
    }

    // Log activity if admin connected account
    if (isAdminAction && adminUserId) {
      const adminUser = getUsers().find(u => u.id === adminUserId)
      logActivity({
        action: 'Instagram account connected (admin)',
        user: adminUser?.name || 'Admin',
        userId: adminUserId,
        details: {
          adminName: adminUser?.name,
          targetArtist: user.name,
          targetArtistId: artistId,
          instagramAccountId: accountId,
        },
        category: 'system',
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        instagramAccountId: accountId,
        tokenExpiresAt: expiresAt.toISOString(),
        tokenExchanged: exchangeToken === true,
      },
    })
  } catch (error: any) {
    console.error('Connect Instagram error:', error)
    return NextResponse.json(
      { error: 'Failed to connect Instagram account', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Get Instagram connection status for an artist
 * GET /api/instagram/connect?artistId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const artistId = searchParams.get('artistId')

    if (!artistId) {
      return NextResponse.json(
        { error: 'Artist ID is required' },
        { status: 400 }
      )
    }

    const users = getUsers()
    const user = users.find(u => u.id === artistId && u.role === 'artist')
    
    if (!user) {
      return NextResponse.json(
        { error: 'Artist not found' },
        { status: 404 }
      )
    }

    const isConnected = !!user.instagramAccountId && !!user.instagramAccessToken
    const isExpired = user.instagramTokenExpiresAt
      ? new Date(user.instagramTokenExpiresAt) < new Date()
      : false

    return NextResponse.json({
      success: true,
      data: {
        connected: isConnected,
        expired: isExpired,
        instagramAccountId: user.instagramAccountId,
        tokenExpiresAt: user.instagramTokenExpiresAt,
      },
    })
  } catch (error: any) {
    console.error('Get Instagram connection error:', error)
    return NextResponse.json(
      { error: 'Failed to get Instagram connection status', details: error.message },
      { status: 500 }
    )
  }
}
