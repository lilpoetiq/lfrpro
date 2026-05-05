# Instagram (Meta API) Integration

This document describes how to set up and use the Instagram metrics integration.

## Overview

The Instagram integration allows you to:
- Connect Instagram Business Accounts to artists
- Automatically fetch daily Instagram metrics (views, saves, shares, comments, completion rate, followers)
- Store metrics in time-series format (one row per artist per day)

## Prerequisites

1. **Meta Developer Account**: Create an app at https://developers.facebook.com/
2. **Instagram Business Account**: The artist's Instagram account must be converted to a Business Account
3. **Facebook Page**: The Instagram Business Account must be connected to a Facebook Page
4. **Access Token**: Generate a long-lived access token with the following permissions:
   - `instagram_basic`
   - `instagram_manage_insights`
   - `pages_read_engagement`

## Setup

### 1. Meta App Credentials

Your Meta App credentials are already configured:
- **App ID**: `1400742961531959`
- **App Secret**: `3f2dde1e39d30d1dcff3652939b5413e`

These are stored in `.env.local` as `META_APP_ID` and `META_APP_SECRET`.

### 2. Create Meta App (if needed)

1. Go to https://developers.facebook.com/apps/
2. Click "Create App"
3. Select "Business" as the app type
4. Fill in app details

### 2. Add Instagram Basic Display & Graph API

1. In your app dashboard, go to "Add Products"
2. Add "Instagram Basic Display" and "Instagram Graph API"
3. Configure OAuth redirect URIs

### 3. Generate Access Token

#### Option A: Using Graph API Explorer (Quick Test)

1. Go to https://developers.facebook.com/tools/explorer/
2. Select your app
3. Add permissions: `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`
4. Generate User Token
5. Exchange for Long-Lived Token (valid for 60 days)

#### Option B: Using OAuth Flow (Production)

1. Implement OAuth flow in your app
2. Request permissions during user authorization
3. Exchange short-lived token for long-lived token using:
   ```
   GET https://graph.facebook.com/v21.0/oauth/access_token?
     grant_type=fb_exchange_token&
     client_id={app-id}&
     client_secret={app-secret}&
     fb_exchange_token={short-lived-token}
   ```

### 4. Get Instagram Business Account ID

You can get the Instagram Business Account ID in two ways:

**Method 1: From Facebook Page**
```bash
GET https://graph.facebook.com/v21.0/{page-id}?fields=instagram_business_account&access_token={token}
```

**Method 2: Using the API**
The `/api/instagram/connect` endpoint can automatically fetch it if you provide the Facebook Page ID.

## API Endpoints

### Connect Instagram Account

**POST** `/api/instagram/connect`

Connect an Instagram Business Account to an artist.

```json
{
  "artistId": "user_123",
  "accessToken": "your_access_token",
  "pageId": "facebook_page_id",  // Optional - will fetch Instagram account ID
  "instagramAccountId": "instagram_account_id",  // Optional - if you already have it
  "exchangeToken": true  // Optional - exchange short-lived token for long-lived (60 days)
}
```

**Note**: If `exchangeToken` is `true`, the system will automatically exchange a short-lived token for a long-lived token (60 days) using your Meta App credentials.

**Response:**
```json
{
  "success": true,
  "data": {
    "instagramAccountId": "17841405309211844",
    "tokenExpiresAt": "2024-03-29T00:00:00.000Z"
  }
}
```

### Check Connection Status

**GET** `/api/instagram/connect?artistId=user_123`

Check if an artist has Instagram connected and if the token is still valid.

**Response:**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "expired": false,
    "instagramAccountId": "17841405309211844",
    "tokenExpiresAt": "2024-03-29T00:00:00.000Z"
  }
}
```

### Fetch Metrics (Manual Trigger)

**GET** `/api/instagram/fetch-metrics?secret=YOUR_CRON_SECRET`

Fetch metrics for all connected artists. Can also be called for a specific artist:
**GET** `/api/instagram/fetch-metrics?artistId=user_123&secret=YOUR_CRON_SECRET`

**Response:**
```json
{
  "success": true,
  "summary": {
    "total": 5,
    "successful": 4,
    "skipped": 1,
    "errors": 0
  },
  "results": [
    {
      "artistId": "user_123",
      "artistName": "Artist Name",
      "status": "success",
      "metrics": {
        "views": 1250,
        "saves": 45,
        "shares": 12,
        "comments": 8,
        "completionRate": 85.5,
        "followers": 5000
      }
    }
  ]
}
```

## Scheduled Jobs

### Option 1: Cron Job (Recommended for VPS/Dedicated Server)

Add to your crontab (`crontab -e`):

```bash
# Run daily at 2 AM
0 2 * * * cd /path/to/lfr-dashboard && npm run fetch-instagram-metrics
```

### Option 2: Vercel Cron Jobs

If deploying on Vercel, add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/instagram/fetch-metrics?secret=YOUR_CRON_SECRET",
      "schedule": "0 2 * * *"
    }
  ]
}
```

### Option 3: External Cron Service

Use services like:
- **cron-job.org**: https://cron-job.org/
- **EasyCron**: https://www.easycron.com/
- **Cronitor**: https://cronitor.io/

Configure to call:
```
GET https://your-domain.com/api/instagram/fetch-metrics?secret=YOUR_CRON_SECRET
```

## Environment Variables

Add to `.env.local`:

```env
# Meta (Facebook/Instagram) App Credentials
META_APP_ID=1400742961531959
META_APP_SECRET=3f2dde1e39d30d1dcff3652939b5413e

# Optional: Secret to protect cron endpoints
CRON_SECRET=your_random_secret_string
```

**Note**: These credentials are already configured in your `.env.local` file.

## Data Storage

Metrics are stored in `data/instagramMetrics.json` with the following structure:

```json
{
  "id": "im_1234567890_abc123",
  "artistId": "user_123",
  "metricDate": "2024-01-29",
  "views": 1250,
  "saves": 45,
  "shares": 12,
  "comments": 8,
  "completionRate": 0.855,
  "followers": 5000
}
```

## Security Notes

⚠️ **Important**: Access tokens are currently stored in plain text in the database. For production:

1. **Encrypt tokens** before storing (use libraries like `crypto` or `node-forge`)
2. **Use environment variables** for sensitive data when possible
3. **Implement token refresh** before expiration
4. **Add rate limiting** to API endpoints
5. **Use HTTPS** for all API calls

## Troubleshooting

### "Invalid access token"
- Token may have expired (tokens last 60 days)
- Token may not have required permissions
- Token may be for wrong app

### "No Instagram Business Account found"
- Instagram account must be a Business Account
- Account must be connected to a Facebook Page
- Page must be linked to your Meta App

### "Metrics already exist for today"
- This is normal - the system prevents duplicate entries
- One row per artist per day (time-series data)
- Wait until next day or manually delete if needed

## Token Refresh

Long-lived tokens expire after 60 days. To refresh:

1. Generate a new long-lived token using the same process
2. Update via `/api/instagram/connect` endpoint
3. Or implement automatic refresh using Meta's token refresh API

## Rate Limits

Meta API has rate limits:
- **200 calls per hour** per user
- **4,800 calls per day** per app

The daily fetch job makes 1-2 calls per artist, so you can support many artists without hitting limits.
