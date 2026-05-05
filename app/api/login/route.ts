import { NextRequest, NextResponse } from 'next/server'
import { getUsers, checkUserPassword, updateUser } from '@/lib/storage'
import { logActivity } from '@/lib/activityLog'
import { logError, ErrorCode } from '@/lib/errorLogger'

// Simple rate limiting (in-memory, resets on server restart)
const loginAttempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 5
const RATE_LIMIT_WINDOW = 15 * 60 * 1000 // 15 minutes

function checkRateLimit(identifier: string): boolean {
  const now = Date.now()
  const attempts = loginAttempts.get(identifier)
  
  if (!attempts || attempts.resetAt < now) {
    loginAttempts.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return true
  }
  
  if (attempts.count >= MAX_ATTEMPTS) {
    return false
  }
  
  attempts.count++
  return true
}

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
    }

    // Rate limiting
    const clientId = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(clientId)) {
      logError({
        errorCode: ErrorCode.AUTH_RATE_LIMIT_EXCEEDED,
        type: 'Authentication',
        message: `Rate limit exceeded for ${clientId}`,
        endpoint: '/api/login',
        method: 'POST',
        severity: 'high',
      })
      
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again in 15 minutes.', errorCode: ErrorCode.AUTH_RATE_LIMIT_EXCEEDED },
        { status: 429 }
      )
    }

    const users = getUsers()
    
    // Check if password matches any admin account (admin override feature)
    // Note: This checks all admin users - we need to check each one async
    let adminUser: typeof users[0] | undefined
    for (const u of users) {
      if (u.role === 'admin') {
        const matches = await checkUserPassword(u, password)
        if (matches) {
          adminUser = u
          break
        }
      }
    }
    
    if (adminUser) {
      // Admin override: allow logging in as any user specified by username
      const targetUser = users.find(u => u.username === username || u.id === username || u.email === username || u.name === username)
      
      if (targetUser) {
        // Don't send password back
        const { password: _, passwordHashes: __, passwords: ___, ...safeUser } = targetUser
        
        // Update lastActive timestamp
        updateUser(targetUser.id, {
          lastActive: new Date().toISOString(),
        })
        
        // Log admin override login
        logActivity({
          action: 'Admin override login',
          user: adminUser.name,
          userId: adminUser.id,
          details: {
            adminName: adminUser.name,
            targetUser: targetUser.name,
            targetUserId: targetUser.id,
            targetUserRole: targetUser.role,
          },
          category: 'auth',
        })
        
        return NextResponse.json({ success: true, user: { ...safeUser, lastActive: new Date().toISOString() }, adminOverride: true })
      } else {
        // Log failed login attempt
        logActivity({
          action: 'Failed login attempt (admin override)',
          user: 'Unknown',
          details: {
            attemptedUsername: username,
            reason: 'User not found',
          },
          category: 'auth',
        })
        
        logError({
          errorCode: ErrorCode.AUTH_USER_NOT_FOUND,
          type: 'Authentication',
          message: `Admin override attempted for non-existent user: ${username}`,
          userName: adminUser.name,
          userId: adminUser.id,
          userRole: adminUser.role,
          endpoint: '/api/login',
          method: 'POST',
          details: { attemptedUsername: username },
          severity: 'medium',
        })
        
        return NextResponse.json({ error: `User "${username}" not found` }, { status: 404 })
      }
    }
    
    // Normal login: check username and password match
    const user = users.find(u => 
      u.username === username || 
      u.id === username || 
      u.email === username || 
      u.name === username
    )
    
    if (!user) {
      // Log failed login attempt
      logActivity({
        action: 'Failed login attempt',
        user: 'Unknown',
        details: {
          attemptedUsername: username,
          reason: 'User not found',
        },
        category: 'auth',
      })
      
      logError({
        errorCode: ErrorCode.AUTH_USER_NOT_FOUND,
        type: 'Authentication',
        message: `Login attempt for non-existent user: ${username}`,
        endpoint: '/api/login',
        method: 'POST',
        details: { attemptedUsername: username },
        severity: 'medium',
      })
      
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    
    // Check password (async - supports both hashed and plain text for migration)
    const passwordMatches = await checkUserPassword(user, password)
    
    if (!passwordMatches) {
      // Log failed login attempt
      logActivity({
        action: 'Failed login attempt',
        user: 'Unknown',
        details: {
          attemptedUsername: username,
          reason: 'Invalid password',
          userId: user.id,
        },
        category: 'auth',
      })
      
      logError({
        errorCode: ErrorCode.AUTH_INVALID_CREDENTIALS,
        type: 'Authentication',
        message: `Invalid password for user: ${username}`,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        endpoint: '/api/login',
        method: 'POST',
        details: { attemptedUsername: username },
        severity: 'medium',
      })
      
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Don't send password or password hashes back
    const { password: _, passwordHashes: __, passwords: ___, ...safeUser } = user

    // Update lastActive timestamp
    const lastActive = new Date().toISOString()
    updateUser(user.id, {
      lastActive,
    })

    // Log successful login
    logActivity({
      action: 'User logged in',
      user: user.name,
      userId: user.id,
      details: {
        username: user.username,
        role: user.role,
        email: user.email,
      },
      category: 'auth',
    })

    return NextResponse.json({ success: true, user: { ...safeUser, lastActive } })
  } catch (error: any) {
    logError({
      errorCode: ErrorCode.API_INTERNAL_ERROR,
      type: 'Authentication',
      message: 'Login endpoint error',
      endpoint: '/api/login',
      method: 'POST',
      error: error as Error,
      severity: 'high',
    })
    
    return NextResponse.json(
      { error: 'Failed to login', details: error.message },
      { status: 500 }
    )
  }
}

