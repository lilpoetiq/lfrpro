import { NextRequest, NextResponse } from 'next/server'
import { getUserById, getUsers } from './storage'
import { logError, ErrorCode } from './errorLogger'

export interface AuthenticatedUser {
  id: string
  name: string
  email?: string
  role: string
  username?: string
}

/**
 * Extract user from request headers or session
 * Currently uses userId from headers (will be improved with proper session management)
 */
export function getAuthenticatedUser(request: NextRequest): AuthenticatedUser | null {
  try {
    // Try to get userId from headers (set by client after login)
    const userId = request.headers.get('x-user-id')
    
    if (!userId) {
      return null
    }
    
    const user = getUserById(userId)
    if (!user) {
      return null
    }
    
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      username: user.username,
    }
  } catch (error) {
    return null
  }
}

/**
 * Middleware to verify authentication on API routes
 */
export function requireAuth(
  handler: (request: NextRequest, user: AuthenticatedUser) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const user = getAuthenticatedUser(request)
    
    if (!user) {
      logError({
        errorCode: ErrorCode.AUTH_UNAUTHORIZED,
        type: 'Authentication',
        message: 'Unauthorized API access attempt',
        endpoint: request.nextUrl.pathname,
        method: request.method,
        severity: 'high',
      })
      
      return NextResponse.json(
        { error: 'Unauthorized', errorCode: ErrorCode.AUTH_UNAUTHORIZED },
        { status: 401 }
      )
    }
    
    return handler(request, user)
  }
}

/**
 * Middleware to verify specific role
 */
export function requireRole(
  roles: string[],
  handler: (request: NextRequest, user: AuthenticatedUser) => Promise<NextResponse>
) {
  return requireAuth(async (request: NextRequest, user: AuthenticatedUser) => {
    if (!roles.includes(user.role)) {
      logError({
        errorCode: ErrorCode.API_FORBIDDEN,
        type: 'Authorization',
        message: `User ${user.name} (${user.role}) attempted to access ${request.nextUrl.pathname}`,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        endpoint: request.nextUrl.pathname,
        method: request.method,
        severity: 'medium',
      })
      
      return NextResponse.json(
        { error: 'Forbidden', errorCode: ErrorCode.API_FORBIDDEN },
        { status: 403 }
      )
    }
    
    return handler(request, user)
  })
}

/**
 * Extract user from request body (for POST requests that send userId)
 * This is a temporary solution until proper session management is implemented
 */
export function getUserFromRequest(request: NextRequest, body?: any): AuthenticatedUser | null {
  try {
    // Try to get from body first
    if (body?.userId) {
      const user = getUserById(body.userId)
      if (user) {
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          username: user.username,
        }
      }
    }
    
    // Fallback to header
    return getAuthenticatedUser(request)
  } catch (error) {
    return null
  }
}
