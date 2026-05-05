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
    console.error('Error reading maintenance file:', error)
    return { isActive: false }
  }
}

async function setMaintenanceInfo(info: MaintenanceInfo): Promise<void> {
  await ensureDataDir()
  await writeFile(MAINTENANCE_FILE, JSON.stringify(info, null, 2), 'utf-8')
}

export async function GET(request: NextRequest) {
  try {
    const info = await getMaintenanceInfo()
    return NextResponse.json(info)
  } catch (error: any) {
    console.error('Error fetching maintenance info:', error)
    return NextResponse.json(
      { isActive: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      isActive, 
      estimatedDuration, 
      updateDescription 
    } = body

    // Validate admin (you can add proper auth here)
    // For now, we'll allow it but you should add authentication

    const maintenanceInfo: MaintenanceInfo = {
      isActive: Boolean(isActive),
      estimatedDuration,
      updateDescription,
      startedAt: isActive ? new Date().toISOString() : undefined,
    }

    // Calculate estimated end time if duration is provided
    if (isActive && estimatedDuration) {
      const durationMatch = estimatedDuration.match(/(\d+)\s*(minute|hour|h|m|hr|hrs)/i)
      if (durationMatch) {
        const amount = parseInt(durationMatch[1])
        const unit = durationMatch[2].toLowerCase()
        
        const now = new Date()
        if (unit.includes('hour') || unit === 'h' || unit === 'hr' || unit === 'hrs') {
          now.setHours(now.getHours() + amount)
        } else if (unit.includes('minute') || unit === 'm') {
          now.setMinutes(now.getMinutes() + amount)
        }
        
        maintenanceInfo.estimatedEndTime = now.toISOString()
      }
    }

    await setMaintenanceInfo(maintenanceInfo)

    return NextResponse.json({
      success: true,
      maintenanceInfo,
    })
  } catch (error: any) {
    console.error('Error setting maintenance info:', error)
    return NextResponse.json(
      { error: 'Failed to set maintenance mode', details: error.message },
      { status: 500 }
    )
  }
}












