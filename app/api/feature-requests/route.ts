import { NextRequest, NextResponse } from 'next/server'
import { readJsonFile, writeJsonFile } from '@/lib/storage'

export interface FeatureRequest {
  id: string
  userId: string
  userName: string
  message: string
  createdAt: string
  status: 'pending' | 'reviewed' | 'done'
}

function getRequests(): FeatureRequest[] {
  return readJsonFile<FeatureRequest>('featureRequests.json')
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const asAdmin = searchParams.get('admin') === 'true'

    const requests = getRequests()

    if (asAdmin && userId) {
      const users = (await import('@/lib/storage')).getUsers()
      const actor = users.find((u: any) => u.id === userId)
      if (actor?.role === 'admin') {
        return NextResponse.json({ success: true, requests })
      }
    }

    if (userId) {
      const filtered = requests.filter((r) => r.userId === userId)
      return NextResponse.json({ success: true, requests: filtered })
    }

    return NextResponse.json({ success: true, requests: [] })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch feature requests', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, userName, message } = body

    if (!userId || !message || typeof message !== 'string') {
      return NextResponse.json({ error: 'userId and message required' }, { status: 400 })
    }

    const requests = getRequests()
    const id = `fr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const newRequest: FeatureRequest = {
      id,
      userId,
      userName: userName || 'Unknown',
      message: message.trim(),
      createdAt: new Date().toISOString(),
      status: 'pending',
    }
    requests.unshift(newRequest)
    writeJsonFile('featureRequests.json', requests)

    return NextResponse.json({ success: true, request: newRequest })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to submit feature request', details: error.message },
      { status: 500 }
    )
  }
}
