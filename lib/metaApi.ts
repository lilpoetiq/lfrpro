/**
 * Meta Graph API Client for Instagram Business Accounts
 * Read-only access to Instagram metrics
 */

interface InstagramMetrics {
  views: number
  saves: number
  shares: number
  comments: number
  completionRate: number
  followers: number
}

interface MetaApiError {
  error: {
    message: string
    type: string
    code: number
  }
}

/**
 * Fetch Instagram metrics for the last 24 hours
 * Requires Instagram Business Account ID and valid access token
 */
export async function fetchInstagramMetrics(
  accountId: string,
  accessToken: string
): Promise<InstagramMetrics> {
  const baseUrl = 'https://graph.facebook.com/v21.0'
  
  try {
    // Get account insights for the last 24 hours
    const since = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000) // 24 hours ago in Unix timestamp
    const until = Math.floor(Date.now() / 1000) // Now in Unix timestamp
    
    // Fetch insights - we'll get impressions (views), saves, shares, comments
    const insightsUrl = `${baseUrl}/${accountId}/insights?metric=impressions,reach,saves,shares,comments&period=day&since=${since}&until=${until}&access_token=${accessToken}`
    
    const insightsResponse = await fetch(insightsUrl)
    const insightsData = await insightsResponse.json()
    
    if (!insightsResponse.ok) {
      const error = insightsData as MetaApiError
      throw new Error(`Meta API Error: ${error.error?.message || 'Unknown error'}`)
    }
    
    // Get follower count
    const accountUrl = `${baseUrl}/${accountId}?fields=followers_count&access_token=${accessToken}`
    const accountResponse = await fetch(accountUrl)
    const accountData = await accountResponse.json()
    
    if (!accountResponse.ok) {
      const error = accountData as MetaApiError
      throw new Error(`Meta API Error: ${error.error?.message || 'Unknown error'}`)
    }
    
    // Parse insights data
    const metrics: InstagramMetrics = {
      views: 0,
      saves: 0,
      shares: 0,
      comments: 0,
      completionRate: 0,
      followers: accountData.followers_count || 0,
    }
    
    // Process insights array
    if (Array.isArray(insightsData.data)) {
      insightsData.data.forEach((insight: any) => {
        const value = insight.values?.[0]?.value || 0
        
        switch (insight.name) {
          case 'impressions':
            metrics.views = parseInt(value) || 0
            break
          case 'saves':
            metrics.saves = parseInt(value) || 0
            break
          case 'shares':
            metrics.shares = parseInt(value) || 0
            break
          case 'comments':
            metrics.comments = parseInt(value) || 0
            break
          case 'reach':
            // Calculate completion rate: (views / reach) * 100
            if (metrics.views > 0 && value > 0) {
              metrics.completionRate = (metrics.views / value) * 100
            }
            break
        }
      })
    }
    
    return metrics
  } catch (error: any) {
    console.error('[Meta API] Error fetching Instagram metrics:', error)
    throw new Error(`Failed to fetch Instagram metrics: ${error.message}`)
  }
}

/**
 * Verify Instagram access token is valid and get user info
 */
export async function verifyInstagramToken(accessToken: string): Promise<{ valid: boolean; error?: string; userId?: string }> {
  try {
    const url = `https://graph.facebook.com/v21.0/me?access_token=${accessToken}`
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/738e3ff4-c1bc-4f87-8364-ca554946b59d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/metaApi.ts:109',message:'Calling Meta API to verify token',data:{url},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const response = await fetch(url)
    const data = await response.json()
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/738e3ff4-c1bc-4f87-8364-ca554946b59d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/metaApi.ts:112',message:'Meta API verification response',data:{ok:response.ok,status:response.status,hasError:!!data.error,errorMessage:data.error?.message,errorCode:data.error?.code,errorType:data.error?.type,userId:data.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    if (!response.ok) {
      const error = data as MetaApiError
      return {
        valid: false,
        error: error.error?.message || 'Invalid access token'
      }
    }
    
    return {
      valid: true,
      userId: data.id
    }
  } catch (error: any) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/738e3ff4-c1bc-4f87-8364-ca554946b59d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/metaApi.ts:126',message:'Token verification exception',data:{error:error.message,errorType:error.constructor.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return {
      valid: false,
      error: error.message || 'Failed to verify token'
    }
  }
}

/**
 * Get Instagram Business Account ID from access token
 * Tries to find it by checking pages associated with the token
 */
export async function getInstagramAccountIdFromToken(accessToken: string): Promise<string> {
  try {
    // First, get the user's pages
    const pagesUrl = `https://graph.facebook.com/v21.0/me/accounts?access_token=${accessToken}`
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/738e3ff4-c1bc-4f87-8364-ca554946b59d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/metaApi.ts:140',message:'Fetching user pages',data:{pagesUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    const pagesResponse = await fetch(pagesUrl)
    const pagesData = await pagesResponse.json()
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/738e3ff4-c1bc-4f87-8364-ca554946b59d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/metaApi.ts:143',message:'Pages API response',data:{ok:pagesResponse.ok,status:pagesResponse.status,hasError:!!pagesData.error,errorMessage:pagesData.error?.message,errorCode:pagesData.error?.code,errorSubcode:pagesData.error?.error_subcode,pageCount:pagesData.data?.length,pageIds:pagesData.data?.map((p:any)=>p.id)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    if (!pagesResponse.ok) {
      const error = pagesData as MetaApiError
      // Check if it's a permissions error
      if (error.error?.code === 200 || (error.error as any)?.error_subcode === 2018218) {
        throw new Error('Token missing required permission: pages_show_list. Please regenerate your token with the "pages_show_list" permission.')
      }
      throw new Error(`Meta API Error: ${error.error?.message || 'Failed to get pages'}`)
    }
    
    // Find a page with an Instagram Business Account
    if (pagesData.data && Array.isArray(pagesData.data) && pagesData.data.length > 0) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/738e3ff4-c1bc-4f87-8364-ca554946b59d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/metaApi.ts:151',message:'Checking pages for Instagram Business Account',data:{pageCount:pagesData.data.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      for (const page of pagesData.data) {
        if (page.id) {
          try {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/738e3ff4-c1bc-4f87-8364-ca554946b59d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/metaApi.ts:155',message:'Checking page for Instagram account',data:{pageId:page.id,pageName:page.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            const accountId = await getInstagramAccountId(page.id, accessToken)
            if (accountId) {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/738e3ff4-c1bc-4f87-8364-ca554946b59d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/metaApi.ts:158',message:'Found Instagram Account ID on page',data:{pageId:page.id,accountId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
              // #endregion
              return accountId
            }
          } catch (pageError: any) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/738e3ff4-c1bc-4f87-8364-ca554946b59d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/metaApi.ts:162',message:'Page has no Instagram account',data:{pageId:page.id,error:pageError.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            // Continue to next page
            continue
          }
        }
      }
      throw new Error('Found Facebook Pages but none have an Instagram Business Account connected. Make sure your Instagram account is connected to a Facebook Page.')
    } else {
      // No pages found - could be permissions or no pages
      throw new Error('No Facebook Pages found. This could mean: (1) Your token is missing the "pages_show_list" permission, or (2) You don\'t have any Facebook Pages. Please provide your Facebook Page ID or Instagram Business Account ID directly.')
    }
  } catch (error: any) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/738e3ff4-c1bc-4f87-8364-ca554946b59d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/metaApi.ts:170',message:'getInstagramAccountIdFromToken failed',data:{error:error.message,errorType:error.constructor.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    console.error('[Meta API] Error getting Instagram account ID from token:', error)
    throw error // Re-throw the original error with better message
  }
}

/**
 * Get Instagram Business Account ID from a Facebook Page
 * Requires Facebook Page ID and access token
 */
export async function getInstagramAccountId(
  pageId: string,
  accessToken: string
): Promise<string> {
  try {
    const url = `https://graph.facebook.com/v21.0/${pageId}?fields=instagram_business_account&access_token=${accessToken}`
    const response = await fetch(url)
    const data = await response.json()
    
    if (!response.ok) {
      const error = data as MetaApiError
      throw new Error(`Meta API Error: ${error.error?.message || 'Unknown error'}`)
    }
    
    if (!data.instagram_business_account?.id) {
      throw new Error('No Instagram Business Account found for this Facebook Page')
    }
    
    return data.instagram_business_account.id
  } catch (error: any) {
    console.error('[Meta API] Error getting Instagram account ID:', error)
    throw new Error(`Failed to get Instagram account ID: ${error.message}`)
  }
}

/**
 * Exchange a short-lived access token for a long-lived token (60 days)
 * Requires Meta App ID and App Secret from environment variables
 */
export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<{
  access_token: string
  token_type: string
  expires_in: number
}> {
  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET

  if (!appId || !appSecret) {
    throw new Error('META_APP_ID and META_APP_SECRET must be set in environment variables')
  }

  try {
    const url = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`
    const response = await fetch(url)
    const data = await response.json()

    if (!response.ok) {
      const error = data as MetaApiError
      throw new Error(`Meta API Error: ${error.error?.message || 'Unknown error'}`)
    }

    return data
  } catch (error: any) {
    console.error('[Meta API] Error exchanging token:', error)
    throw new Error(`Failed to exchange token: ${error.message}`)
  }
}
