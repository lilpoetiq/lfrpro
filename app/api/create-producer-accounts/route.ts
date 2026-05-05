import { NextRequest, NextResponse } from 'next/server'
import { getCatalog, getUsers, addUser } from '@/lib/storage'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { songId, credits } = body

    if (!songId) {
      return NextResponse.json({ error: 'Song ID is required' }, { status: 400 })
    }

    if (!credits || !Array.isArray(credits)) {
      return NextResponse.json({ error: 'Credits array is required' }, { status: 400 })
    }

    const catalog = getCatalog()
    const song = catalog.find(item => item && item.id === songId)
    
    if (!song) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 })
    }

    const users = getUsers()
    const createdAccounts: string[] = []
    const existingAccounts: string[] = []

    // Process producer credits
    const producerCredits = credits.filter((credit: any) => credit.role === 'producer')
    
    for (const credit of producerCredits) {
      const producerName = (credit.name || '').trim()
      if (!producerName) continue

      // Check if account already exists (by name, email, or username)
      const normalizedName = producerName.toLowerCase().trim()
      const existingUser = users.find(u => {
        const userName = (u.name || '').toLowerCase().trim()
        const userArtistName = (u.artistName || '').toLowerCase().trim()
        const userEmail = (u.email || '').toLowerCase().trim()
        const userUsername = (u.username || '').toLowerCase().trim()
        
        return userName === normalizedName ||
               userArtistName === normalizedName ||
               userEmail === normalizedName ||
               userUsername === normalizedName ||
               (u.aliases || []).some((alias: string) => alias.toLowerCase().trim() === normalizedName)
      })

      if (existingUser) {
        existingAccounts.push(existingUser.id)
        continue
      }

      // Generate username from name (sanitized)
      const username = producerName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 20) || `producer${Date.now()}`

      // Check if username is taken, append number if needed
      let finalUsername = username
      let counter = 1
      while (users.some(u => u.username === finalUsername)) {
        finalUsername = `${username}${counter}`
        counter++
      }

      // Generate email (if IPI provided, use it; otherwise generate)
      const email = credit.ipi 
        ? `${finalUsername}@lfrpro.com`
        : `${finalUsername}@lfrpro.com`

      // Generate a default password (8 characters)
      const defaultPassword = Math.random().toString(36).slice(-8)

      try {
        const newUser = addUser({
          username: finalUsername,
          password: defaultPassword,
          name: producerName,
          email: email,
          role: 'producer',
          ipi: credit.ipi || undefined,
          createdFromCredit: true,
          aliases: credit.customRole ? [credit.customRole] : undefined,
        })

        createdAccounts.push(newUser.id)
        console.log(`[POST /api/create-producer-accounts] Created producer account for: ${producerName} (${newUser.id})`)
      } catch (error: any) {
        console.error(`[POST /api/create-producer-accounts] Error creating account for ${producerName}:`, error.message)
        // Continue with other credits even if one fails
      }
    }

    return NextResponse.json({
      success: true,
      created: createdAccounts.length,
      existing: existingAccounts.length,
      createdAccountIds: createdAccounts,
      existingAccountIds: existingAccounts,
    })
  } catch (error: any) {
    console.error('[POST /api/create-producer-accounts] Error:', error)
    return NextResponse.json(
      { error: 'Failed to create producer accounts', details: error.message },
      { status: 500 }
    )
  }
}
