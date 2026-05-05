import { NextRequest, NextResponse } from 'next/server'
import { getMessages, addMessage, updateMessage, getUsers, getCatalog, getUserById } from '@/lib/storage'
import { formatLocalDate } from '@/lib/utils'
import { logError, ErrorCode } from '@/lib/errorLogger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    // If no userId provided, return all messages (for admin dashboard)
    const messages = getMessages(userId || undefined)
    return NextResponse.json({ success: true, messages })
  } catch (error: any) {
    console.error('Get messages error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch messages', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { from, fromName, to, toName, subject, message, songId, dueDate } = body

    if (!from) {
      logError({
        errorCode: ErrorCode.API_MISSING_PARAMS,
        type: 'Message',
        message: 'User ID required for sending message',
        endpoint: '/api/messages',
        method: 'POST',
        severity: 'medium',
      })
      return NextResponse.json({ error: 'User ID required', errorCode: ErrorCode.API_MISSING_PARAMS }, { status: 400 })
    }

    // Verify authentication and permissions server-side
    const user = getUserById(from)
    if (!user) {
      logError({
        errorCode: ErrorCode.AUTH_USER_NOT_FOUND,
        type: 'Message',
        message: `User not found for sending message: ${from}`,
        userId: from,
        endpoint: '/api/messages',
        method: 'POST',
        severity: 'high',
      })
      return NextResponse.json({ error: 'User not found', errorCode: ErrorCode.AUTH_USER_NOT_FOUND }, { status: 404 })
    }

    // Prevent artists from sending messages (verify server-side)
    if (user.role === 'artist') {
      logError({
        errorCode: ErrorCode.API_FORBIDDEN,
        type: 'Message',
        message: `Artist attempted to send message`,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        endpoint: '/api/messages',
        method: 'POST',
        details: { to, subject },
        severity: 'medium',
      })
      return NextResponse.json({ error: 'Artists cannot send messages', errorCode: ErrorCode.API_FORBIDDEN }, { status: 403 })
    }

    if (!from || !to || !subject || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const users = getUsers()
    const toUser = users.find(u => u.id === to)
    if (!toUser) {
      return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })
    }

    // Get song info if songId is provided
    let songInfo = ''
    if (songId) {
      const catalog = getCatalog()
      const song = catalog.find(s => s.id === songId)
      if (song) {
        songInfo = ` for "${song.song}" by ${song.artist}`
      }
    }

    // Calculate days until due date if provided
    let daysText = ''
    if (dueDate) {
      const dueDateObj = new Date(dueDate)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      dueDateObj.setHours(0, 0, 0, 0)
      const daysUntil = Math.ceil((dueDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      daysText = daysUntil === 0 ? ' (due today)' : daysUntil === 1 ? ' (due in 1 day)' : daysUntil < 0 ? ` (${Math.abs(daysUntil)} day${Math.abs(daysUntil) !== 1 ? 's' : ''} overdue)` : ` (due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''})`
    }

    // Enhance message with context
    const enhancedMessage = `${message}${songInfo ? `\n\nRelated to: ${songInfo.replace(' for ', '')}` : ''}${dueDate ? `\n\nDue: ${formatLocalDate(dueDate)}${daysText}` : ''}\n\nSent by: ${fromName}`

    const newMessage = addMessage({
      from,
      fromName,
      to,
      toName: toUser.name,
      subject: subject,
      message: enhancedMessage,
      songId,
    })

    return NextResponse.json({ success: true, message: newMessage })
  } catch (error: any) {
    console.error('Add message error:', error)
    return NextResponse.json(
      { error: 'Failed to send message', details: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'Message ID required' }, { status: 400 })
    }

    const success = updateMessage(id, { read: true })

    if (!success) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Update message error:', error)
    return NextResponse.json(
      { error: 'Failed to update message', details: error.message },
      { status: 500 }
    )
  }
}
