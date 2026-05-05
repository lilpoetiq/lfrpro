import { NextRequest, NextResponse } from 'next/server'
import { getActivityLogs, logActivity } from '@/lib/activityLog'
import { getErrorLogs } from '@/lib/errorLogger'
import type { ActivityLogEntry } from '@/lib/activityLog'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined
    const category = searchParams.get('category') as any

    // Get activity logs
    const activityLogs = getActivityLogs(undefined, category === 'error' ? undefined : category)
    
    // Get error logs and convert them to activity log format
    const errorLogs = getErrorLogs({ limit: undefined })
    const errorActivityLogs: ActivityLogEntry[] = errorLogs.map(error => ({
      id: error.id,
      timestamp: error.timestamp,
      action: `${error.type}: ${error.message}`,
      user: error.userName || 'System',
      userId: error.userId,
      details: {
        errorCode: error.errorCode,
        errorType: error.type,
        severity: error.severity,
        endpoint: error.endpoint,
        method: error.method,
        resolved: error.resolved,
        ...error.details,
      },
      category: 'error' as const,
    }))
    
    // Merge activity logs and error logs
    let allLogs: ActivityLogEntry[] = [...activityLogs, ...errorActivityLogs]
    
    // Filter by category if specified (but errors are already filtered above)
    if (category && category !== 'all' && category !== 'error') {
      allLogs = allLogs.filter(log => log.category === category)
    } else if (category === 'error') {
      allLogs = errorActivityLogs
    }
    
    // Sort by timestamp (newest first)
    allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    
    // Apply limit after merging and sorting
    if (limit) {
      allLogs = allLogs.slice(0, limit)
    }

    return NextResponse.json({ success: true, logs: allLogs })
  } catch (error: any) {
    console.error('Get activity log error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activity log', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, user, userId, details, category } = body

    if (!action || !user || !category) {
      return NextResponse.json({ error: 'Action, user, and category are required' }, { status: 400 })
    }

    const entry = logActivity({
      action,
      user,
      userId,
      details: details || {},
      category,
    })

    return NextResponse.json({ success: true, entry })
  } catch (error: any) {
    console.error('Log activity error:', error)
    return NextResponse.json(
      { error: 'Failed to log activity', details: error.message },
      { status: 500 }
    )
  }
}

