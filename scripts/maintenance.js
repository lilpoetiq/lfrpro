#!/usr/bin/env node

/**
 * Maintenance Mode Toggle Script
 * 
 * Usage:
 *   Enable: node scripts/maintenance.js on "30 minutes" "Updating database schema"
 *   Disable: node scripts/maintenance.js off
 *   Status: node scripts/maintenance.js status
 */

const { writeFile, mkdir, readFile } = require('fs/promises')
const { existsSync } = require('fs')
const path = require('path')

const DATA_DIR = path.join(process.cwd(), 'data')
const MAINTENANCE_FILE = path.join(DATA_DIR, 'maintenance.json')

async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true })
  }
}

async function getMaintenanceInfo() {
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

async function setMaintenanceInfo(info) {
  await ensureDataDir()
  await writeFile(MAINTENANCE_FILE, JSON.stringify(info, null, 2), 'utf-8')
}

async function enableMaintenance(duration, description) {
  const maintenanceInfo = {
    isActive: true,
    estimatedDuration: duration,
    updateDescription: description,
    startedAt: new Date().toISOString(),
  }

  // Calculate estimated end time if duration is provided
  if (duration) {
    const durationMatch = duration.match(/(\d+)\s*(minute|hour|h|m|hr|hrs)/i)
    if (durationMatch) {
      const amount = parseInt(durationMatch[1])
      const unit = durationMatch[2].toLowerCase()
      
      const endTime = new Date()
      if (unit.includes('hour') || unit === 'h' || unit === 'hr' || unit === 'hrs') {
        endTime.setHours(endTime.getHours() + amount)
      } else if (unit.includes('minute') || unit === 'm') {
        endTime.setMinutes(endTime.getMinutes() + amount)
      }
      
      maintenanceInfo.estimatedEndTime = endTime.toISOString()
    }
  }

  await setMaintenanceInfo(maintenanceInfo)
  console.log('✅ Maintenance mode enabled')
  console.log(`   Duration: ${duration || 'Not specified'}`)
  console.log(`   Description: ${description || 'Not specified'}`)
  if (maintenanceInfo.estimatedEndTime) {
    console.log(`   Estimated end: ${new Date(maintenanceInfo.estimatedEndTime).toLocaleString()}`)
  }
}

async function disableMaintenance() {
  const maintenanceInfo = {
    isActive: false,
  }
  await setMaintenanceInfo(maintenanceInfo)
  console.log('✅ Maintenance mode disabled')
}

async function showStatus() {
  const info = await getMaintenanceInfo()
  if (info.isActive) {
    console.log('🔧 Maintenance mode is ACTIVE')
    console.log(`   Started: ${info.startedAt ? new Date(info.startedAt).toLocaleString() : 'Unknown'}`)
    console.log(`   Duration: ${info.estimatedDuration || 'Not specified'}`)
    console.log(`   Description: ${info.updateDescription || 'Not specified'}`)
    if (info.estimatedEndTime) {
      console.log(`   Estimated end: ${new Date(info.estimatedEndTime).toLocaleString()}`)
    }
  } else {
    console.log('✅ Maintenance mode is INACTIVE')
  }
}

// Main execution
const command = process.argv[2]

if (command === 'on' || command === 'enable') {
  const duration = process.argv[3]
  const description = process.argv[4] || process.argv.slice(4).join(' ')
  enableMaintenance(duration, description).catch(console.error)
} else if (command === 'off' || command === 'disable') {
  disableMaintenance().catch(console.error)
} else if (command === 'status') {
  showStatus().catch(console.error)
} else {
  console.log(`
Usage:
  node scripts/maintenance.js on [duration] [description]
  node scripts/maintenance.js off
  node scripts/maintenance.js status

Examples:
  node scripts/maintenance.js on "30 minutes" "Updating database"
  node scripts/maintenance.js on "2 hours" "Server migration"
  node scripts/maintenance.js off
  node scripts/maintenance.js status
  `)
  process.exit(1)
}












