import { NextRequest, NextResponse } from 'next/server'
import { getErrorLogs, getErrorStats, resolveError, ErrorCode } from '@/lib/errorLogger'
import { getUserFromRequest } from '@/lib/auth'

// GET - Retrieve error logs (admin only)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const body = Object.fromEntries(searchParams.entries())
    
    // Verify admin access
    const user = getUserFromRequest(request, body)
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required', errorCode: ErrorCode.API_FORBIDDEN },
        { status: 403 }
      )
    }

    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100
    const errorCode = searchParams.get('errorCode') || undefined
    const userId = searchParams.get('userId') || undefined
    const severity = searchParams.get('severity') || undefined
    const resolved = searchParams.get('resolved') === 'true' ? true : searchParams.get('resolved') === 'false' ? false : undefined
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined

    const logs = getErrorLogs({
      limit,
      errorCode,
      userId,
      severity,
      resolved,
      startDate,
      endDate,
    })

    const stats = getErrorStats()

    return NextResponse.json({
      success: true,
      logs,
      stats,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch error logs', details: error.message },
      { status: 500 }
    )
  }
}

// PATCH - Resolve an error (admin only)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { errorId, notes } = body

    // Verify admin access
    const user = getUserFromRequest(request, body)
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required', errorCode: ErrorCode.API_FORBIDDEN },
        { status: 403 }
      )
    }

    if (!errorId) {
      return NextResponse.json(
        { error: 'Error ID required', errorCode: ErrorCode.API_MISSING_PARAMS },
        { status: 400 }
      )
    }

    const success = resolveError(errorId, user.name, notes)

    if (!success) {
      return NextResponse.json(
        { error: 'Error not found', errorCode: ErrorCode.API_NOT_FOUND },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to resolve error', details: error.message },
      { status: 500 }
    )
  }
}
