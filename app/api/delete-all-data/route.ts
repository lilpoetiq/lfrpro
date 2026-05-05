import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getDataPath } from '@/lib/uploadConfig'

const DATA_DIR = getDataPath()

export async function DELETE(request: NextRequest) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      return NextResponse.json({ success: true, message: 'No data directory found' })
    }

    // List of files to keep (like users.json - we might want to keep user accounts)
    // But for now, delete everything except the directory structure
    const filesToDelete: string[] = []
    const dirsToDelete: string[] = []

    // Read all files in data directory
    const entries = fs.readdirSync(DATA_DIR, { withFileTypes: true })

    entries.forEach((entry) => {
      const fullPath = path.join(DATA_DIR, entry.name)
      
      if (entry.isDirectory()) {
        // Delete uploads directory and its contents
        if (entry.name === 'uploads') {
          dirsToDelete.push(fullPath)
        }
      } else if (entry.isFile()) {
        // Delete all JSON files and TypeScript files
        // This includes: uploads.json, catalog.json, analyses.json, users.json, songVault.json, and all artist_*.json files
        if (entry.name.endsWith('.json') || entry.name.endsWith('.ts')) {
          filesToDelete.push(fullPath)
        }
      }
    })

    // Delete all files
    filesToDelete.forEach((filePath) => {
      try {
        fs.unlinkSync(filePath)
      } catch (error) {
        console.error(`Error deleting file ${filePath}:`, error)
      }
    })

    // Delete directories recursively
    dirsToDelete.forEach((dirPath) => {
      try {
        fs.rmSync(dirPath, { recursive: true, force: true })
      } catch (error) {
        console.error(`Error deleting directory ${dirPath}:`, error)
      }
    })

    // Recreate uploads directory structure
    const uploadsDir = path.join(DATA_DIR, 'uploads')
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${filesToDelete.length} files and ${dirsToDelete.length} directories`,
      deletedFiles: filesToDelete.length,
      deletedDirs: dirsToDelete.length,
    })
  } catch (error: any) {
    console.error('Delete all data error:', error)
    return NextResponse.json(
      { error: 'Failed to delete all data', details: error.message },
      { status: 500 }
    )
  }
}

