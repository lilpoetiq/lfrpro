# Error Handling & Post-Release Evaluation

## Overview

This document describes the error handling improvements and post-release evaluation system implemented for the release readiness module.

## Task 9.3 - Snapshot Persistence ✅

### Enhanced Snapshot Storage

Snapshots are now properly persisted with:
- **Artist ID**: Links snapshot to artist
- **Release ID**: Optional link to specific release
- **Low Confidence Flag**: Automatically flagged if OCR confidence < 70%
- **Processing Error**: Stores errors for admin review
- **Metadata**: Week start, streams, listeners, save rate, playlist adds, top cities

### Storage Location

- **File**: `data/spotifySnapshots.json`
- **Interface**: `SpotifySnapshot` in `lib/storage.ts`
- **Functions**: `getSpotifySnapshots()`, `addSpotifySnapshot()`

## Task 10.1 - Post-Release Evaluation ✅

### System Overview

The post-release evaluation system compares:
1. **Readiness state at release time** (cooling/building/ready)
2. **Actual Spotify performance** (from snapshots)
3. **Correlation analysis** (how well readiness predicted outcomes)

### Features

**Evaluation Data Captured:**
- Readiness state at release (state, momentum, weighted score)
- Spotify outcomes (week 1/2/4 streams, listeners, save rate, playlist adds)
- Performance rating (exceeded/met/below/significantly_below)
- Key findings and recommendations
- Correlation notes (how readiness correlated with performance)

**Internal Notes (Admin Only):**
- Performance rating based on readiness state vs actual results
- Key findings explaining performance
- Recommendations for future releases
- Correlation analysis

### API Endpoint

**POST** `/api/post-release-evaluation`

**Request:**
```json
{
  "releaseId": "release_123",
  "artistId": "user_456",
  "releaseDate": "2025-01-15",
  "evaluatedBy": "admin_user_id" // optional
}
```

**Response:**
```json
{
  "success": true,
  "evaluation": {
    "id": "eval_...",
    "releaseId": "release_123",
    "artistId": "user_456",
    "readinessAtRelease": {
      "state": "ready",
      "momentum": "rising",
      "weightedScore": 0.85
    },
    "spotifyOutcomes": {
      "week1Streams": 12500,
      "week1Listeners": 3500,
      "week1SaveRate": 0.15,
      "week1PlaylistAdds": 45
    },
    "internalNotes": {
      "performanceRating": "exceeded",
      "keyFindings": ["Release exceeded expectations..."],
      "recommendations": ["Continue using readiness system..."],
      "correlationNotes": "Readiness state accurately predicted..."
    }
  }
}
```

**GET** `/api/post-release-evaluation?releaseId=xxx&artistId=xxx`

Returns all evaluations matching the criteria.

### Storage

- **File**: `data/postReleaseEvaluations.json`
- **Interface**: `PostReleaseEvaluation` in `lib/storage.ts`
- **Functions**: `getPostReleaseEvaluations()`, `addPostReleaseEvaluation()`, `updatePostReleaseEvaluation()`

### Correlation Logic

The system automatically generates correlation notes:

- **Ready state + High performance**: "Readiness state accurately predicted strong performance"
- **Ready state + Low performance**: "Readiness suggested strong performance, but results were below expectations"
- **Building state + High performance**: "Performance exceeded expectations for building state"
- **Cooling state + High performance**: "Strong promotion overcame lower readiness metrics"

## Task 11 - Error Handling & Safety ✅

### Invalid Screenshot Handling

**Validation Checks:**
1. **File Type**: Only PNG/JPG allowed
   - Error code: `INVALID_FILE_TYPE`
   - Returns detailed error message

2. **File Size**: Max 10MB
   - Error code: `FILE_TOO_LARGE`
   - Returns actual size vs max size

3. **File Integrity**: Basic corruption check
   - Error code: `INVALID_FILE`
   - Checks minimum file size (100 bytes)

**Error Response Format:**
```json
{
  "error": "Invalid file type",
  "details": "Only PNG and JPG images are allowed",
  "code": "INVALID_FILE_TYPE"
}
```

### Low Confidence OCR Flagging

**Automatic Flagging:**
- Confidence < 70% → `lowConfidenceFlag: true`
- Warning included in API response
- Admin can review flagged snapshots

**Response Warning:**
```json
{
  "success": true,
  "warnings": ["Low confidence OCR detected. Please verify extracted data."]
}
```

### API Retry Logic

**Retry Strategy:**
- Max 3 retry attempts
- Exponential backoff (1s, 2s, 3s delays)
- Retries on API failures (network, rate limits, server errors)

**Error Handling:**
- **401 Unauthorized**: "OpenAI API authentication failed"
- **429 Rate Limit**: "Rate limit exceeded. Please try again later"
- **500+ Server Errors**: "OpenAI API server error"
- **Other Errors**: Detailed error message from API

**Fallback Behavior:**
- If all retries fail, snapshot is still saved with:
  - `processingError` field populated
  - `lowConfidenceFlag: true`
  - `rawImageUrl` preserved for manual review

### Default Readiness State

**Handling Missing Data:**
- If no Instagram metrics available → Default to `'building'` state
- Prevents errors when accessing readiness data
- Ensures UI always has a valid state to display

**Implementation:**
```typescript
if (!instagramMetrics || instagramMetrics.length === 0) {
  const existingReadiness = getReleaseReadinessByArtistId(artistId)
  if (!existingReadiness) {
    upsertReleaseReadiness({
      artistId: artistId,
      state: 'building', // Default state
    })
  }
}
```

### Error Notification

**Admin Notifications:**
- Low confidence snapshots flagged for review
- Processing errors stored in snapshot record
- Failed uploads still preserve file URL for manual processing

**User Feedback:**
- Clear error messages with error codes
- Actionable error details (file size, type, etc.)
- Warnings for low confidence data

## Error Codes Reference

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `INVALID_FILE_TYPE` | File is not PNG or JPG | 400 |
| `FILE_TOO_LARGE` | File exceeds 10MB limit | 400 |
| `INVALID_FILE` | File appears corrupted | 400 |
| `NO_SNAPSHOTS` | No snapshots available for evaluation | 400 |
| `RELEASE_NOT_FOUND` | Release ID not found in catalog | 404 |

## Best Practices

1. **Always check `lowConfidenceFlag`** before using snapshot data
2. **Review `processingError`** field for failed OCR attempts
3. **Use retry logic** for transient API failures
4. **Default to 'building'** when readiness data is unavailable
5. **Store file URLs** even on processing failure for manual review

## Future Enhancements

- Historical readiness state snapshots at release time
- Automatic evaluation triggers (e.g., 7 days after release)
- Batch evaluation processing
- Evaluation dashboard for admins
- Performance trend analysis across multiple releases
