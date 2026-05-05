import { NextRequest, NextResponse } from 'next/server'
import { getCatalog, addCatalogItem, updateCatalogItem, deleteCatalogItem, archiveCatalogItem, getUsers, getArtistUserMappings, computeCampaignStatus, autoCompleteExpiredCampaigns } from '@/lib/storage'
import { logActivity } from '@/lib/activityLog'
import { notifyStreamsUpdated, notifyCatalogUpdated, notifySongDelayed, notifySongDelayRemoved, notifySongUpdated } from '@/lib/aiNotifications'
import { parseArtistsFromString, matchArtistsToUsers } from '@/lib/artistParser'
import { logChange } from '@/lib/db'
import { backupToJson } from '@/lib/backup'

export const dynamic = 'force-dynamic'

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
  if (Array.isArray(item?.songs)) {
    for (const track of item.songs) {
      const feat = track?.featuredArtistIds
      if (Array.isArray(feat) && feat.some((id: string) => scopedArtistIds.includes(id))) return true
    }
  }
  return false
}

function itemIncludesActorAsArtist(item: any, actorUserId: string): boolean {
  if (!actorUserId) return false
  if (item?.artistId === actorUserId) return true
  if (Array.isArray(item?.artistIds) && item.artistIds.includes(actorUserId)) return true
  return false
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const autoLink = searchParams.get('autoLink') === 'true'
    const viewerUserId = searchParams.get('userId') || undefined
    const includeArchivedParam = searchParams.get('includeArchived') === 'true'
    const statusFilter = searchParams.get('status') || undefined // upcoming | active | completed | archived
    const artistFilter = searchParams.get('artist') || undefined // artist name or ID
    let viewerIsNonAdmin = false
    let viewer: any = null

    // Auto-move expired campaigns to completed
    autoCompleteExpiredCampaigns()
    
    let catalog = getCatalog()
    
    // Auto-link artists for items missing artistIds (if requested)
    if (autoLink) {
      try {
        const users = getUsers()
        const mappings = getArtistUserMappings()
        const manualMappings: Record<string, string> = {}
        mappings.forEach(m => {
          manualMappings[m.artistName.toLowerCase()] = m.userId
        })
        
        let linkedCount = 0
        catalog = catalog.map((item: any) => {
          // Skip if already has artistIds
          if (item.artistIds && item.artistIds.length > 0) {
            return item
          }
          
          // Try to link based on artist name
          if (item.artist) {
            const parsedArtists = parseArtistsFromString(item.artist)
            const matchedIds = matchArtistsToUsers(parsedArtists, users, manualMappings)
            
            if (matchedIds.length > 0) {
              linkedCount++
              
              // Update artist name to use artistName (display name) instead of real name
              // e.g., "Od Sleep" instead of "Loyce Weaver"
              // BUT: Only include artist accounts, not managers (managers shouldn't appear in artist field)
              const artistUserIds = matchedIds.filter(id => {
                const user = users.find(u => u.id === id)
                return user && user.role === 'artist'
              })
              
              const displayNames = artistUserIds.map(id => {
                const user = users.find(u => u.id === id)
                return user?.artistName || user?.name || ''
              }).filter(Boolean)
              
              return {
                ...item,
                artistIds: matchedIds, // Keep all IDs (including managers) for linking
                artistId: artistUserIds.length > 0 ? artistUserIds[0] : matchedIds[0], // Use first artist ID
                artist: displayNames.length > 0 ? displayNames.join(' & ') : item.artist, // Use display names (artists only)
              }
            }
          }
          
          return item
        })
        
        // Save updated catalog if any items were linked
        if (linkedCount > 0) {
          // Update each item individually to ensure proper saving
          // IMPORTANT: Only update items that were actually modified, and preserve all existing fields
          catalog.forEach((item: any) => {
            if (item.artistIds && item.artistIds.length > 0) {
              // Get the original item to compare
              const originalItem = getCatalog().find(orig => orig.id === item.id)
              if (originalItem) {
                // Only update if artistIds or artistId actually changed
                const artistIdsChanged = !originalItem.artistIds || 
                  JSON.stringify(originalItem.artistIds.sort()) !== JSON.stringify(item.artistIds.sort())
                const artistIdChanged = originalItem.artistId !== item.artistId
                const artistChanged = originalItem.artist !== item.artist
                
                if (artistIdsChanged || artistIdChanged || artistChanged) {
                  // Preserve all existing fields, only update what changed
                  const updates: any = {}
                  if (artistIdsChanged) updates.artistIds = item.artistIds
                  if (artistIdChanged) updates.artistId = item.artistId
                  if (artistChanged) updates.artist = item.artist
                  
                  updateCatalogItem(item.id, updates)
                }
              }
            }
          })
          console.log(`[GET /api/catalog] Auto-linked ${linkedCount} catalog items to artist accounts`)
        }
      } catch (error) {
        console.error('[GET /api/catalog] Error auto-linking (non-critical):', error)
        // Continue - don't fail the request
      }
    }
    
    // Filter out denied releases - they should not appear in the catalog
    let filteredCatalog = catalog.filter((item: any) => item.releaseApprovalStatus !== 'denied')
    
    const totalBeforeArchiveFilter = filteredCatalog.length
    const archivedCount = filteredCatalog.filter((item: any) => item.isArchived).length
    
    // Filter out archived items (unless explicitly requested via includeArchived param)
    if (!includeArchivedParam) {
      filteredCatalog = filteredCatalog.filter((item: any) => !item.isArchived)
    }

    // Apply campaign status filter
    if (statusFilter) {
      filteredCatalog = filteredCatalog.filter((item: any) => computeCampaignStatus(item) === statusFilter)
    }

    // Apply artist filter (by name or artistId)
    if (artistFilter) {
      const q = artistFilter.toLowerCase().trim()
      filteredCatalog = filteredCatalog.filter((item: any) => {
        if (item.artistId === artistFilter) return true
        if (item.artist?.toLowerCase().includes(q)) return true
        if (item.artistIds?.includes(artistFilter)) return true
        return false
      })
    }
    
    console.log(`[API Catalog] Total items: ${catalog.length}, After denied filter: ${totalBeforeArchiveFilter}, Archived: ${archivedCount}, After archive filter: ${filteredCatalog.length}, includeArchivedParam: ${includeArchivedParam}`)

    // Optional scoping: if a viewerUserId is provided, scope results for staff/managers/producers (admins see all)
    // Check if viewer is admin first - admins should never be scoped
    let isAdmin = false
    if (viewerUserId) {
      const users = getUsers()
      viewer = users.find(u => u.id === viewerUserId) || null
      isAdmin = viewer?.role === 'admin' || false
      viewerIsNonAdmin = !!viewer && !isAdmin
      
      // Skip scoping for admins - they see everything
      if (isAdmin) {
        console.log(`[API Catalog] Admin user detected, skipping scoping - showing all ${filteredCatalog.length} items`)
      } else if (viewerIsNonAdmin && viewer) {
        const viewerIsStaff = isStaffUser(viewer)
        let scopedArtistIds: string[] = []
        
        if (viewer.role === 'manager') {
          scopedArtistIds = viewer.linkedArtistIds || []
        } else if (viewer.role === 'producer') {
          // Producers: filter songs where they are credited as producer
          // Match by name (case-insensitive) from credits
          const producerName = (viewer.name || '').toLowerCase().trim()
          const producerArtistName = (viewer.artistName || '').toLowerCase().trim()
          const producerAliases = (viewer.aliases || []).map((a: string) => a.toLowerCase().trim())
          
          filteredCatalog = filteredCatalog.filter((item: any) => {
            // Check song-level credits
            if (item.credits && Array.isArray(item.credits)) {
              const hasProducerCredit = item.credits.some((credit: any) => {
                if (credit.role !== 'producer') return false
                const creditName = (credit.name || '').toLowerCase().trim()
                return creditName === producerName || 
                       creditName === producerArtistName ||
                       producerAliases.includes(creditName) ||
                       (producerName && creditName.includes(producerName)) ||
                       (producerArtistName && creditName.includes(producerArtistName))
              })
              if (hasProducerCredit) return true
            }
            
            // Check track-level credits (for albums/EPs)
            if (item.songs && Array.isArray(item.songs)) {
              return item.songs.some((track: any) => {
                if (!track.credits || !Array.isArray(track.credits)) return false
                return track.credits.some((credit: any) => {
                  if (credit.role !== 'producer') return false
                  const creditName = (credit.name || '').toLowerCase().trim()
                  return creditName === producerName || 
                         creditName === producerArtistName ||
                         producerAliases.includes(creditName) ||
                         (producerName && creditName.includes(producerName)) ||
                         (producerArtistName && creditName.includes(producerArtistName))
                })
              })
            }
            
            return false
          })
          
          // Producers don't need artist ID scoping, they're scoped by credits
          scopedArtistIds = []
        } else if (viewerIsStaff) {
          // Staff users in Artist mode: include their own songs + managed artists
          // Staff users in Staff mode: don't scope (see full catalog) - handled by not passing userId
          scopedArtistIds = [
            viewer.id, // Include their own songs
            ...(viewer.staffManagedArtistIds || []) // Plus their managed artists
          ]
        } else {
          // Regular artist: only their own songs
          scopedArtistIds = [viewer.id]
        }

        if (scopedArtistIds.length > 0) {
          filteredCatalog = filteredCatalog.filter((item: any) => itemHasArtistInScope(item, scopedArtistIds))
        }

        // Note: Staff self-lock is enforced on write operations (PUT/POST/DELETE), not reads
        // Staff users can see their own songs in the catalog, they just can't edit/approve them
      }
    }
    
    // Ensure all items have valid IDs and required fields
    // Filter out items with invalid song/artist names (like "????")
    const slugifyForId = (input: string) =>
      (input || '')
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')

    const validatedCatalog = filteredCatalog
      .filter((item: any) => {
        // Filter out items with invalid song or artist names
        if (!item.song || item.song === '????' || item.song.trim() === '') {
          console.warn(`[GET /api/catalog] Filtering out item with invalid song name: "${item.song}" (ID: ${item.id})`)
          return false
        }
        if (!item.artist || item.artist === '????' || item.artist.trim() === '') {
          console.warn(`[GET /api/catalog] Filtering out item with invalid artist name: "${item.artist}" (ID: ${item.id})`)
          return false
        }
        return true
      })
      .map((item: any) => {
        const baseId = `${slugifyForId(item.song)}-by-${slugifyForId(item.artist)}`
        const campaignStatus = computeCampaignStatus(item)
        const out: any = {
          ...item,
          // Prefer human-friendly IDs. If missing, generate from song+artist.
          id:
            item.id ||
            (baseId !== 'untitled-by-unknown' && baseId !== '-by-' ? baseId : '') ||
            `catalog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          releaseType: item.releaseType || 'single',
          totalStreams: item.totalStreams || 0,
          campaignStatus,
        }
        if (viewerIsNonAdmin && viewer) {
          delete out.aiActionHistory
        }
        return out
      })
    
    console.log('[GET /api/catalog] Returning catalog with', validatedCatalog.length, 'items (total in DB:', catalog.length, ', denied filtered:', catalog.length - filteredCatalog.length, ', archived:', includeArchivedParam ? 'included' : 'excluded', ', scoped:', viewerUserId && !isAdmin ? 'yes' : 'no', ')')
    return NextResponse.json({ success: true, catalog: validatedCatalog })
  } catch (error: any) {
    console.error('[GET /api/catalog] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch catalog', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { song, artist, artistId, artistIds, releaseType, releaseDate, totalStreams, distributor, fileUrl, googleDriveUrl, upc, isrc, songs, userId, userName } = body

    // Determine actor (do not trust userRole from client - verify server-side)
    if (!userId) return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    const actor = getUsers().find(u => u.id === userId)
    if (!actor) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const actorIsAdmin = actor.role === 'admin'
    const actorIsManager = actor.role === 'manager'
    const actorIsProducer = actor.role === 'producer'
    const actorIsStaff = isStaffUser(actor)
    
    // Producers have read-only access
    if (actorIsProducer) {
      return NextResponse.json({ error: 'Forbidden: Producers have read-only access' }, { status: 403 })
    }
    
    const canWriteCatalog = actorIsAdmin || actorIsManager || (actorIsStaff && hasStaffPermission(actor, 'staff:catalog:write'))
    if (!canWriteCatalog) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Validate and sanitize inputs
    const sanitizedSong = typeof song === 'string' ? song.trim() : ''
    const sanitizedArtist = typeof artist === 'string' ? artist.trim() : ''
    
    if (!sanitizedSong || sanitizedSong === '' || sanitizedSong === '????') {
      return NextResponse.json({ error: 'Valid song name is required' }, { status: 400 })
    }
    
    if (!sanitizedArtist || sanitizedArtist === '' || sanitizedArtist === '????') {
      return NextResponse.json({ error: 'Valid artist name is required' }, { status: 400 })
    }

    // Auto-link artists if artistId/artistIds are not provided
    let finalArtistId = artistId
    let finalArtistIds = artistIds && artistIds.length > 0 ? artistIds : undefined
    
    if (!finalArtistIds || finalArtistIds.length === 0) {
      try {
        const users = getUsers()
        const parsedArtists = parseArtistsFromString(artist)
        const mappings = getArtistUserMappings()
        const manualMappings: Record<string, string> = {}
        mappings.forEach(m => {
          manualMappings[m.artistName.toLowerCase()] = m.userId
        })
        
        const matchedIds = matchArtistsToUsers(parsedArtists, users, manualMappings)
        
        if (matchedIds.length > 0) {
          finalArtistIds = matchedIds
          finalArtistId = matchedIds[0]
          console.log('[POST /api/catalog] Auto-linked artists:', matchedIds, 'for artist:', artist)
        }
      } catch (error) {
        console.error('[POST /api/catalog] Error auto-linking artists (non-critical):', error)
        // Continue - don't fail the creation
      }
    }

    const item = addCatalogItem({
      song: sanitizedSong,
      artist: sanitizedArtist,
      artistId: finalArtistId, // Backwards compatibility
      artistIds: finalArtistIds,
      releaseType: releaseType || 'single',
      releaseDate: releaseDate || undefined,
      totalStreams: totalStreams || 0,
      distributor: distributor || undefined,
      manuallyAdded: true,
      fileUrl: fileUrl || undefined,
      googleDriveUrl: googleDriveUrl || undefined,
      upc,
      isrc,
      songs: songs || undefined,
    })

    // Scope enforcement (manager/staff) + staff self-lock
    if (!actorIsAdmin) {
      const scopedArtistIds = actorIsManager ? (actor.linkedArtistIds || []) : (actor.staffManagedArtistIds || [])
      if (scopedArtistIds.length > 0 && !itemHasArtistInScope(item, scopedArtistIds)) {
        // Roll back creation (best-effort)
        try { deleteCatalogItem(item.id) } catch {}
        return NextResponse.json({ error: 'Forbidden: out of scope' }, { status: 403 })
      }
      if (actorIsStaff && itemIncludesActorAsArtist(item, actor.id)) {
        try { deleteCatalogItem(item.id) } catch {}
        return NextResponse.json({ error: 'Forbidden: staff cannot create catalog items tied to themselves' }, { status: 403 })
      }
    }

    // Log activity
    const users = getUsers()
    const user = userId ? users.find(u => u.id === userId) : null
    const actorName = userName || user?.name || 'System'
    
    logActivity({
      action: 'Song added to catalog',
      user: actorName,
      userId: userId,
      category: 'catalog',
      details: {
        song: sanitizedSong,
        artist: sanitizedArtist,
        songId: item.id,
        releaseType: releaseType || 'single',
        manuallyAdded: true,
      },
    })

    try {
      logChange({
        entity_type: 'catalog',
        entity_id: item.id,
        action: 'add',
        changed_by: userId,
        changed_by_name: actorName,
        details: { song: sanitizedSong, artist: sanitizedArtist },
      })
    } catch (e) {
      console.error('[catalog] Change log error:', e)
    }

    return NextResponse.json({ success: true, item })
  } catch (error: any) {
    console.error('Add catalog item error:', error)
    return NextResponse.json(
      { error: 'Failed to add catalog item', details: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, userId, userName, ...updates } = body

    // Determine actor (do not trust userRole from client - verify server-side)
    if (!userId) return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    const actor = getUsers().find(u => u.id === userId)
    if (!actor) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const actorIsAdmin = actor.role === 'admin'
    const actorIsManager = actor.role === 'manager'
    const actorIsProducer = actor.role === 'producer'
    const actorIsStaff = isStaffUser(actor)
    
    // Producers have read-only access
    if (actorIsProducer) {
      return NextResponse.json({ error: 'Forbidden: Producers have read-only access' }, { status: 403 })
    }
    
    const canWriteCatalog = actorIsAdmin || actorIsManager || (actorIsStaff && hasStaffPermission(actor, 'staff:catalog:write'))
    if (!canWriteCatalog) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!id) {
      return NextResponse.json({ error: 'Item ID required' }, { status: 400 })
    }
    
    // Validate and sanitize song/artist if being updated
    if (updates.song !== undefined) {
      const sanitizedSong = typeof updates.song === 'string' ? updates.song.trim() : ''
      if (!sanitizedSong || sanitizedSong === '' || sanitizedSong === '????') {
        return NextResponse.json({ error: 'Valid song name is required' }, { status: 400 })
      }
      updates.song = sanitizedSong
    }
    
    if (updates.artist !== undefined) {
      const sanitizedArtist = typeof updates.artist === 'string' ? updates.artist.trim() : ''
      if (!sanitizedArtist || sanitizedArtist === '' || sanitizedArtist === '????') {
        return NextResponse.json({ error: 'Valid artist name is required' }, { status: 400 })
      }
      updates.artist = sanitizedArtist
    }

    // Get the item before update to log changes
    let catalog
    let oldItem
    try {
      catalog = getCatalog()
      oldItem = catalog.find(item => item && item.id === id)
    } catch (error: any) {
      console.error('[PUT /api/catalog] Error fetching catalog:', error)
      return NextResponse.json(
        { error: 'Failed to fetch catalog', details: error.message },
        { status: 500 }
      )
    }

    if (!oldItem) {
      console.error('[PUT /api/catalog] Item not found:', id)
      console.error('[PUT /api/catalog] Available IDs (first 10):', catalog.slice(0, 10).map(item => item?.id))
      return NextResponse.json(
        { error: 'Item not found', itemId: id },
        { status: 404 }
      )
    }

    // Scope enforcement (manager/staff): can only modify items tied to allowed artists
    if (!actorIsAdmin) {
      const scopedArtistIds = actorIsManager ? (actor.linkedArtistIds || []) : (actor.staffManagedArtistIds || [])
      if (scopedArtistIds.length > 0 && !itemHasArtistInScope(oldItem, scopedArtistIds)) {
        return NextResponse.json({ error: 'Forbidden: out of scope' }, { status: 403 })
      }
      if (actorIsStaff && itemIncludesActorAsArtist(oldItem, actor.id)) {
        return NextResponse.json({ error: 'Forbidden: staff cannot modify their own catalog items' }, { status: 403 })
      }
    }

    console.log('[PUT /api/catalog] Updating item:', {
      id,
      song: oldItem.song,
      artist: oldItem.artist,
      updates: Object.keys(updates),
    })

    // Auto-link artists if artist name changes but artistId/artistIds are not provided
    if (updates.artist && (!updates.artistId && !updates.artistIds)) {
      try {
        const users = getUsers()
        const parsedArtists = parseArtistsFromString(updates.artist)
        const mappings = getArtistUserMappings()
        const manualMappings: Record<string, string> = {}
        mappings.forEach(m => {
          manualMappings[m.artistName.toLowerCase()] = m.userId
        })
        
        const matchedIds = matchArtistsToUsers(parsedArtists, users, manualMappings)
        
        if (matchedIds.length > 0) {
          // Preserve existing artistIds and add new matches
          const existingIds = oldItem.artistIds || (oldItem.artistId ? [oldItem.artistId] : [])
          const combinedIds = [...new Set([...existingIds, ...matchedIds])]
          updates.artistIds = combinedIds
          updates.artistId = combinedIds[0] // Backwards compatibility
          
          // Update artist name to use artistName (display name) instead of real name
          // e.g., "Od Sleep" instead of "Loyce Weaver"
          // BUT: Only include artist accounts, not managers (managers shouldn't appear in artist field)
          const artistUserIds = combinedIds.filter(id => {
            const user = users.find(u => u.id === id)
            return user && user.role === 'artist'
          })
          
          const displayNames = artistUserIds.map(id => {
            const user = users.find(u => u.id === id)
            return user?.artistName || user?.name || ''
          }).filter(Boolean)
          
          if (displayNames.length > 0) {
            updates.artist = displayNames.join(' & ')
            console.log('[PUT /api/catalog] Updated artist name to display names (artists only):', displayNames)
          }
          
          console.log('[PUT /api/catalog] Auto-linked artists:', matchedIds, 'for artist:', updates.artist)
        }
      } catch (error) {
        console.error('[PUT /api/catalog] Error auto-linking artists (non-critical):', error)
        // Continue - don't fail the update
      }
    }
    
    // If artistIds are provided but artist name should be updated to use display names
    // BUT: Only update if artist name is also being changed (don't auto-update just from artistIds)
    // This prevents managers' names from being added to artist fields when linking
    if (updates.artistIds && updates.artistIds.length > 0 && updates.artist) {
      try {
        const users = getUsers()
        // Filter out managers - only use artist accounts for display names
        const artistUserIds = updates.artistIds.filter((id: string) => {
          const user = users.find(u => u.id === id)
          return user && user.role === 'artist'
        })
        
        if (artistUserIds.length > 0) {
          const displayNames = artistUserIds.map((id: string) => {
            const user = users.find(u => u.id === id)
            // Use artistName (display name) like "Od Sleep" instead of real name "Loyce Weaver"
            return user?.artistName || user?.name || ''
          }).filter(Boolean)
          
          if (displayNames.length > 0 && (!updates.artist || updates.artist !== displayNames.join(' & '))) {
            updates.artist = displayNames.join(' & ')
            console.log('[PUT /api/catalog] Updated artist name to display names from artistIds (artists only):', displayNames)
          }
        }
      } catch (error) {
        console.error('[PUT /api/catalog] Error updating artist name from artistIds (non-critical):', error)
        // Continue - don't fail the update
      }
    }

    // Prevent staff from updating an item to include themselves (self-lock) and enforce scoped artistIds
    if (!actorIsAdmin) {
      const scopedArtistIds = actorIsManager ? (actor.linkedArtistIds || []) : (actor.staffManagedArtistIds || [])
      const resultingArtistIds: string[] | undefined =
        updates.artistIds !== undefined ? updates.artistIds : oldItem.artistIds

      if (actorIsStaff && Array.isArray(resultingArtistIds) && resultingArtistIds.includes(actor.id)) {
        return NextResponse.json({ error: 'Forbidden: staff cannot attach themselves to catalog items' }, { status: 403 })
      }
      if (scopedArtistIds.length > 0 && Array.isArray(resultingArtistIds)) {
        const outOfScope = resultingArtistIds.some(id => !scopedArtistIds.includes(id))
        if (outOfScope) {
          return NextResponse.json({ error: 'Forbidden: cannot set artistIds outside your scope' }, { status: 403 })
        }
      }
    }

    const success = updateCatalogItem(id, updates)

    if (!success) {
      console.error('[PUT /api/catalog] updateCatalogItem returned false for:', id)
      return NextResponse.json(
        { error: 'Failed to update catalog item', itemId: id, details: 'updateCatalogItem returned false - check server logs' },
        { status: 500 }
      )
    }

    try {
      const backupPath = backupToJson(oldItem, 'catalog_before_update', `${oldItem.song} by ${oldItem.artist}`)
      logChange({
        entity_type: 'catalog',
        entity_id: id,
        action: 'update',
        changed_by: userId,
        changed_by_name: userName || getUsers().find(u => u.id === userId)?.name || 'System',
        backup_path: backupPath,
        details: { song: oldItem.song, artist: oldItem.artist, updatedFields: Object.keys(updates) },
      })
    } catch (e) {
      console.error('[catalog] Change log error:', e)
    }

    // Log activity for all catalog updates
    const users = getUsers()
    const user = userId ? users.find(u => u.id === userId) : null
    const actorName = userName || user?.name || 'System'
    
    // Log stream updates
    if (oldItem && updates.totalStreams !== undefined && updates.totalStreams !== oldItem.totalStreams) {
      logActivity({
        action: 'Streams updated',
        user: actorName,
        userId: userId,
        category: 'catalog',
        details: {
          song: oldItem.song,
          artist: oldItem.artist,
          songId: id,
          oldStreams: oldItem.totalStreams,
          newStreams: updates.totalStreams,
        },
      })
    }
    
    // Log other catalog updates (artist, release date, etc.)
    const updateFields = Object.keys(updates).filter(key => key !== 'totalStreams')
    if (updateFields.length > 0) {
      const updateDetails: Record<string, any> = {
        song: oldItem.song,
        artist: oldItem.artist,
        songId: id,
      }
      
      updateFields.forEach(field => {
        updateDetails[`old${field.charAt(0).toUpperCase() + field.slice(1)}`] = oldItem[field as keyof typeof oldItem]
        updateDetails[`new${field.charAt(0).toUpperCase() + field.slice(1)}`] = updates[field]
      })
      
      logActivity({
        action: 'Catalog item updated',
        user: actorName,
        userId: userId,
        category: 'catalog',
        details: updateDetails,
      })
    }

    // Notify AI of significant stream updates (non-blocking - don't fail if this errors)
    if (oldItem && updates.totalStreams !== undefined) {
      try {
        await notifyStreamsUpdated({
          songName: oldItem.song,
          artistName: oldItem.artist,
          totalStreams: updates.totalStreams,
          oldStreams: oldItem.totalStreams,
        })
      } catch (error) {
        console.error('[PUT /api/catalog] Error notifying streams update (non-critical):', error)
        // Continue - don't fail the request
      }
    }

    // Get updated item to check for delay changes
    const updatedItem = getCatalog().find(item => item && item.id === id)
    
    // Check for delay status changes and notify artists
    if (oldItem && updatedItem) {
      const wasDelayed = oldItem.isDelayed || false
      const isNowDelayed = updatedItem.isDelayed || false
      const delayChanged = wasDelayed !== isNowDelayed
      
      // Get artist user IDs for notifications
      let artistUserIds: string[] = []
      try {
        const users = getUsers()
        const mappings = getArtistUserMappings()
        const manualMappings: Record<string, string> = {}
        mappings.forEach(m => {
          manualMappings[m.artistName.toLowerCase()] = m.userId
        })
        const parsedArtists = parseArtistsFromString(oldItem.artist)
        artistUserIds = matchArtistsToUsers(parsedArtists, users, manualMappings)
        
        // Fallback to artistIds if available
        if (artistUserIds.length === 0 && oldItem.artistIds && oldItem.artistIds.length > 0) {
          artistUserIds = oldItem.artistIds
        } else if (artistUserIds.length === 0 && oldItem.artistId) {
          artistUserIds = [oldItem.artistId]
        }
      } catch (error) {
        console.error('[PUT /api/catalog] Error getting artist user IDs:', error)
      }
      
      // Notify if delay was added
      if (delayChanged && isNowDelayed) {
        try {
          await notifySongDelayed({
            songName: oldItem.song,
            artistName: oldItem.artist,
            delayReason: updatedItem.delayReason,
            releaseDate: updatedItem.releaseDate || updatedItem.releaseDateRequested,
            artistUserIds,
          })
        } catch (error) {
          console.error('[PUT /api/catalog] Error notifying delay (non-critical):', error)
        }
      }
      
      // Notify if delay was removed
      if (delayChanged && !isNowDelayed && wasDelayed) {
        try {
          await notifySongDelayRemoved({
            songName: oldItem.song,
            artistName: oldItem.artist,
            releaseDate: updatedItem.releaseDate || updatedItem.releaseDateRequested,
            artistUserIds,
          })
        } catch (error) {
          console.error('[PUT /api/catalog] Error notifying delay removal (non-critical):', error)
        }
      }
      
      // Notify artists of other important updates (non-delay related)
      const importantChanges = Object.keys(updates).filter(key => 
        key !== 'totalStreams' && 
        key !== 'isDelayed' && 
        key !== 'delayReason' &&
        (key === 'releaseDate' || key === 'releaseApprovalStatus' || key === 'releaseDateRequested' || key === 'isUnreleased')
      )
      
      if (importantChanges.length > 0 && !delayChanged) {
        try {
          await notifySongUpdated({
            songName: oldItem.song,
            artistName: oldItem.artist,
            changes: importantChanges,
            releaseDate: updatedItem.releaseDate || updatedItem.releaseDateRequested,
            artistUserIds,
          })
        } catch (error) {
          console.error('[PUT /api/catalog] Error notifying song update (non-critical):', error)
        }
      }
    }

    // Notify AI of other catalog updates (non-blocking - don't fail if this errors)
    if (oldItem && Object.keys(updates).some(key => key !== 'totalStreams' && key !== 'isDelayed' && key !== 'delayReason' && key !== 'isUnreleased')) {
      try {
        await notifyCatalogUpdated({
          songName: oldItem.song,
          artistName: oldItem.artist,
          changes: Object.keys(updates).filter(k => k !== 'totalStreams' && k !== 'isDelayed' && k !== 'delayReason' && k !== 'isUnreleased').join(', '),
        })
      } catch (error) {
        console.error('[PUT /api/catalog] Error notifying catalog update (non-critical):', error)
        // Continue - don't fail the request
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Update catalog item error:', error)
    return NextResponse.json(
      { error: 'Failed to update catalog item', details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const userId = searchParams.get('userId')
    const userName = searchParams.get('userName')
    const action = searchParams.get('action') || 'archive' // 'archive' or 'delete'

    // Determine actor (do not trust userRole from client - verify server-side)
    if (!userId) return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    const actor = getUsers().find(u => u.id === userId)
    if (!actor) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const actorIsAdmin = actor.role === 'admin'
    const actorIsManager = actor.role === 'manager'
    const actorIsProducer = actor.role === 'producer'
    const actorIsStaff = isStaffUser(actor)
    
    // Producers have read-only access
    if (actorIsProducer) {
      return NextResponse.json({ error: 'Forbidden: Producers have read-only access' }, { status: 403 })
    }
    
    const canWriteCatalog = actorIsAdmin || actorIsManager || (actorIsStaff && hasStaffPermission(actor, 'staff:catalog:write'))
    if (!canWriteCatalog) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (!id) {
      return NextResponse.json({ error: 'Item ID required' }, { status: 400 })
    }

    const catalog = getCatalog()
    const item = catalog.find(i => i.id === id)

    // Scope enforcement (manager/staff) + staff self-lock
    if (item && !actorIsAdmin) {
      const scopedArtistIds = actorIsManager ? (actor.linkedArtistIds || []) : (actor.staffManagedArtistIds || [])
      if (scopedArtistIds.length > 0 && !itemHasArtistInScope(item, scopedArtistIds)) {
        return NextResponse.json({ error: 'Forbidden: out of scope' }, { status: 403 })
      }
      if (actorIsStaff && itemIncludesActorAsArtist(item, actor.id)) {
        return NextResponse.json({ error: 'Forbidden: staff cannot modify their own catalog items' }, { status: 403 })
      }
    }

    // Only admins can permanently delete
    if (action === 'delete' && !actorIsAdmin) {
      return NextResponse.json({ error: 'Forbidden: Only admins can permanently delete items' }, { status: 403 })
    }

    let success: boolean
    let actionName: string

    if (action === 'delete') {
      // Permanently delete
      success = deleteCatalogItem(id)
      actionName = 'Song deleted'
    } else {
      // Archive
      success = archiveCatalogItem(id)
      actionName = 'Song archived'
    }

    if (!success) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    if (item) {
      try {
        const backupPath = backupToJson(item, 'catalog_deleted', `${item.song} by ${item.artist}`)
        logChange({
          entity_type: 'catalog',
          entity_id: id,
          action: action === 'delete' ? 'delete' : 'archive',
          changed_by: userId,
          changed_by_name: userName || getUsers().find(u => u.id === userId)?.name || 'System',
          backup_path: backupPath,
          details: { song: item.song, artist: item.artist },
        })
      } catch (e) {
        console.error('[catalog] Change log error:', e)
      }
    }

    // Log activity
    if (item) {
      const users = getUsers()
      const user = userId ? users.find(u => u.id === userId) : null
      const actorName = userName || user?.name || 'System'
      
      logActivity({
        action: actionName,
        user: actorName,
        userId: userId || undefined,
        category: 'catalog',
        details: {
          song: item.song,
          artist: item.artist,
          songId: item.id,
          permanent: action === 'delete',
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete catalog item error:', error)
    return NextResponse.json(
      { error: 'Failed to process catalog item', details: error.message },
      { status: 500 }
    )
  }
}

