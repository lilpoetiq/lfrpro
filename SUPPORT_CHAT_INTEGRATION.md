# Support Chat Integration Guide for Website Developers

## Required: Make Support Submissions Idempotent

When the website sends a support question to Message AI, it **must** include a stable identifier so retries don't create duplicate texts.

## API Endpoint

**POST** `http://<YOUR_AI_SERVER>:3001/api/support-question`

### Headers

```
Content-Type: application/json
X-Idempotency-Key: <stable_key> (recommended)
```

## Required Fields

- **questionId**: Stable per submission (database row id / UUID saved in DB). This must **not change** if the website retries.
- **phoneNumber**: Artist phone in E.164 format (ex: `+15105551234`)
- **userName** (or **artistName**)
- **question**: Full text of the support question

## Strong Recommendation (Use Both)

- **questionId**: `support_<dbRowId>`
- **X-Idempotency-Key**: `support:<questionId>` (ex: `support:support_18421`)

## Example Payload

```json
{
  "questionId": "support_18421",
  "userId": "u_92",
  "userName": "Sariya",
  "artistName": "Sariya",
  "phoneNumber": "+15109346358",
  "question": "Hi I want to release",
  "context": "website support form",
  "createdAt": "2026-01-20T02:33:00.000Z"
}
```

## Critical Rule

**If the website retries (timeout / network fail), it MUST resend the same `questionId` and same `X-Idempotency-Key`.**

If it generates a new id every retry, it will look like "new questions" and can spam the support team.

After a request **succeeds**, the client must **reset** and generate a **new** `questionId` for the next message/submission.

## Optional: Dry-Run for Testing (No Texts Sent)

Add query parameter: `?dryRun=true` or header `x-dry-run: true`

This returns what would be sent without actually sending iMessages.

## Implementation Notes

1. **Store questionId**: When first submitting, save the `questionId` to your database/state
2. **Reuse on retry**: If the request fails and you retry, use the **same** `questionId` and `X-Idempotency-Key`
3. **Generate stable IDs**: Use database row IDs or UUIDs that persist across retries
4. **Phone format**: Always use E.164 format (`+` followed by country code and number)

## Error Handling

- If the server returns an error, check if it's a network/timeout issue
- On retry, use the **exact same** `questionId` and `X-Idempotency-Key`
- Don't generate new IDs for retries - this prevents duplicate messages
