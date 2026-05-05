# Release Readiness Engine

This document describes the momentum calculation and readiness engine system.

## Overview

The Release Readiness Engine automatically determines an artist's readiness state (`cooling`, `building`, or `ready`) based on:
1. **Momentum Calculation**: Compares baseline (30-60 day average) vs recent window (7 day average)
2. **Lane-Based Weighting**: Applies different thresholds and weightings based on artist career stage
3. **State Resolution**: Maps momentum signals to readiness states

## Momentum Calculation (Task 5)

### Baseline Calculation (Task 5.1)

For each artist, the system calculates:
- **Rolling Baseline**: Average metric score over 30-60 days (default: 45 days)
- **Recent Window**: Average metric score over the last 7 days

The metric score is calculated using weighted engagement:
```
score = (views × 0.3) + (saves × 0.3) + (shares × 0.2) + (comments × 0.2)
```

### Momentum Direction (Task 5.2)

The system compares recent window vs baseline to determine momentum:

- **Rising**: Recent > Baseline × 1.1 (10%+ increase)
- **Falling**: Recent < Baseline × 0.9 (10%+ decrease)  
- **Steady**: Otherwise (within ±10%)

The momentum is calculated on-demand and can be stored temporarily or recomputed as needed.

## Readiness Engine (Task 6)

### Lane-Based Weighting (Task 6.1)

Artists are assigned to lanes based on career stage:

- **Emerging**: Early-stage artists (threshold: 15% change needed)
- **Developing**: Growing artists (threshold: 12% change needed)
- **Established**: Established artists (threshold: 10% change needed)
- **Elite**: Top-tier artists (threshold: 8% change needed)

Each lane has different weightings for Instagram metrics:

| Lane | Views | Saves | Shares | Comments | Completion | Followers | Threshold |
|------|-------|-------|--------|----------|------------|-----------|-----------|
| Emerging | 0.2 | 0.3 | 0.25 | 0.25 | 0.1 | 0.1 | 15% |
| Developing | 0.25 | 0.3 | 0.2 | 0.25 | 0.15 | 0.15 | 12% |
| Established | 0.3 | 0.25 | 0.2 | 0.15 | 0.2 | 0.2 | 10% |
| Elite | 0.35 | 0.2 | 0.15 | 0.1 | 0.25 | 0.25 | 8% |

### State Resolution (Task 6.2)

The engine maps momentum signals to readiness states:

```
if momentum === 'rising' → state = 'ready'
if momentum === 'steady' → state = 'building' (or 'ready' if weighted score > 0.7)
if momentum === 'falling' → state = 'cooling'
```

The result is persisted to the `release_readiness` table.

## API Endpoints

### Calculate Readiness State

**GET** `/api/release-readiness/calculate?artistId=xxx` (optional)

Calculates and persists readiness state for all artists (or specific artist if `artistId` provided).

**Response:**
```json
{
  "success": true,
  "summary": {
    "total": 10,
    "successful": 8,
    "skipped": 2,
    "errors": 0
  },
  "results": [
    {
      "artistId": "user_123",
      "artistName": "Artist Name",
      "status": "success",
      "state": "ready",
      "momentum": "rising",
      "lane": "established",
      "momentumData": {
        "direction": "rising",
        "baseline": 1250.5,
        "recent": 1450.2,
        "changePercent": 15.9,
        "confidence": 1.0
      },
      "weightedScore": 0.75
    }
  ]
}
```

### Get Readiness with Calculation

**GET** `/api/release-readiness?artistId=xxx&recalculate=true`

Fetches readiness data and optionally recalculates state. Returns both stored state and calculated state.

**Response:**
```json
{
  "success": true,
  "data": {
    "readiness": {
      "id": "rr_123",
      "artistId": "user_123",
      "state": "ready",
      "lastUpdated": "2025-01-29T12:00:00.000Z"
    },
    "calculated": {
      "calculatedState": "ready",
      "momentum": "rising",
      "momentumData": {
        "direction": "rising",
        "baseline": 1250.5,
        "recent": 1450.2,
        "changePercent": 15.9,
        "confidence": 1.0
      },
      "lane": "established",
      "weightedScore": 0.75
    }
  }
}
```

## Automatic Calculation

The readiness state is automatically recalculated:
1. **After Instagram metrics fetch**: When daily metrics are fetched, readiness is recalculated
2. **On-demand**: Via the `/api/release-readiness/calculate` endpoint
3. **When viewing**: The GET endpoint can recalculate if `recalculate=true` is passed

## Setting Artist Lane

To set an artist's lane, update the user profile:

```typescript
updateUser(artistId, {
  lane: 'established' // or 'emerging', 'developing', 'elite'
})
```

If not set, defaults to `'developing'`.

## Data Flow

1. **Daily Instagram Metrics Fetch** → Stores metrics in `instagram_metrics` table
2. **Automatic Readiness Calculation** → Calculates momentum and state
3. **State Persistence** → Updates `release_readiness` table
4. **Display** → Release readiness page shows current state

## Configuration

### Adjusting Thresholds

Edit `lib/readinessEngine.ts` to modify:
- Lane weightings
- Momentum thresholds per lane
- State resolution logic

### Adjusting Baseline Period

Edit `lib/momentum.ts` to modify:
- Baseline calculation period (default: 45 days)
- Recent window period (default: 7 days)
- Momentum threshold percentage (default: 10%)

## Example Calculation

For an established artist with:
- Baseline (45-day avg): 1,000 metric score
- Recent (7-day avg): 1,150 metric score
- Change: +15%

**Result:**
- Momentum: `rising` (15% > 10% threshold)
- State: `ready` (rising momentum → ready state)
- Persisted to `release_readiness` table
