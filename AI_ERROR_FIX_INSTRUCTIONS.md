# Quick Instructions for AI: How to Fix Dashboard Errors

When I report an error, here's what you should do:

## Step 1: Identify the Error Type

**React Context Error?**
- Error mentions: `useContext`, `usePathname`, `useRouter`
- Fix: Add `'use client'` directive to component, check for SSR issues

**Catalog Update Error?**
- Error: "Failed to update catalog item"
- Fix: Check `lib/storage.ts` updateCatalogItem function, verify item exists, check catalog.json

**CSV Upload Issue?**
- Duplicate songs or streams not merging
- Fix: Check matching logic in `app/api/upload-csv/route.ts`, ensure case-insensitive matching

**File Upload Error?**
- Files not uploading
- Fix: Check directory exists, verify permissions, check file size limits

## Step 2: Check the Files

**Key Files to Check:**
- `lib/storage.ts` - All data operations
- `app/api/catalog/route.ts` - Catalog API
- `app/api/upload-csv/route.ts` - CSV uploads
- Component files - Check for `'use client'` directive

**Data Files:**
- `data/catalog.json` - Song catalog
- Check if file exists and is valid JSON

## Step 3: Apply the Fix

1. **Read the error message** - Look at server console logs
2. **Find the root cause** - Check the specific file/function mentioned
3. **Apply fix** - Use the troubleshooting guide patterns
4. **Test** - Verify the fix works
5. **Explain** - Tell me what was wrong and how you fixed it

## Step 4: Common Fixes

### Missing 'use client'
```typescript
// Add this as first line:
'use client'
```

### Catalog Update Failure
- Check if item ID exists in catalog
- Verify catalog.json is valid JSON
- Add better error logging

### CSV Duplicates
- Use `/api/catalog/merge-duplicates` to merge
- Use `/api/catalog/delete-csv-entries` to clean up
- Fix matching logic to be case-insensitive

## What to Tell Me

When you fix something, tell me:
1. **What the error was** - Brief description
2. **What file you changed** - Which file(s)
3. **What you fixed** - The specific change
4. **How to verify** - How I can confirm it's fixed

## Example Response

"I found the issue! The component was missing the `'use client'` directive, which caused React hooks to fail during server-side rendering. I added `'use client'` to the top of `components/SidebarClient.tsx`. The error should be resolved now - try refreshing the page."







