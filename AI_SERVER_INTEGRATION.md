# AI Server Integration Guide

This document explains how to integrate your AI/message server with the LFR Dashboard notification system.

## Overview

The dashboard sends notifications to your AI server via webhook at `/api/webhook/change`. Your server should receive these notifications, format them appropriately, and send SMS/text messages to admins and employees.

## Webhook Endpoint

**URL:** `POST {AI_SERVER_URL}/api/webhook/change`

**Environment Variable:** Set `AI_SERVER_URL` in your `.env` file (defaults to `http://localhost:3001`)

## Request Format

All notifications are sent as JSON POST requests with the following structure:

```typescript
{
  event: string                    // Event type (see Event Types below)
  data: {                          // Event-specific data
    // ... varies by event type
  }
  notifyAdmins?: boolean           // Should notify admins (true/false)
  notifyCEO?: boolean              // Should notify CEO (true/false)
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  timestamp: string                // ISO 8601 timestamp
  recipients?: RecipientInfo[]     // Optional: explicit recipients (if provided)
}

interface RecipientInfo {
  userId: string
  name: string
  phoneNumber?: string
  email?: string
  role: string
  artistName?: string
}
```

## Event Types

### 1. `song_submitted`
**Triggered:** When an artist submits a release request

**Priority:** `high`

**Data Structure:**
```typescript
{
  songName: string
  artistName: string
  userId: string
  userName: string
  releaseDate?: string                    // ISO date string
  releaseDateFormatted?: string           // Human-readable date (e.g., "Friday, January 19, 2026")
  daysUntilRelease?: number               // Days until release date
  releaseType?: 'single' | 'ep' | 'album'
  genre?: string
  collaborators?: string
  description?: string
  promoIdeas?: string
  instagramHandle?: string
  twitterHandle?: string
  tiktokHandle?: string
  songId?: string
  hasCover?: boolean
  songsCount?: number                     // For albums/EPs
}
```

**Example Message:**
```
🎵 New Release Request!

Song: "My New Song"
Artist: 555wick
Release Date: Friday, January 19, 2026 (3 days)
Type: Single
Genre: Hip-Hop

Promo Ideas:
- Social media campaign
- Music video release

View in dashboard: {dashboard_url}/dashboard/catalog/{songId}
```

---

### 2. `release_approved`
**Triggered:** When an admin approves a release request

**Priority:** `high`

**Data Structure:**
```typescript
{
  songName: string
  artistName: string
  releaseDate?: string
  releaseDateFormatted?: string
  daysUntilRelease?: number
  approvedBy: string                     // Admin name
  songId?: string
  userId?: string
  releaseType?: 'single' | 'ep' | 'album'
}
```

**Example Message:**
```
✅ Release Approved!

Song: "My New Song"
Artist: 555wick
Release Date: Friday, January 19, 2026
Approved by: Admin Name

The release has been added to the catalog and is scheduled for distribution.
```

---

### 3. `release_denied`
**Triggered:** When an admin denies a release request

**Priority:** `high`

**Data Structure:**
```typescript
{
  songName: string
  artistName: string
  reason?: string                        // Denial reason
  deniedBy: string                       // Admin name
  songId?: string
  userId?: string
  releaseDate?: string
  releaseDateFormatted?: string
  releaseType?: 'single' | 'ep' | 'album'
}
```

**Example Message:**
```
❌ Release Denied

Song: "My New Song"
Artist: 555wick
Denied by: Admin Name

Reason: {reason}

Please review and resubmit with corrections.
```

---

### 4. `artist_question`
**Triggered:** When an artist submits a question via the support form

**Priority:** `high` (default, can be `low` | `medium` | `high` | `urgent`)

**Data Structure:**
```typescript
{
  question: string                       // The question text
  artistName: string
  artistId: string
  userName: string
  songName?: string                      // If related to a specific song
  songId?: string
  context?: string                       // e.g., "Release Request Form"
  category?: 'release' | 'catalog' | 'checklist' | 'technical' | 'general'
  urgency?: 'low' | 'medium' | 'high' | 'urgent'
  contactMethod?: 'email' | 'sms' | 'both'
  timestamp: string
}
```

**Example Message:**
```
❓ Artist Question

From: 555wick (John Doe)
Context: Release Request Form
Category: release

Question:
"How do I upload multiple songs for an album?"

Song: "My Album" (if applicable)

Please respond via SMS or email.
```

---

### 5. `checklist_item_completed`
**Triggered:** When an important checklist item is completed

**Priority:** `high` (for important tasks) | `medium` (for others)

**Data Structure:**
```typescript
{
  songName: string
  artistName: string
  task: string                           // e.g., "Upload to distributor"
  section: string                        // e.g., "2. Distribution Setup"
  completedBy?: string
  releaseDate?: string
  releaseDateFormatted?: string
  daysUntilRelease?: number
  artistUserIds?: string[]
  songId?: string
}
```

**Important Tasks (high priority):**
- Upload to distributor
- Sent out to Empire
- Empire
- Orchard
- Release date
- Cover art
- Master
- Distributor

**Example Message:**
```
✅ Checklist Item Completed

Song: "My New Song"
Artist: 555wick
Task: Upload to distributor
Section: 2. Distribution Setup
Completed by: Admin Name

Release Date: Friday, January 19, 2026 (3 days)
```

---

### 6. `deadline_approaching`
**Triggered:** When a deadline is approaching

**Priority:** `urgent` (≤1 day) | `high` (≤3 days) | `medium` (others)

**Data Structure:**
```typescript
{
  item: string
  daysUntil: number
  type: 'release' | 'task' | 'contract' | 'other'
}
```

---

### 7. `deadline_missed`
**Triggered:** When a deadline is missed

**Priority:** `urgent`

**Data Structure:**
```typescript
{
  item: string
  daysOverdue: number
  type: 'release' | 'task' | 'contract' | 'other'
}
```

---

### 8. `song_delayed`
**Triggered:** When a release is delayed

**Priority:** `high`

**Data Structure:**
```typescript
{
  songName: string
  artistName: string
  delayReason?: string
  releaseDate?: string
  artistUserIds?: string[]
}
```

---

### 9. `checklist_status`
**Triggered:** When checking status of upcoming releases with incomplete checklists

**Priority:** `urgent` (≤3 days) | `high` (≤7 days) | `medium` (others)

**Data Structure:**
```typescript
{
  releases: Array<{
    songName: string
    artistName: string
    releaseDate: string
    daysUntil: number
    completionPercentage: number
    untouched: boolean
  }>
}
```

---

### 10. `streams_updated`
**Triggered:** When streams are updated significantly (>10% increase)

**Priority:** `low`

**Data Structure:**
```typescript
{
  songName: string
  artistName: string
  totalStreams: number
  oldStreams?: number
}
```

---

### 11. `catalog_updated`
**Triggered:** When catalog is updated

**Priority:** `low`

**Data Structure:**
```typescript
{
  songName: string
  artistName: string
  changes: string                        // Comma-separated list of changed fields
}
```

---

### 12. `song_updated`
**Triggered:** When a song is updated (for artist notifications)

**Priority:** `medium`

**Data Structure:**
```typescript
{
  songName: string
  artistName: string
  changes: string[]                      // Array of changed field names
  releaseDate?: string
  artistUserIds?: string[]
}
```

---

### 13. `song_delay_removed`
**Triggered:** When a delay is removed from a song

**Priority:** `medium`

**Data Structure:**
```typescript
{
  songName: string
  artistName: string
  releaseDate?: string
  artistUserIds?: string[]
}
```

---

### 14. `phone_number_added`
**Triggered:** When a phone number is added to a user

**Priority:** `low`

**Data Structure:**
```typescript
{
  userName: string
  phoneNumber: string
  role: string
}
```

---

## Recipient Management

### Option 1: Fetch Recipients from Dashboard API

Your server can fetch admin/CEO phone numbers from the dashboard:

**Endpoint:** `GET {DASHBOARD_URL}/api/users`

**Response:**
```json
{
  "success": true,
  "users": [
    {
      "id": "user_123",
      "name": "Admin Name",
      "email": "admin@example.com",
      "phoneNumber": "+1234567890",
      "role": "admin"
    }
  ]
}
```

Filter users where:
- `notifyAdmins === true` → Send to all users with `role === 'admin'`
- `notifyCEO === true` → Send to CEO (you can identify CEO by name, email, or a custom field)

### Option 2: Use Explicit Recipients

If `recipients` array is provided in the notification, use those directly.

### Option 3: Hardcoded Recipients

Maintain a list of admin/CEO phone numbers in your server config.

---

## Message Formatting

### SMS Best Practices

1. **Keep messages concise** - SMS has 160 character limit (though modern phones support longer messages)
2. **Use emojis sparingly** - They can help with quick scanning
3. **Include actionable information** - Links, dates, names
4. **Format dates clearly** - Use `releaseDateFormatted` when available
5. **Include priority indicators** - Use emojis or text to indicate urgency

### Example Message Templates

#### High Priority (Release Requests)
```
🎵 New Release: "{songName}" by {artistName}
📅 Release: {releaseDateFormatted} ({daysUntilRelease} days)
🎧 Type: {releaseType}
💡 Promo: {promoIdeas}
View: {dashboard_url}/catalog/{songId}
```

#### Urgent (Questions)
```
❓ Question from {artistName}
"{question}"
Context: {context}
Reply via SMS or email.
```

#### Medium Priority (Approvals)
```
✅ Approved: "{songName}" by {artistName}
Release: {releaseDateFormatted}
Approved by: {approvedBy}
```

---

## Server Implementation Example

### Node.js/Express Example

```javascript
const express = require('express');
const axios = require('axios');
const twilio = require('twilio'); // Or your SMS provider

const app = express();
app.use(express.json());

// Your dashboard URL
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3000';

// SMS client (Twilio example)
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Admin/CEO phone numbers (you can fetch these from dashboard API)
const ADMIN_PHONES = [
  '+1234567890', // Admin 1
  '+0987654321', // Admin 2
];

const CEO_PHONE = '+1111111111';

// Fetch recipients from dashboard
async function getRecipients(notifyAdmins, notifyCEO) {
  const recipients = [];
  
  if (notifyAdmins || notifyCEO) {
    try {
      const response = await axios.get(`${DASHBOARD_URL}/api/users`);
      const users = response.data.users || [];
      
      if (notifyAdmins) {
        const admins = users.filter(u => u.role === 'admin' && u.phoneNumber);
        recipients.push(...admins.map(u => ({
          phone: u.phoneNumber,
          name: u.name,
          role: 'admin'
        })));
      }
      
      if (notifyCEO) {
        // Identify CEO (you can use a custom field or name matching)
        const ceo = users.find(u => 
          u.role === 'admin' && 
          (u.name.toLowerCase().includes('ceo') || u.email.includes('ceo'))
        );
        if (ceo && ceo.phoneNumber) {
          recipients.push({
            phone: ceo.phoneNumber,
            name: ceo.name,
            role: 'ceo'
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch recipients:', error);
      // Fallback to hardcoded numbers
      if (notifyAdmins) {
        recipients.push(...ADMIN_PHONES.map(phone => ({ phone, role: 'admin' })));
      }
      if (notifyCEO) {
        recipients.push({ phone: CEO_PHONE, role: 'ceo' });
      }
    }
  }
  
  return recipients;
}

// Format message based on event type
function formatMessage(event, data, priority) {
  const emoji = {
    high: '🔴',
    urgent: '🚨',
    medium: '🟡',
    low: '🟢'
  }[priority] || '📢';
  
  switch (event) {
    case 'song_submitted':
      return `${emoji} New Release Request!\n\n` +
             `Song: "${data.songName}"\n` +
             `Artist: ${data.artistName}\n` +
             (data.releaseDateFormatted ? `Release: ${data.releaseDateFormatted}` : '') +
             (data.daysUntilRelease ? ` (${data.daysUntilRelease} days)` : '') + '\n' +
             (data.releaseType ? `Type: ${data.releaseType}\n` : '') +
             (data.genre ? `Genre: ${data.genre}\n` : '') +
             (data.promoIdeas ? `\nPromo Ideas:\n${data.promoIdeas}\n` : '') +
             (data.songId ? `\nView: ${DASHBOARD_URL}/dashboard/catalog/${data.songId}` : '');
             
    case 'release_approved':
      return `✅ Release Approved!\n\n` +
             `Song: "${data.songName}"\n` +
             `Artist: ${data.artistName}\n` +
             (data.releaseDateFormatted ? `Release: ${data.releaseDateFormatted}\n` : '') +
             `Approved by: ${data.approvedBy}`;
             
    case 'release_denied':
      return `❌ Release Denied\n\n` +
             `Song: "${data.songName}"\n` +
             `Artist: ${data.artistName}\n` +
             `Denied by: ${data.deniedBy}\n` +
             (data.reason ? `Reason: ${data.reason}` : '');
             
    case 'artist_question':
      return `❓ Artist Question\n\n` +
             `From: ${data.artistName} (${data.userName})\n` +
             (data.context ? `Context: ${data.context}\n` : '') +
             (data.category ? `Category: ${data.category}\n` : '') +
             `\nQuestion:\n"${data.question}"\n` +
             (data.songName ? `\nRelated to: "${data.songName}"` : '') +
             `\n\nPlease respond via SMS or email.`;
             
    case 'checklist_item_completed':
      return `✅ Checklist Item Completed\n\n` +
             `Song: "${data.songName}"\n` +
             `Artist: ${data.artistName}\n` +
             `Task: ${data.task}\n` +
             `Section: ${data.section}\n` +
             (data.completedBy ? `Completed by: ${data.completedBy}\n` : '') +
             (data.releaseDateFormatted ? `Release: ${data.releaseDateFormatted}` : '') +
             (data.daysUntilRelease ? ` (${data.daysUntilRelease} days)` : '');
             
    default:
      return `${emoji} ${event}\n\n${JSON.stringify(data, null, 2)}`;
  }
}

// Webhook endpoint
app.post('/api/webhook/change', async (req, res) => {
  try {
    const { event, data, notifyAdmins, notifyCEO, priority = 'medium', recipients } = req.body;
    
    console.log(`[Webhook] Received ${event} event (priority: ${priority})`);
    
    // Get recipients
    let messageRecipients = [];
    
    if (recipients && recipients.length > 0) {
      // Use explicit recipients if provided
      messageRecipients = recipients
        .filter(r => r.phoneNumber)
        .map(r => ({ phone: r.phoneNumber, name: r.name, role: r.role }));
    } else {
      // Fetch from dashboard or use hardcoded
      messageRecipients = await getRecipients(notifyAdmins, notifyCEO);
    }
    
    if (messageRecipients.length === 0) {
      console.log('[Webhook] No recipients found, skipping SMS');
      return res.json({ success: true, message: 'No recipients' });
    }
    
    // Format message
    const message = formatMessage(event, data, priority);
    
    // Send SMS to all recipients
    const sendPromises = messageRecipients.map(async (recipient) => {
      try {
        await twilioClient.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER, // Your Twilio number
          to: recipient.phone
        });
        console.log(`[SMS] Sent to ${recipient.name || recipient.phone}`);
      } catch (error) {
        console.error(`[SMS] Failed to send to ${recipient.phone}:`, error);
      }
    });
    
    await Promise.all(sendPromises);
    
    res.json({ success: true, recipients: messageRecipients.length });
  } catch (error) {
    console.error('[Webhook] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`AI Server listening on port ${PORT}`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/api/webhook/change`);
});
```

---

## Environment Variables

Set these in your AI server's `.env` file:

```env
# Dashboard URL (for fetching user data)
DASHBOARD_URL=http://localhost:3000

# SMS Provider (Twilio example)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Or use your own SMS provider
SMS_API_KEY=your_sms_api_key
SMS_API_URL=https://api.yoursmsprovider.com
```

---

## Error Handling

The dashboard sends notifications asynchronously and won't fail if your server is down. However, you should:

1. **Log all webhook requests** for debugging
2. **Handle errors gracefully** - Don't crash if SMS fails
3. **Rate limit** - Don't spam recipients with too many messages
4. **Validate data** - Check that required fields are present
5. **Return proper status codes** - 200 for success, 500 for errors

---

## Testing

Test your webhook endpoint:

```bash
curl -X POST http://localhost:3001/api/webhook/change \
  -H "Content-Type: application/json" \
  -d '{
    "event": "song_submitted",
    "data": {
      "songName": "Test Song",
      "artistName": "Test Artist",
      "userId": "user_123",
      "userName": "Test User",
      "releaseDate": "2026-01-22",
      "releaseDateFormatted": "Friday, January 22, 2026",
      "daysUntilRelease": 3,
      "releaseType": "single"
    },
    "notifyAdmins": true,
    "notifyCEO": false,
    "priority": "high",
    "timestamp": "2026-01-19T02:00:00.000Z"
  }'
```

---

## Priority Handling

Handle priorities appropriately:

- **urgent**: Send immediately, may send multiple times
- **high**: Send immediately
- **medium**: Send within a few minutes (can batch)
- **low**: Batch and send periodically (e.g., hourly digest)

---

## Questions?

If you need help integrating, check:
1. Dashboard logs for webhook delivery status
2. Your server logs for received webhooks
3. SMS provider logs for delivery confirmations

