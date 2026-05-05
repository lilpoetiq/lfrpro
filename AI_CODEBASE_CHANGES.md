# Codebase Changes & Current State - AI Reference Guide

This document summarizes recent changes, improvements, and current patterns in the Legendary Fyre Records Dashboard. Use this as a reference when making changes or troubleshooting.

---

## Recent Major Changes

### 1. CSV Upload Stream Reconciliation System

**What Changed:**
- CSV uploads now automatically match songs to existing catalog entries
- Streams are merged by calculating the difference (new streams - existing streams)
- Only the difference is added to prevent duplicate entries
- Collaboration songs (same song, different artists) are handled correctly

**Key Files:**
- `app/api/upload-csv/route.ts` - Main CSV upload logic
- `app/api/catalog/reconcile-streams/route.ts` - Retroactive stream reconciliation
- `app/api/catalog/merge-duplicates/route.ts` - Merge duplicate entries
- `app/api/catalog/delete-csv-entries/route.ts` - Delete CSV-added entries

**How It Works:**
1. When CSV is uploaded, songs are matched to existing catalog items
2. Matching is done by:
   - First: Exact match (song name + artist name)
   - Then: Song name only (for collaborations)
   - Also: Nested songs in albums/EPs
3. If match found: Calculate stream difference and add only the difference
4. If no match: Add as new entry

**Example:**
- Existing: "Song Name" by "Artist1" with 8911 streams
- CSV shows: "Song Name" by "Artist1" with 11019 streams
- Difference: 11019 - 8911 = 2108
- Result: Update to 8911 + 2108 = 11019 streams

**For Collaborations:**
- If CSV has "Song Name" by "Artist2" but catalog has "Song Name" by "Artist1"
- System matches by song name only
- Updates existing entry and combines artists: "Artist1 & Artist2"
- Adds stream difference to existing streams

**Important Functions:**
```typescript
// Normalization function (case-insensitive, trimmed)
const normalize = (str: string) => str.toLowerCase().trim()

// Matching logic
let existing = catalog.find(
  item => normalize(item.song) === normalizedSong && 
          normalize(item.artist) === normalizedArtist
)

// If not found, try song name only (for collaborations)
if (!existing) {
  existing = catalog.find(
    item => normalize(item.song) === normalizedSong
  )
}
```

---

### 2. Enhanced Error Handling

**What Changed:**
- Added comprehensive error handling to `updateCatalogItem` function
- Improved API route error messages with detailed logging
- Better error boundaries that don't use router hooks
- Enhanced error logging throughout the application

**Key Files:**
- `lib/storage.ts` - `updateCatalogItem` function with detailed error handling
- `app/api/catalog/route.ts` - Enhanced PUT handler with validation
- `app/error.tsx` - Improved error boundary
- `app/dashboard/error.tsx` - Dashboard-specific error boundary

**Error Handling Pattern:**
```typescript
export function updateCatalogItem(id: string, updates: Partial<CatalogItem>): boolean {
  try {
    // Validate file exists
    if (!fs.existsSync(filePath)) {
      console.error('[updateCatalogItem] Catalog file does not exist:', filePath)
      return false
    }
    
    // Parse with error handling
    let catalog: CatalogItem[]
    try {
      catalog = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    } catch (parseError: any) {
      console.error('[updateCatalogItem] Error parsing catalog file:', parseError)
      throw new Error(`Failed to parse catalog file: ${parseError.message}`)
    }
    
    // Validate structure
    if (!Array.isArray(catalog)) {
      throw new Error('Catalog file is corrupted - expected array')
    }
    
    // Find item with validation
    const index = catalog.findIndex(item => item && item.id === id)
    if (index === -1) {
      console.error('[updateCatalogItem] Song not found:', id)
      return false
    }
    
    // Update with validation
    // ... update logic ...
    
    // Write with error handling
    try {
      fs.writeFileSync(filePath, JSON.stringify(catalog, null, 2), 'utf-8')
    } catch (writeError: any) {
      console.error('[updateCatalogItem] Error writing file:', writeError)
      throw new Error(`Failed to write catalog file: ${writeError.message}`)
    }
    
    return true
  } catch (error: any) {
    console.error('[updateCatalogItem] Error:', error)
    console.error('[updateCatalogItem] Stack:', error.stack)
    return false
  }
}
```

---

### 3. Navigation Reordering

**What Changed:**
- Catalog moved above Beat Catalog in admin navigation
- Analytics moved up, positioned after Catalog
- Beat Catalog moved below Catalog and Analytics

**Key File:**
- `components/SidebarClient.tsx` - Admin navigation order updated

**Current Order:**
1. Dashboard
2. AI Chat (mobile only)
3. All Artists
4. **Catalog** (moved up)
5. **Analytics** (moved up)
6. **Beat Catalog** (moved down)
7. Song Vault
8. Contracts
9. Upload Data
10. AI Insights
11. Release Schedule
12. Users
13. Tasks
14. Activity Log
15. Updates

---

### 4. Beat Catalog System

**What Changed:**
- Complete beat catalog system with upload, parsing, and management
- Folder-based uploads supported
- Additional files (Logic projects, stems) can be linked to beats
- Audio metadata tagging with Legendary Fyre Records branding
- Download tracking and fingerprinting

**Key Files:**
- `app/api/beats/upload-pack/route.ts` - Beat pack upload
- `app/api/beats/[beatId]/download/route.ts` - Beat download with ZIP support
- `app/dashboard/beats/page.tsx` - Admin beat management
- `app/dashboard/beats/browse/page.tsx` - Artist beat browsing
- `lib/beatParser.ts` - Filename parsing
- `lib/audioMetadata.ts` - Audio metadata handling

**Important Patterns:**
- Beats stored in `data/uploads/beats/[packName]/`
- Additional files in `data/uploads/beat-files/`
- Metadata uses "Legendary Fyre Records" and "Distributed by" (not "Owned by")
- ZIP downloads only when more than 3 audio files
- All audio files tagged with metadata before download

---

### 5. Branding Updates

**What Changed:**
- Changed from "LFR Records" to "Legendary Fyre Records" throughout
- Changed from "Owned by" to "Distributed by" (beats are distributed, not owned until purchased)
- Updated logo text to "LEGENDARY FYRE RECORDS"

**Key Files:**
- `components/LFRLogo.tsx` - Logo component
- `lib/storage.ts` - Default catalog item fields
- `lib/audioMetadata.ts` - Audio metadata tags
- `app/api/beats/upload-pack/route.ts` - Beat defaults
- Various UI components and API responses

**Branding Values:**
- Owner: "Legendary Fyre Records"
- Copyright: "© Legendary Fyre Records"
- Contact/Label: "Distributed by Legendary Fyre Records"
- License: "Licensed, not sold"

---

## Current Code Patterns

### Component Structure

**Client Components:**
```typescript
'use client' // MUST be first line, no blank lines

import { useState, useEffect } from 'react'
// ... other imports

export default function Component() {
  // Component logic
}
```

**Server Components:**
```typescript
// No 'use client' directive
// Can use async/await
// Can access file system directly

export default async function Component() {
  // Server-side logic
}
```

### API Route Pattern

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getCatalog, updateCatalogItem } from '@/lib/storage'

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body
    
    // Validate
    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 })
    }
    
    // Get data
    const catalog = getCatalog()
    const item = catalog.find(i => i.id === id)
    
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }
    
    // Perform operation
    const success = updateCatalogItem(id, updates)
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update', itemId: id },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
```

### Storage Function Pattern

```typescript
export function updateCatalogItem(id: string, updates: Partial<CatalogItem>): boolean {
  try {
    const filePath = path.join(DATA_DIR, 'catalog.json')
    
    // Validate file exists
    if (!fs.existsSync(filePath)) {
      console.error('[updateCatalogItem] File does not exist:', filePath)
      return false
    }
    
    // Read and parse
    let catalog: CatalogItem[]
    try {
      catalog = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    } catch (parseError: any) {
      console.error('[updateCatalogItem] Parse error:', parseError)
      return false
    }
    
    // Validate structure
    if (!Array.isArray(catalog)) {
      console.error('[updateCatalogItem] Not an array')
      return false
    }
    
    // Find item
    const index = catalog.findIndex(item => item && item.id === id)
    if (index === -1) {
      console.error('[updateCatalogItem] Item not found:', id)
      return false
    }
    
    // Update
    catalog[index] = { ...catalog[index], ...updates }
    
    // Write
    try {
      fs.writeFileSync(filePath, JSON.stringify(catalog, null, 2), 'utf-8')
    } catch (writeError: any) {
      console.error('[updateCatalogItem] Write error:', writeError)
      return false
    }
    
    return true
  } catch (error: any) {
    console.error('[updateCatalogItem] Error:', error)
    return false
  }
}
```

### Matching Logic Pattern

```typescript
// Normalization function (always use this)
const normalize = (str: string) => str.toLowerCase().trim()

// Matching for collaborations
const normalizedSong = normalize(songData.song)
const normalizedArtist = normalize(songData.artist)

// First try exact match
let existing = catalog.find(
  item => normalize(item.song) === normalizedSong && 
          normalize(item.artist) === normalizedArtist
)

// If not found, try song name only (for collaborations)
if (!existing) {
  existing = catalog.find(
    item => normalize(item.song) === normalizedSong
  )
}

// Check nested songs in albums/EPs
if (!existing) {
  for (const item of catalog) {
    if ((item.releaseType === 'album' || item.releaseType === 'ep') && 
        item.songs && Array.isArray(item.songs)) {
      let songIndex = item.songs.findIndex((s: any) => 
        normalize(s.song) === normalizedSong
      )
      if (songIndex !== -1) {
        // Found nested song
        break
      }
    }
  }
}
```

### Stream Calculation Pattern

```typescript
// Calculate difference and add only the difference
const existingStreams = existing.totalStreams || 0
const csvStreams = songData.streams || 0
const streamDifference = csvStreams - existingStreams

if (streamDifference > 0) {
  // Only add the difference
  const newTotalStreams = existingStreams + streamDifference
  
  updateCatalogItem(existing.id, {
    totalStreams: newTotalStreams,
    // ... other fields
  })
}
```

---

## Data Structures

### CatalogItem Interface

```typescript
interface CatalogItem {
  id: string
  song: string
  artist: string
  artistId?: string // Deprecated, use artistIds
  artistIds?: string[] // Multiple artists for collaborations
  releaseType: 'single' | 'ep' | 'album'
  releaseDate?: string
  releaseDateRequested?: string
  releaseApprovalStatus?: 'pending' | 'approved' | 'denied'
  releaseApprovalNotes?: string
  totalStreams: number
  distributor?: string
  platforms?: string[] // Backwards compatibility
  manuallyAdded: boolean
  fileUrl?: string
  googleDriveUrl?: string
  upc?: string
  isrc?: string
  albumCover?: string
  lyrics?: string // Deprecated
  lyricsArray?: Array<{
    id: string
    title?: string
    content: string
    createdAt: string
  }>
  fromCSV?: boolean // Flag for CSV-added items
  songs?: Array<{ // For albums/EPs
    id: string
    song: string
    isrc?: string
    streams?: number
    audioUrl?: string
  }>
  isUnreleased?: boolean
  vaultFileId?: string
  isDelayed?: boolean
  delayReason?: string
}
```

### Beat Interface

```typescript
interface Beat {
  id: string
  name: string
  bpm?: number
  producerIds: string[] // Required - prevents incomplete beats
  packId: string
  status: 'available' | 'reserved' | 'exclusive_sold'
  genre?: string
  mood?: string
  licenseOptions: {
    lease?: number
    premiumLease?: number
    exclusive?: number
  }
  originalFileUrl: string
  previewFileUrl?: string
  owner: string // "Legendary Fyre Records"
  copyright: string // "© Legendary Fyre Records"
  contact: string // "Distributed by Legendary Fyre Records"
  tags?: string[] // "Gospel Safe", "Explicit", "Radio Ready"
  isIncomplete: boolean // Based on producerIds
  canPublish: boolean // Based on producerIds
  createdAt: string
  updatedAt: string
}
```

---

## Important Endpoints

### Catalog Endpoints

- `GET /api/catalog` - Get all catalog items
- `POST /api/catalog` - Add new catalog item
- `PUT /api/catalog` - Update catalog item
- `DELETE /api/catalog?id=...` - Delete catalog item
- `POST /api/catalog/reconcile-streams` - Reconcile streams with CSV data
- `POST /api/catalog/merge-duplicates` - Merge duplicate entries
- `POST /api/catalog/delete-csv-entries` - Delete CSV-added entries

### Beat Endpoints

- `GET /api/beats` - Get all beats
- `POST /api/beats` - Add beat
- `PUT /api/beats` - Update beat
- `DELETE /api/beats` - Delete beat
- `POST /api/beats/upload-pack` - Upload beat pack (folder)
- `GET /api/beats/[beatId]/download` - Download beat (original or ZIP)
- `GET /api/files/beats/[...path]` - Serve beat files

### CSV Endpoints

- `POST /api/upload-csv` - Upload and process CSV file

---

## File Locations

### Data Files
- `data/catalog.json` - Song catalog
- `data/users.json` - User accounts
- `data/uploads/beats/` - Beat audio files
- `data/uploads/beat-files/` - Additional beat files (Logic, stems, etc.)
- `data/uploads/` - Other uploaded files

### Key Source Files
- `lib/storage.ts` - All data storage operations
- `lib/utils.ts` - Utility functions (normalize, cleanSongName, etc.)
- `lib/beatParser.ts` - Beat filename parsing
- `lib/audioMetadata.ts` - Audio metadata handling
- `app/api/catalog/route.ts` - Catalog API
- `app/api/upload-csv/route.ts` - CSV upload
- `components/SidebarClient.tsx` - Navigation sidebar

---

## Common Tasks & How to Do Them

### Add a New Catalog Item

```typescript
import { addCatalogItem } from '@/lib/storage'

const newItem = addCatalogItem({
  song: 'Song Name',
  artist: 'Artist Name',
  releaseType: 'single',
  totalStreams: 0,
  manuallyAdded: true,
  // ... other fields
})
```

### Update Catalog Item

```typescript
import { updateCatalogItem } from '@/lib/storage'

const success = updateCatalogItem(itemId, {
  totalStreams: 1000,
  artist: 'Updated Artist',
  // ... other fields
})
```

### Match Songs for CSV Upload

```typescript
const normalize = (str: string) => str.toLowerCase().trim()
const normalizedSong = normalize(songData.song)
const normalizedArtist = normalize(songData.artist)

// Try exact match first
let existing = catalog.find(
  item => normalize(item.song) === normalizedSong && 
          normalize(item.artist) === normalizedArtist
)

// Then try song name only (for collaborations)
if (!existing) {
  existing = catalog.find(
    item => normalize(item.song) === normalizedSong
  )
}
```

### Calculate Stream Difference

```typescript
const existingStreams = existing.totalStreams || 0
const csvStreams = songData.streams || 0
const streamDifference = csvStreams - existingStreams

if (streamDifference > 0) {
  const newTotalStreams = existingStreams + streamDifference
  updateCatalogItem(existing.id, { totalStreams: newTotalStreams })
}
```

---

## Debugging Commands

```bash
# Check catalog file
node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('data/catalog.json')); console.log('Items:', data.length);"

# Validate JSON
node -e "JSON.parse(require('fs').readFileSync('data/catalog.json'))"

# Find item by ID
node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('data/catalog.json')); const item=data.find(i=>i.id==='ID_HERE'); console.log(JSON.stringify(item, null, 2));"

# Check for items without IDs
node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('data/catalog.json')); const bad=data.filter(i=>!i||!i.id); console.log('Items without ID:', bad.length);"

# Check file permissions
ls -la data/

# Check disk space
df -h
```

---

## Important Notes

1. **Always use normalization** when comparing strings (song names, artist names)
2. **Match by song name first** for collaborations, then exact match
3. **Calculate stream differences** - don't replace, add the difference
4. **Validate data** before saving (check if files exist, validate JSON, etc.)
5. **Add error handling** to all file operations and API routes
6. **Use 'use client'** for all components using React hooks
7. **Log errors** with context (function name, file, error details)
8. **Check for null/undefined** before accessing properties
9. **Use try-catch** for all JSON parsing and file operations
10. **Validate item exists** before updating or deleting

---

## When Making Changes

1. **Follow existing patterns** - Use the same structure as similar code
2. **Add error handling** - Always wrap operations in try-catch
3. **Add logging** - Log important operations and errors
4. **Validate inputs** - Check data before using it
5. **Test thoroughly** - Verify changes work and don't break existing functionality
6. **Update this document** - If you add new patterns or change existing ones

---

## Recent Bug Fixes

1. **CSV Duplicates** - Fixed matching logic to handle collaborations
2. **Stream Merging** - Fixed to add only difference, not replace
3. **Catalog Updates** - Enhanced error handling and validation
4. **React Context Errors** - Fixed error boundaries to not use router hooks
5. **File Downloads** - Fixed to use original filename, not URL filename
6. **Catalog Display** - Removed CSV auto-addition to main catalog view
7. **Song ID Decoding** - Fixed URL-encoded song IDs in detail pages

---

This document should be updated whenever significant changes are made to the codebase. Keep it current so the AI can reference accurate information about how the system works.







