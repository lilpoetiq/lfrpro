import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')

export async function GET(request: NextRequest) {
  try {
    const analysesFile = path.join(DATA_DIR, 'analyses.json')
    
    if (!fs.existsSync(analysesFile)) {
      return NextResponse.json({ success: true, analyses: [] })
    }
    
    const analyses = JSON.parse(fs.readFileSync(analysesFile, 'utf-8'))
      .sort((a: any, b: any) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
      .slice(0, 10)

    return NextResponse.json({ success: true, analyses })
  } catch (error: any) {
    console.error('Get analyses error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analyses', details: error.message },
      { status: 500 }
    )
  }
}
