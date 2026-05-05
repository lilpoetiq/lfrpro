import { NextRequest, NextResponse } from 'next/server'
import Papa from 'papaparse'
import { saveUpload, saveArtistData } from '@/lib/storage'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const artistName = formData.get('artistName') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!artistName) {
      return NextResponse.json({ error: 'Artist name required' }, { status: 400 })
    }

    // Read file content
    const text = await file.text()
    
    // Parse CSV
    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    })

    if (parsed.errors.length > 0) {
      return NextResponse.json(
        { error: 'CSV parsing error', details: parsed.errors },
        { status: 400 }
      )
    }

    // Add artist name to each row if not present
    const dataWithArtist = parsed.data.map((row: any) => ({
      ...row,
      artist: artistName,
    }))

    // Save artist-specific data
    saveArtistData(artistName, dataWithArtist)

    // Create grouped data
    const groupedData: Record<string, any[]> = {}
    groupedData[artistName] = dataWithArtist

    // Store upload metadata
    const uploadData = {
      id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fileName: file.name,
      artistName: artistName,
      uploadedAt: new Date().toISOString(),
      rowCount: dataWithArtist.length,
      data: dataWithArtist,
      groupedByArtist: groupedData,
      artistsFound: [artistName],
      metadata: {
        size: file.size,
        type: file.type,
        artistCount: 1,
      },
    }

    saveUpload(uploadData)

    return NextResponse.json({
      success: true,
      id: uploadData.id,
      rowCount: dataWithArtist.length,
      message: 'CSV uploaded and stored successfully',
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload CSV', details: error.message },
      { status: 500 }
    )
  }
}
