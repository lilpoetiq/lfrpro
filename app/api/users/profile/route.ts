import { NextRequest, NextResponse } from 'next/server'
import { updateUser, getUserById } from '@/lib/storage'

/**
 * PATCH /api/users/profile
 * Self-update of profile: phoneNumber, email only.
 * Body: { userId, phoneNumber?, email? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, phoneNumber, email } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    const user = getUserById(userId)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const updates: Record<string, string> = {}
    if (phoneNumber !== undefined) updates.phoneNumber = String(phoneNumber).trim() || ''
    if (email !== undefined) updates.email = String(email).trim()

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    updateUser(userId, updates)
    const updated = getUserById(userId)
    const { password, passwords, passwordHashes, ...safeUser } = updated as any

    return NextResponse.json({ success: true, user: safeUser })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update profile', details: error.message },
      { status: 500 }
    )
  }
}
