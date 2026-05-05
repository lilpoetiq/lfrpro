import { NextRequest, NextResponse } from 'next/server'
import { getContracts, addContract, updateContract, deleteContract, getCatalog, getUsers } from '@/lib/storage'

// GET - Fetch contracts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const songId = searchParams.get('songId') || undefined
    const artistId = searchParams.get('artistId') || undefined
    
    const contracts = getContracts(songId, artistId)
    
    return NextResponse.json({ success: true, contracts })
  } catch (error: any) {
    console.error('Failed to fetch contracts:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch contracts' },
      { status: 500 }
    )
  }
}

// POST - Create new contract
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, songId, artistIds, splits, effectiveDate, expirationDate, notes, createdBy, isActive } = body
    
    if (!name || !artistIds || !splits || !effectiveDate || !createdBy) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Validate splits
    if (!Array.isArray(splits) || splits.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Splits must be a non-empty array' },
        { status: 400 }
      )
    }
    
    // Get artist names for splits
    const users = getUsers()
    const splitsWithNames = splits.map((split: any) => {
      const user = users.find(u => u.id === split.artistId)
      return {
        ...split,
        artistName: user?.name || user?.artistName || 'Unknown',
      }
    })
    
    const contract = addContract({
      name,
      songId,
      artistIds,
      splits: splitsWithNames,
      effectiveDate,
      expirationDate,
      notes,
      createdBy,
      isActive: isActive !== undefined ? isActive : true,
    })
    
    return NextResponse.json({ success: true, contract })
  } catch (error: any) {
    console.error('Failed to create contract:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create contract' },
      { status: 500 }
    )
  }
}

// PUT - Update contract
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Contract ID required' },
        { status: 400 }
      )
    }
    
    // If updating splits, get artist names
    if (updates.splits) {
      const users = getUsers()
      updates.splits = updates.splits.map((split: any) => {
        const user = users.find(u => u.id === split.artistId)
        return {
          ...split,
          artistName: user?.name || user?.artistName || 'Unknown',
        }
      })
    }
    
    const contract = updateContract(id, updates)
    
    if (!contract) {
      return NextResponse.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ success: true, contract })
  } catch (error: any) {
    console.error('Failed to update contract:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update contract' },
      { status: 500 }
    )
  }
}

// DELETE - Delete contract
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Contract ID required' },
        { status: 400 }
      )
    }
    
    const deleted = deleteContract(id)
    
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to delete contract:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete contract' },
      { status: 500 }
    )
  }
}

