import { NextRequest, NextResponse } from 'next/server'
import { getUserById, getUsers, checkUserPassword, addUserPassword, getUserPasswordHashes } from '@/lib/storage'
import { logError, ErrorCode } from '@/lib/errorLogger'
import { getUserFromRequest } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, currentPassword, newPassword } = body

    if (!userId || !currentPassword || !newPassword) {
      logError({
        errorCode: ErrorCode.API_MISSING_PARAMS,
        type: 'Password Change',
        message: 'Missing required fields for password change',
        endpoint: '/api/change-password',
        method: 'POST',
        severity: 'low',
      })
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const user = getUserById(userId)
    if (!user) {
      logError({
        errorCode: ErrorCode.AUTH_USER_NOT_FOUND,
        type: 'Password Change',
        message: `Password change attempted for non-existent user: ${userId}`,
        endpoint: '/api/change-password',
        method: 'POST',
        severity: 'medium',
      })
      return NextResponse.json({ 
        error: 'User not found',
        details: `User with ID "${userId}" does not exist`
      }, { status: 404 })
    }
    
    // Check if current password is valid (async - supports both hashed and plain text)
    const isValidPassword = await checkUserPassword(user, currentPassword)
    if (!isValidPassword) {
      logError({
        errorCode: ErrorCode.AUTH_INVALID_CREDENTIALS,
        type: 'Password Change',
        message: `Invalid current password for user: ${user.name}`,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        endpoint: '/api/change-password',
        method: 'POST',
        severity: 'medium',
      })
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
    }

    if (newPassword.length < 6) {
      logError({
        errorCode: ErrorCode.API_VALIDATION_ERROR,
        type: 'Password Change',
        message: `Password too short for user: ${user.name}`,
        userId: user.id,
        userName: user.name,
        endpoint: '/api/change-password',
        method: 'POST',
        details: { passwordLength: newPassword.length },
        severity: 'low',
      })
      return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 })
    }

    // Check if new password matches any existing password hash
    const existingHashes = getUserPasswordHashes(user)
    for (const hash of existingHashes) {
      if (hash.startsWith('$2')) {
        // It's a bcrypt hash, verify the new password against it
        const { verifyPassword } = await import('@/lib/storage')
        const matches = await verifyPassword(newPassword, hash)
        if (matches) {
          logError({
            errorCode: ErrorCode.API_VALIDATION_ERROR,
            type: 'Password Change',
            message: `New password matches existing password for user: ${user.name}`,
            userId: user.id,
            userName: user.name,
            endpoint: '/api/change-password',
            method: 'POST',
            severity: 'low',
          })
          return NextResponse.json({ error: 'New password is already in use' }, { status: 400 })
        }
      } else if (hash === newPassword) {
        // Plain text match (during migration)
        logError({
          errorCode: ErrorCode.API_VALIDATION_ERROR,
          type: 'Password Change',
          message: `New password matches existing password for user: ${user.name}`,
          userId: user.id,
          userName: user.name,
          endpoint: '/api/change-password',
          method: 'POST',
          severity: 'low',
        })
        return NextResponse.json({ error: 'New password is already in use' }, { status: 400 })
      }
    }

    // Add the new password hash
    await addUserPassword(user, newPassword)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    logError({
      errorCode: ErrorCode.API_INTERNAL_ERROR,
      type: 'Password Change',
      message: 'Password change endpoint error',
      endpoint: '/api/change-password',
      method: 'POST',
      error: error as Error,
      severity: 'high',
    })
    
    return NextResponse.json(
      { error: 'Failed to change password', details: error.message },
      { status: 500 }
    )
  }
}
