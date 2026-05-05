import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getCatalog, getUsers } from '@/lib/storage'
import { parseArtistsFromString, matchArtistsToUsers } from '@/lib/artistParser'
import { notifyChecklistItemCompleted } from '@/lib/aiNotifications'
import { getDataPath } from '@/lib/uploadConfig'
import { getChecklistPath } from '@/lib/backup'

const DATA_DIR = getDataPath()

function hasStaffPermission(user: any, perm: string): boolean {
  return Array.isArray(user?.staffPermissions) && user.staffPermissions.includes(perm)
}

function isStaffUser(user: any): boolean {
  return user?.role === 'artist' && Array.isArray(user?.staffPermissions) && user.staffPermissions.length > 0
}

function itemHasArtistInScope(item: any, scopedArtistIds: string[]): boolean {
  if (!scopedArtistIds || scopedArtistIds.length === 0) return false
  if (item?.artistId && scopedArtistIds.includes(item.artistId)) return true
  if (Array.isArray(item?.artistIds) && item.artistIds.some((id: string) => scopedArtistIds.includes(id))) return true
  return false
}

function itemIncludesActorAsArtist(item: any, actorUserId: string): boolean {
  if (!actorUserId) return false
  if (item?.artistId === actorUserId) return true
  if (Array.isArray(item?.artistIds) && item.artistIds.includes(actorUserId)) return true
  return false
}

function canManageChecklist(song: any, actor: any): boolean {
  if (!actor || !song) return false
  if (actor.role === 'admin') return true
  if (actor.role === 'manager') {
    const linkedIds = actor.linkedArtistIds || []
    if (song.artistId && linkedIds.includes(song.artistId)) return true
    if (song.artistIds && song.artistIds.some((id: string) => linkedIds.includes(id))) return true
    return false
  }
  if (isStaffUser(actor)) {
    const managedIds = actor.staffManagedArtistIds || []
    // Self-lock: cannot manage own songs
    if (itemIncludesActorAsArtist(song, actor.id)) return false
    // Check if song is in managed scope
    if (song.artistId && managedIds.includes(song.artistId)) return true
    if (song.artistIds && song.artistIds.some((id: string) => managedIds.includes(id))) return true
    return false
  }
  return false
}

interface ChecklistItem {
  id: string
  songId: string
  task: string
  section: string
  category: 'mandatory' | 'optional'
  completed: boolean
  assignedTo?: string
  assignedToName?: string
  comment?: string
  dueDate?: string
  completedAt?: string
  completedBy?: string
  createdAt: string
  updatedAt: string
  hasNotification?: boolean
  notificationMessage?: string
  status?: 'pending' | 'in_progress' | 'completed'
  startedAt?: string
  timeSpent?: number
  adminNotes?: string
}

function getChecklistFile(songId: string, song?: string, artist?: string): string {
  return getChecklistPath(songId, song, artist)
}

function getChecklistItems(songId: string, song?: string, artist?: string): ChecklistItem[] {
  const slugPath = getChecklistFile(songId, song, artist)
  const legacyPath = path.join(DATA_DIR, `checklist_${songId}.json`)
  const filePath = fs.existsSync(slugPath) ? slugPath : legacyPath
  if (!fs.existsSync(filePath)) {
    return []
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

function saveChecklistItems(songId: string, items: ChecklistItem[], song?: string, artist?: string): void {
  const filePath = getChecklistFile(songId, song, artist)
  const legacyPath = path.join(DATA_DIR, `checklist_${songId}.json`)
  fs.writeFileSync(filePath, JSON.stringify(items, null, 2))
  if (song && artist && filePath !== legacyPath && fs.existsSync(legacyPath)) {
    try {
      fs.unlinkSync(legacyPath)
    } catch {
      // Ignore cleanup errors
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const songId = searchParams.get('songId')

    if (!songId) {
      return NextResponse.json({ error: 'Song ID is required' }, { status: 400 })
    }

    const catalog = getCatalog()
    const catalogItem = catalog.find(item => item && item.id === songId)
    const songName = catalogItem?.song
    const artistName = catalogItem?.artist

    let items = getChecklistItems(songId, songName, artistName)

    // If no items exist, initialize with default checklist
    if (items.length === 0) {
      items = initializeDefaultChecklist(songId)
      saveChecklistItems(songId, items, songName, artistName)
    }

    // Add assigned user names and ensure status field exists
    const { getUsers } = await import('@/lib/storage')
    const users = getUsers()
    const itemsWithNames = items.map(item => ({
      ...item,
      assignedToName: item.assignedTo ? (users.find(u => u.id === item.assignedTo)?.name || 'Unassigned') : undefined,
      status: item.status || (item.completed ? 'completed' : 'pending'), // Ensure status exists
    }))

    // Save updated items if we added status fields
    const needsUpdate = items.some(item => !item.status)
    if (needsUpdate) {
      const updatedItems = items.map(item => ({
        ...item,
        status: item.status || (item.completed ? 'completed' : 'pending'),
      }))
      saveChecklistItems(songId, updatedItems, songName, artistName)
    }

    return NextResponse.json({ success: true, items: itemsWithNames })
  } catch (error: any) {
    console.error('Get checklist error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch checklist', details: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { songId, itemId, updates, userId } = body

    if (!songId || !itemId) {
      return NextResponse.json({ error: 'Song ID and Item ID are required' }, { status: 400 })
    }

    // Check permissions
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const users = getUsers()
    const actor = users.find(u => u.id === userId)
    if (!actor) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get song from catalog
    const catalog = getCatalog()
    const song = catalog.find(item => item && item.id === songId)
    if (!song) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 })
    }

    // Check if user can manage this song's checklist
    if (!canManageChecklist(song, actor)) {
      return NextResponse.json({ error: 'You do not have permission to modify this checklist' }, { status: 403 })
    }

    const items = getChecklistItems(songId, song.song, song.artist)
    const itemIndex = items.findIndex(item => item.id === itemId)

    if (itemIndex === -1) {
      return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 })
    }

    const oldItem = items[itemIndex]
    const wasCompleted = oldItem.completed || false

    // Update item
    items[itemIndex] = {
      ...items[itemIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    }

    // If marking as completed, set completedAt and completedBy, and stop timer
    if (updates.completed && !items[itemIndex].completedAt) {
      items[itemIndex].completedAt = new Date().toISOString()
      items[itemIndex].completedBy = updates.completedBy || undefined
      
      // Stop timer and save time spent if timer was running
      if (items[itemIndex].startedAt) {
        const startedAt = new Date(items[itemIndex].startedAt).getTime()
        const timeSpent = Math.floor((Date.now() - startedAt) / 1000) // seconds
        items[itemIndex].timeSpent = (items[itemIndex].timeSpent || 0) + timeSpent
        items[itemIndex].status = 'completed'
        items[itemIndex].startedAt = undefined // Clear startedAt since it's completed
      } else {
        items[itemIndex].status = 'completed'
      }
    }

    // If unmarking as completed, clear completedAt and reset status
    if (updates.completed === false) {
      items[itemIndex].completed = false
      items[itemIndex].completedAt = undefined
      items[itemIndex].completedBy = undefined
      items[itemIndex].status = 'pending'
      items[itemIndex].timeSpent = undefined
      items[itemIndex].startedAt = undefined
    }

    saveChecklistItems(songId, items, song.song, song.artist)

    // Notify artists when important checklist items are completed
    const isNowCompleted = items[itemIndex].completed || false
    const justCompleted = !wasCompleted && isNowCompleted

    if (justCompleted) {
      try {
        // Get song information
        const catalog = getCatalog()
        const song = catalog.find(item => item && item.id === songId)
        
        if (song) {
          // Get artist user IDs for notifications
          let artistUserIds: string[] = []
          try {
            const users = getUsers()
            const parsedArtists = parseArtistsFromString(song.artist)
            // Get manual mappings
            const { getArtistUserMappings } = await import('@/lib/storage')
            const mappings = getArtistUserMappings()
            const manualMappings: Record<string, string> = {}
            mappings.forEach(m => {
              manualMappings[m.artistName.toLowerCase()] = m.userId
            })
            
            artistUserIds = matchArtistsToUsers(parsedArtists, users, manualMappings)
            
            // Fallback to artistIds if available
            if (artistUserIds.length === 0 && song.artistIds && song.artistIds.length > 0) {
              artistUserIds = song.artistIds
            } else if (artistUserIds.length === 0 && song.artistId) {
              artistUserIds = [song.artistId]
            }
          } catch (error) {
            console.error('[PUT /api/checklist] Error getting artist user IDs:', error)
          }

          // Notify about checklist completion
          await notifyChecklistItemCompleted({
            songName: song.song,
            artistName: song.artist,
            task: items[itemIndex].task,
            section: items[itemIndex].section,
            completedBy: items[itemIndex].completedBy,
            releaseDate: song.releaseDate || song.releaseDateRequested,
            artistUserIds,
          })
        }
      } catch (error) {
        console.error('[PUT /api/checklist] Error notifying checklist completion (non-critical):', error)
        // Continue - don't fail the request
      }
    }

    return NextResponse.json({ success: true, item: items[itemIndex] })
  } catch (error: any) {
    console.error('Update checklist error:', error)
    return NextResponse.json(
      { error: 'Failed to update checklist', details: error.message },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { songId, itemId, action, completedBy, userId } = body  // action: 'start' | 'complete'

    if (!songId || !itemId || !action) {
      return NextResponse.json({ error: 'Song ID, item ID, and action are required' }, { status: 400 })
    }

    // Check permissions
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const users = getUsers()
    const actor = users.find(u => u.id === userId)
    if (!actor) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get song from catalog
    const catalog = getCatalog()
    const song = catalog.find(item => item && item.id === songId)
    if (!song) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 })
    }

    // Check if user can manage this song's checklist
    if (!canManageChecklist(song, actor)) {
      return NextResponse.json({ error: 'You do not have permission to modify this checklist' }, { status: 403 })
    }

    const items = getChecklistItems(songId, song.song, song.artist)
    const itemIndex = items.findIndex(item => item.id === itemId)

    if (itemIndex === -1) {
      return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 })
    }

    const item = items[itemIndex]

    if (action === 'start') {
      items[itemIndex] = {
        ...item,
        status: 'in_progress',
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      saveChecklistItems(songId, items, song.song, song.artist)
      return NextResponse.json({ success: true, item: items[itemIndex] })
    } else if (action === 'complete') {
      // Calculate time spent
      const startedAt = item.startedAt ? new Date(item.startedAt).getTime() : Date.now()
      const timeSpent = Math.floor((Date.now() - startedAt) / 1000) // seconds
      
      items[itemIndex] = {
        ...item,
        status: 'completed',
        completed: true,
        completedAt: new Date().toISOString(),
        completedBy: completedBy || item.completedBy,
        timeSpent: (item.timeSpent || 0) + timeSpent,
        updatedAt: new Date().toISOString(),
      }
      saveChecklistItems(songId, items, song.song, song.artist)
      
      // Send notification when checklist item is completed
      try {
        const catalog = getCatalog()
        const song = catalog.find(item => item && item.id === songId)
        
        if (song) {
          // Get artist user IDs for notifications
          let artistUserIds: string[] = []
          try {
            const users = getUsers()
            const parsedArtists = parseArtistsFromString(song.artist)
            // Get manual mappings
            const { getArtistUserMappings } = await import('@/lib/storage')
            const mappings = getArtistUserMappings()
            const manualMappings: Record<string, string> = {}
            mappings.forEach(m => {
              manualMappings[m.artistName.toLowerCase()] = m.userId
            })
            
            artistUserIds = matchArtistsToUsers(parsedArtists, users, manualMappings)
            
            // Fallback to artistIds if available
            if (artistUserIds.length === 0 && song.artistIds && song.artistIds.length > 0) {
              artistUserIds = song.artistIds
            } else if (artistUserIds.length === 0 && song.artistId) {
              artistUserIds = [song.artistId]
            }
          } catch (error) {
            console.error('[PATCH /api/checklist] Error getting artist user IDs:', error)
          }

          // Notify about checklist completion
          await notifyChecklistItemCompleted({
            songName: song.song,
            artistName: song.artist,
            task: items[itemIndex].task,
            section: items[itemIndex].section,
            completedBy: items[itemIndex].completedBy,
            releaseDate: song.releaseDate || song.releaseDateRequested,
            artistUserIds,
          })
        }
      } catch (error) {
        console.error('[PATCH /api/checklist] Error notifying checklist completion (non-critical):', error)
        // Continue - don't fail the request
      }
      
      return NextResponse.json({ success: true, item: items[itemIndex] })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('Update checklist status error:', error)
    return NextResponse.json(
      { error: 'Failed to update checklist status', details: error.message },
      { status: 500 }
    )
  }
}

function initializeDefaultChecklist(songId: string): ChecklistItem[] {
  const now = new Date().toISOString()
  let itemId = 1

  const createItem = (task: string, section: string, category: 'mandatory' | 'optional'): ChecklistItem => ({
    id: `checklist_${songId}_${itemId++}`,
    songId,
    task,
    section,
    category,
    completed: false,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  })

  return [
    // MANDATORY TASKS
    // 1. Publishing (2–3 Weeks Before Release)
    createItem('Confirm splits with all writers/producers (split sheet signed)', '1. Publishing (2–3 Weeks Before Release)', 'mandatory'),
    createItem('Register song with PRO (ASCAP)', '1. Publishing (2–3 Weeks Before Release)', 'mandatory'),
    createItem('Register with The MLC', '1. Publishing (2–3 Weeks Before Release)', 'mandatory'),
    createItem('Register song with Identifyy (YouTube)', '1. Publishing (2–3 Weeks Before Release)', 'mandatory'),

    // 2. Distribution Setup (2-3 weeks before release)
    createItem('Collect final master (WAV + MP3)', '2. Distribution Setup (2-3 weeks before release)', 'mandatory'),
    createItem('Work on Dolby Atmos Mixes (wav only)', '2. Distribution Setup (2-3 weeks before release)', 'mandatory'),
    createItem('Collect final cover art (3000x3000 JPG with artist name & title)', '2. Distribution Setup (2-3 weeks before release)', 'mandatory'),
    createItem('Collect credits (producers, writers, engineers)', '2. Distribution Setup (2-3 weeks before release)', 'mandatory'),
    createItem('Collect & upload lyrics to Musixmatch', '2. Distribution Setup (2-3 weeks before release)', 'mandatory'),
    createItem('Upload to distributor (Empire / Orchard)', '2. Distribution Setup (2-3 weeks before release)', 'mandatory'),
    createItem('Add correct metadata (UPC, ISRC, splits, publisher info)', '2. Distribution Setup (2-3 weeks before release)', 'mandatory'),
    createItem('Schedule release date (2–3 weeks prep time)', '2. Distribution Setup (2-3 weeks before release)', 'mandatory'),

    // 4. Content & Social Media - Before Release
    createItem('Schedule music video (2 weeks before release) (if we can)', '4. Content & Social Media - Before Release', 'mandatory'),
    createItem('Announce release date with cover art', '4. Content & Social Media - Before Release', 'mandatory'),
    createItem('Schedule content for every 2 days. (Push hard)', '4. Content & Social Media - Before Release', 'mandatory'),
    createItem('Upload Spotify Canvas', '4. Content & Social Media - Before Release', 'mandatory'),

    // Release Day
    createItem('Post streaming links on all socials', '4. Content & Social Media - Release Day', 'mandatory'),
    createItem('Update bio/link in bio', '4. Content & Social Media - Release Day', 'mandatory'),
    createItem('Drop music video or visualizer', '4. Content & Social Media - Release Day', 'mandatory'),
    createItem('Share Spotify Canvas on socials', '4. Content & Social Media - Release Day', 'mandatory'),

    // Post Release (1–4 Weeks)
    createItem('Post consistently every 3 days. (Step off)', '4. Content & Social Media - Post Release (1–4 Weeks)', 'mandatory'),

    // 5. Strategy & Planning
    createItem('Build release campaign plans', '5. Strategy & Planning', 'mandatory'),
    createItem('Identify the target audience', '5. Strategy & Planning', 'mandatory'),
    createItem('Align plans with label managers & A&R', '5. Strategy & Planning', 'mandatory'),

    // 6. Content & Branding
    createItem('Ensure artist branding is consistent (logos, colors, fonts)', '6. Content & Branding', 'mandatory'),
    createItem('Approve & guide content ideas (photoshoots, promo videos)', '6. Content & Branding', 'mandatory'),

    // 7. Social Media Management
    createItem('Oversee artist + label social campaigns', '7. Social Media Management', 'mandatory'),
    createItem('Create posting schedules', '7. Social Media Management', 'mandatory'),
    createItem('Monitor engagement/analytics', '7. Social Media Management', 'mandatory'),

    // 8. Release Marketing
    createItem('Coordinate timelines with Release Manager', '8. Release Marketing', 'mandatory'),
    createItem('Ensure pre-save links are ready & pushed', '8. Release Marketing', 'mandatory'),
    createItem('Manage playlist pitching (Spotify, Apple Music, YouTube)', '8. Release Marketing', 'mandatory'),

    // 11. Analytics & Reporting
    createItem('Track streams, sales, engagement, ads', '11. Analytics & Reporting', 'mandatory'),
    createItem('Make performance reports (day after release)', '11. Analytics & Reporting', 'mandatory'),
    createItem('Make update performance report (2 weeks after release)', '11. Analytics & Reporting', 'mandatory'),
    createItem('Suggest improvements for future releases', '11. Analytics & Reporting', 'mandatory'),

    // OPTIONAL TASKS
    // Promotion Prep
    createItem('Send to blogs, playlists, DJs, curators', 'Promotion Prep', 'optional'),
    createItem('Pitch to local radio & college stations', 'Promotion Prep', 'optional'),
    createItem('Submit to SubmitHub / Groover / PlaylistPush', 'Promotion Prep', 'optional'),
    createItem('Schedule interviews/podcasts (every 2 releases)', 'Promotion Prep', 'optional'),
    createItem('Teasers/clips from studio sessions', 'Promotion Prep', 'optional'),
    createItem('Behind-the-scenes content', 'Promotion Prep', 'optional'),

    // Content & Social Media - Before Release
    createItem('Behind-the-scenes video of making the track', 'Content & Social Media - Before Release (Optional)', 'optional'),
    createItem('Countdown posts', 'Content & Social Media - Before Release (Optional)', 'optional'),
    createItem('Pre-save page (Legendary Fyre Records website)', 'Content & Social Media - Before Release (Optional)', 'optional'),

    // Release Day (Optional)
    createItem('Celebration/BTS post', 'Content & Social Media - Release Day (Optional)', 'optional'),

    // Post-Release (Optional)
    createItem('Performance video', 'Content & Social Media - Post-Release (Optional)', 'optional'),
    createItem('Lyric video / motion graphic', 'Content & Social Media - Post-Release (Optional)', 'optional'),

    // Partnerships & PR
    createItem('Pitch music for blog write-ups & reviews', 'Partnerships & PR', 'optional'),
    createItem('Manage collaborations or brand sponsorships', 'Partnerships & PR', 'optional'),
  ]
}

