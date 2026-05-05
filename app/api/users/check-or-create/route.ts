import { NextRequest, NextResponse } from 'next/server'
import { getUsers, addUser, updateUser } from '@/lib/storage'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, ipi } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const users = getUsers()
    
    // Check if user exists by name (case-insensitive)
    const normalizedName = name.toLowerCase().trim()
    const existingUser = users.find(u => 
      u.name.toLowerCase().trim() === normalizedName ||
      u.artistName?.toLowerCase().trim() === normalizedName ||
      u.realName?.toLowerCase().trim() === normalizedName ||
      u.aliases?.some(alias => alias.toLowerCase().trim() === normalizedName)
    )

    if (existingUser) {
      // Update IPI if provided and user doesn't have one
      if (ipi && !existingUser.ipi) {
        updateUser(existingUser.id, { ipi })
        return NextResponse.json({ 
          success: true, 
          user: { ...existingUser, ipi },
          exists: true 
        })
      }
      return NextResponse.json({ 
        success: true, 
        user: existingUser,
        exists: true 
      })
    }

    // User doesn't exist - return info for frontend to prompt
    return NextResponse.json({ 
      success: true, 
      exists: false,
      suggestedUsername: name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    })
  } catch (error: any) {
    console.error('Check or create user error:', error)
    return NextResponse.json(
      { error: 'Failed to check user', details: error.message },
      { status: 500 }
    )
  }
}

