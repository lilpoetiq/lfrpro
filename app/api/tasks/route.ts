import { NextRequest, NextResponse } from 'next/server'
import { getTasks, addTask, updateTask, deleteTask } from '@/lib/storage'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const assignedTo = searchParams.get('assignedTo')
    const userId = searchParams.get('userId')
    const songId = searchParams.get('songId')
    
    let tasks = getTasks()
    
    if (assignedTo) {
      tasks = tasks.filter(t => t.assignedTo === assignedTo)
    }
    
    if (userId) {
      tasks = tasks.filter(t => t.assignedTo === userId)
    }
    
    if (songId) {
      tasks = tasks.filter(t => t.songId === songId)
    }
    
    // Add assigned user names
    const { getUsers } = await import('@/lib/storage')
    const users = getUsers()
    const tasksWithNames = tasks.map(task => ({
      ...task,
      assignedToName: users.find(u => u.id === task.assignedTo)?.name || 'Unassigned',
    }))
    
    return NextResponse.json({ success: true, tasks: tasksWithNames })
  } catch (error: any) {
    console.error('Get tasks error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tasks', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, assignedTo, assignedToName, assignedBy, assignedByName, dueDate, category, songId, hasNotification, notificationMessage } = body

    if (!title || !assignedTo || !assignedToName) {
      return NextResponse.json({ error: 'Title, assignedTo, and assignedToName are required' }, { status: 400 })
    }

    const task = addTask({
      title,
      description: description || '',
      assignedTo,
      assignedToName,
      assignedBy: assignedBy || assignedTo,
      assignedByName: assignedByName || assignedToName,
      dueDate: dueDate || new Date().toISOString(),
      completed: false,
      category: category || 'general',
      songId: songId || undefined,
      hasNotification: hasNotification || false,
      notificationMessage: notificationMessage || undefined,
      status: 'pending',
    })

    return NextResponse.json({ success: true, task })
  } catch (error: any) {
    console.error('Add task error:', error)
    return NextResponse.json(
      { error: 'Failed to add task', details: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Task ID required' }, { status: 400 })
    }

    const success = updateTask(id, updates)

    if (!success) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Update task error:', error)
    return NextResponse.json(
      { error: 'Failed to update task', details: error.message },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, action } = body  // action: 'start' | 'complete'

    if (!id || !action) {
      return NextResponse.json({ error: 'Task ID and action are required' }, { status: 400 })
    }

    const tasks = getTasks()
    const task = tasks.find(t => t.id === id)

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    if (action === 'start') {
      const updates = {
        status: 'in_progress' as const,
        startedAt: new Date().toISOString(),
        completed: false,
      }
      updateTask(id, updates)
      return NextResponse.json({ success: true, task: { ...task, ...updates } })
    } else if (action === 'complete') {
      // Calculate time spent
      const startedAt = task.startedAt ? new Date(task.startedAt).getTime() : Date.now()
      const timeSpent = Math.floor((Date.now() - startedAt) / 1000) // seconds
      
      const updates = {
        status: 'completed' as const,
        completed: true,
        completedAt: new Date().toISOString(),
        timeSpent: (task.timeSpent || 0) + timeSpent,
      }
      updateTask(id, updates)
      return NextResponse.json({ success: true, task: { ...task, ...updates } })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('Update task status error:', error)
    return NextResponse.json(
      { error: 'Failed to update task status', details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Task ID required' }, { status: 400 })
    }

    const success = deleteTask(id)

    if (!success) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete task error:', error)
    return NextResponse.json(
      { error: 'Failed to delete task', details: error.message },
      { status: 500 }
    )
  }
}

