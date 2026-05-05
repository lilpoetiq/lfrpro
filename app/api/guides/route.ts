import { NextRequest, NextResponse } from 'next/server'
import { getGuides, addGuide, updateGuide, deleteGuide, getGuidesForUser, getUsers, addMessage } from '@/lib/storage'
import { logActivity } from '@/lib/activityLog'

// Get guides - filtered by user if userId provided
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (userId) {
      // Return only guides assigned to this user
      const userGuides = getGuidesForUser(userId)
      return NextResponse.json({ success: true, guides: userGuides })
    }
    
    // Return all guides (for admin management)
    const guides = getGuides()
    return NextResponse.json({ success: true, guides })
  } catch (error: any) {
    console.error('Get guides error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch guides', details: error.message },
      { status: 500 }
    )
  }
}

// Create guide (Eric/admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, content, assignedTo, createdBy, userName } = body

    // Only allow Eric (the owner) to create guides
    const users = getUsers()
    const creator = users.find(u => u.id === createdBy)
    
    // Check if creator is Eric (owner account - ID "1" or username "admin" or name contains "Eric")
    const isEric = creator && (
      creator.id === '1' || 
      creator.username === 'admin' || 
      (creator.name.toLowerCase().includes('eric') && creator.role === 'admin')
    )
    
    if (!creator || !isEric) {
      return NextResponse.json(
        { error: 'Only Eric (the owner) can create guides' },
        { status: 403 }
      )
    }

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      )
    }

    const guide = addGuide({
      title,
      content,
      createdBy,
      assignedTo: assignedTo || [],
      isActive: true,
    })

    // Create notifications for assigned users
    if (assignedTo && assignedTo.length > 0) {
      const users = getUsers()
      assignedTo.forEach((userId: string) => {
        const assignedUser = users.find(u => u.id === userId)
        if (assignedUser) {
          // Create a message notification for the assigned user with detailed information
          addMessage({
            from: createdBy,
            fromName: userName || creator.name,
            to: userId,
            toName: assignedUser.name,
            subject: `📚 New guide assigned: ${guide.title}`,
            message: `You have been assigned a guide to study: "${guide.title}"\n\n${guide.content.substring(0, 200)}${guide.content.length > 200 ? '...' : ''}\n\nPlease review this guide and follow the instructions provided.\n\nAssigned by: ${userName || creator.name}`,
            // Store guideId in a way that can be extracted (we'll parse it from subject/message)
            // The notification API will extract guideId by matching the title
          })
        }
      })
    }

    // Log activity
    logActivity({
      action: 'Guide created',
      user: userName || creator.name,
      userId: createdBy,
      category: 'system',
      details: {
        guideId: guide.id,
        title: guide.title,
        assignedTo: guide.assignedTo,
      },
    })

    return NextResponse.json({ success: true, guide })
  } catch (error: any) {
    console.error('Create guide error:', error)
    return NextResponse.json(
      { error: 'Failed to create guide', details: error.message },
      { status: 500 }
    )
  }
}

// Update guide (Eric/admin only)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, updates, userId, userName } = body

    if (!id) {
      return NextResponse.json({ error: 'Guide ID required' }, { status: 400 })
    }

    // Only allow Eric (the owner) to update guides
    const users = getUsers()
    const user = users.find(u => u.id === userId)
    
    // Check if user is Eric (owner account - ID "1" or username "admin" or name contains "Eric")
    const isEric = user && (
      user.id === '1' || 
      user.username === 'admin' || 
      (user.name.toLowerCase().includes('eric') && user.role === 'admin')
    )
    
    if (!user || !isEric) {
      return NextResponse.json(
        { error: 'Only Eric (the owner) can update guides' },
        { status: 403 }
      )
    }

    const existingGuide = getGuides().find(g => g.id === id)
    if (!existingGuide) {
      return NextResponse.json({ error: 'Guide not found' }, { status: 404 })
    }

    const success = updateGuide(id, updates)

    if (!success) {
      return NextResponse.json({ error: 'Guide not found' }, { status: 404 })
    }

    // Check if assignedTo was updated and notify newly assigned users
    if (updates.assignedTo && Array.isArray(updates.assignedTo)) {
      const users = getUsers()
      const previousAssigned = existingGuide.assignedTo || []
      const newlyAssigned = updates.assignedTo.filter((userId: string) => !previousAssigned.includes(userId))
      
      newlyAssigned.forEach((userId: string) => {
        const assignedUser = users.find(u => u.id === userId)
        if (assignedUser) {
          // Create a message notification for the newly assigned user with detailed information
          addMessage({
            from: userId,
            fromName: userName || user.name,
            to: userId,
            toName: assignedUser.name,
            subject: `📚 New guide assigned: ${existingGuide.title}`,
            message: `You have been assigned a guide to study: "${existingGuide.title}"\n\n${existingGuide.content.substring(0, 200)}${existingGuide.content.length > 200 ? '...' : ''}\n\nPlease review this guide and follow the instructions provided.\n\nAssigned by: ${userName || user.name}`,
            // Store guideId in a way that can be extracted (we'll parse it from subject/message)
            // The notification API will extract guideId by matching the title
          })
        }
      })
    }

    // Log activity
    logActivity({
      action: 'Guide updated',
      user: userName || user.name,
      userId,
      category: 'system',
      details: {
        guideId: id,
        updates,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Update guide error:', error)
    return NextResponse.json(
      { error: 'Failed to update guide', details: error.message },
      { status: 500 }
    )
  }
}

// Delete guide (Eric/admin only)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const userId = searchParams.get('userId')
    const userName = searchParams.get('userName')

    if (!id) {
      return NextResponse.json({ error: 'Guide ID required' }, { status: 400 })
    }

    // Only allow Eric (the owner) to delete guides
    if (userId) {
      const users = getUsers()
      const user = users.find(u => u.id === userId)
      
      // Check if user is Eric (owner account - ID "1" or username "admin" or name contains "Eric")
      const isEric = user && (
        user.id === '1' || 
        user.username === 'admin' || 
        (user.name.toLowerCase().includes('eric') && user.role === 'admin')
      )
      
      if (!user || !isEric) {
        return NextResponse.json(
          { error: 'Only Eric (the owner) can delete guides' },
          { status: 403 }
        )
      }
    }

    const success = deleteGuide(id)

    if (!success) {
      return NextResponse.json({ error: 'Guide not found' }, { status: 404 })
    }

    // Log activity
    if (userId) {
      logActivity({
        action: 'Guide deleted',
        user: userName || 'Admin',
        userId,
        category: 'system',
        details: {
          guideId: id,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete guide error:', error)
    return NextResponse.json(
      { error: 'Failed to delete guide', details: error.message },
      { status: 500 }
    )
  }
}

