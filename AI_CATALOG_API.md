# Message AI Server - Full Catalog API Access

This document provides comprehensive API documentation for the Message AI server to interact with the LFR Dashboard catalog system.

## Authentication

All API requests to `/api/ai-actions` require authentication via API key:

```
Headers:
  x-ai-api-key: lfr-ai-secret-key-change-in-production
  Content-Type: application/json
```

## Base URL

```
http://localhost:3000/api/ai-actions
```

## Endpoints

### 1. Update Catalog Item

Update any field of an existing catalog item (song, album, EP).

**Endpoint:** `POST /api/ai-actions`

**Request Body:**
```json
{
  "action": "update_catalog",
  "songId": "catalog_1234567890_abc123",
  "updates": {
    "song": "New Song Name",
    "artist": "Artist Name",
    "releaseDate": "2026-02-15T00:00:00.000Z",
    "albumCover": "/api/files/album-covers/filename.jpg",
    "releaseType": "single",
    "totalStreams": 1000,
    "distributor": "Distributor Name",
    "upc": "123456789012",
    "isrc": "USRC176012345",
    "releaseApprovalStatus": "approved",
    "releaseApprovalNotes": "Approved for release",
    "isDelayed": false,
    "delayReason": null,
    "isUnreleased": false,
    "googleDriveUrl": "https://drive.google.com/file/...",
    "fileUrl": "/api/files/...",
    "promoNotes": "Promotional notes here",
    "artistId": "user_123",
    "artistIds": ["user_123", "user_456"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Catalog item updated: \"Song Name\""
}
```

**Available Fields:**
- `song` (string) - Song/track name
- `artist` (string) - Artist name (can be "Artist1 & Artist2" for collaborations)
- `artistId` (string) - Primary artist user ID
- `artistIds` (string[]) - Array of artist user IDs for collaborations
- `releaseType` ("single" | "ep" | "album") - Type of release
- `releaseDate` (string) - ISO 8601 date string (e.g., "2026-02-15T00:00:00.000Z")
- `releaseDateRequested` (string) - Original requested release date
- `releaseApprovalStatus` ("pending" | "approved" | "denied") - Approval status
- `releaseApprovalNotes` (string) - Notes about approval/denial
- `albumCover` (string) - URL path to album cover (e.g., "/api/files/album-covers/filename.jpg")
- `totalStreams` (number) - Total streaming count
- `distributor` (string) - Distributor name
- `upc` (string) - UPC code
- `isrc` (string) - ISRC code
- `isDelayed` (boolean) - Whether release is delayed
- `delayReason` (string) - Reason for delay
- `isUnreleased` (boolean) - Whether song is unreleased
- `googleDriveUrl` (string) - Google Drive link
- `fileUrl` (string) - Local file URL
- `promoNotes` (string) - Promotional notes

**Example - Update Album Cover:**
```json
{
  "action": "update_catalog",
  "songId": "catalog_123",
  "updates": {
    "albumCover": "/api/files/album-covers/my_album_cover.jpg"
  }
}
```

**Example - Update Release Date:**
```json
{
  "action": "update_catalog",
  "songId": "catalog_123",
  "updates": {
    "releaseDate": "2026-03-01T00:00:00.000Z"
  }
}
```

**Example - Update Artist Name:**
```json
{
  "action": "update_catalog",
  "songId": "catalog_123",
  "updates": {
    "artist": "New Artist Name"
  }
}
```

---

### 2. Add Catalog Item

Add a new song/album/EP to the catalog.

**Request Body:**
```json
{
  "action": "add_catalog_item",
  "song": "Song Name",
  "artist": "Artist Name",
  "artistId": "user_123",
  "artistIds": ["user_123"],
  "releaseType": "single",
  "releaseDate": "2026-02-15T00:00:00.000Z",
  "albumCover": "/api/files/album-covers/filename.jpg",
  "distributor": "Distributor Name",
  "upc": "123456789012",
  "isrc": "USRC176012345",
  "totalStreams": 0,
  "fileUrl": "/api/files/...",
  "googleDriveUrl": "https://drive.google.com/...",
  "promoNotes": "Promotional notes"
}
```

**Required Fields:**
- `song` (string)
- `artist` (string)

**Response:**
```json
{
  "success": true,
  "message": "Added \"Song Name\" by Artist Name to catalog",
  "item": {
    "id": "catalog_1234567890_abc123",
    "song": "Song Name",
    "artist": "Artist Name",
    ...
  }
}
```

---

### 3. Create Release

Create a new release with validation (checks for duplicates, validates release date).

**Request Body:**
```json
{
  "action": "create_release",
  "song": "Song Name",
  "artist": "Artist Name",
  "artistId": "user_123",
  "artistIds": ["user_123"],
  "releaseType": "single",
  "releaseDate": "2026-02-15T00:00:00.000Z",
  "albumCover": "/api/files/album-covers/filename.jpg",
  "distributor": "Distributor Name",
  "upc": "123456789012",
  "isrc": "USRC176012345",
  "fileUrl": "/api/files/...",
  "googleDriveUrl": "https://drive.google.com/...",
  "notes": "Release notes"
}
```

**Required Fields:**
- `song` (string)
- `artist` (string)

**Validation:**
- Release date must be at least 3 days in the future
- Checks for duplicate songs (same song name + artist name)

**Response:**
```json
{
  "success": true,
  "message": "Release created: \"Song Name\" by Artist Name",
  "item": {
    "id": "catalog_1234567890_abc123",
    ...
  }
}
```

---

### 4. Approve Release

Approve a pending release request.

**Request Body:**
```json
{
  "action": "approve_release",
  "songId": "catalog_123",
  "approvedDate": "2026-02-15T00:00:00.000Z",
  "notes": "Approved for release"
}
```

**Required Fields:**
- `songId` (string)

**Validation:**
- Release date must be at least 3 days in the future
- Song must exist in catalog

**Response:**
```json
{
  "success": true,
  "message": "Release approved for \"Song Name\" by Artist Name",
  "releaseDate": "2026-02-15T00:00:00.000Z"
}
```

---

### 5. Deny Release

Deny a pending release request.

**Request Body:**
```json
{
  "action": "deny_release",
  "songId": "catalog_123",
  "reason": "Reason for denial"
}
```

**Required Fields:**
- `songId` (string)
- `reason` (string) - Must not be empty

**Response:**
```json
{
  "success": true,
  "message": "Release denied for \"Song Name\" by Artist Name",
  "reason": "Reason for denial"
}
```

---

### 6. Delete Catalog Item

Delete a catalog item.

**Request Body:**
```json
{
  "action": "delete_catalog_item",
  "songId": "catalog_123"
}
```

**Required Fields:**
- `songId` (string)

**Response:**
```json
{
  "success": true,
  "message": "Deleted \"Song Name\" by Artist Name from catalog"
}
```

---

### 7. Find Song

Find songs by name, artist, or ID. Useful for getting the `songId` before updating.

**Request Body:**
```json
{
  "action": "find_song",
  "songName": "Song Name",
  "artistName": "Artist Name"
}
```

**OR:**
```json
{
  "action": "find_song",
  "songId": "catalog_123"
}
```

**Required Fields:**
- At least one of: `songName`, `artistName`, or `songId`

**Response:**
```json
{
  "success": true,
  "matches": 1,
  "songs": [
    {
      "id": "catalog_123",
      "song": "Song Name",
      "artist": "Artist Name",
      ...
    }
  ]
}
```

**Example - Find by name:**
```json
{
  "action": "find_song",
  "songName": "My Song"
}
```

**Example - Find by artist:**
```json
{
  "action": "find_song",
  "artistName": "Artist Name"
}
```

**Example - Find exact match:**
```json
{
  "action": "find_song",
  "songName": "My Song",
  "artistName": "Artist Name"
}
```

---

### 7. Find Song

Find songs by name, artist, or ID. Useful for getting the `songId` before updating.

**Request Body:**
```json
{
  "action": "find_song",
  "songName": "Song Name",
  "artistName": "Artist Name"
}
```

**OR:**
```json
{
  "action": "find_song",
  "songId": "catalog_123"
}
```

**Required Fields:**
- At least one of: `songName`, `artistName`, or `songId`

**Response:**
```json
{
  "success": true,
  "matches": 1,
  "songs": [
    {
      "id": "catalog_123",
      "song": "Song Name",
      "artist": "Artist Name",
      ...
    }
  ]
}
```

**Example - Find by name:**
```json
{
  "action": "find_song",
  "songName": "My Song"
}
```

**Example - Find by artist:**
```json
{
  "action": "find_song",
  "artistName": "Artist Name"
}
```

**Example - Find exact match:**
```json
{
  "action": "find_song",
  "songName": "My Song",
  "artistName": "Artist Name"
}
```

---

## Reading Catalog Data

To read catalog data, use the standard catalog API:

**Endpoint:** `GET /api/catalog`

**Response:**
```json
{
  "success": true,
  "catalog": [
    {
      "id": "catalog_123",
      "song": "Song Name",
      "artist": "Artist Name",
      "releaseType": "single",
      "releaseDate": "2026-02-15T00:00:00.000Z",
      "albumCover": "/api/files/album-covers/filename.jpg",
      "totalStreams": 1000,
      ...
    },
    ...
  ]
}
```

**Query Parameters:**
- `userId` (optional) - Filter catalog for specific user
- `autoLink` (optional) - Auto-link artists to user accounts

**Example:**
```
GET /api/catalog?autoLink=true
```

---

## Finding Songs

Before updating a song, you need to find its `songId`. Use the catalog API:

1. **Get all catalog items:**
   ```
   GET /api/catalog
   ```

2. **Search for song by name/artist:**
   ```javascript
   const catalog = await fetch('/api/catalog').then(r => r.json())
   const song = catalog.catalog.find(item => 
     item.song.toLowerCase() === "song name".toLowerCase() &&
     item.artist.toLowerCase() === "artist name".toLowerCase()
   )
   const songId = song.id
   ```

---

## Album Cover URLs

Album covers can be set using URL paths. The system stores covers in `/data/uploads/album-covers/` and serves them via `/api/files/album-covers/`.

**Format:**
```
/api/files/album-covers/filename.jpg
```

**Example:**
```json
{
  "action": "update_catalog",
  "songId": "catalog_123",
  "updates": {
    "albumCover": "/api/files/album-covers/my_album_cover_1234567890_abc123.jpg"
  }
}
```

---

## Date Formats

All dates must be in ISO 8601 format:

**Format:** `YYYY-MM-DDTHH:mm:ss.sssZ`

**Examples:**
- `"2026-02-15T00:00:00.000Z"` - February 15, 2026 at midnight UTC
- `"2026-03-01T12:00:00.000Z"` - March 1, 2026 at noon UTC

**JavaScript:**
```javascript
const releaseDate = new Date('2026-02-15').toISOString()
// Returns: "2026-02-15T00:00:00.000Z"
```

**Validation:**
- Release dates for approvals must be at least 3 days in the future
- Dates are validated server-side

---

## Artist Names and IDs

**Artist Names:**
- Use display names (e.g., "Od Sleep" instead of "Loyce Weaver")
- For collaborations, use "Artist1 & Artist2"
- The system will auto-link artist names to user accounts

**Artist IDs:**
- `artistId` - Primary artist user ID (backwards compatibility)
- `artistIds` - Array of artist user IDs (preferred for collaborations)
- When updating artist name, the system will auto-link if `artistIds` is not provided

**Example:**
```json
{
  "action": "update_catalog",
  "songId": "catalog_123",
  "updates": {
    "artist": "Od Sleep & Another Artist",
    "artistIds": ["user_123", "user_456"]
  }
}
```

---

## Error Handling

All endpoints return standard error responses:

**Error Response:**
```json
{
  "error": "Error message here",
  "details": "Additional error details"
}
```

**Status Codes:**
- `200` - Success
- `400` - Bad Request (missing/invalid parameters)
- `401` - Unauthorized (invalid API key)
- `404` - Not Found (song/item not found)
- `500` - Internal Server Error

**Example Error:**
```json
{
  "error": "Song ID is required",
  "details": "songId parameter is missing"
}
```

---

## Complete Example Workflow

1. **Find a song:**
   ```javascript
   const response = await fetch('http://localhost:3000/api/catalog')
   const data = await response.json()
   const song = data.catalog.find(item => 
     item.song.toLowerCase().includes('song name')
   )
   ```

2. **Update the song:**
   ```javascript
   const updateResponse = await fetch('http://localhost:3000/api/ai-actions', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'x-ai-api-key': 'lfr-ai-secret-key-change-in-production'
     },
     body: JSON.stringify({
       action: 'update_catalog',
       songId: song.id,
       updates: {
         albumCover: '/api/files/album-covers/new_cover.jpg',
         releaseDate: '2026-03-01T00:00:00.000Z',
         artist: 'New Artist Name'
       }
     })
   })
   const result = await updateResponse.json()
   ```

---

## Notes

- All API requests must include the `x-ai-api-key` header
- Dates must be at least 3 days in the future for release approvals
- Album cover URLs should use the `/api/files/album-covers/` path format
- Artist names will be auto-linked to user accounts if `artistIds` is not provided
- The system validates all inputs and returns detailed error messages
- All changes are logged in the activity log
