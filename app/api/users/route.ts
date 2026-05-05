import { NextRequest, NextResponse } from 'next/server'
import {
  addUser,
  updateUser,
  deleteUser,
  getUsers,
  getArtistUserMappings
} from '@/lib/storage'

export async function GET(request: NextRequest) {
  try {
    const users = getUsers()
    // Don't return passwords
    const safeUsers = users.map(({ password, passwords, ...user }: any) => user)
    return NextResponse.json({ success: true, users: safeUsers })
  } catch (error: any) {
    console.error('Get users error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password, name, email, role, phoneNumber, ipi, createdFromCredit } = body

    if (!username || !password || !name || !email || !role) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    const users = getUsers()
    if (users.some((u: any) => u.username === username || u.email === email)) {
      return NextResponse.json({ error: 'Username or email already exists' }, { status: 400 })
    }

    const user = addUser({ 
      username, 
      password,  // Will be converted to passwords array by helper functions
      name, 
      email, 
      role: role as 'artist' | 'manager' | 'admin' | 'producer',
      phoneNumber: phoneNumber || undefined,
      artistName: body.artistName || undefined,
      ipi: ipi || undefined,
      createdFromCredit: createdFromCredit || false,
    })
    const { password: _, passwords: __, ...safeUser } = user

      // After creating user, try to match with existing catalog items
      // This ensures artists like "Lilpoetiq" get linked when user accounts are created
      try {
        const { getCatalog, updateCatalogItem, getArtistUserMappings } = await import('@/lib/storage')
        const { parseArtistsFromString, matchArtistsToUsers } = await import('@/lib/artistParser')
        const catalog = getCatalog()
        const users = getUsers()
        
        // Get manual mappings
        const mappings = getArtistUserMappings()
        const manualMappings: Record<string, string> = {}
        mappings.forEach(m => {
          manualMappings[m.artistName.toLowerCase()] = m.userId
        })
        
        // Check if this user's name or artistName matches any artist in catalog
        const userArtistName = (body.artistName || name || '').toLowerCase().trim()
        const catalogItems = catalog.filter(item => {
          if (!item.artist) return false
          const itemArtists = parseArtistsFromString(item.artist)
          return itemArtists.some(a => {
            const normalizedArtist = a.toLowerCase().trim()
            return normalizedArtist === userArtistName || 
                   (userArtistName.length >= 3 && normalizedArtist.includes(userArtistName)) ||
                   (normalizedArtist.length >= 3 && userArtistName.includes(normalizedArtist))
          })
        })
        
        // Update catalog items to link to this user
        for (const item of catalogItems) {
          const itemArtists = parseArtistsFromString(item.artist)
          const matchedIds = matchArtistsToUsers(itemArtists, users, manualMappings)
        
        if (matchedIds.length > 0 && (!item.artistIds || !item.artistIds.includes(user.id))) {
          const updatedArtistIds = item.artistIds ? [...new Set([...item.artistIds, ...matchedIds])] : matchedIds
          updateCatalogItem(item.id, {
            artistIds: updatedArtistIds,
            artistId: updatedArtistIds[0], // Backwards compatibility
          })
        }
      }
    } catch (error) {
      // Non-critical - log but don't fail user creation
      console.error('[POST /api/users] Error matching user to catalog items:', error)
    }

    return NextResponse.json({ success: true, user: safeUser })
  } catch (error: any) {
    console.error('Add user error:', error)
    return NextResponse.json(
      { error: 'Failed to add user', details: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, actorUserId, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Security / Permissions:
    // Only admins can grant staff permissions or staff managed artists.
    // NOTE: This project does not have server sessions/JWT yet, so we require actorUserId from the client.
    const isStaffUpdate =
      Object.prototype.hasOwnProperty.call(updates, 'staffPermissions') ||
      Object.prototype.hasOwnProperty.call(updates, 'staffManagedArtistIds')

    if (isStaffUpdate) {
      if (!actorUserId) {
        return NextResponse.json({ error: 'actorUserId required for staff permission updates' }, { status: 400 })
      }
      const actor = getUsers().find((u: any) => u.id === actorUserId)
      if (!actor || actor.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 })
      }

      // Sanitize
      if (updates.staffPermissions !== undefined) {
        if (!Array.isArray(updates.staffPermissions)) {
          return NextResponse.json({ error: 'staffPermissions must be an array' }, { status: 400 })
        }
        updates.staffPermissions = updates.staffPermissions
          .filter((p: any) => typeof p === 'string')
          .map((p: string) => p.trim())
          .filter(Boolean)
      }
      if (updates.staffManagedArtistIds !== undefined) {
        if (!Array.isArray(updates.staffManagedArtistIds)) {
          return NextResponse.json({ error: 'staffManagedArtistIds must be an array' }, { status: 400 })
        }
        updates.staffManagedArtistIds = updates.staffManagedArtistIds
          .filter((id: any) => typeof id === 'string')
          .map((id: string) => id.trim())
          .filter(Boolean)
      }

      // Staff can never be allowed to "manage self" by allowlist
      updates.staffManagedArtistIds = (updates.staffManagedArtistIds || []).filter((aid: string) => aid !== id)
    }

    // Verify user exists before updating
    const users = getUsers()
    const userExists = users.some(u => u.id === id)
    
    if (!userExists) {
      return NextResponse.json({ 
        error: 'User not found',
        details: `User with ID "${id}" does not exist. Available user IDs: ${users.map((u: any) => u.id).join(', ')}`
      }, { status: 404 })
    }

    const success = updateUser(id, updates)

    if (!success) {
      return NextResponse.json({ 
        error: 'Failed to update user',
        details: 'User exists but update failed. Check server logs for details.'
      }, { status: 500 })
    }

    // After updating user, try to match with existing catalog items
    // This ensures artists get linked when user info is updated (e.g., adding artistName)
    try {
      const { getCatalog, updateCatalogItem, getUsers } = await import('@/lib/storage')
      const { parseArtistsFromString, matchArtistsToUsers } = await import('@/lib/artistParser')
      const catalog = getCatalog()
      const users = getUsers()
      const updatedUser = users.find(u => u.id === id)
      
      if (updatedUser) {
        // Check if this user's name or artistName matches any artist in catalog
        const artistName = (updatedUser.artistName || updatedUser.name || '').toLowerCase().trim()
        if (artistName) {
          const catalogItems = catalog.filter(item => {
            if (!item.artist) return false
            const itemArtists = parseArtistsFromString(item.artist)
            return itemArtists.some(a => a.toLowerCase().trim() === artistName)
          })
          
          // Get manual mappings
          const mappings = getArtistUserMappings()
          const manualMappings: Record<string, string> = {}
          mappings.forEach(m => {
            manualMappings[m.artistName.toLowerCase()] = m.userId
          })
          
          // Update catalog items to link to this user
          for (const item of catalogItems) {
            const itemArtists = parseArtistsFromString(item.artist)
            const matchedIds = matchArtistsToUsers(itemArtists, users, manualMappings)
            
            if (matchedIds.length > 0 && (!item.artistIds || !item.artistIds.includes(id))) {
              const updatedArtistIds = item.artistIds ? [...new Set([...item.artistIds, ...matchedIds])] : matchedIds
              updateCatalogItem(item.id, {
                artistIds: updatedArtistIds,
                artistId: updatedArtistIds[0], // Backwards compatibility
              })
            }
          }
        }
      }
    } catch (error) {
      // Non-critical - log but don't fail user update
      console.error('[PUT /api/users] Error matching user to catalog items:', error)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Update user error:', error)
    return NextResponse.json(
      { error: 'Failed to update user', details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const success = deleteUser(id)

    if (!success) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete user error:', error)
    return NextResponse.json(
      { error: 'Failed to delete user', details: error.message },
      { status: 500 }
    )
  }
}

