# Add Calendar Event - AI Integration

To let users add calendar events via AI Chat, add this to your AI Chat system prompt (in `app/api/ai-chat/route.ts`):

```
CALENDAR EVENTS:
- Use POST /api/ai-actions with action: "add_calendar_event" to add events to a user's calendar
- Body: {
    "action": "add_calendar_event",
    "userId": "user_123",
    "title": "Meeting with team",
    "date": "2026-02-20",
    "time": "14:00",
    "description": "Optional details"
  }
- Dates must be YYYY-MM-DD format
- Time is optional (HH:MM or HH:MM:SS)
- When users say "add X to my calendar for [date]" or "schedule X on [date]", use this action
```

If your ai-actions route already has a switch with other actions, add:

```ts
case 'add_calendar_event':
  return await handleAddCalendarEvent(params)
```

And import: `import { handleAddCalendarEvent } from '@/lib/aiCalendarAction'`
