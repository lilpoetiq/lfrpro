# GitHub + Vercel (and when to use a real server)

## 1) Push to GitHub

```bash
git init
git add -A
git status
git commit -m "Initial commit: LFR dashboard"
# Create a new empty repo on GitHub, then:
git remote add origin https://github.com/YOUR_ORG/YOUR_REPO.git
git branch -M main
git push -u origin main
```

Use `.env.local` for secrets on your machine only (it is gitignored). Copy from `.env.example` and fill in values. To keep large `data/` and uploads off the repo and on a drive or server volume, see [`EXTERNAL_DATA.md`](./EXTERNAL_DATA.md) (`DATA_DIR`, `UPLOAD_DIR`).

## 2) Connect Vercel

1. [vercel.com](https://vercel.com) → **Add New** → **Project** → import the GitHub repo.
2. **Framework Preset:** Next.js (auto-detected).  
3. **Build Command:** `npm run build` (default; matches `package.json`).  
4. **Install Command:** `npm ci` (set in `vercel.json` if you want reproducible installs).
5. **Environment variables:** add the same keys you use in `.env.local` (at minimum anything your production build needs; see `.env.example`).

Vercel runs **Install project → Build → Deploy** on every push to the production branch.

## 3) Important: this app and “serverless”

This dashboard **writes JSON + SQLite and saves uploads to disk** (`data/`, `album-covers/`, `track-audio/`, etc.).

On **Vercel’s default serverless runtime**, the filesystem is **ephemeral** between requests. **Catalog data, uploads, and `catalog.db` will not persist reliably** the way they do on your Mac or a VPS with a real disk.

**Practical options:**

| Goal | Suggestion |
|------|------------|
| Fast CI + preview of the **UI** | GitHub + Vercel (or Vercel Preview Deployments) is fine. |
| Real production with **full catalog, files, and DB** | Run **Node on a server with a volume** (see `QUICK_DEPLOY.md` / `DEPLOY_DIGITALOCEAN.md`), or Docker + persistent storage—not serverless alone. |
| Future: stay on Vercel | You’d need **external** blob storage + database (bigger app change). |

So: **GitHub + Vercel = great for repo + CI + previews**; **production “like local” = VPS/Docker** until storage is externalized.

## 4) CI on every push

GitHub Actions (`.github/workflows/ci.yml`) runs `npm ci` and `npm run build` on pushes/PRs to `main`/`master` so broken builds are caught before you deploy.

## 5) Domain

In Vercel: **Project → Settings → Domains** to attach `yourdomain.com` and optional redirects from `www`.
