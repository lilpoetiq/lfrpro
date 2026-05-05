# Where data and uploads live (Mac + external drive)

The Next.js build does not embed your library. At runtime, paths come from `lib/uploadConfig.ts`.

## Recommended layout (automated)

| | Path (defaults used by `npm run setup:split`) |
|---|--------|
| **JSON, SQLite, checklists, logs** (fast internal disk) | `~/LFR-assets/data` → **`DATA_DIR`** |
| **Covers, audio, beats, large files** (external volume) | `/Volumes/lil drive/LFR-assets` → **`UPLOAD_DIR`** (when the “lil drive” volume is present) |

If `/Volumes/lil drive` is missing (drive unplugged), the script uses **`~/LFR-assets/media`** for `UPLOAD_DIR` instead, so the app still runs from your Mac.

## Commands

| Command | What it does |
|--------|----------------|
| `npm run setup:split` | Creates folders, copies `./data` → `DATA_DIR` and project upload folders → `UPLOAD_DIR`, writes `.env.local`. Large folders (e.g. `beats/`) can take a long time. |
| `npm run setup:env` | **Only** writes/merges `DATA_DIR` and `UPLOAD_DIR` in `.env.local` (no copying). Use this for a quick switch or if copies are still running. |
| `npm run paths` | Prints resolved `DATA_DIR` and `UPLOAD_DIR` and a few example paths. |

**Flags for the setup script:** `--dry-run`, `--force` (replace non-empty destinations), `--env-only` (same as `setup:env`).

**Overrides (optional):**  
`LFR_DATA_DIR` and `LFR_UPLOAD_DIR` when running the script.

## `.env.local` (gitignored)

After setup, you should have something like:

```env
DATA_DIR=/Users/yourname/LFR-assets/data
UPLOAD_DIR="/Volumes/lil drive/LFR-assets"
```

Add other keys (e.g. `OPENAI_API_KEY`) below; re-run `setup:env` to refresh paths without deleting your secrets (other lines are merged from the previous `.env.local` when possible).

## Manual one-time: move from the project

If you did not use the script, stop the app, then move:

- `data/` → `~/LFR-assets/data` (or your `DATA_DIR`)
- Folders in the project root: `album-covers`, `track-audio`, `beats`, etc. → under your `UPLOAD_DIR`

## Git

`.gitignore` ignores `data/` and the default upload folder names in the project root, so the repo stays code-focused. If paths were **already tracked**:

```bash
git rm -r --cached data album-covers beats audio track-audio
# add others as needed, then commit
```

## Vercel / serverless

Serverless hosts do not give you durable local disk; use a **VPS + volume** (see `QUICK_DEPLOY.md`) or external object storage for production.
