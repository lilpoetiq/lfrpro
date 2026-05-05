import { NextRequest, NextResponse } from 'next/server'
import { getUploads, addUser } from '@/lib/storage'
import { extractArtistsFromCSV } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const { uploadId } = await request.json()
    
    const uploads = getUploads()
    const upload = uploadId 
      ? uploads.find(u => u.id === uploadId)
      : uploads.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0]
    
    if (!upload) {
      return NextResponse.json(
        { error: 'No CSV data found' },
        { status: 404 }
      )
    }

    const artists = (upload.artistsFound ?? extractArtistsFromCSV(upload.data || [])) || []
    const createdAccounts: any[] = []
    const errors: string[] = []

    for (const artistName of artists) {
      if (!artistName || artistName === 'Unknown') continue
      
      try {
        // Generate username from artist name (lowercase, replace spaces with underscores)
        const username = artistName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
        const defaultPassword = `${username}123` // Default password
        
        // Check if user already exists
        const { getUsers } = await import('@/lib/storage')
        const existingUsers = getUsers()
        if (existingUsers.some(u => u.username === username || u.name === artistName)) {
          errors.push(`${artistName}: Account already exists`)
          continue
        }
        
        const user = addUser({
          username,
          password: defaultPassword,
          name: artistName,
          email: `${username}@lfr.com`,
          role: 'artist',
        })
        
        createdAccounts.push({
          id: user.id,
          username: user.username,
          name: user.name,
          defaultPassword,
        })
      } catch (error: any) {
        errors.push(`${artistName}: ${error.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      created: createdAccounts.length,
      accounts: createdAccounts,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    console.error('Create accounts error:', error)
    return NextResponse.json(
      { error: 'Failed to create accounts', details: error.message },
      { status: 500 }
    )
  }
}

