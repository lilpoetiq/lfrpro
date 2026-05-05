# Explanation Generation & Spotify Screenshot Processing

## Overview

This document describes the explanation generation system and Spotify screenshot ingestion with AI vision processing.

## Explanation Generation (Task 7)

### Explanation Builder

The explanation builder (`lib/explanationBuilder.ts`) generates human-readable explanations based on:

1. **Momentum Direction**: Rising, steady, or falling
2. **Strongest Contributing Metrics**: Top 2 metrics driving performance
3. **Weakest Contributing Metrics**: Bottom 2 metrics needing attention

### How It Works

1. **Analyze Metric Contributions**: Compares recent metrics vs baseline to identify strongest/weakest contributors
2. **Generate Explanation Text**: Creates contextual explanation based on momentum and state
3. **Generate Action Steps**: Provides 3-5 actionable steps for the artist
4. **Admin Notes**: Provides detailed admin-focused insights for staff

### Explanation Structure

```typescript
{
  explanationText: string  // Human-readable explanation
  actionSteps: string[]    // 3-5 actionable steps for artist
  adminNotes: string       // Detailed admin insights
}
```

### Examples

**Rising Momentum:**
- Explanation: "Your Instagram metrics show strong positive momentum with a 15.9% increase..."
- Action Steps: Focus on maintaining momentum, increasing posting frequency
- Admin Notes: "Strong positive momentum. Optimal timing for release..."

**Falling Momentum:**
- Explanation: "Your Instagram metrics show declining momentum with a 12.3% decrease..."
- Action Steps: Analyze content performance, increase engagement, consider collaborations
- Admin Notes: "Artist experiencing decline. Recommend content strategy review..."

### Storage

Explanations are automatically generated and stored in `readiness_explanations` table when:
- Instagram metrics are fetched daily
- Readiness state is recalculated
- Manual calculation is triggered

## UI Data Hooks (Task 8)

### useReadinessData Hook

Created `hooks/useReadinessData.ts` - A React hook that:

- Fetches readiness state, explanation, and action steps
- Caches data per session (5-minute cache duration)
- Supports refetch on demand
- Handles loading and error states

### Usage

```typescript
import { useReadinessData } from '@/hooks/useReadinessData'

function MyComponent() {
  const { readiness, explanation, isLoading, error, refetch } = useReadinessData(artistId)
  
  // readiness: current state
  // explanation: latest explanation with action steps
  // isLoading: loading state
  // error: error message if any
  // refetch: function to manually refresh data
}
```

### Features

- **Session Caching**: Data cached for 5 minutes to reduce API calls
- **Automatic Refetch**: Refetches when artist ID changes
- **Error Handling**: Graceful error handling with error messages
- **Loading States**: Proper loading indicators

## Spotify Screenshot Ingestion (Task 9)

### File Upload (Task 9.1)

**Endpoint**: `POST /api/spotify-screenshot`

**Requirements**:
- Accepts PNG/JPG only
- Max file size: 10MB
- Stores images in `data/uploads/spotify-screenshots/`
- Returns file URL for access

**Request**:
```json
{
  "file": File (FormData),
  "artistId": "user_123",
  "releaseId": "release_456" // optional
}
```

**Response**:
```json
{
  "success": true,
  "fileUrl": "/api/files/spotify-screenshots/filename.jpg",
  "fileName": "filename.jpg",
  "processed": true,
  "data": {
    "weekStart": "2025-01-29",
    "streams": 12500,
    "listeners": 3500,
    "saveRate": 0.15,
    "playlistAdds": 45,
    "topCities": ["New York", "Los Angeles", "Chicago"],
    "confidence": 0.95,
    "timePeriod": "30",
    "growthTrend": "growing",
    "adminNotes": "Strong growth trend..."
  }
}
```

### AI Vision Processing (Task 9.2)

**Model**: GPT-4o (or GPT-4 Vision)

**Process**:
1. Upload image → Convert to base64
2. Send to OpenAI Vision API with detailed prompt
3. Extract structured data via OCR + context analysis
4. Normalize into `SpotifySnapshot` fields
5. Assign confidence score (0-1)

**Extracted Data**:
- Time period (7/14/30/60 days or all-time)
- Total streams
- Total listeners
- Save rate (percentage → decimal)
- Playlist adds
- Top cities (max 5)
- Growth trend (growing/falling/stable)
- Week start date

**Admin Notes Generation**:

The AI provides detailed admin-focused analysis:

- **For Falling Trends**: Explains decline causes, specific steps to stabilize metrics, release timing recommendations
- **For Growing Trends**: Explains what's working, how to maintain momentum, release acceleration opportunities
- **For Stable Trends**: Explains how to break through to growth, optimization strategies

**Example Admin Notes**:
```
"ADMIN NOTES: Artist showing 12% decline in 30-day streams. Primary concern: 
playlist adds have decreased significantly. Recommend immediate playlist 
pitching campaign, consider promotional playlist placements, review release 
timing. Consider delaying release if trend continues. Focus on playlist 
strategy and promotional partnerships."
```

### Understanding Time Periods

The AI is specifically instructed to:
- Identify the time period shown (7/14/30/60 days or all-time)
- Provide context-aware analysis based on the period
- Compare trends appropriately (e.g., 7-day vs previous 7-day, not vs 30-day)

### Growth/Falling Analysis

The system analyzes:
- **Chart trends**: Upward/downward/flat patterns
- **Metric comparisons**: Current vs previous periods
- **Context**: Time period awareness for accurate analysis

### Admin Recommendations

For both artist and admin:
- **Artist-facing**: Actionable steps they can take
- **Admin-facing**: Strategic recommendations, release timing, promotional opportunities

## Integration Points

### Automatic Explanation Generation

Explanations are automatically generated when:
1. Daily Instagram metrics are fetched
2. Readiness state is recalculated
3. Manual calculation is triggered via `/api/release-readiness/calculate`

### Spotify Snapshot Storage

After AI processing, snapshots are automatically saved to `spotify_snapshots` table with:
- All extracted metrics
- Confidence score
- Raw image URL
- Admin notes (for admin viewing)

## API Endpoints

### Upload Spotify Screenshot

**POST** `/api/spotify-screenshot`

Upload a screenshot and process with AI vision.

**FormData**:
- `file`: Image file (PNG/JPG)
- `artistId`: Artist user ID (required)
- `releaseId`: Release ID (optional)

### Get Readiness Data (with Hook)

The `useReadinessData` hook automatically calls:
**GET** `/api/release-readiness?artistId=xxx&type=all&recalculate=true`

Returns readiness state, explanation, and action steps.

## File Storage

Spotify screenshots are stored at:
- **Path**: `data/uploads/spotify-screenshots/`
- **URL**: `/api/files/spotify-screenshots/{filename}`
- **Naming**: `spotify_{artistId}_{timestamp}_{random}.{ext}`

## Error Handling

- **File Upload Errors**: Validates file type, size, and required fields
- **AI Processing Errors**: Returns error but doesn't fail upload (user can retry)
- **Missing Data**: Gracefully handles missing metrics or low confidence scores

## Future Enhancements

- Batch processing for multiple screenshots
- Historical trend analysis across multiple snapshots
- Automatic snapshot scheduling
- Integration with Spotify API for validation
