import { NextRequest, NextResponse } from 'next/server'
import {
  getCatalogChangeRequests,
  addCatalogChangeRequest,
  updateCatalogChangeRequest,
  getUsers,
} from '@/lib/storage'

function isStaffUser(user: any): boolean {
  return user?.role === 'artist' && Array.isArray(user?.staffPermissions) && user.staffPermissions.length > 0
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestedBy = searchParams.get('requestedBy')
    const status = searchParams.get('status') as 'pending' | 'approved' | 'denied' | undefined
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const users = getUsers()
    const user = users.find(u => u.id === userId)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Owner/admin: see all. Manager: see all. Staff: see only their own.
    const isAdmin = user.role === 'admin'
    const isManager = user.role === 'manager'
    const isStaff = isStaffUser(user)

    let items = getCatalogChangeRequests()
    if (isStaff && !isAdmin && !isManager) {
      items = items.filter(r => r.requestedBy === userId)
    }
    if (requestedBy) items = items.filter(r => r.requestedBy === requestedBy)
    if (status) items = items.filter(r => r.status === status)

    return NextResponse.json({ success: true, requests: items })
  } catch (error: any) {
    console.error('Get catalog change requests error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch change requests', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { songId, songName, artistName, requestedBy, requestedByName, changes, userId } = body

    if (!songId || !songName || !artistName || !requestedBy || !requestedByName || !changes) {
      return NextResponse.json(
        { error: 'songId, songName, artistName, requestedBy, requestedByName, and changes are required' },
        { status: 400 }
      )
    }

    const users = getUsers()
    const user = users.find(u => u.id === requestedBy)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Only staff can submit change requests (owner/manager edit directly)
    if (!isStaffUser(user)) {
      return NextResponse.json(
        { error: 'Only staff can submit catalog change requests. Owners and managers edit directly.' },
        { status: 403 }
      )
    }

    const req = addCatalogChangeRequest({
      songId,
      songName,
      artistName,
      requestedBy,
      requestedByName,
      changes: String(changes).trim(),
    })

    return NextResponse.json({ success: true, request: req })
  } catch (error: any) {
    console.error('Add catalog change request error:', error)
    return NextResponse.json(
      { error: 'Failed to submit change request', details: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status, reviewedBy, userId } = body

    if (!id || !status) {
      return NextResponse.json({ error: 'id and status are required' }, { status: 400 })
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const users = getUsers()
    const user = users.find(u => u.id === userId)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Only owner/admin and manager can approve/deny
    if (user.role !== 'admin' && user.role !== 'manager') {
      return NextResponse.json(
        { error: 'Only owner or manager can approve or deny change requests' },
        { status: 403 }
      )
    }

    const updated = updateCatalogChangeRequest(id, {
      status: status as 'pending' | 'approved' | 'denied',
      reviewedBy: reviewedBy || userId,
      reviewedAt: new Date().toISOString(),
    })

    if (!updated) {
      return NextResponse.json({ error: 'Change request not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, request: updated })
  } catch (error: any) {
    console.error('Update catalog change request error:', error)
    return NextResponse.json(
      { error: 'Failed to update change request', details: error.message },
      { status: 500 }
    )
  }
}
