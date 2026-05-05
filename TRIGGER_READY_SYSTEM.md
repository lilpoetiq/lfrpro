# Trigger-Ready System Documentation

## Overview

The Trigger-Ready system matches artist readiness state with unreleased songs to identify optimal release timing. It flags songs when conditions align, providing evidence-based recommendations instead of arbitrary dates.

## System Flow

### Step 0: The Pipe (What's Connected)

✅ **Securely Connected:**
- Instagram (via Meta Graph API)
- Artist IG business accounts (read-only)

✅ **What We Do:**
- Read performance data only
- No posting, DMing, or content manipulation
- Zero risk, no funny business

### Step 1: Automatic Data Pulling

**Frequency:** Every few hours (or daily via cron)

**Per Artist:**
- Follower count
- Follower growth rate
- Avg engagement rate
- Last post time
- Posting frequency

**Per Post/Reel:**
- Views
- Likes
- Comments
- Saves
- Shares
- Watch time (huge)
- Completion rate (did people finish the reel?)

**Key Insight:** Watch time + saves matter more than likes.

### Step 2: Momentum Calculation

**Comparison:**
- Last 7 days vs Artist's normal baseline (30-60 days)

**Question:** "Is this artist moving different right now?"

**Example Logic:**
- Reel views ↑ 2x normal
- Saves ↑
- Comments coming faster
- Followers creeping up
= **momentum spike**

**Output:** 🔴 🟡 🟢 Momentum Status
- 🔴 Cold → audience asleep
- 🟡 Warm → attention building
- 🟢 Hot → attention peaking

### Step 3: Songs Pre-Tagged

Before any drop, songs are tagged with:

**Tags:**
- **Energy:** low / medium / high
- **Emotion:** pain, praise, flex, healing, celebration, reflection, motivation, other
- **Lane:** underground, regional, faith, creative, inspirational
- **Content Fit:** snippet-ready, visual-heavy, story-driven, viral-potential, deep-listening

**Storage:** `CatalogItem.readinessTags` or `CatalogItem.songs[].readinessTags`

### Step 4: Matching Moment to Music

**The Smart Part:**

System checks:
1. Artist momentum status (ready/building/cooling)
2. What type of content is working right now
3. What unreleased songs fit that vibe

**Example:**
- Artist momentum = 🟢 Ready
- Reels with emotional captions performing best
- Saves high
- A heartfelt song sitting in Standby

**System flags:** "This record matches current audience behavior."

**Not hype. Evidence-based timing.**

### Step 5: Release Flagged, Not Scheduled

**When conditions line up:**
- Song gets marked `triggerReady: true`
- Team gets notified internally
- Nothing drops automatically

**Key Principle:**
👉 The system never says WHEN.
It only says: **"If you drop now, odds are good."**

That's how you keep the illusion of randomness.

### Step 6: Silence Tracked

**Meta API tells us:**
- Engagement decay
- Drop-off speed
- Audience fatigue

**If artist posting too much:**
- Views fall
- Watch time drops

**System cools momentum automatically:**
"Pause. Don't drop yet."

**This stops:**
- Panic releases
- Overposting

### Step 7: Learning Loop

**After a drop:**
- Streaming data comes in later
- IG behavior is watched immediately

**System answers:**
- Did surprise drops perform better?
- Did this artist do better after silence?
- Did gospel perform better on weekends?
- Did underground hit harder late night?

**Over time:**
👉 Patterns show themselves
👉 Strategy sharpens
👉 No guessing

## Implementation Details

### Song Tagging

**Interface:**
```typescript
readinessTags?: {
  energy?: 'low' | 'medium' | 'high'
  emotion?: 'pain' | 'praise' | 'flex' | 'healing' | 'celebration' | 'reflection' | 'motivation' | 'other'
  lane?: 'underground' | 'regional' | 'faith' | 'creative' | 'inspirational'
  contentFit?: 'snippet-ready' | 'visual-heavy' | 'story-driven' | 'viral-potential' | 'deep-listening'
  triggerReady?: boolean
  triggerReadyAt?: string
  triggerReadyReason?: string
}
```

### Trigger-Ready Matching

**Scoring System:**
- Readiness State Match: +40 (ready), +20 (building), +5 (cooling)
- Lane Match: +15
- Content Fit Match: +10-25 (depending on what's working)
- Emotion Match: +15 (if emotional content working)
- Energy Match: +5-10 (based on momentum)

**Match Score Thresholds:**
- 60+ with Ready state → `release_now`
- 40+ with Building state → `build_momentum_first`
- Below 40 → `wait_for_better_timing`

### API Endpoints

**GET** `/api/trigger-ready?artistId=xxx`
- Find songs matching current readiness conditions
- Returns matches with scores and recommendations

**POST** `/api/trigger-ready/flag`
- Flag songs as trigger-ready (internal use)

**GET** `/api/notifications/trigger-ready`
- Get all trigger-ready notifications
- Filter by artist, acknowledged status

**POST** `/api/notifications/trigger-ready/check`
- Check for new trigger-ready songs
- Create notifications for high-scoring matches

**PATCH** `/api/notifications/trigger-ready/:id`
- Acknowledge a notification

### Per-Post Tracking

**GET** `/api/instagram/posts?artistId=xxx`
- Fetch individual post/reel metrics
- Returns detailed insights per post
- Calculates engagement rates

**Note:** Meta API requires fetching posts individually, which may have rate limits.

### Engagement Decay Detection

**Function:** `detectEngagementDecay()`

**Checks:**
- Recent 3 posts vs Previous 3 posts
- Views drop > 15% → Decaying
- Engagement drop > 20% → Decaying

**Recommendation:**
"Pause. Don't drop yet. Engagement is decaying - audience may be experiencing fatigue."

## Notification System

### Notification Format

**Full Message:**
```
🟩 Artist Name - "Song Name" is Trigger-Ready (85% match). Ready to release now.
```

**Short Message (SMS/Quick Alert):**
```
🟩 Artist Name hot. "Song Name" ready.
```

### Notification States

- **Unacknowledged:** New, needs attention
- **Acknowledged:** Team has reviewed
- **Auto-created:** When match score ≥ 60 and state = ready

## What This Means

**For Artists:**
- Releases feel organic
- Fans feel like music just appears
- Artists don't feel rushed

**For Label:**
- Move off timing, not habit
- Behind the scenes = disciplined
- Public-facing = spontaneous

**That's how real labels move.**

## Future Enhancements

- Historical pattern analysis
- Day-of-week optimization
- Time-of-day optimization
- Cross-artist pattern recognition
- Automated SMS/email alerts
- Integration with release scheduling
