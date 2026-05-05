# Comprehensive AI Troubleshooting Guide for Legendary Fyre Records Dashboard

This comprehensive guide helps the AI assistant diagnose, understand, and fix errors in the Legendary Fyre Records Dashboard. Use this as your primary reference when troubleshooting issues.

---

## Table of Contents

1. [React Context & Hook Errors](#react-context--hook-errors)
2. [Catalog & Data Management Errors](#catalog--data-management-errors)
3. [CSV Upload & Import Errors](#csv-upload--import-errors)
4. [File Upload & Storage Errors](#file-upload--storage-errors)
5. [API Route Errors](#api-route-errors)
6. [Authentication & Authorization Errors](#authentication--authorization-errors)
7. [UI & Rendering Errors](#ui--rendering-errors)
8. [Performance & Optimization Issues](#performance--optimization-issues)
9. [Database & Storage Issues](#database--storage-issues)
10. [Network & API Communication Errors](#network--api-communication-errors)

---

## React Context & Hook Errors

### Error: `Cannot read properties of null (reading 'useContext')`

**Full Error Message:**
```
TypeError: Cannot read properties of null (reading 'useContext')
at usePathname (node_modules/next/dist/esm/client/components/navigation.js)
```

**Symptoms:**
- Error occurs during page generation/SSR
- Usually happens with Next.js navigation hooks (`usePathname`, `useRouter`, `useParams`)
- Error boundary tries to use hooks before React context is initialized
- Page fails to load or shows blank screen

**Root Causes:**
1. Component using client-side hooks during server-side rendering
2. Missing `'use client'` directive on component file
3. Router context not available during error boundary rendering
4. Component imported in server component without proper client wrapper
5. Dynamic import without `ssr: false` flag

**Detailed Diagnosis Steps:**

1. **Check Component Type:**
   ```typescript
   // ❌ BAD - Server Component trying to use client hook
   import { usePathname } from 'next/navigation'
   export default function Component() {
     const pathname = usePathname() // ERROR HERE
     return <div>{pathname}</div>
   }
   
   // ✅ GOOD - Client Component
   'use client'
   import { usePathname } from 'next/navigation'
   export default function Component() {
     const pathname = usePathname() // Works!
     return <div>{pathname}</div>
   }
   ```

2. **Check Error Boundaries:**
   ```typescript
   // ❌ BAD - Error boundary using router hook
   'use client'
   export default function Error({ error, reset }) {
     const pathname = usePathname() // ERROR - context not available
     return <div>Error on {pathname}</div>
   }
   
   // ✅ GOOD - Error boundary using window.location
   'use client'
   export default function Error({ error, reset }) {
     const [pathname, setPathname] = useState('')
     useEffect(() => {
       if (typeof window !== 'undefined') {
         setPathname(window.location.pathname)
       }
     }, [])
     return <div>Error on {pathname}</div>
   }
   ```

3. **Check Dynamic Imports:**
   ```typescript
   // ❌ BAD - Dynamic import without ssr: false
   const Component = dynamic(() => import('./Component'))
   
   // ✅ GOOD - Dynamic import with ssr: false
   const Component = dynamic(() => import('./Component'), {
     ssr: false,
     loading: () => <div>Loading...</div>
   })
   ```

**Complete Fix Process:**

1. **Identify the problematic component:**
   - Check error stack trace for component name
   - Look for components using `usePathname`, `useRouter`, `useParams`
   - Check if component is in `app/` directory (server components by default)

2. **Add 'use client' directive:**
   ```typescript
   'use client' // MUST be first line, no blank lines before
   
   import { usePathname } from 'next/navigation'
   // ... rest of component
   ```

3. **For error boundaries, use alternative approach:**
   ```typescript
   'use client'
   import { useEffect, useState } from 'react'
   
   export default function Error({ error, reset }) {
     const [pathname, setPathname] = useState('')
     
     useEffect(() => {
       if (typeof window !== 'undefined') {
         setPathname(window.location.pathname)
       }
     }, [])
     
     return (
       <div>
         <h2>Error on {pathname}</h2>
         <button onClick={reset}>Try again</button>
       </div>
     )
   }
   ```

4. **Verify fix:**
   - Restart dev server: `npm run dev`
   - Check browser console for errors
   - Verify page loads correctly

**Files Commonly Affected:**
- `components/SidebarClient.tsx`
- `app/dashboard/error.tsx`
- `app/error.tsx`
- Any component using Next.js navigation hooks

**Prevention:**
- Always add `'use client'` when using React hooks
- Use `window.location` in error boundaries instead of router hooks
- Wrap client components in dynamic imports with `ssr: false` when needed

---

## Catalog & Data Management Errors

### Error: `Failed to update catalog item`

**Full Error Message:**
```
Failed to update catalog item
Item ID: catalog_1234567890_abc123
```

**Symptoms:**
- Songs not updating in catalog
- Stream counts not updating
- Error appears when editing songs
- 500 error from `/api/catalog` PUT endpoint

**Root Causes:**
1. Item ID not found in catalog
2. Catalog file corruption or invalid JSON
3. File system permissions issue
4. Concurrent update conflicts
5. Invalid update data structure
6. Missing required fields in update object

**Detailed Diagnosis Steps:**

1. **Check if item exists:**
   ```bash
   # Run this to check catalog
   node -e "
   const fs = require('fs');
   const catalog = JSON.parse(fs.readFileSync('data/catalog.json'));
   const itemId = 'catalog_1234567890_abc123'; // Replace with actual ID
   const item = catalog.find(i => i.id === itemId);
   console.log('Item found:', !!item);
   if (item) console.log('Item:', JSON.stringify(item, null, 2));
   "
   ```

2. **Validate catalog.json structure:**
   ```bash
   # Check if JSON is valid
   node -e "
   try {
     const fs = require('fs');
     const catalog = JSON.parse(fs.readFileSync('data/catalog.json'));
     console.log('✅ JSON is valid');
     console.log('Total items:', catalog.length);
     console.log('Is array:', Array.isArray(catalog));
     
     // Check for items without IDs
     const itemsWithoutId = catalog.filter(item => !item || !item.id);
     if (itemsWithoutId.length > 0) {
       console.log('⚠️ Items without ID:', itemsWithoutId.length);
     }
   } catch (e) {
     console.error('❌ JSON Error:', e.message);
   }
   "
   ```

3. **Check file permissions:**
   ```bash
   ls -la data/catalog.json
   # Should show: -rw-r--r-- or similar (read/write permissions)
   ```

4. **Check server logs:**
   Look for these log messages:
   - `[updateCatalogItem] Song not found in catalog:`
   - `[updateCatalogItem] Error updating catalog item:`
   - `[PUT /api/catalog] Error:`

**Complete Fix Process:**

1. **Verify catalog file exists and is readable:**
   ```typescript
   // In lib/storage.ts - updateCatalogItem function
   const filePath = path.join(DATA_DIR, 'catalog.json')
   if (!fs.existsSync(filePath)) {
     console.error('[updateCatalogItem] Catalog file does not exist:', filePath)
     return false
   }
   ```

2. **Add better error handling:**
   ```typescript
   export function updateCatalogItem(id: string, updates: Partial<CatalogItem>): boolean {
     try {
       const filePath = path.join(DATA_DIR, 'catalog.json')
       
       // Validate file exists
       if (!fs.existsSync(filePath)) {
         console.error('[updateCatalogItem] Catalog file does not exist:', filePath)
         return false
       }
       
       // Read and parse catalog
       let catalog: CatalogItem[]
       try {
         const fileContent = fs.readFileSync(filePath, 'utf-8')
         catalog = JSON.parse(fileContent)
       } catch (parseError: any) {
         console.error('[updateCatalogItem] Error parsing catalog file:', parseError)
         throw new Error(`Failed to parse catalog file: ${parseError.message}`)
       }
       
       // Validate catalog is array
       if (!Array.isArray(catalog)) {
         console.error('[updateCatalogItem] Catalog is not an array:', typeof catalog)
         throw new Error('Catalog file is corrupted - expected array')
       }
       
       // Find item
       const index = catalog.findIndex(item => item && item.id === id)
       
       if (index === -1) {
         console.error('[updateCatalogItem] Song not found:', id)
         console.error('[updateCatalogItem] Available IDs (first 10):', 
           catalog.slice(0, 10).map(item => item?.id))
         return false
       }
       
       // Update item
       const oldItem = catalog[index]
       catalog[index] = { ...catalog[index], ...updates }
       
       // Validate updated item
       if (!catalog[index].id) {
         throw new Error('Updated item missing required ID field')
       }
       
       // Write back to file
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

3. **Check API route error handling:**
   ```typescript
   // In app/api/catalog/route.ts - PUT handler
   export async function PUT(request: NextRequest) {
     try {
       const body = await request.json()
       const { id, userRole, ...updates } = body
       
       if (!id) {
         return NextResponse.json({ error: 'Item ID required' }, { status: 400 })
       }
       
       // Get catalog and verify item exists
       let catalog
       let oldItem
       try {
         catalog = getCatalog()
         oldItem = catalog.find(item => item && item.id === id)
       } catch (error: any) {
         console.error('[PUT /api/catalog] Error fetching catalog:', error)
         return NextResponse.json(
           { error: 'Failed to fetch catalog', details: error.message },
           { status: 500 }
         )
       }
       
       if (!oldItem) {
         console.error('[PUT /api/catalog] Item not found:', id)
         return NextResponse.json(
           { error: 'Item not found', itemId: id },
           { status: 404 }
         )
       }
       
       // Update item
       const success = updateCatalogItem(id, updates)
       
       if (!success) {
         console.error('[PUT /api/catalog] updateCatalogItem returned false')
         return NextResponse.json(
           { error: 'Failed to update catalog item', itemId: id },
           { status: 500 }
         )
       }
       
       return NextResponse.json({ success: true })
     } catch (error: any) {
       console.error('[PUT /api/catalog] Error:', error)
       return NextResponse.json(
         { error: 'Failed to update catalog item', details: error.message },
         { status: 500 }
       )
     }
   }
   ```

**Common Scenarios:**

**Scenario 1: Item ID doesn't exist**
- **Cause:** Item was deleted or ID is incorrect
- **Fix:** Verify ID is correct, check if item exists before update
- **Prevention:** Always validate item exists before updating

**Scenario 2: Catalog file is corrupted**
- **Cause:** Invalid JSON, file was partially written
- **Fix:** Restore from backup, validate JSON structure
- **Prevention:** Use atomic file writes, add JSON validation

**Scenario 3: Concurrent updates**
- **Cause:** Multiple requests updating same item simultaneously
- **Fix:** Add locking mechanism or handle conflicts gracefully
- **Prevention:** Use optimistic locking or queue updates

**Files to Check:**
- `lib/storage.ts` - `updateCatalogItem` function
- `app/api/catalog/route.ts` - PUT handler
- `data/catalog.json` - Catalog data file

**Debugging Commands:**
```bash
# Check catalog file
node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('data/catalog.json')); console.log('Items:', data.length);"

# Find specific item
node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('data/catalog.json')); const item=data.find(i=>i.id==='ITEM_ID_HERE'); console.log(JSON.stringify(item, null, 2));"

# Validate all items have IDs
node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('data/catalog.json')); const bad=data.filter(i=>!i||!i.id); console.log('Items without ID:', bad.length);"
```

---

## CSV Upload & Import Errors

### Error: Duplicate songs being created

**Symptoms:**
- Same song appears multiple times in catalog
- Different artist names for same song (collaborations)
- Streams not merging correctly
- CSV upload creates new entries instead of updating existing ones

**Root Causes:**
1. Matching logic not finding existing songs
2. Case sensitivity in song/artist names
3. Collaboration songs treated as separate entries
4. Normalization function not working correctly
5. Matching only by exact song + artist, not song name alone

**Detailed Diagnosis:**

1. **Check matching logic:**
   ```typescript
   // Current matching in app/api/upload-csv/route.ts
   const normalize = (str: string) => str.toLowerCase().trim()
   const normalizedSong = normalize(songData.song)
   const normalizedArtist = normalize(songData.artist)
   
   // ❌ BAD - Only matches exact song + artist
   let existing = catalog.find(
     item => normalize(item.song) === normalizedSong && 
             normalize(item.artist) === normalizedArtist
   )
   
   // ✅ GOOD - Matches by song name first (for collaborations)
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

2. **Check normalization function:**
   ```typescript
   // Test normalization
   const normalize = (str: string) => str.toLowerCase().trim()
   
   // Should handle:
   normalize("  SONG NAME  ") === "song name" // true
   normalize("Song Name") === "song name" // true
   normalize("SONG NAME") === "song name" // true
   ```

**Complete Fix Process:**

1. **Update matching logic to handle collaborations:**
   ```typescript
   // In app/api/upload-csv/route.ts
   songsMap.forEach((songData) => {
     const normalize = (str: string) => str.toLowerCase().trim()
     const normalizedSong = normalize(songData.song)
     const normalizedArtist = normalize(songData.artist)
     const csvStreams = songData.streams || 0
     
     // First try exact match (song + artist)
     let existing = currentCatalog.find(
       item => normalize(item.song) === normalizedSong && 
               normalize(item.artist) === normalizedArtist
     )
     
     // If not found, try song name only (for collaborations)
     // This prevents duplicates like "2 Week Notice" with "pOETiqbEETz" vs "Lady L.U.S.T"
     if (!existing) {
       existing = currentCatalog.find(
         item => normalize(item.song) === normalizedSong
       )
     }
     
     // Check nested songs in albums/EPs
     let nestedSongMatch = null
     if (!existing) {
       for (const item of currentCatalog) {
         if ((item.releaseType === 'album' || item.releaseType === 'ep') && 
             item.songs && Array.isArray(item.songs)) {
           // Try exact match first
           let songIndex = item.songs.findIndex((s: any) => 
             normalize(s.song) === normalizedSong && 
             normalize(item.artist) === normalizedArtist
           )
           
           // If not found, try song name only
           if (songIndex === -1) {
             songIndex = item.songs.findIndex((s: any) => 
               normalize(s.song) === normalizedSong
             )
           }
           
           if (songIndex !== -1) {
             nestedSongMatch = { album: item, songIndex }
             break
           }
         }
       }
     }
     
     // Handle existing vs new song logic...
   })
   ```

2. **Update streams correctly:**
   ```typescript
   if (existing) {
     const existingStreams = existing.totalStreams || 0
     const streamDifference = csvStreams - existingStreams
     
     // Only update if CSV has more streams
     if (streamDifference > 0) {
       const newTotalStreams = existingStreams + streamDifference
       
       // For collaborations, combine artist names
       let updatedArtist = existing.artist
       const isCollaboration = normalize(existing.artist) !== normalizedArtist
       if (isCollaboration && !existing.artist.includes(songData.artist)) {
         updatedArtist = `${existing.artist} & ${songData.artist}`
       }
       
       updateCatalogItem(existing.id, {
         totalStreams: newTotalStreams,
         artist: updatedArtist,
         // ... other fields
       })
     }
   }
   ```

3. **Merge existing duplicates:**
   ```typescript
   // Use this endpoint to merge duplicates
   POST /api/catalog/merge-duplicates
   
   // Or manually:
   // 1. Group songs by normalized song name
   // 2. Keep entry with highest streams
   // 3. Combine artist names
   // 4. Delete duplicate entries
   ```

**Common Scenarios:**

**Scenario 1: Collaboration songs**
- **Problem:** "2 Week Notice" appears twice - once with "pOETiqbEETz", once with "Lady L.U.S.T"
- **Fix:** Match by song name only, combine artist names
- **Result:** Single entry: "2 Week Notice" by "pOETiqbEETz & Lady L.U.S.T"

**Scenario 2: Case sensitivity**
- **Problem:** "Song Name" vs "song name" treated as different
- **Fix:** Use normalization function consistently
- **Result:** Both match correctly

**Scenario 3: Whitespace differences**
- **Problem:** "Song Name" vs " Song Name " treated as different
- **Fix:** Trim whitespace in normalization
- **Result:** Both match correctly

**Files to Check:**
- `app/api/upload-csv/route.ts` - CSV upload logic
- `lib/utils.ts` - Normalization functions
- `app/api/catalog/merge-duplicates/route.ts` - Merge duplicates endpoint

**Debugging:**
```bash
# Test normalization
node -e "
const normalize = (str) => str.toLowerCase().trim();
console.log(normalize('  SONG NAME  ')); // 'song name'
console.log(normalize('Song Name') === normalize('SONG NAME')); // true
"
```

---

## File Upload & Storage Errors

### Error: Files not uploading

**Symptoms:**
- Upload button doesn't work
- Files don't appear after upload
- "Failed to upload" error message
- Files not saving to disk

**Root Causes:**
1. Upload directory doesn't exist
2. File permissions issue
3. File size exceeds limit
4. Invalid file type
5. Disk space full
6. API route error

**Detailed Diagnosis:**

1. **Check directory exists:**
   ```typescript
   // In upload route
   const uploadDir = path.join(process.cwd(), 'data', 'uploads', 'beats')
   
   if (!fs.existsSync(uploadDir)) {
     // Create directory
     fs.mkdirSync(uploadDir, { recursive: true })
   }
   ```

2. **Check file permissions:**
   ```bash
   ls -la data/uploads/
   # Should show: drwxr-xr-x (directory with read/write/execute)
   
   # Fix permissions if needed
   chmod -R 755 data/uploads/
   ```

3. **Check disk space:**
   ```bash
   df -h
   # Check available space
   ```

4. **Check file size limits:**
   ```typescript
   // In Next.js config or API route
   export const config = {
     api: {
       bodyParser: {
         sizeLimit: '50mb', // Adjust as needed
       },
     },
   }
   ```

**Complete Fix Process:**

1. **Ensure directories exist:**
   ```typescript
   // Create helper function
   function ensureUploadDir(subdir: string) {
     const uploadDir = path.join(DATA_DIR, 'uploads', subdir)
     if (!fs.existsSync(uploadDir)) {
       fs.mkdirSync(uploadDir, { recursive: true })
       console.log(`Created upload directory: ${uploadDir}`)
     }
     return uploadDir
   }
   
   // Use in upload route
   const uploadDir = ensureUploadDir('beats')
   ```

2. **Add proper error handling:**
   ```typescript
   export async function POST(request: NextRequest) {
     try {
       const formData = await request.formData()
       const file = formData.get('file') as File
       
       if (!file) {
         return NextResponse.json({ error: 'No file provided' }, { status: 400 })
       }
       
       // Check file size
       const maxSize = 50 * 1024 * 1024 // 50MB
       if (file.size > maxSize) {
         return NextResponse.json(
           { error: `File too large. Max size: ${maxSize / 1024 / 1024}MB` },
           { status: 400 }
         )
       }
       
       // Check file type
       const allowedTypes = ['audio/wav', 'audio/mpeg', 'audio/mp3']
       if (!allowedTypes.includes(file.type)) {
         return NextResponse.json(
           { error: `Invalid file type: ${file.type}` },
           { status: 400 }
         )
       }
       
       // Ensure directory exists
       const uploadDir = ensureUploadDir('beats')
       
       // Save file
       const buffer = Buffer.from(await file.arrayBuffer())
       const fileName = `${Date.now()}_${file.name}`
       const filePath = path.join(uploadDir, fileName)
       
       fs.writeFileSync(filePath, buffer)
       
       return NextResponse.json({
         success: true,
         fileUrl: `/api/files/beats/${fileName}`,
       })
     } catch (error: any) {
       console.error('Upload error:', error)
       return NextResponse.json(
         { error: 'Failed to upload file', details: error.message },
         { status: 500 }
       )
     }
   }
   ```

**Files to Check:**
- `app/api/beats/upload-pack/route.ts` - Beat pack uploads
- `app/api/beats/files/upload/route.ts` - Additional file uploads
- `app/api/upload-file/route.ts` - General file uploads
- `data/uploads/` - Upload directories

---

## API Route Errors

### Error: 500 Internal Server Error

**Symptoms:**
- API routes returning 500 errors
- "Internal server error" messages
- Routes not responding
- Errors in server console

**Root Causes:**
1. Missing error handling (try-catch)
2. File system operations failing
3. Invalid request data
4. Missing environment variables
5. Database/storage errors
6. Unhandled promise rejections

**Complete Fix Template:**

```typescript
export async function POST(request: NextRequest) {
  try {
    // 1. Validate request
    const body = await request.json()
    if (!body.requiredField) {
      return NextResponse.json(
        { error: 'requiredField is required' },
        { status: 400 }
      )
    }
    
    // 2. Validate data
    if (typeof body.value !== 'string') {
      return NextResponse.json(
        { error: 'Invalid data type' },
        { status: 400 }
      )
    }
    
    // 3. Perform operation with error handling
    try {
      const result = await someOperation(body)
      return NextResponse.json({ success: true, result })
    } catch (operationError: any) {
      console.error('Operation error:', operationError)
      return NextResponse.json(
        { error: 'Operation failed', details: operationError.message },
        { status: 500 }
      )
    }
  } catch (error: any) {
    // 4. Catch all errors
    console.error('API route error:', error)
    console.error('Error stack:', error.stack)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
```

**Common Patterns:**

1. **File operations:**
   ```typescript
   try {
     const filePath = path.join(DATA_DIR, 'file.json')
     if (!fs.existsSync(filePath)) {
       return NextResponse.json({ error: 'File not found' }, { status: 404 })
     }
     const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
     // ... process data
   } catch (error: any) {
     console.error('File operation error:', error)
     return NextResponse.json(
       { error: 'Failed to read file', details: error.message },
       { status: 500 }
     )
   }
   ```

2. **Database operations:**
   ```typescript
   try {
     const catalog = getCatalog()
     const item = catalog.find(i => i.id === id)
     if (!item) {
       return NextResponse.json({ error: 'Item not found' }, { status: 404 })
     }
     // ... process item
   } catch (error: any) {
     console.error('Database operation error:', error)
     return NextResponse.json(
       { error: 'Database error', details: error.message },
       { status: 500 }
     )
   }
   ```

**Files to Check:**
- All files in `app/api/` directory
- Look for missing try-catch blocks
- Check error handling patterns

---

## Authentication & Authorization Errors

### Error: Unauthorized access

**Symptoms:**
- Users can't access certain pages
- API routes returning 403 errors
- Role-based access not working

**Root Causes:**
1. Missing authentication check
2. Incorrect role validation
3. Session not persisting
4. Token expired or invalid

**Fix Pattern:**

```typescript
// In API route
export async function POST(request: NextRequest) {
  // Get user from session/cookie
  const user = await getUserFromRequest(request)
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Check role
  if (user.role !== 'admin' && user.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  // Continue with operation
}
```

---

## UI & Rendering Errors

### Error: Component not rendering

**Symptoms:**
- Blank pages
- Components not showing
- Hydration errors
- Styling issues

**Root Causes:**
1. Missing 'use client' directive
2. Server/client component mismatch
3. Invalid JSX
4. Missing imports
5. CSS/styling issues

**Fix Pattern:**

```typescript
// Always check:
// 1. Is component marked as 'use client'?
'use client'

// 2. Are all imports correct?
import { useState, useEffect } from 'react'

// 3. Is JSX valid?
export default function Component() {
  return <div>Content</div> // Valid JSX
}
```

---

## Performance & Optimization Issues

### Error: Slow page loads

**Symptoms:**
- Pages taking too long to load
- Timeout errors
- High memory usage

**Root Causes:**
1. Large data files
2. Inefficient queries
3. Missing pagination
4. Too many re-renders
5. Large bundle size

**Fix Patterns:**

1. **Add pagination:**
   ```typescript
   const page = parseInt(searchParams.get('page') || '1')
   const limit = 20
   const start = (page - 1) * limit
   const items = catalog.slice(start, start + limit)
   ```

2. **Use memoization:**
   ```typescript
   const memoizedValue = useMemo(() => {
     return expensiveCalculation(data)
   }, [data])
   ```

3. **Lazy load components:**
   ```typescript
   const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
     loading: () => <div>Loading...</div>
   })
   ```

---

## Database & Storage Issues

### Error: Data not persisting

**Symptoms:**
- Changes not saving
- Data lost on refresh
- File writes failing

**Root Causes:**
1. File write permissions
2. Concurrent writes
3. Invalid JSON
4. Disk space full

**Fix Pattern:**

```typescript
// Always validate before writing
function saveData(data: any) {
  try {
    // Validate data
    if (!Array.isArray(data)) {
      throw new Error('Data must be an array')
    }
    
    // Write atomically
    const tempPath = filePath + '.tmp'
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2))
    fs.renameSync(tempPath, filePath)
    
    return true
  } catch (error) {
    console.error('Save error:', error)
    return false
  }
}
```

---

## Network & API Communication Errors

### Error: Failed to fetch

**Symptoms:**
- API calls failing
- Network errors
- CORS issues
- Timeout errors

**Root Causes:**
1. Server not running
2. Wrong URL
3. CORS configuration
4. Network issues
5. Timeout too short

**Fix Pattern:**

```typescript
// Add timeout and error handling
try {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout
  
  const response = await fetch(url, {
    signal: controller.signal,
    // ... other options
  })
  
  clearTimeout(timeoutId)
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  
  return await response.json()
} catch (error: any) {
  if (error.name === 'AbortError') {
    throw new Error('Request timeout')
  }
  throw error
}
```

---

## Quick Reference: Common Fixes

### Add 'use client' directive
```typescript
'use client' // First line, no blank lines
```

### Fix catalog update
```typescript
// Verify item exists
const item = catalog.find(i => i.id === id)
if (!item) return false

// Update with validation
catalog[index] = { ...catalog[index], ...updates }
fs.writeFileSync(filePath, JSON.stringify(catalog, null, 2))
```

### Fix CSV duplicates
```typescript
// Match by song name first (for collaborations)
let existing = catalog.find(item => 
  normalize(item.song) === normalizedSong
)
```

### Fix file upload
```typescript
// Ensure directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}
```

### Fix API errors
```typescript
try {
  // Operation
} catch (error: any) {
  console.error('Error:', error)
  return NextResponse.json(
    { error: 'Operation failed', details: error.message },
    { status: 500 }
  )
}
```

---

## Debugging Commands Reference

```bash
# Check catalog file
node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('data/catalog.json')); console.log('Items:', data.length);"

# Validate JSON
node -e "JSON.parse(require('fs').readFileSync('data/catalog.json'))"

# Check file permissions
ls -la data/

# Check disk space
df -h

# Find item by ID
node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('data/catalog.json')); const item=data.find(i=>i.id==='ID_HERE'); console.log(JSON.stringify(item, null, 2));"

# Check for items without IDs
node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('data/catalog.json')); const bad=data.filter(i=>!i||!i.id); console.log('Items without ID:', bad.length);"
```

---

## File Structure Reference

```
lfr-dashboard/
├── app/
│   ├── api/              # API routes
│   │   ├── catalog/      # Catalog endpoints
│   │   ├── beats/        # Beat catalog endpoints
│   │   └── upload-csv/   # CSV upload endpoint
│   ├── dashboard/        # Dashboard pages
│   └── layout.tsx        # Root layout
├── components/           # React components
├── lib/
│   ├── storage.ts        # Data storage functions
│   └── utils.ts          # Utility functions
├── data/                 # Data files
│   ├── catalog.json      # Song catalog
│   ├── users.json        # User accounts
│   └── uploads/          # Uploaded files
└── AI_TROUBLESHOOTING_GUIDE.md  # This file
```

---

## When User Reports an Error

1. **Ask for details:**
   - What were you doing when it happened?
   - What page/route were you on?
   - What's the exact error message?
   - Can you share server console logs?

2. **Identify error type:**
   - Match error message to patterns in this guide
   - Check error stack trace for file names
   - Determine if it's React, API, File System, etc.

3. **Apply fix:**
   - Follow the detailed fix process for that error type
   - Make changes to appropriate files
   - Add error handling if missing

4. **Test fix:**
   - Verify the error is resolved
   - Check related functionality still works
   - Ensure no new errors introduced

5. **Explain to user:**
   - What the error was
   - What caused it
   - What you fixed
   - How to verify it's fixed
   - How to prevent it in the future

---

## Prevention Checklist

- [ ] All components using hooks have `'use client'`
- [ ] All API routes have try-catch blocks
- [ ] All file operations check if files exist
- [ ] All JSON parsing is wrapped in try-catch
- [ ] All user inputs are validated
- [ ] Error messages are descriptive
- [ ] Logs include context (file, function, error details)
- [ ] File permissions are correct
- [ ] Directories are created if they don't exist
- [ ] Data is validated before saving

---

This guide should be your primary reference when troubleshooting any errors in the Legendary Fyre Records Dashboard. Always refer back to the specific section for the error type you're encountering.
