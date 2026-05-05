import { NextRequest, NextResponse } from 'next/server'
import { getCatalog, updateCatalogItem, addCatalogItem, deleteCatalogItem, getUsers, updateUser, addTask, updateTask, deleteTask, addMessage, updateMessage, addSongVaultFile, updateSongVaultFile, deleteSongVaultFile, addContract, updateContract, deleteContract } from '@/lib/storage'
import { handleAddCalendarEvent } from '@/lib/aiCalendarAction'
import {
  handleFindArtist,
  handleGetArtistSchedule,
  handleAddContentCalendar,
  handleAddLabelInstagramPost,
  handleScheduleBulk,
} from '@/lib/aiScheduleActions'
import { logActivity } from '@/lib/activityLog'
import { notifyReleaseApproved, notifyReleaseDenied } from '@/lib/aiNotifications'
import fs from 'fs'
import path from 'path'

// API key for AI authentication
const AI_API_KEY = (process.env as any).AI_API_KEY || 'lfr-ai-secret-key-change-in-production'

// Middleware to verify AI API key
function verifyAIKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-ai-api-key') || request.headers.get('authorization')?.replace('Bearer ', '')
  return apiKey === AI_API_KEY
}

type AiActionHistoryEntry = {
  id: string
  at: string
  action: string
  summary: string
}

function makeAiEntry(action: string, summary: string): AiActionHistoryEntry {
  const safeSummary = (summary || '').toString().trim().slice(0, 400)
  return {
    id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    action,
    summary: safeSummary || action,
  }
}

function appendAiHistory(songId: string, entry: AiActionHistoryEntry) {
  try {
    const catalog = getCatalog()
    const song = catalog.find(item => item.id === songId)
    if (!song) return
    const prev = Array.isArray((song as any).aiActionHistory) ? (song as any).aiActionHistory : []
    const next = [...prev, entry].slice(-25)
    updateCatalogItem(songId, { aiActionHistory: next } as any)
  } catch (e) {
    // Non-critical: never fail the AI action just because history couldn't be recorded.
    console.warn('[ai-actions] Failed to append AI history (non-critical):', e)
  }
}

// Helper function to resolve songId from songName/artistName
function resolveSongId(params: any): { songId: string | null; song: any | null; error: string | null } {
  const { songId, songName, artistName } = params
  
  // If songId is provided, use it directly
  if (songId) {
    const catalog = getCatalog()
    const song = catalog.find(item => item.id === songId)
    if (!song) {
      return { songId: null, song: null, error: `Song not found with ID: ${songId}` }
    }
    return { songId, song, error: null }
  }
  
  // If songName/artistName provided, search for the song
  if (!songName && !artistName) {
    return { songId: null, song: null, error: 'Either songId, or songName (and optionally artistName) is required' }
  }
  
  const catalog = getCatalog()
  const normalize = (str: string) => str.toLowerCase().trim()
  
  let matches = catalog
  
  if (songName) {
    matches = matches.filter(item => 
      normalize(item.song).includes(normalize(songName))
    )
  }
  
  if (artistName) {
    matches = matches.filter(item => 
      normalize(item.artist).includes(normalize(artistName))
    )
  }
  
  if (matches.length === 0) {
    return { 
      songId: null, 
      song: null, 
      error: `No songs found matching "${songName || ''}"${artistName ? ` by "${artistName}"` : ''}` 
    }
  }
  
  // Prefer exact matches
  const exactMatches = matches.filter(item => 
    (!songName || normalize(item.song) === normalize(songName)) &&
    (!artistName || normalize(item.artist).includes(normalize(artistName)))
  )
  
  const result = exactMatches.length > 0 ? exactMatches[0] : matches[0]
  
  if (matches.length > 1 && exactMatches.length === 0) {
    // Multiple matches found - return first but warn
    return { 
      songId: result.id, 
      song: result, 
      error: `Multiple songs found. Using "${result.song}" by ${result.artist}. Found ${matches.length} matches.` 
    }
  }
  
  return { songId: result.id, song: result, error: null }
}

function summarizeCatalogUpdates(updates: any): string {
  const keys = Object.keys(updates || {})
  if (keys.length == 0) return 'No changes'

  const parts: string[] = []
  const add = (label: string, value?: any) => {
    if (value === undefined) return
    if (value === null) return parts.push(`${label} → (cleared)`)
    const str = typeof value === 'string' ? value : JSON.stringify(value)
    parts.push(`${label} → ${str.length > 120 ? str.slice(0, 120) + '…' : str}`)
  }

  add('song', updates.song)
  add('artist', updates.artist)
  add('releaseType', updates.releaseType)
  add('releaseDate', updates.releaseDate)
  add('releaseApprovalStatus', updates.releaseApprovalStatus)
  add('albumCover', updates.albumCover)
  add('upc', updates.upc)
  add('isrc', updates.isrc)
  add('distributor', updates.distributor)
  add('isDelayed', updates.isDelayed)
  add('delayReason', updates.delayReason)
  add('isUnreleased', updates.isUnreleased)

  const known = new Set([
    'song',
    'artist',
    'releaseType',
    'releaseDate',
    'releaseApprovalStatus',
    'albumCover',
    'upc',
    'isrc',
    'distributor',
    'isDelayed',
    'delayReason',
    'isUnreleased',
  ])
  const remaining = keys.filter((k: string) => !known.has(k))

  const head = `Updated ${keys.join(', ')}`
  const detail = parts.length > 0 ? ` (${parts.join('; ')})` : ''
  const tail = remaining.length > 0 ? `; other: ${remaining.join(', ')}` : ''
  return (`${head}${detail}${tail}`).slice(0, 400)
}

export async function POST(request: NextRequest) {
  try {
    // Verify API key
    if (!verifyAIKey(request)) {
      return NextResponse.json({ error: 'Unauthorized - Invalid API key' }, { status: 401 })
    }

    const body = await request.json()
    const { action, ...params } = body

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 })
    }

    switch (action) {
      case 'approve_release':
        return await handleApproveRelease(params)
      
      case 'deny_release':
        return await handleDenyRelease(params)
      
      case 'update_catalog':
        return await handleUpdateCatalog(params)
      
      case 'add_catalog_item':
        return await handleAddCatalogItem(params)
      
      case 'delete_catalog_item':
        return await handleDeleteCatalogItem(params)
      
      case 'create_task':
        return await handleCreateTask(params)
      
      case 'add_calendar_event':
        return await handleAddCalendarEvent(params)
      
      case 'update_task':
        return await handleUpdateTask(params)
      
      case 'complete_task':
        return await handleCompleteTask(params)
      
      case 'update_user':
        return await handleUpdateUser(params)
      
      case 'create_release':
        return await handleCreateRelease(params)
      
      case 'check_csv':
        return await handleCheckCSV(params)
      
      case 'update_checklist':
        return await handleUpdateChecklist(params)
      
      case 'update_release_schedule':
        return await handleUpdateReleaseSchedule(params)
      
      case 'add_message':
        return await handleAddMessage(params)
      
      case 'update_social_media':
        return await handleUpdateSocialMedia(params)
      
      case 'update_song_vault':
        return await handleUpdateSongVault(params)
      
      case 'update_contract':
        return await handleUpdateContract(params)
      
      case 'create_album_ep':
        return await handleCreateAlbumEP(params)
      
      case 'add_songs_to_album':
        return await handleAddSongsToAlbum(params)
      
      case 'find_song':
        return await handleFindSong(params)
      
      case 'find_artist':
        return await handleFindArtist(params)
      
      case 'get_artist_schedule':
        return await handleGetArtistSchedule(params)
      
      case 'add_content_calendar':
        return await handleAddContentCalendar(params)
      
      case 'add_label_instagram_post':
        return await handleAddLabelInstagramPost(params)
      
      case 'schedule_bulk':
        return await handleScheduleBulk(params)
      
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error: any) {
    console.error('AI action error:', error)
    return NextResponse.json(
      { error: 'Failed to process action', details: error.message },
      { status: 500 }
    )
  }
}

// Approve a release
async function handleApproveRelease(params: any) {
  const { approvedDate, notes } = params

  // Resolve songId from songName/artistName or use provided songId
  const resolved = resolveSongId(params)
  if (resolved.error || !resolved.songId || !resolved.song) {
    return NextResponse.json({ error: resolved.error || 'Song not found' }, { status: 400 })
  }
  
  const songId = resolved.songId
  const song = resolved.song

  const finalDate = approvedDate || song.releaseDateRequested
  if (!finalDate) {
    return NextResponse.json({ error: 'Release date is required' }, { status: 400 })
  }

  // Validate date is at least 3 days out
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const releaseDate = new Date(finalDate)
  releaseDate.setHours(0, 0, 0, 0)
  const daysDiff = Math.ceil((releaseDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (daysDiff < 3) {
    return NextResponse.json(
      { error: 'Release date must be at least 3 days in advance', daysUntil: daysDiff },
      { status: 400 }
    )
  }

  const updates: any = {
    releaseApprovalStatus: 'approved',
    releaseDate: finalDate,
    releaseDateRequested: undefined,
    releaseApprovalNotes: notes || undefined,
  }

  const success = updateCatalogItem(songId, updates)

  if (!success) {
    return NextResponse.json({ error: 'Failed to update catalog' }, { status: 500 })
  }

  appendAiHistory(
    songId,
    makeAiEntry(
      'approve_release',
      `Approved release; releaseDate → ${finalDate}${notes ? `; notes: ${String(notes).slice(0, 160)}` : ''}`
    )
  )

  // Log activity
  logActivity({
    action: 'Release Approved by AI',
    user: 'AI System',
    category: 'catalog',
    details: {
      song: song.song,
      artist: song.artist,
      songId,
      approvedDate: finalDate,
      notes,
    },
  })

  // Notify AI server (will text admins)
  await notifyReleaseApproved({
    songName: song.song,
    artistName: song.artist,
    releaseDate: finalDate,
    approvedBy: 'AI System',
  })

  return NextResponse.json({
    success: true,
    message: `Release approved for "${song.song}" by ${song.artist}`,
    releaseDate: finalDate,
  })
}

// Deny a release
async function handleDenyRelease(params: any) {
  const { reason } = params

  if (!reason || !reason.trim()) {
    return NextResponse.json({ error: 'Reason is required for denial' }, { status: 400 })
  }

  // Resolve songId from songName/artistName or use provided songId
  const resolved = resolveSongId(params)
  if (resolved.error || !resolved.songId || !resolved.song) {
    return NextResponse.json({ error: resolved.error || 'Song not found' }, { status: 400 })
  }
  
  const songId = resolved.songId
  const song = resolved.song

  const updates: any = {
    releaseApprovalStatus: 'denied',
    releaseApprovalNotes: reason,
    releaseDate: undefined,
  }

  const success = updateCatalogItem(songId, updates)

  if (!success) {
    return NextResponse.json({ error: 'Failed to update catalog' }, { status: 500 })
  }

  appendAiHistory(
    songId,
    makeAiEntry('deny_release', `Denied release; reason: ${String(reason).trim().slice(0, 200)}`)
  )

  // Log activity
  logActivity({
    action: 'Release Denied by AI',
    user: 'AI System',
    category: 'catalog',
    details: {
      song: song.song,
      artist: song.artist,
      songId,
      reason,
    },
  })

  // Notify AI server (will text admins)
  await notifyReleaseDenied({
    songName: song.song,
    artistName: song.artist,
    reason,
    deniedBy: 'AI System',
  })

  return NextResponse.json({
    success: true,
    message: `Release denied for "${song.song}" by ${song.artist}`,
    reason,
  })
}

// Update catalog item
async function handleUpdateCatalog(params: any) {
  const { updates } = params

  if (!updates || typeof updates !== 'object') {
    return NextResponse.json({ error: 'Updates object is required' }, { status: 400 })
  }

  // Resolve songId from songName/artistName or use provided songId
  const resolved = resolveSongId(params)
  if (resolved.error || !resolved.songId || !resolved.song) {
    return NextResponse.json({ error: resolved.error || 'Song not found' }, { status: 400 })
  }
  
  const songId = resolved.songId
  const song = resolved.song

  const success = updateCatalogItem(songId, updates)

  if (!success) {
    return NextResponse.json({ error: 'Failed to update catalog' }, { status: 500 })
  }

  appendAiHistory(songId, makeAiEntry('update_catalog', summarizeCatalogUpdates(updates)))

  // Log activity
  logActivity({
    action: 'Catalog Updated by AI',
    user: 'AI System',
    category: 'catalog',
    details: {
      song: song.song,
      artist: song.artist,
      songId,
      updates,
    },
  })

  return NextResponse.json({
    success: true,
    message: `Catalog item updated: "${song.song}"`,
  })
}

// Add catalog item
async function handleAddCatalogItem(params: any) {
  const { song, artist, artistId, artistIds, releaseType, releaseDate, totalStreams, distributor, upc, isrc, albumCover, fileUrl, googleDriveUrl, promoNotes } = params

  if (!song || !artist) {
    return NextResponse.json({ error: 'Song and artist are required' }, { status: 400 })
  }

  const item = addCatalogItem({
    song,
    artist,
    artistId: artistId || undefined,
    artistIds: artistIds || undefined,
    releaseType: releaseType || 'single',
    releaseDate: releaseDate || undefined,
    totalStreams: totalStreams || 0,
    distributor: distributor || undefined,
    manuallyAdded: true,
    upc: upc || undefined,
    isrc: isrc || undefined,
    albumCover: albumCover || undefined,
    fileUrl: fileUrl || undefined,
    googleDriveUrl: googleDriveUrl || undefined,
    promoNotes: promoNotes || undefined,
  })

  appendAiHistory(
    item.id,
    makeAiEntry(
      'add_catalog_item',
      `Created catalog item; releaseType → ${releaseType || 'single'}${releaseDate ? `; releaseDate → ${releaseDate}` : ''}${albumCover ? '; albumCover set' : ''}`
    )
  )

  // Log activity
  logActivity({
    action: 'Catalog Item Added by AI',
    user: 'AI System',
    category: 'catalog',
    details: {
      song,
      artist,
      songId: item.id,
      releaseType: releaseType || 'single',
      albumCover: albumCover || undefined,
      releaseDate: releaseDate || undefined,
    },
  })

  return NextResponse.json({
    success: true,
    message: `Added "${song}" by ${artist} to catalog`,
    item,
  })
}

// Delete catalog item
async function handleDeleteCatalogItem(params: any) {
  // Resolve songId from songName/artistName or use provided songId
  const resolved = resolveSongId(params)
  if (resolved.error || !resolved.songId || !resolved.song) {
    return NextResponse.json({ error: resolved.error || 'Song not found' }, { status: 400 })
  }
  
  const songId = resolved.songId
  const song = resolved.song

  const success = deleteCatalogItem(songId)

  if (!success) {
    return NextResponse.json({ error: 'Failed to delete catalog item' }, { status: 500 })
  }

  // Log activity
  logActivity({
    action: 'Catalog Item Deleted by AI',
    user: 'AI System',
    category: 'catalog',
    details: {
      song: song.song,
      artist: song.artist,
      songId,
    },
  })

  return NextResponse.json({
    success: true,
    message: `Deleted "${song.song}" by ${song.artist} from catalog`,
  })
}

// Create task
async function handleCreateTask(params: any) {
  const { title, description, assignedTo, assignedToName, dueDate, category, songId, assignedBy, assignedByName } = params

  if (!title || !assignedTo || !assignedToName) {
    return NextResponse.json({ error: 'Title, assignedTo, and assignedToName are required' }, { status: 400 })
  }

  const users = getUsers()
  const assignedByUser = assignedBy ? users.find(u => u.id === assignedBy) : null
  const finalAssignedBy = assignedBy || 'system'
  const finalAssignedByName = assignedByName || assignedByUser?.name || 'AI System'

  // Calculate days until due date
  const dueDateObj = dueDate ? new Date(dueDate) : new Date()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  dueDateObj.setHours(0, 0, 0, 0)
  const daysUntil = Math.ceil((dueDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  const daysText = daysUntil === 0 ? 'today' : daysUntil === 1 ? 'in 1 day' : daysUntil < 0 ? `${Math.abs(daysUntil)} day${Math.abs(daysUntil) !== 1 ? 's' : ''} ago` : `in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`

  // Get song info if songId is provided
  let songInfo = ''
  if (songId) {
    const catalog = getCatalog()
    const song = catalog.find(s => s.id === songId)
    if (song) {
      songInfo = ` for "${song.song}" by ${song.artist}`
    }
  }

  const task = addTask({
    title,
    description: description || '',
    assignedTo,
    assignedToName,
    assignedBy: finalAssignedBy,
    assignedByName: finalAssignedByName,
    dueDate: dueDate || new Date().toISOString(),
    completed: false,
    category: category || 'general',
    songId: songId || undefined,
  })

  // Create detailed notification message
  const assignedToUser = users.find(u => u.id === assignedTo)
  if (assignedToUser) {
    const { addMessage } = await import('@/lib/storage')
    const { formatLocalDate } = await import('@/lib/utils')
    const notificationSubject = `Task Assigned: ${title}${songInfo}`
    const notificationMessage = `${title}${songInfo ? `\n\nRelated to: ${songInfo.replace(' for ', '')}` : ''}${description ? `\n\n${description}` : ''}\n\nAssigned by: ${finalAssignedByName}\nDue: ${dueDate ? formatLocalDate(dueDate) : 'No due date'} (${daysText})`

    addMessage({
      from: finalAssignedBy,
      fromName: finalAssignedByName,
      to: assignedTo,
      toName: assignedToUser.name,
      subject: notificationSubject,
      message: notificationMessage,
      songId: songId || undefined,
    })
  }

  // Log activity
  logActivity({
    action: 'Task Created by AI',
    user: 'AI System',
    category: 'task',
    details: {
      taskId: task.id,
      title,
      assignedTo,
      assignedBy: finalAssignedBy,
      dueDate: dueDate || new Date().toISOString(),
    },
  })

  return NextResponse.json({
    success: true,
    message: `Task created: "${title}"`,
    task,
  })
}

// Update task
async function handleUpdateTask(params: any) {
  const { taskId, updates } = params

  if (!taskId) {
    return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
  }

  if (!updates || typeof updates !== 'object') {
    return NextResponse.json({ error: 'Updates object is required' }, { status: 400 })
  }

  const success = updateTask(taskId, updates)

  if (!success) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  // Log activity
  logActivity({
    action: 'Task Updated by AI',
    user: 'AI System',
    category: 'task',
    details: {
      taskId,
      updates,
    },
  })

  return NextResponse.json({
    success: true,
    message: 'Task updated',
  })
}

// Complete task
async function handleCompleteTask(params: any) {
  const { taskId } = params

  if (!taskId) {
    return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
  }

  const success = updateTask(taskId, { completed: true })

  if (!success) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  // Log activity
  logActivity({
    action: 'Task Completed by AI',
    user: 'AI System',
    category: 'task',
    details: {
      taskId,
    },
  })

  return NextResponse.json({
    success: true,
    message: 'Task marked as completed',
  })
}

// Update user
async function handleUpdateUser(params: any) {
  const { userId, updates } = params

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
  }

  if (!updates || typeof updates !== 'object') {
    return NextResponse.json({ error: 'Updates object is required' }, { status: 400 })
  }

  const users = getUsers()
  const user = users.find(u => u.id === userId)

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const success = updateUser(userId, updates)

  if (!success) {
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }

  // Log activity
  logActivity({
    action: 'User Updated by AI',
    user: 'AI System',
    category: 'user',
    details: {
      userId,
      updates,
    },
  })

  return NextResponse.json({
    success: true,
    message: `User updated: ${user.name}`,
  })
}

// Create a new release
async function handleCreateRelease(params: any) {
  const { song, artist, artistId, artistIds, releaseType, releaseDate, distributor, upc, isrc, albumCover, fileUrl, googleDriveUrl, notes } = params

  if (!song || !artist) {
    return NextResponse.json({ error: 'Song and artist are required' }, { status: 400 })
  }

  // Validate release date is at least 3 days out if provided
  if (releaseDate) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const releaseDateObj = new Date(releaseDate)
    releaseDateObj.setHours(0, 0, 0, 0)
    const daysDiff = Math.ceil((releaseDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysDiff < 3) {
      return NextResponse.json(
        { error: 'Release date must be at least 3 days in advance', daysUntil: daysDiff },
        { status: 400 }
      )
    }
  }

  // Check for duplicate songs
  const catalog = getCatalog()
  const duplicate = catalog.find(item => 
    item.song.toLowerCase().trim() === song.toLowerCase().trim() &&
    item.artist.toLowerCase().trim() === artist.toLowerCase().trim()
  )

  if (duplicate) {
    return NextResponse.json({
      error: 'Duplicate release',
      message: `A song with the same title "${song}" by ${artist} already exists in the catalog.`,
      existingSongId: duplicate.id,
    }, { status: 400 })
  }

  // Find artist user IDs if artistIds not provided
  let finalArtistIds = artistIds
  if (!finalArtistIds && artistId) {
    finalArtistIds = [artistId]
  } else if (!finalArtistIds) {
    const users = getUsers()
    const artistUser = users.find(u => 
      u.artistName?.toLowerCase().trim() === artist.toLowerCase().trim() ||
      u.name?.toLowerCase().trim() === artist.toLowerCase().trim()
    )
    if (artistUser) {
      finalArtistIds = [artistUser.id]
    }
  }

  const item = addCatalogItem({
    song,
    artist,
    artistId: finalArtistIds && finalArtistIds.length > 0 ? finalArtistIds[0] : undefined,
    artistIds: finalArtistIds,
    releaseType: releaseType || 'single',
    releaseDate: releaseDate ? (releaseDate + (releaseDate.includes('T') ? '' : 'T00:00:00.000Z')) : undefined,
    releaseApprovalStatus: releaseDate ? 'approved' : 'pending',
    releaseApprovalNotes: notes || undefined,
    totalStreams: 0,
    distributor: distributor || undefined,
    manuallyAdded: true,
    fileUrl: fileUrl || undefined,
    googleDriveUrl: googleDriveUrl || undefined,
    upc: upc || undefined,
    isrc: isrc || undefined,
    albumCover: albumCover || undefined,
  })

  appendAiHistory(
    item.id,
    makeAiEntry(
      'create_release',
      `Created release; releaseType → ${releaseType || 'single'}${releaseDate ? `; releaseDate → ${releaseDate}` : ''}${albumCover ? '; albumCover set' : ''}${notes ? `; notes: ${String(notes).slice(0, 140)}` : ''}`
    )
  )

  // Log activity
  logActivity({
    action: 'Release Created by AI',
    user: 'AI System',
    category: 'catalog',
    details: {
      song,
      artist,
      songId: item.id,
      releaseType: releaseType || 'single',
      releaseDate,
      distributor,
    },
  })

  return NextResponse.json({
    success: true,
    message: `Release created: "${song}" by ${artist}`,
    item,
  })
}

// Check CSV data
async function handleCheckCSV(params: any) {
  const { getUploads } = await import('@/lib/storage')
  const uploads = getUploads()
  
  // Get most recent upload or specific upload ID
  const uploadId = params.uploadId
  const upload = uploadId 
    ? uploads.find(u => u.id === uploadId)
    : uploads.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0]
  
  if (!upload) {
    return NextResponse.json({ error: 'No CSV data found' }, { status: 404 })
  }

  // Return summary of CSV data
  const summary = {
    uploadId: upload.id,
    fileName: upload.fileName,
    uploadedAt: upload.uploadedAt,
    rowCount: upload.rowCount,
    artistsFound: upload.artistsFound || [],
    artistCount: upload.artistsFound?.length || 0,
    sampleData: upload.data?.slice(0, 10) || [], // First 10 rows as sample
    groupedByArtist: Object.keys(upload.groupedByArtist || {}).reduce((acc: any, artist: string) => {
      acc[artist] = {
        songCount: (upload.groupedByArtist?.[artist] || []).length,
        sampleSongs: (upload.groupedByArtist?.[artist] || []).slice(0, 5).map((row: any) => ({
          song: row._parsedSong || row.song || row.Song || 'Unknown',
          artist: row._parsedArtist || artist,
        })),
      }
      return acc
    }, {}),
  }

  return NextResponse.json({
    success: true,
    csv: summary,
  })
}

// Update checklist item
async function handleUpdateChecklist(params: any) {
  const { itemId, updates } = params

  if (!itemId) {
    return NextResponse.json({ error: 'Item ID is required' }, { status: 400 })
  }

  if (!updates || typeof updates !== 'object') {
    return NextResponse.json({ error: 'Updates object is required' }, { status: 400 })
  }

  // Resolve songId from songName/artistName or use provided songId
  const resolved = resolveSongId(params)
  if (resolved.error || !resolved.songId || !resolved.song) {
    return NextResponse.json({ error: resolved.error || 'Song not found' }, { status: 400 })
  }
  
  const songId = resolved.songId
  const song = resolved.song

  const { getChecklistPath } = await import('@/lib/backup')
  const { getDataPath } = await import('@/lib/uploadConfig')
  const slugPath = getChecklistPath(songId, song.song, song.artist)
  const legacyPath = path.join(getDataPath(), `checklist_${songId}.json`)
  const checklistFile = fs.existsSync(slugPath) ? slugPath : legacyPath

  if (!fs.existsSync(checklistFile)) {
    return NextResponse.json({ error: 'Checklist not found' }, { status: 404 })
  }

  const items = JSON.parse(fs.readFileSync(checklistFile, 'utf-8'))
  const itemIndex = items.findIndex((item: any) => item.id === itemId)

  if (itemIndex === -1) {
    return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 })
  }

  // Update item
  items[itemIndex] = {
    ...items[itemIndex],
    ...updates,
    updatedAt: new Date().toISOString(),
  }

  // Handle completion status
  if (updates.completed && !items[itemIndex].completedAt) {
    items[itemIndex].completedAt = new Date().toISOString()
    items[itemIndex].completedBy = updates.completedBy || 'AI System'
  }

  if (updates.completed === false) {
    items[itemIndex].completedAt = undefined
    items[itemIndex].completedBy = undefined
  }

  fs.writeFileSync(checklistFile, JSON.stringify(items, null, 2))

  // Log activity
  const catalogForLog = getCatalog()
  const songForLog = catalogForLog.find(item => item.id === songId)
  
  logActivity({
    action: 'Checklist Updated by AI',
    user: 'AI System',
    category: 'catalog',
    details: {
      song: songForLog?.song || 'Unknown',
      artist: songForLog?.artist || 'Unknown',
      songId,
      itemId,
      updates,
    },
  })

  return NextResponse.json({
    success: true,
    message: 'Checklist item updated',
    item: items[itemIndex],
  })
}

// Update release schedule
async function handleUpdateReleaseSchedule(params: any) {
  const { releaseDate, releaseApprovalStatus, notes } = params

  // Resolve songId from songName/artistName or use provided songId
  const resolved = resolveSongId(params)
  if (resolved.error || !resolved.songId || !resolved.song) {
    return NextResponse.json({ error: resolved.error || 'Song not found' }, { status: 400 })
  }
  
  const songId = resolved.songId
  const song = resolved.song

  const updates: any = {}

  if (releaseDate !== undefined) {
    // Validate date is at least 3 days out if it's a future date
    if (releaseDate) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const releaseDateObj = new Date(releaseDate)
      releaseDateObj.setHours(0, 0, 0, 0)
      const daysDiff = Math.ceil((releaseDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysDiff < 3 && daysDiff >= 0) {
        return NextResponse.json(
          { error: 'Release date must be at least 3 days in advance', daysUntil: daysDiff },
          { status: 400 }
        )
      }
    }
    updates.releaseDate = releaseDate || undefined
  }

  if (releaseApprovalStatus !== undefined) {
    updates.releaseApprovalStatus = releaseApprovalStatus
  }

  if (notes !== undefined) {
    updates.releaseApprovalNotes = notes || undefined
  }

  const success = updateCatalogItem(songId, updates)

  if (!success) {
    return NextResponse.json({ error: 'Failed to update release schedule' }, { status: 500 })
  }

  // Log activity
  logActivity({
    action: 'Release Schedule Updated by AI',
    user: 'AI System',
    category: 'catalog',
    details: {
      song: song.song,
      artist: song.artist,
      songId,
      releaseDate,
      releaseApprovalStatus,
      notes,
    },
  })

  // Notify if approved/denied
  if (releaseApprovalStatus === 'approved') {
    await notifyReleaseApproved({
      songName: song.song,
      artistName: song.artist,
      releaseDate: releaseDate || song.releaseDate,
      approvedBy: 'AI System',
    })
  } else if (releaseApprovalStatus === 'denied') {
    await notifyReleaseDenied({
      songName: song.song,
      artistName: song.artist,
      reason: notes,
      deniedBy: 'AI System',
    })
  }

  return NextResponse.json({
    success: true,
    message: `Release schedule updated for "${song.song}"`,
  })
}

// Add message/notification
async function handleAddMessage(params: any) {
  const { from, fromName, to, toName, subject, message, songId } = params

  if (!to || !subject || !message) {
    return NextResponse.json({ error: 'To, subject, and message are required' }, { status: 400 })
  }

  const users = getUsers()
  const toUser = users.find(u => u.id === to)
  if (!toUser) {
    return NextResponse.json({ error: 'Recipient user not found' }, { status: 404 })
  }

  const newMessage = addMessage({
    from: from || 'system',
    fromName: fromName || 'AI System',
    to,
    toName: toName || toUser.name,
    subject,
    message,
    songId: songId || undefined,
  })

  // Log activity
  logActivity({
    action: 'Message Created by AI',
    user: 'AI System',
    category: 'system',
    details: {
      messageId: newMessage.id,
      to: toUser.name,
      subject,
    },
  })

  return NextResponse.json({
    success: true,
    message: `Message sent to ${toUser.name}`,
    messageData: newMessage,
  })
}

// Update social media data
async function handleUpdateSocialMedia(params: any) {
  const { artistId, updates } = params

  if (!artistId) {
    return NextResponse.json({ error: 'Artist ID is required' }, { status: 400 })
  }

  if (!updates || typeof updates !== 'object') {
    return NextResponse.json({ error: 'Updates object is required' }, { status: 400 })
  }

  // TODO: Implement social media data storage functions
  // These functions (addSocialMediaData, updateSocialMediaData) don't exist in storage.ts yet
  // For now, just log the activity
  
  logActivity({
    action: 'Social Media Data Updated by AI',
    user: 'AI System',
    category: 'system',
    details: {
      artistId,
      updates,
      note: 'Social media data storage functions not yet implemented',
    },
  })

  return NextResponse.json({
    success: true,
    message: 'Social media data update logged (storage functions not yet implemented)',
    data: { artistId, updates },
  })
}

// Update song vault file
async function handleUpdateSongVault(params: any) {
  const { fileId, updates } = params

  if (!fileId) {
    return NextResponse.json({ error: 'File ID is required' }, { status: 400 })
  }

  if (!updates || typeof updates !== 'object') {
    return NextResponse.json({ error: 'Updates object is required' }, { status: 400 })
  }

  const success = updateSongVaultFile(fileId, updates)

  if (!success) {
    return NextResponse.json({ error: 'Song vault file not found' }, { status: 404 })
  }

  // Log activity
  logActivity({
    action: 'Song Vault File Updated by AI',
    user: 'AI System',
    category: 'vault',
    details: {
      fileId,
      updates,
    },
  })

  return NextResponse.json({
    success: true,
    message: 'Song vault file updated',
  })
}

// Update contract
async function handleUpdateContract(params: any) {
  const { contractId, updates } = params

  if (!contractId) {
    return NextResponse.json({ error: 'Contract ID is required' }, { status: 400 })
  }

  if (!updates || typeof updates !== 'object') {
    return NextResponse.json({ error: 'Updates object is required' }, { status: 400 })
  }

  const updatedContract = updateContract(contractId, updates)

  if (!updatedContract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
  }

  // Log activity
  logActivity({
    action: 'Contract Updated by AI',
    user: 'AI System',
    category: 'system',
    details: {
      contractId,
      updates,
    },
  })

  return NextResponse.json({
    success: true,
    message: 'Contract updated',
    contract: updatedContract,
  })
}

// Create album/EP with existing songs (without deleting them)
async function handleCreateAlbumEP(params: any) {
  const { albumName, artist, releaseType, songIds, releaseDate, distributor, upc, isrc, albumCover, artistId, artistIds } = params

  if (!albumName || !artist) {
    return NextResponse.json({ error: 'Album name and artist are required' }, { status: 400 })
  }

  if (!releaseType || (releaseType !== 'album' && releaseType !== 'ep')) {
    return NextResponse.json({ error: 'Release type must be "album" or "ep"' }, { status: 400 })
  }

  if (!songIds || !Array.isArray(songIds) || songIds.length === 0) {
    return NextResponse.json({ error: 'Song IDs array is required' }, { status: 400 })
  }

  const catalog = getCatalog()
  const selectedSongs = catalog.filter(item => songIds.includes(item.id))

  if (selectedSongs.length !== songIds.length) {
    const foundIds = selectedSongs.map(s => s.id)
    const missingIds = songIds.filter(id => !foundIds.includes(id))
    return NextResponse.json({ 
      error: 'Some songs were not found', 
      missingIds 
    }, { status: 404 })
  }

  // Combine streams from all songs
  const totalStreams = selectedSongs.reduce((sum, song) => sum + song.totalStreams, 0)

  // Get common artist info
  const commonArtist = artist || selectedSongs[0]?.artist
  const finalArtistId = artistId || selectedSongs[0]?.artistId
  const finalArtistIds = artistIds || selectedSongs[0]?.artistIds || (finalArtistId ? [finalArtistId] : undefined)

  // Create album/EP with all songs (songs remain in catalog, just referenced)
  const albumItem = addCatalogItem({
    song: albumName,
    artist: commonArtist,
    artistId: finalArtistId,
    artistIds: finalArtistIds,
    releaseType: releaseType,
    releaseDate: releaseDate || undefined,
    totalStreams: totalStreams,
    distributor: distributor || undefined,
    manuallyAdded: true,
    upc: upc || undefined,
    isrc: isrc || undefined,
    albumCover: albumCover || undefined,
    songs: selectedSongs.map(song => ({
      id: song.id,
      song: song.song,
      isrc: song.isrc,
      streams: song.totalStreams,
    })),
  })

  appendAiHistory(
    albumItem.id,
    makeAiEntry(
      'create_album_ep',
      `Created ${releaseType} "${albumName}" with ${selectedSongs.length} tracks; totalStreams → ${totalStreams}${releaseDate ? `; releaseDate → ${releaseDate}` : ''}${albumCover ? '; albumCover set' : ''}`
    )
  )

  // Log activity
  logActivity({
    action: `Created ${releaseType} with ${selectedSongs.length} songs`,
    user: 'AI System',
    category: 'catalog',
    details: {
      albumName,
      artist: commonArtist,
      releaseType,
      songCount: selectedSongs.length,
      totalStreams,
      songIds: selectedSongs.map(s => s.id),
      albumId: albumItem.id,
    },
  })

  return NextResponse.json({
    success: true,
    message: `Created ${releaseType} "${albumName}" with ${selectedSongs.length} songs`,
    album: albumItem,
    songsAdded: selectedSongs.map(s => ({ id: s.id, song: s.song })),
  })
}

// Add songs to existing album/EP
async function handleAddSongsToAlbum(params: any) {
  const { albumId, songIds } = params

  if (!albumId) {
    return NextResponse.json({ error: 'Album ID is required' }, { status: 400 })
  }

  if (!songIds || !Array.isArray(songIds) || songIds.length === 0) {
    return NextResponse.json({ error: 'Song IDs array is required' }, { status: 400 })
  }

  const catalog = getCatalog()
  const album = catalog.find(item => item.id === albumId)

  if (!album) {
    return NextResponse.json({ error: 'Album/EP not found' }, { status: 404 })
  }

  if (album.releaseType !== 'album' && album.releaseType !== 'ep') {
    return NextResponse.json({ error: 'Item is not an album or EP' }, { status: 400 })
  }

  const selectedSongs = catalog.filter(item => songIds.includes(item.id))

  if (selectedSongs.length !== songIds.length) {
    const foundIds = selectedSongs.map(s => s.id)
    const missingIds = songIds.filter(id => !foundIds.includes(id))
    return NextResponse.json({ 
      error: 'Some songs were not found', 
      missingIds 
    }, { status: 404 })
  }

  // Get existing songs in album
  const existingSongs = album.songs || []
  const existingSongIds = new Set(existingSongs.map(s => s.id))

  // Add new songs (avoid duplicates)
  const newSongs = selectedSongs
    .filter(song => !existingSongIds.has(song.id))
    .map(song => ({
      id: song.id,
      song: song.song,
      isrc: song.isrc,
      streams: song.totalStreams,
    }))

  if (newSongs.length === 0) {
    return NextResponse.json({ 
      error: 'All selected songs are already in the album',
      message: 'No new songs to add'
    }, { status: 400 })
  }

  // Combine existing and new songs
  const allSongs = [...existingSongs, ...newSongs]
  
  // Recalculate total streams
  const totalStreams = allSongs.reduce((sum, song) => sum + (song.streams || 0), 0)

  // Update album
  const success = updateCatalogItem(albumId, {
    songs: allSongs,
    totalStreams: totalStreams,
  })

  if (!success) {
    return NextResponse.json({ error: 'Failed to update album' }, { status: 500 })
  }

  appendAiHistory(
    albumId,
    makeAiEntry('add_songs_to_album', `Added ${newSongs.length} tracks to ${album.releaseType} "${album.song}"`)
  )

  // Log activity
  logActivity({
    action: `Added ${newSongs.length} songs to ${album.releaseType}`,
    user: 'AI System',
    category: 'catalog',
    details: {
      albumName: album.song,
      artist: album.artist,
      releaseType: album.releaseType,
      songsAdded: newSongs.length,
      songIds: newSongs.map(s => s.id),
      albumId,
    },
  })

  return NextResponse.json({
    success: true,
    message: `Added ${newSongs.length} songs to ${album.releaseType} "${album.song}"`,
    songsAdded: newSongs.map(s => ({ id: s.id, song: s.song })),
    totalSongs: allSongs.length,
    totalStreams,
  })
}

// Find song by name/artist
async function handleFindSong(params: any) {
  const { songName, artistName, songId } = params

  const catalog = getCatalog()

  // If songId provided, find by ID
  if (songId) {
    const song = catalog.find(item => item.id === songId)
    if (!song) {
      return NextResponse.json({ error: 'Song not found', songId }, { status: 404 })
    }
    return NextResponse.json({
      success: true,
      song,
    })
  }

  // Find by name/artist
  if (!songName && !artistName) {
    return NextResponse.json({ error: 'songName, artistName, or songId is required' }, { status: 400 })
  }

  const normalize = (str: string) => str.toLowerCase().trim()
  
  let matches = catalog

  if (songName) {
    matches = matches.filter(item => 
      normalize(item.song).includes(normalize(songName))
    )
  }

  if (artistName) {
    matches = matches.filter(item => 
      normalize(item.artist).includes(normalize(artistName))
    )
  }

  if (matches.length === 0) {
    return NextResponse.json({ 
      error: 'No songs found',
      searchCriteria: { songName, artistName }
    }, { status: 404 })
  }

  // Return exact matches first, then partial matches
  const exactMatches = matches.filter(item => 
    (!songName || normalize(item.song) === normalize(songName)) &&
    (!artistName || normalize(item.artist) === normalize(artistName))
  )

  const results = exactMatches.length > 0 ? exactMatches : matches

  return NextResponse.json({
    success: true,
    matches: results.length,
    songs: results.slice(0, 10), // Return first 10 matches
  })
}
