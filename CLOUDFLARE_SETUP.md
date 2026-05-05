# Cloudflare Deployment Issues & Solutions

## Problem: Error 522 (Connection Timeout)

Cloudflare Pages is a **serverless platform** that doesn't support Node.js file system operations. Your app uses `fs` extensively to read/write JSON files, which causes the 522 error.

## Critical Issue

The app uses file system operations (`fs.readFileSync`, `fs.writeFileSync`, etc.) which are **not available** on Cloudflare Pages/Workers.

## Solutions

### Option 1: Use Vercel (Recommended)
Vercel supports Node.js file system operations and is the best fit for Next.js apps:

1. Deploy to Vercel:
   ```bash
   npm i -g vercel
   vercel
   ```

2. Set environment variables in Vercel dashboard:
   - `OPENAI_API_KEY` (your OpenAI API key)

3. Deploy

### Option 2: Use Railway or Render
Both support Node.js with file system access:
- Railway: https://railway.app
- Render: https://render.com

### Option 3: Migrate to Cloudflare D1 Database
This requires significant code changes to replace file system with D1 database:

1. Create D1 database in Cloudflare dashboard
2. Replace all `fs` operations with D1 queries
3. Update `lib/storage.ts` to use D1 instead of JSON files

**This is a major refactor and not recommended for quick fix.**

### Option 4: Use Cloudflare R2 for File Storage
For uploaded files, use R2 instead of file system:

1. Create R2 bucket in Cloudflare
2. Update file upload routes to use R2
3. Still need database for JSON data (D1 or external)

## Immediate Fix: Remove Hardcoded API Keys

I've already removed hardcoded API keys from the code. Make sure to set `OPENAI_API_KEY` as an environment variable in your hosting platform.

## Recommended Action

**Switch to Vercel** - it's the easiest solution and supports all your current functionality without code changes.

1. Sign up at https://vercel.com
2. Import your GitHub repository
3. Set `OPENAI_API_KEY` environment variable
4. Deploy

Vercel will automatically:
- Build your Next.js app
- Handle file system operations
- Provide HTTPS and CDN
- Support all your API routes

## Environment Variables Needed

Make sure these are set in your hosting platform:
- `OPENAI_API_KEY` - Your OpenAI API key

## Testing Locally

To test if the app works:
```bash
npm run build
npm start
```

If it builds and starts successfully, it will work on Vercel/Railway/Render.

