import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'

const DATA_DIR = path.join(process.cwd(), 'data')
const MAINTENANCE_FILE = path.join(DATA_DIR, 'maintenance.json')

interface MaintenanceInfo {
  isActive: boolean
  estimatedDuration?: string
  estimatedEndTime?: string
  updateDescription?: string
  startedAt?: string
}

async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true })
  }
}

async function getMaintenanceInfo(): Promise<MaintenanceInfo> {
  await ensureDataDir()
  
  if (!existsSync(MAINTENANCE_FILE)) {
    return { isActive: false }
  }

  try {
    const content = await readFile(MAINTENANCE_FILE, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    return { isActive: false }
  }
}

async function setMaintenanceInfo(info: MaintenanceInfo): Promise<void> {
  await ensureDataDir()
  await writeFile(MAINTENANCE_FILE, JSON.stringify(info, null, 2), 'utf-8')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      isActive, 
      estimatedDuration, 
      updateDescription 
    } = body

    const currentInfo = await getMaintenanceInfo()
    
    const maintenanceInfo: MaintenanceInfo = {
      isActive: Boolean(isActive),
      estimatedDuration: estimatedDuration || currentInfo.estimatedDuration,
      updateDescription: updateDescription || currentInfo.updateDescription,
      startedAt: isActive 
        ? (currentInfo.startedAt || new Date().toISOString())
        : undefined,
    }

    // Calculate estimated end time if duration is provided
    if (isActive && estimatedDuration) {
      const durationMatch = estimatedDuration.match(/(\d+)\s*(minute|hour|h|m|hr|hrs)/i)
      if (durationMatch) {
        const amount = parseInt(durationMatch[1])
        const unit = durationMatch[2].toLowerCase()
        
        const startTime = maintenanceInfo.startedAt 
          ? new Date(maintenanceInfo.startedAt)
          : new Date()
        
        if (unit.includes('hour') || unit === 'h' || unit === 'hr' || unit === 'hrs') {
          startTime.setHours(startTime.getHours() + amount)
        } else if (unit.includes('minute') || unit === 'm') {
          startTime.setMinutes(startTime.getMinutes() + amount)
        }
        
        maintenanceInfo.estimatedEndTime = startTime.toISOString()
      }
    } else if (!isActive) {
      // Clear end time when disabling maintenance
      maintenanceInfo.estimatedEndTime = undefined
    }

    await setMaintenanceInfo(maintenanceInfo)

    return NextResponse.json({
      success: true,
      maintenanceInfo,
    })
  } catch (error: any) {
    console.error('Error toggling maintenance mode:', error)
    return NextResponse.json(
      { error: 'Failed to toggle maintenance mode', details: error.message },
      { status: 500 }
    )
  }
}

