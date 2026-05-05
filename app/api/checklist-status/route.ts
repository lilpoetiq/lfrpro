import { NextRequest, NextResponse } from 'next/server'
import { getCatalog, getUsers, addMessage } from '@/lib/storage'
import { notifyChecklistStatus } from '@/lib/aiNotifications'
import fs from 'fs'
import path from 'path'
import { getDataPath } from '@/lib/uploadConfig'
import { getChecklistPath } from '@/lib/backup'

const DATA_DIR = getDataPath()

export const dynamic = 'force-dynamic'

interface ChecklistItem {
  id: string
  songId: string
  task: string
  section: string
  category: 'mandatory' | 'optional'
  completed: boolean
  createdAt: string
  updatedAt: string
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

function getChecklistCompletion(songId: string, song?: string, artist?: string): {
  totalItems: number
  completedItems: number
  mandatoryItems: number
  completedMandatory: number
  completionPercentage: number
  lastUpdated?: string
  untouched: boolean
} {
  const items = getChecklistItems(songId, song, artist)
  
  if (items.length === 0) {
    return {
      totalItems: 0,
      completedItems: 0,
      mandatoryItems: 0,
      completedMandatory: 0,
      completionPercentage: 0,
      untouched: true,
    }
  }

  const mandatoryItems = items.filter(i => i.category === 'mandatory')
  const completedMandatory = mandatoryItems.filter(i => i.completed).length
  const completedItems = items.filter(i => i.completed).length
  
  // Check if checklist is untouched (no items completed and no updates)
  const lastUpdated = items.reduce((latest, item) => {
    const itemDate = new Date(item.updatedAt).getTime()
    const latestDate = latest ? new Date(latest).getTime() : 0
    return itemDate > latestDate ? item.updatedAt : latest
  }, '')
  
  const untouched = completedItems === 0 && 
    (!lastUpdated || new Date(lastUpdated).getTime() === new Date(items[0].createdAt).getTime())

  return {
    totalItems: items.length,
    completedItems,
    mandatoryItems: mandatoryItems.length,
    completedMandatory,
    completionPercentage: mandatoryItems.length > 0 
      ? Math.round((completedMandatory / mandatoryItems.length) * 100)
      : 0,
    lastUpdated: lastUpdated || undefined,
    untouched,
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const daysAhead = parseInt(searchParams.get('daysAhead') || '14') // Default 14 days
    const minCompletion = parseInt(searchParams.get('minCompletion') || '100') // Default 100% (incomplete)
    
    const catalog = getCatalog()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Find upcoming releases
    const upcomingReleases = catalog.filter(item => {
      if (!item.releaseDate) return false
      if (item.releaseApprovalStatus !== 'approved') return false
      
      const releaseDate = new Date(item.releaseDate)
      releaseDate.setHours(0, 0, 0, 0)
      
      const daysUntil = Math.ceil((releaseDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      
      return daysUntil >= 0 && daysUntil <= daysAhead
    })

    // Check checklist status for each upcoming release
    const releasesWithStatus = upcomingReleases.map(item => {
      const checklistStatus = getChecklistCompletion(item.id, item.song, item.artist)
      
      const releaseDate = new Date(item.releaseDate!)
      releaseDate.setHours(0, 0, 0, 0)
      const daysUntil = Math.ceil((releaseDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      
      return {
        songId: item.id,
        song: item.song,
        artist: item.artist,
        releaseDate: item.releaseDate,
        daysUntil,
        checklistStatus,
        needsAttention: checklistStatus.completionPercentage < minCompletion || checklistStatus.untouched,
      }
    })

    // Filter to only releases that need attention
    const needsAttention = releasesWithStatus.filter(r => r.needsAttention)
    
    // Sort by days until release (soonest first)
    needsAttention.sort((a, b) => a.daysUntil - b.daysUntil)

    // Create dashboard notifications for admins if there are releases needing attention
    if (needsAttention.length > 0) {
      const users = getUsers()
      const admins = users.filter(u => u.role === 'admin')
      
      // Group releases by urgency for notification
      const urgentReleases = needsAttention.filter(r => r.daysUntil <= 3)
      const soonReleases = needsAttention.filter(r => r.daysUntil > 3 && r.daysUntil <= 7)
      
      // Create notifications for each admin
      admins.forEach(admin => {
        // Create a summary notification
        let notificationMessage = `${needsAttention.length} release(s) need checklist attention:\n\n`
        
        if (urgentReleases.length > 0) {
          notificationMessage += `🚨 URGENT (≤3 days):\n`
          urgentReleases.forEach(r => {
            const status = r.checklistStatus.untouched ? 'UNTOUCHED' : `${r.checklistStatus.completionPercentage}% complete`
            notificationMessage += `• "${r.song}" by ${r.artist} - ${r.daysUntil} day(s) - ${status}\n`
          })
          notificationMessage += `\n`
        }
        
        if (soonReleases.length > 0) {
          notificationMessage += `⚠️ SOON (4-7 days):\n`
          soonReleases.forEach(r => {
            const status = r.checklistStatus.untouched ? 'UNTOUCHED' : `${r.checklistStatus.completionPercentage}% complete`
            notificationMessage += `• "${r.song}" by ${r.artist} - ${r.daysUntil} day(s) - ${status}\n`
          })
          notificationMessage += `\n`
        }
        
        if (needsAttention.length > urgentReleases.length + soonReleases.length) {
          const upcoming = needsAttention.filter(r => r.daysUntil > 7)
          notificationMessage += `📅 UPCOMING (8-14 days):\n`
          upcoming.slice(0, 5).forEach(r => {
            const status = r.checklistStatus.untouched ? 'UNTOUCHED' : `${r.checklistStatus.completionPercentage}% complete`
            notificationMessage += `• "${r.song}" by ${r.artist} - ${r.daysUntil} day(s) - ${status}\n`
          })
          if (upcoming.length > 5) {
            notificationMessage += `... and ${upcoming.length - 5} more\n`
          }
        }
        
        notificationMessage += `\nPlease review checklists on the website.`
        
        // Create dashboard notification
        addMessage({
          from: 'system',
          fromName: 'System',
          to: admin.id,
          toName: admin.name || 'Admin',
          subject: `Checklist Alert: ${needsAttention.length} Release(s) Need Attention`,
          message: notificationMessage,
        })
      })
      
      // Notify AI server (will send iMessage to admins)
      await notifyChecklistStatus({
        releases: needsAttention
          .filter(r => r.releaseDate) // Only include releases with dates
          .map(r => ({
            songName: r.song,
            artistName: r.artist,
            releaseDate: r.releaseDate!,
            daysUntil: r.daysUntil,
            completionPercentage: r.checklistStatus.completionPercentage,
            untouched: r.checklistStatus.untouched,
          })),
      })
    }

    return NextResponse.json({
      success: true,
      totalUpcoming: upcomingReleases.length,
      needsAttention: needsAttention.length,
      releases: needsAttention,
      summary: {
        untouched: needsAttention.filter(r => r.checklistStatus.untouched).length,
        incomplete: needsAttention.filter(r => !r.checklistStatus.untouched && r.checklistStatus.completionPercentage < 100).length,
        releasingSoon: needsAttention.filter(r => r.daysUntil <= 7).length,
        releasingVerySoon: needsAttention.filter(r => r.daysUntil <= 3).length,
      },
      notificationsSent: needsAttention.length > 0,
    })
  } catch (error: any) {
    console.error('Checklist status error:', error)
    return NextResponse.json(
      { error: 'Failed to check checklist status', details: error.message },
      { status: 500 }
    )
  }
}

