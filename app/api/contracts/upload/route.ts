import { NextRequest, NextResponse } from 'next/server'
import { addContractDocument, getContracts } from '@/lib/storage'
import { mkdir } from 'fs/promises'
import path from 'path'

import { UPLOAD_BASE } from '@/lib/uploadConfig'
import { getReadableFileName } from '@/lib/fileNaming'
import { writeUploadToDisk } from '@/lib/writeUploadToDisk'

const UPLOAD_DIR = UPLOAD_BASE

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const contractId = formData.get('contractId') as string
    const file = formData.get('file') as File
    const userId = formData.get('userId') as string

    if (!contractId || !file) {
      return NextResponse.json(
        { error: 'contractId and file are required' },
        { status: 400 }
      )
    }

    const contract = getContracts().find((c) => c.id === contractId)
    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    const category = 'contracts'
    const categoryDir = path.join(UPLOAD_DIR, category)
    await mkdir(categoryDir, { recursive: true })

    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const extension = path.extname(originalName) || ''
    const baseName = path.basename(originalName, path.extname(originalName))
    const artistLabel = contract.splits?.[0]?.artistName || contract.name || 'contract'
    const fileName = getReadableFileName({
      baseName: `${artistLabel}_${baseName || 'doc'}`,
      extension: extension || path.extname(file.name),
      directory: categoryDir,
    })
    const filePath = path.join(categoryDir, fileName)

    await writeUploadToDisk(file, filePath)

    const fileUrl = `/api/files/${category}/${fileName}`

    const updated = addContractDocument(contractId, {
      fileName: file.name,
      fileUrl,
      uploadedBy: userId,
    })

    return NextResponse.json({
      success: true,
      contract: updated,
      document: updated?.documents?.slice(-1)[0],
    })
  } catch (error: any) {
    console.error('Contract upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    )
  }
}
