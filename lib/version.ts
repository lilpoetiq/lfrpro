/**
 * L.O.S (Legendary Operating System) - Dashboard version
 * Versioning rules:
 * - Bug fixes: +0.01 (e.g., 1.01 → 1.02)
 * - Major updates: +0.10 (e.g., 1.10 → 1.20)
 * - Huge updates: full major bump (e.g., 1.99 → 2.00)
 */
export const APP_VERSION = '1.12'
export const APP_NAME = 'L.O.S'

export interface ChangelogEntry {
  version: string
  date: string
  type: 'bugfix' | 'major' | 'huge'
  title: string
  description: string
  features?: string[]
  improvements?: string[]
  fixes?: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.12',
    date: new Date().toISOString().split('T')[0],
    type: 'major',
    title: 'Readable Files, SQLite Change Log & Backups',
    description: 'All uploads use readable filenames (Artist_Song.ext). SQLite change log tracks what changed, when, and by whom. JSON backups in data/backups/. Checklists use readable names (checklist_all-in-my-head-by-omar-hernandez.json).',
    features: [
      'Readable file naming: Artist_Song.ext (or date suffix on collision)',
      'SQLite catalog.db with change_log table (entity, action, changed_at, changed_by, backup_path)',
      'Periodic JSON backups in data/backups/',
      'Checklist files: checklist_{song-by-artist-slug}.json in lfr-dashboard-uploads/data',
      'API /api/changes for recent changes',
    ],
    improvements: [
      'All upload routes (album-cover, track-audio, beats, contracts, etc.) use readable names',
      'DATA_DIR / UPLOAD_DIR env support for lfr-dashboard-uploads',
    ],
    fixes: [],
  },
  {
    version: '1.11',
    date: new Date().toISOString().split('T')[0],
    type: 'bugfix',
    title: 'Data & Playback Fixes',
    description: 'Small update addressing data sync issues and playback problems.',
    features: [],
    improvements: [],
    fixes: [
      'Data issue between files causing album covers not loading',
      'Beats/songs not playing due to file path sync',
      'Old versions of software popping up from months prior (delete/save not persisting)',
    ],
  },
  {
    version: '1.10',
    date: new Date().toISOString().split('T')[0],
    type: 'major',
    title: 'L.O.S 1.10 — Complete Feature Documentation',
    description: 'Major update with full documentation of everything L.O.S can do. This label operating system powers the entire Legendary Fyre Records workflow from catalog to contracts to AI-powered release strategy.',
    features: [
      'Authentication & roles: Admin, Manager, Artist, Producer, Staff (artist with staff permissions). Admin override login.',
      'Dashboard: Role-specific home with key metrics, quick actions, and notifications.',
      'Calendar: Events by type (release, promo, studio, etc.), day drawer, artist grouping, campaign detail panel.',
      'AI Chat: Conversational assistant for artists and staff; can answer questions and perform actions.',
      'Catalog: Full music catalog with songs, artists, releases, streams, ISRC/UPC, album covers, motion covers, music videos. CSV import, manual add. Route song to artist (admin override).',
      'Artist Growth Center (Release Readiness): Evidence-based release timing. Instagram metrics (Meta API), Spotify screenshot OCR (AI vision). Readiness states: Cooling / Building / Ready. Lane-based evaluation (underground, regional, faith, creative, inspirational). Trigger-Ready matching. Staff strategy brief & AI chat. Post-release evaluation.',
      'Submit Release: Artists submit songs for review. Upload audio, metadata. Admin/manager approve or deny.',
      'Browse Beats: Beat catalog with packs, individual beats. Listen, favorite, download. Cost tracking.',
      'Streaming Stats: Spotify & Apple Music metrics, trends, platform comparison.',
      'Releases: Release schedule and history. Approval workflow. Delayed releases with reasons.',
      'Revenue: Revenue breakdown, splits, charts. Artist-specific and label-wide.',
      'Contracts: Upload PDFs or images. Auto-analyze with AI (extract splits, artist-friendly explanation). Artist view of contracts. Assign artists to splits.',
      'Change Requests: Catalog change requests. Approval workflow.',
      'Vault: Unreleased / vault material. Secure storage.',
      'Upload Data: CSV upload for catalog, analytics. AI-powered analysis.',
      'AI Insights: OpenAI-powered analytics on streaming trends, performance, engagement.',
      'Release Schedule: Release calendar with approval, admin overrides.',
      'Users: User management (CRUD), roles, artist mappings, last active tracking. Password change.',
      'Tasks: Task management for releases and workflows.',
      'Activity Log: Audit trail of actions across the system.',
      'Guides & Handbooks: Internal documentation and guides.',
      'Notifications: In-app notifications, trigger-ready alerts, permission popup.',
      'Support Chat: AI-powered support for artists.',
      'File storage: Central upload config (lfr-dashboard-uploads). Album covers, beat files, track audio, vault, submissions.',
      'Error logging: Admin error log viewer with diagnostics.',
    ],
    improvements: [
      'Last active accuracy: Activity heartbeat on navigation (throttled).',
      'Upload path: Uses lfr-dashboard-uploads on lil drive.',
    ],
    fixes: [],
  },
  {
    version: '1.02',
    date: '2025-03-05',
    type: 'bugfix',
    title: 'File Storage Redirect',
    description: 'All uploads and file storage redirected to lfr-dashboard-uploads.',
    features: [],
    improvements: [
      'Central upload config (lib/uploadConfig.ts)',
      'All upload routes use lfr-dashboard-uploads',
      'Set UPLOAD_DIR in .env for production override',
    ],
    fixes: [],
  },
  {
    version: '1.01',
    date: '2025',
    type: 'bugfix',
    title: 'Initial L.O.S Versioning',
    description: 'Campaign Detail Panel, enhanced calendar, and version indicator for staff.',
    features: [
      'Campaign Detail Panel in Day Drawer',
      'Calendar grouped by artist with color system',
      'L.O.S version indicator (staff/owner only)',
      'Updates page with changelog',
    ],
    improvements: [],
    fixes: [],
  },
]
