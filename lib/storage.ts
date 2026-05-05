import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'
import { getDataPath } from './uploadConfig'

const DATA_DIR = getDataPath()

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

// Interfaces
export interface CatalogItem {
  id: string
  song: string
  artist: string
  artistId?: string
  artistIds?: string[]
  releaseType: 'single' | 'ep' | 'album'
  releaseDate?: string
  releaseDateRequested?: string
  releaseApprovalStatus?: 'pending' | 'approved' | 'denied'
  releaseApprovalNotes?: string
  isDelayed?: boolean
  delayReason?: string
  totalStreams: number
  distributor?: string
  platforms?: string[]
  manuallyAdded: boolean
  googleDriveUrl?: string
  fileUrl?: string
  upc?: string
  isrc?: string
  fromCSV?: boolean
  isUnreleased?: boolean
  vaultFileId?: string
  sentToEmpireAt?: string
  promoNotes?: string
  albumCover?: string
  motionCover?: string  // Video file for animated album cover
  /** Smaller web-friendly transcode for in-app playback; download should use motionCover */
  motionCoverPreview?: string
  /**
   * Replaced covers kept when uploading with “archive previous” (e.g. old art may still appear on DSPs).
   * Newest entries first. Files remain under /api/files/; URLs stay valid until manually removed from disk.
   */
  coverArchive?: Array<{
    id: string
    kind: 'still' | 'motion'
    masterUrl: string
    previewUrl?: string
    replacedAt: string
  }>
  musicVideo?: string   // Music video URL
  isArchived?: boolean
  /**
   * Campaign lifecycle: upcoming | active | completed | archived
   * - upcoming: release_date in future
   * - active: release_date passed, campaign ongoing (before campaignEndDate)
   * - completed: campaignEndDate passed (or auto-completed)
   * - archived: admin manually archived
   */
  campaignStatus?: 'upcoming' | 'active' | 'completed' | 'archived'
  /** When the campaign is considered ended (default: release + 2 weeks) */
  campaignEndDate?: string
  /** Performance metrics for completed campaigns */
  performanceMetrics?: {
    week1Streams?: number
    month1Streams?: number
    totalStreams?: number
    engagementPercent?: number
    topPerformingContent?: string
    bestPostingDay?: string
    highestPerformingPlatform?: string
  }
  /** Campaign learnings: what worked, what didn't, what to repeat */
  campaignWins?: string
  /** Campaign score 1–10 (completed songs) */
  campaignScore?: number
  /** strong | average | weak */
  campaignOutcome?: 'strong' | 'average' | 'weak'
  /** Brief campaign summary */
  campaignSummary?: string
  /** Lessons learned */
  lessonsLearned?: string
  /** Strategy to repeat next time */
  strategyToRepeat?: string
  /** Strategy to avoid next time */
  strategyToAvoid?: string
  /** If true: can be used as template for future releases */
  blueprintReady?: boolean
  /** Manually added past content links (for Import Past Campaign) */
  pastContentLinks?: Array<{
    id: string
    url: string
    platform?: string
    date?: string
    notes?: string
  }>
  /**
   * Admin-only: a lightweight audit trail of changes performed by Message AI via `/api/ai-actions`.
   * This is meant for display in the dashboard (not a security boundary).
   */
  aiActionHistory?: Array<{
    id: string
    at: string
    action: string
    summary: string
  }>
  /**
   * Additional information/notes that can be added by admins.
   * This is a free-form text field for any extra details about the release.
   */
  additionalInfo?: string
  lyricsArray?: string[]
  /**
   * Release Readiness Tags (for Trigger-Ready matching)
   */
  readinessTags?: {
    energy?: 'low' | 'medium' | 'high'
    emotion?: 'pain' | 'praise' | 'flex' | 'healing' | 'celebration' | 'reflection' | 'motivation' | 'other'
    lane?: 'underground' | 'regional' | 'faith' | 'creative' | 'inspirational'
    contentFit?: 'snippet-ready' | 'visual-heavy' | 'story-driven' | 'viral-potential' | 'deep-listening'
    triggerReady?: boolean  // System-flagged when conditions align
    triggerReadyAt?: string  // When it was flagged
    triggerReadyReason?: string  // Why it was flagged
  }
  songs?: Array<{
    id: string
    song: string
    isrc?: string
    streams?: number
    audioUrl?: string
    /** Display line, e.g. "feat. Jane & John" (shown on tracklist) */
    featuring?: string
    /** Dashboard user IDs for featured artists — they see this release in their catalog */
    featuredArtistIds?: string[]
    readinessTags?: {
      energy?: 'low' | 'medium' | 'high'
      emotion?: 'pain' | 'praise' | 'flex' | 'healing' | 'celebration' | 'reflection' | 'motivation' | 'other'
      lane?: 'underground' | 'regional' | 'faith' | 'creative' | 'inspirational'
      contentFit?: 'snippet-ready' | 'visual-heavy' | 'story-driven' | 'viral-potential' | 'deep-listening'
      triggerReady?: boolean
      triggerReadyAt?: string
      triggerReadyReason?: string
    }
    credits?: Array<{
      id: string
      role: 'producer' | 'engineer' | 'writer' | 'publisher' | 'mixer' | 'mastering' | 'other'
      name: string
      ipi?: string
      customRole?: string
      adminNotes?: string
    }>
  }>
  credits?: Array<{
    id: string
    role: 'producer' | 'engineer' | 'writer' | 'publisher' | 'mixer' | 'mastering' | 'other'
    name: string
    ipi?: string
    customRole?: string
    adminNotes?: string
  }>
}

export type CampaignStatus = 'upcoming' | 'active' | 'completed' | 'archived'

/** Compute campaign status from release date, campaign end date, and archived flag */
export function computeCampaignStatus(item: CatalogItem): CampaignStatus {
  if (item.campaignStatus === 'archived' || item.isArchived) return 'archived'
  if (item.campaignStatus) {
    // If explicitly set and not archived, use it (but we may still auto-update completed)
    const releaseDate = item.releaseDate || item.releaseDateRequested
    const campaignEnd = item.campaignEndDate
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    if (campaignEnd && campaignEnd <= today && item.campaignStatus !== 'completed') {
      return 'completed' // Auto: campaign end passed
    }
    if (item.campaignStatus === 'completed') return 'completed'
    if (item.campaignStatus === 'active') return 'active'
    if (item.campaignStatus === 'upcoming') return 'upcoming'
  }
  const releaseDate = item.releaseDate || item.releaseDateRequested
  const campaignEnd = item.campaignEndDate || (releaseDate ? defaultCampaignEndDate(releaseDate.split('T')[0]) : null)
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  if (!releaseDate) return 'upcoming'
  if (releaseDate > today) return 'upcoming'
  if (campaignEnd && campaignEnd <= today) return 'completed'
  return 'active'
}

/** Default campaign end: release + 2 weeks */
export function defaultCampaignEndDate(releaseDate: string): string {
  const d = new Date(releaseDate)
  d.setDate(d.getDate() + 14)
  return d.toISOString().split('T')[0]
}

/** Auto-move songs to completed when campaign end date passes. Call from catalog read path. */
export function autoCompleteExpiredCampaigns(): number {
  const catalog = getCatalog()
  const today = new Date().toISOString().split('T')[0]
  let updated = 0
  catalog.forEach((item) => {
    if (item.isArchived || item.campaignStatus === 'archived') return
    const end = item.campaignEndDate || (item.releaseDate ? defaultCampaignEndDate(item.releaseDate.split('T')[0]) : null)
    if (end && end <= today && item.campaignStatus !== 'completed') {
      if (updateCatalogItem(item.id, { campaignStatus: 'completed' })) updated++
    }
  })
  return updated
}

export interface User {
  id: string
  username: string
  password?: string  // Deprecated: use passwordHashes array instead, kept for backward compatibility
  passwords?: string[]  // Deprecated: use passwordHashes array instead
  passwordHashes?: string[]  // Array of bcrypt hashed passwords for this account
  name: string
  email: string
  role: 'artist' | 'manager' | 'admin' | 'producer'
  createdAt: string
  artistName?: string
  realName?: string
  aliases?: string[]
  phoneNumber?: string
  linkedArtistIds?: string[]
  staffPermissions?: string[]
  staffManagedArtistIds?: string[]
  managerPermissions?: { [key: string]: boolean }
  managerId?: string
  ipi?: string
  createdFromCredit?: boolean  // Badge indicator
  // Instagram (Meta) integration
  instagramAccountId?: string  // Instagram Business Account ID
  instagramAccessToken?: string  // Encrypted/stored access token
  instagramTokenExpiresAt?: string  // Token expiration timestamp
  // Release readiness lane
  lane?: 'underground' | 'regional' | 'faith' | 'creative' | 'inspirational' | 'emerging' | 'developing' | 'established' | 'elite'  // Artist lane/career stage
  lastActive?: string  // ISO timestamp of last activity
  // Beat preferences for artists
  preferredGenres?: string[]  // Genres the artist prefers (beats of these genres show first)
  preferredMoods?: string[]  // Moods the artist prefers (beats of these moods show first)
  beatListenHistory?: Array<{  // Track which beats the artist has listened to
    beatId: string
    listenedAt: string  // ISO timestamp
  }>
  favoriteBeats?: string[]  // Array of beat IDs that the artist has hearted/favorited
}

export interface Task {
  id: string
  title: string
  description: string
  assignedTo: string
  assignedToName: string
  assignedBy: string
  assignedByName: string
  dueDate: string
  completed: boolean
  category: string
  songId?: string
  createdAt?: string
  completedAt?: string
  hasNotification?: boolean
  notificationMessage?: string
  status?: 'pending' | 'in_progress' | 'completed'
  startedAt?: string
  timeSpent?: number
}

export interface Message {
  id: string
  from: string
  fromName: string
  to: string
  toName: string
  subject: string
  message: string
  read: boolean
  createdAt: string
  songId?: string
}

export interface ContractDocument {
  id: string
  fileName: string
  fileUrl: string
  uploadedAt: string
  uploadedBy?: string
}

export interface Contract {
  id: string
  name: string
  songId?: string
  artistIds: string[]
  splits: Array<{
    artistId: string
    artistName?: string
    percentage: number
    role?: string
  }>
  effectiveDate: string
  expirationDate?: string
  notes?: string
  createdBy: string
  createdAt: string
  isActive: boolean
  documents?: ContractDocument[]
  /** AI-generated explanation for artists (positive, accessible) */
  artistFriendlyExplanation?: string
  /** Extracted percentages from last document analysis (for admin reference) */
  extractedSplits?: Array<{ partyName: string; percentage: number; role?: string }>
}

export interface Beat {
  id: string
  name: string
  bpm?: number // Auto-detected, not manually entered
  key?: string // Auto-detected musical key (e.g., "C Major", "A Minor")
  producerIds: string[]
  packId?: string
  packName?: string
  status: 'available' | 'reserved' | 'exclusive_sold'
  selectedBy?: Array<{
    artistId: string
    selectedAt: string
    licenseType: 'lease' | 'premium_lease' | 'exclusive'
  }>
  downloadFingerprints?: Array<{
    artistId: string
    timestamp: string
    sessionId: string
    fingerprint: string
  }>
  genre?: string
  mood?: string
  bpmAnalyzed?: boolean // Flag to indicate if BPM has been analyzed
  keyAnalyzed?: boolean // Flag to indicate if key has been analyzed
  leasePrice?: number
  premiumLeasePrice?: number
  exclusivePrice?: number
  originalFileUrl: string
  previewFileUrl?: string
  tags?: string[]
  createdAt: string
  updatedAt: string
  owner?: string
  copyright?: string
  license?: string
  contact?: string
  isIncomplete?: boolean
  canPublish?: boolean
}

export interface BeatFile {
  id: string
  beatId: string
  fileName: string
  fileType: 'original' | 'preview' | 'stems' | 'midi' | 'other' | 'folder'
  fileUrl: string
  fileSize?: number
  uploadedBy?: string
  uploadedAt: string
  folderPath?: string
  isFolder?: boolean
}

export interface BeatPack {
  id: string
  name: string
  producerIds: string[]
  beatIds?: string[]
  folderPath?: string
  uploadedBy?: string
  uploadedAt?: string
  createdAt: string
}

export interface Producer {
  id: string
  name: string
  createdAt: string
  defaultRoyaltySplit?: number
}

export interface BeatSelection {
  id: string
  artistId: string
  beatId: string
  licenseType: 'lease' | 'premium_lease' | 'exclusive'
  status: 'pending' | 'approved' | 'denied'
  sessionId?: string
  createdAt: string
  selectedAt?: string
  cost?: number
  labelCut?: number
  producerPayouts?: Array<{
    producerId: string
    producerName?: string
    amount: number
    percentage?: number
  }>
}

export interface SongVaultFile {
  id: string
  songId?: string
  songName?: string
  artistName?: string
  artistId?: string
  fileName: string
  fileType: string
  fileUrl?: string
  googleDriveUrl?: string
  link?: string // External link (e.g., Dropbox, WeTransfer, etc.)
  fileSize?: number
  uploadedBy: string
  uploadedAt: string
  folderPath?: string
  isFolder: boolean
  isUnreleased?: boolean
  children?: SongVaultFile[]
}

export interface VideoVaultItem {
  id: string
  title: string
  videoUrl: string
  caption: string
  description?: string
  /** Platform: instagram, tiktok, youtube */
  platform?: string
  createdAt: string
}

export interface CatalogChangeRequest {
  id: string
  songId: string
  songName: string
  artistName: string
  requestedBy: string
  requestedByName: string
  requestedAt: string
  changes: string
  status: 'pending' | 'approved' | 'denied'
  reviewedBy?: string
  reviewedAt?: string
}

export interface PersonalCalendarEvent {
  id: string
  userId: string
  title: string
  date: string
  time?: string
  description?: string
  notifyAt?: string
  createdAt: string
}

export type LabelCalendarEventType =
  | 'artist_post'
  | 'label_post'
  | 'collab_post'
  | 'release'
  | 'promo'
  | 'studio_session'
  | 'meeting'
  | 'deadline'
  | 'event'
  | 'content_due'
  | 'announcement'
  | 'snippet'
  | 'week1_recap'
  | 'music_video'
  | 'playlist_push'
  | '48hr_push'

export type PromotionTarget = 'artist_page' | 'label_page' | 'both'

export type LabelCalendarEventStatus = 'scheduled' | 'confirmed' | 'completed' | 'missed'

export type ProductType = 'single' | 'ep' | 'album' | 'merch' | 'general_post'
export type ContentType = 'reel' | 'post' | 'story' | 'carousel' | 'video'
export type RolloutPhase = 'tease' | 'build' | 'drop' | 'post_drop'

export interface LabelCalendarEvent {
  id: string
  date: string
  /** Time in HH:mm format (optional) */
  scheduledTime?: string
  artistId?: string
  songId?: string
  /** Product type: Single, EP, Album, Merch, General Post */
  productType?: ProductType
  /** Content format: reel, post, story, etc. */
  contentType?: ContentType
  /** Video Vault item ID when attached */
  vaultVideoId?: string
  /** Campaign phase: tease, build, drop, post-drop */
  rolloutPhase?: RolloutPhase
  eventType: LabelCalendarEventType
  /** Campaign timeline step for song detail view */
  campaignStep?: 'announcement' | 'snippet' | 'release' | '48hr_push' | 'week1_recap' | 'music_video' | 'playlist_push'
  promotionTarget: PromotionTarget
  title: string
  linkedMediaUrl?: string
  linkedSnippetUrl?: string
  linkedDriveUrl?: string
  notes?: string
  status: LabelCalendarEventStatus
  locked: boolean
  createdBy: 'ai' | 'user'
  createdAt: string
  userId?: string
}

export interface ChatMessage {
  id: string
  userId?: string
  userName?: string
  message: string
  response: string
  timestamp: string
}

export interface Upload {
  id: string
  fileName: string
  uploadedAt: string
  groupedByArtist?: { [key: string]: any[] }
  rowCount?: number
  artistsFound?: string[]
  data?: any[]
}

export interface Guide {
  id: string
  title: string
  content: string
  createdBy: string
  createdAt: string
  updatedAt: string
  assignedTo: string[]
  isActive: boolean
}

// Generic file read/write helpers
export function readJsonFile<T>(filename: string): T[] {
  const filePath = path.join(DATA_DIR, filename)
  if (!fs.existsSync(filePath)) {
    return []
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return content.trim() ? JSON.parse(content) : []
  } catch {
    return []
  }
}

export function writeJsonFile<T>(filename: string, data: T[]): void {
  const filePath = path.join(DATA_DIR, filename)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

// Create a URL-safe, human-friendly catalog ID based on song + artist.
// Example: "Midnight Freestyle" by "Gp3asy" -> "midnight-freestyle-by-gp3asy"
// If a collision exists, add "-2", "-3", etc.
function slugifyForId(input: string): string {
  return (input || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // drop punctuation/special chars
    .replace(/[\s_]+/g, '-') // spaces/underscores -> -
    .replace(/-+/g, '-') // collapse multiple -
    .replace(/^-+|-+$/g, '') // trim leading/trailing -
}

function generateCatalogSlugId(song: string, artist: string, existingIds: Set<string>): string {
  const songSlug = slugifyForId(song)
  const artistSlug = slugifyForId(artist)
  const base = `${songSlug || 'untitled'}-by-${artistSlug || 'unknown'}`

  let candidate = base
  let i = 1
  while (existingIds.has(candidate)) {
    i += 1
    candidate = `${base}-${i}`
  }
  existingIds.add(candidate)
  return candidate
}

// Catalog functions
export function getCatalog(): CatalogItem[] {
  return readJsonFile<CatalogItem>('catalog.json')
}

export function addCatalogItem(item: Omit<CatalogItem, 'id'>): CatalogItem {
  // Validate required fields
  if (!item.song || typeof item.song !== 'string' || item.song.trim() === '' || item.song === '????') {
    throw new Error(`Invalid song name: "${item.song}". Song name is required and cannot be empty or "????".`)
  }
  
  if (!item.artist || typeof item.artist !== 'string' || item.artist.trim() === '' || item.artist === '????') {
    throw new Error(`Invalid artist name: "${item.artist}". Artist name is required and cannot be empty or "????".`)
  }
  
  const catalog = getCatalog()
  const existingIds = new Set(catalog.map(i => i.id).filter(Boolean))
  const newItem: CatalogItem = {
    ...item,
    song: item.song.trim(),
    artist: item.artist.trim(),
    id: generateCatalogSlugId(item.song.trim(), item.artist.trim(), existingIds),
  }
  catalog.push(newItem)
  writeJsonFile('catalog.json', catalog)
  return newItem
}

export function updateCatalogItem(id: string, updates: Partial<CatalogItem>): boolean {
  const catalog = getCatalog()
  const index = catalog.findIndex(item => item.id === id)
  if (index === -1) {
    console.error(`[updateCatalogItem] Item not found: ${id}`)
    return false
  }
  
  const oldItem = catalog[index]
  
  // Filter out undefined values from updates to prevent overwriting with undefined
  const cleanUpdates: Partial<CatalogItem> = {}
  Object.keys(updates).forEach(key => {
    const value = updates[key as keyof CatalogItem]
    // Only include defined values (not undefined, but null and empty strings are allowed)
    if (value !== undefined) {
      (cleanUpdates as any)[key] = value
    }
  })
  
  // Preserve artistId and artistIds if not explicitly being updated
  const preservedUpdates: Partial<CatalogItem> = { ...cleanUpdates }
  
  // If artistId/artistIds are not in updates, preserve existing ones
  if (!('artistId' in cleanUpdates) && oldItem.artistId) {
    preservedUpdates.artistId = oldItem.artistId
  }
  if (!('artistIds' in cleanUpdates) && oldItem.artistIds && oldItem.artistIds.length > 0) {
    preservedUpdates.artistIds = oldItem.artistIds
  }
  
  // If artistId is being cleared but artistIds exists, keep artistId from artistIds[0]
  if (cleanUpdates.artistId === '' || cleanUpdates.artistId === null) {
    if (oldItem.artistIds && oldItem.artistIds.length > 0 && !('artistIds' in cleanUpdates)) {
      preservedUpdates.artistId = oldItem.artistIds[0]
    }
  }
  
  // If artistIds is being cleared but artistId exists, create artistIds from artistId
  if ((cleanUpdates.artistIds === null || (Array.isArray(cleanUpdates.artistIds) && cleanUpdates.artistIds.length === 0)) && oldItem.artistId) {
    if (!('artistId' in cleanUpdates) || cleanUpdates.artistId === oldItem.artistId) {
      preservedUpdates.artistIds = [oldItem.artistId]
    }
  }
  
  // Merge updates with old item, preserving all existing fields
  // This ensures no fields are lost during update
  // IMPORTANT: When updating nested arrays like 'songs', we need to ensure
  // all top-level fields (like albumCover) are preserved
  const updatedItem: CatalogItem = { ...oldItem, ...preservedUpdates }
  
  // If songs array is being updated, ensure we preserve audioUrl fields in each song
  if ('songs' in preservedUpdates && Array.isArray(preservedUpdates.songs) && Array.isArray(oldItem.songs)) {
    updatedItem.songs = preservedUpdates.songs.map((newSong: any) => {
      // Find the corresponding old song to preserve its fields
      const oldSong = oldItem.songs?.find((s: any) => s.id === newSong.id)
      if (oldSong) {
        // Merge old song fields with new song fields, preserving audioUrl and other fields
        return { ...oldSong, ...newSong }
      }
      return newSong
    })
  }
  
  catalog[index] = updatedItem
  
  // Validate the updated item has required fields
  if (!catalog[index].song || !catalog[index].artist) {
    console.error(`[updateCatalogItem] Updated item missing required fields:`, {
      id,
      song: catalog[index].song,
      artist: catalog[index].artist,
      updates: Object.keys(preservedUpdates)
    })
    // Restore old item if update would break required fields
    catalog[index] = oldItem
    return false
  }
  
  writeJsonFile('catalog.json', catalog)
  return true
}

export function deleteCatalogItem(id: string): boolean {
  const catalog = getCatalog()
  const filtered = catalog.filter(item => item.id !== id)
  if (filtered.length === catalog.length) return false
  writeJsonFile('catalog.json', filtered)
  return true
}

export function archiveCatalogItem(id: string): boolean {
  const catalog = getCatalog()
  const item = catalog.find(i => i.id === id)
  if (!item) return false
  
  // Set isArchived and campaignStatus to archived
  const updatedItem = { ...item, isArchived: true, campaignStatus: 'archived' as const }
  const index = catalog.findIndex(i => i.id === id)
  catalog[index] = updatedItem
  writeJsonFile('catalog.json', catalog)
  return true
}

export function unarchiveCatalogItem(id: string): boolean {
  const catalog = getCatalog()
  const item = catalog.find(i => i.id === id)
  if (!item) return false
  
  // Remove isArchived and reset campaignStatus (will be recomputed)
  const updatedItem = { ...item }
  delete updatedItem.isArchived
  delete (updatedItem as any).campaignStatus
  const index = catalog.findIndex(i => i.id === id)
  catalog[index] = updatedItem
  writeJsonFile('catalog.json', catalog)
  return true
}

// Password helper functions with bcrypt hashing
// Note: These functions are defined at the end of the file after storage functions

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10
  return bcrypt.hash(password, saltRounds)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// Get password hashes (migrated from plain text passwords)
export function getUserPasswordHashes(user: User): string[] {
  // Return passwordHashes array if it exists
  if (user.passwordHashes && user.passwordHashes.length > 0) {
    return user.passwordHashes
  }
  
  // Backward compatibility: migrate plain text passwords to hashes
  // This will be done on first login attempt
  const plainPasswords: string[] = []
  
  if (user.passwords && user.passwords.length > 0) {
    plainPasswords.push(...user.passwords)
  }
  
  if ('password' in user && user.password !== undefined && user.password !== null && user.password !== '') {
    plainPasswords.push(user.password)
  }
  
  return plainPasswords // Return plain text for migration (will be hashed on next login)
}

// Check password against hashes (supports both hashed and plain text for migration)
export async function checkUserPassword(user: User, password: string): Promise<boolean> {
  const hashes = getUserPasswordHashes(user)
  
  // Check against hashed passwords
  for (const hash of hashes) {
    // If hash looks like bcrypt hash (starts with $2a$, $2b$, or $2y$), verify it
    if (hash.startsWith('$2')) {
      const isValid = await verifyPassword(password, hash)
      if (isValid) {
        return true
      }
    } else {
      // Plain text password (for migration) - compare directly
      if (hash === password) {
        // Migrate to hash on successful login
        await migratePasswordToHash(user, password)
        return true
      }
    }
  }
  
  return false
}

// Migrate plain text password to hash
async function migratePasswordToHash(user: User, plainPassword: string): Promise<void> {
  try {
    const hashedPassword = await hashPassword(plainPassword)
    const users = getUsers()
    const userIndex = users.findIndex(u => u.id === user.id)
    
    if (userIndex !== -1) {
      // Initialize passwordHashes array if it doesn't exist
      if (!users[userIndex].passwordHashes) {
        users[userIndex].passwordHashes = []
      }
      
      // Add hashed password if not already present
      if (!users[userIndex].passwordHashes!.includes(hashedPassword)) {
        users[userIndex].passwordHashes!.push(hashedPassword)
      }
      
      // Remove plain text passwords
      delete users[userIndex].password
      delete users[userIndex].passwords
      
      writeJsonFile('users.json', users)
    }
  } catch (error) {
    console.error('Failed to migrate password to hash:', error)
    // Don't throw - allow login to proceed
  }
}

// Add new password hash
export async function addUserPassword(user: User, newPassword: string): Promise<string[]> {
  const hashedPassword = await hashPassword(newPassword)
  const users = getUsers()
  const userIndex = users.findIndex(u => u.id === user.id)
  
  if (userIndex !== -1) {
    if (!users[userIndex].passwordHashes) {
      users[userIndex].passwordHashes = []
    }
    
    // Don't add duplicate hashes
    if (!users[userIndex].passwordHashes!.includes(hashedPassword)) {
      users[userIndex].passwordHashes!.push(hashedPassword)
    }
    
    writeJsonFile('users.json', users)
    return users[userIndex].passwordHashes!
  }
  
  return []
}

// Remove password hash
export async function removeUserPassword(user: User, passwordToRemove: string): Promise<string[]> {
  const hashes = getUserPasswordHashes(user)
  const hashedPassword = await hashPassword(passwordToRemove)
  
  const users = getUsers()
  const userIndex = users.findIndex(u => u.id === user.id)
  
  if (userIndex !== -1 && users[userIndex].passwordHashes) {
    users[userIndex].passwordHashes = users[userIndex].passwordHashes!.filter(
      hash => hash !== hashedPassword && !(hash === passwordToRemove) // Also remove plain text if present
    )
    writeJsonFile('users.json', users)
    return users[userIndex].passwordHashes || []
  }
  
  return []
}

// User functions
export function getUsers(): User[] {
  return readJsonFile<User>('users.json')
}

export function getUserById(id: string): User | undefined {
  return getUsers().find(u => u.id === id)
}

export function addUser(user: Omit<User, 'id' | 'createdAt'>): User {
  const users = getUsers()
  const newUser: User = {
    ...user,
    id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
  }
  users.push(newUser)
  writeJsonFile('users.json', users)
  return newUser
}

/**
 * Track that an artist has listened to a beat
 */
export function trackBeatListen(artistId: string, beatId: string): boolean {
  const user = getUserById(artistId)
  if (!user || user.role !== 'artist') return false
  
  const listenHistory = user.beatListenHistory || []
  // Check if already listened (within last 30 days to avoid duplicates)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const alreadyListened = listenHistory.some(
    entry => entry.beatId === beatId && entry.listenedAt > thirtyDaysAgo
  )
  
  if (!alreadyListened) {
    listenHistory.push({
      beatId,
      listenedAt: new Date().toISOString(),
    })
    return updateUser(artistId, { beatListenHistory: listenHistory })
  }
  
  return true
}

/**
 * Check if an artist has listened to a beat
 */
export function hasArtistListenedToBeat(artistId: string, beatId: string): boolean {
  const user = getUserById(artistId)
  if (!user || !user.beatListenHistory) return false
  
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  return user.beatListenHistory.some(
    entry => entry.beatId === beatId && entry.listenedAt > thirtyDaysAgo
  )
}

/**
 * Update artist's preferred genres
 */
export function updateArtistGenres(artistId: string, genres: string[]): boolean {
  return updateUser(artistId, { preferredGenres: genres })
}

/**
 * Get artist's preferred genres
 */
export function getArtistPreferredGenres(artistId: string): string[] {
  const user = getUserById(artistId)
  return user?.preferredGenres || []
}

export function updateUser(id: string, updates: Partial<User>): boolean {
  const users = getUsers()
  const index = users.findIndex(u => u.id === id)
  if (index === -1) return false
  
  const oldUser = users[index]
  
  // Clean updates - only include fields that are explicitly being updated
  // Don't overwrite with undefined or empty strings unless explicitly clearing a field
  const cleanUpdates: Partial<User> = {}
  
  Object.keys(updates).forEach(key => {
    // Skip 'id' and 'createdAt' - these shouldn't be updated
    if (key === 'id' || key === 'createdAt') return
    
    const value = (updates as any)[key]
    
    // Only include fields that are explicitly set (not undefined)
    if (value !== undefined) {
      // For optional string fields like phoneNumber, allow empty string to clear it
      if (key === 'phoneNumber' || key === 'artistName' || key === 'realName' || key === 'ipi') {
        cleanUpdates[key as keyof User] = value === '' ? undefined : (value as any)
      }
      // For password, only update if a new password is provided (not empty)
      else if (key === 'password') {
        if (value && value.trim()) {
          cleanUpdates[key as keyof User] = value as any
        }
        // If password is empty/undefined, don't update it (preserve existing)
      }
      // For arrays, allow empty arrays
      else if (Array.isArray(value)) {
        cleanUpdates[key as keyof User] = value as any
      }
      // For other fields, include the value
      else if (value !== null && value !== '') {
        cleanUpdates[key as keyof User] = value as any
      }
    }
  })
  
  // Merge updates with existing user data, preserving all existing fields
  users[index] = { ...oldUser, ...cleanUpdates }
  writeJsonFile('users.json', users)
  return true
}

export function deleteUser(id: string): boolean {
  const users = getUsers()
  const filtered = users.filter(u => u.id !== id)
  if (filtered.length === users.length) return false
  writeJsonFile('users.json', filtered)
  return true
}

// Task functions
export function getTasks(): Task[] {
  return readJsonFile<Task>('tasks.json')
}

export function addTask(task: Omit<Task, 'id' | 'createdAt'>): Task {
  const tasks = getTasks()
  const newTask: Task = {
    ...task,
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    status: task.status || 'pending',
  }
  tasks.push(newTask)
  writeJsonFile('tasks.json', tasks)
  return newTask
}

export function updateTask(id: string, updates: Partial<Task>): boolean {
  const tasks = getTasks()
  const index = tasks.findIndex(t => t.id === id)
  if (index === -1) return false
  tasks[index] = { ...tasks[index], ...updates }
  writeJsonFile('tasks.json', tasks)
  return true
}

export function deleteTask(id: string): boolean {
  const tasks = getTasks()
  const filtered = tasks.filter(t => t.id !== id)
  if (filtered.length === tasks.length) return false
  writeJsonFile('tasks.json', filtered)
  return true
}

// Message functions
export function getMessages(userId?: string): Message[] {
  const messages = readJsonFile<Message>('messages.json')
  return userId ? messages.filter(m => m.to === userId) : messages
}

export function addMessage(message: Omit<Message, 'id' | 'createdAt' | 'read'>): Message {
  const messages = getMessages()
  const newMessage: Message = {
    ...message,
    id: `message_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    read: false,
    createdAt: new Date().toISOString(),
  }
  messages.push(newMessage)
  writeJsonFile('messages.json', messages)
  return newMessage
}

export function updateMessage(id: string, updates: Partial<Message>): boolean {
  const messages = getMessages()
  const index = messages.findIndex(m => m.id === id)
  if (index === -1) return false
  messages[index] = { ...messages[index], ...updates }
  writeJsonFile('messages.json', messages)
  return true
}

// Convenience helper (used by notifications API)
export function markMessageRead(id: string): boolean {
  return updateMessage(id, { read: true })
}

// Contract functions
export function getContracts(songId?: string, artistId?: string): Contract[] {
  let contracts = readJsonFile<Contract>('contracts.json')
  if (songId) contracts = contracts.filter(c => c.songId === songId)
  if (artistId) contracts = contracts.filter(c => c.artistIds.includes(artistId))
  return contracts
}

export function addContract(contract: Omit<Contract, 'id' | 'createdAt'>): Contract {
  const contracts = getContracts()
  const newContract: Contract = {
    ...contract,
    id: `contract_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
  }
  const allContracts = getContracts()
  allContracts.push(newContract)
  writeJsonFile('contracts.json', allContracts)
  return newContract
}

export function updateContract(id: string, updates: Partial<Contract>): Contract | null {
  const contracts = getContracts()
  const index = contracts.findIndex(c => c.id === id)
  if (index === -1) return null
  contracts[index] = { ...contracts[index], ...updates }
  writeJsonFile('contracts.json', contracts)
  return contracts[index]
}

export function deleteContract(id: string): boolean {
  const contracts = getContracts()
  const filtered = contracts.filter(c => c.id !== id)
  if (filtered.length === contracts.length) return false
  writeJsonFile('contracts.json', filtered)
  return true
}

export function addContractDocument(
  contractId: string,
  doc: Omit<ContractDocument, 'id' | 'uploadedAt'>
): Contract | null {
  const contracts = getContracts()
  const index = contracts.findIndex(c => c.id === contractId)
  if (index === -1) return null
  const contract = contracts[index]
  const documents = contract.documents || []
  const newDoc: ContractDocument = {
    ...doc,
    id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    uploadedAt: new Date().toISOString(),
  }
  documents.push(newDoc)
  contract.documents = documents
  contracts[index] = contract
  writeJsonFile('contracts.json', contracts)
  return contract
}

export function removeContractDocument(contractId: string, docId: string): Contract | null {
  const contracts = getContracts()
  const index = contracts.findIndex(c => c.id === contractId)
  if (index === -1) return null
  const contract = contracts[index]
  const documents = (contract.documents || []).filter(d => d.id !== docId)
  contract.documents = documents
  contracts[index] = contract
  writeJsonFile('contracts.json', contracts)
  return contract
}

// Beat functions
export function getBeats(filters?: any): Beat[] {
  let beats = readJsonFile<Beat>('beats.json')
  if (filters) {
    if (filters.status) beats = beats.filter(b => b.status === filters.status)
    if (filters.producerId) beats = beats.filter(b => b.producerIds.includes(filters.producerId))
    if (filters.genre) beats = beats.filter(b => b.genre === filters.genre)
    if (filters.bpm) beats = beats.filter(b => b.bpm === filters.bpm)
    if (filters.packId) beats = beats.filter(b => b.packId === filters.packId)
    if (filters.availableOnly) beats = beats.filter(b => b.status === 'available')
  }
  return beats
}

export function getBeatById(id: string): Beat | undefined {
  return getBeats().find(b => b.id === id)
}

export function addBeat(beat: Omit<Beat, 'id' | 'createdAt' | 'updatedAt'>): Beat {
  const addBeatStart = Date.now()
  // #region agent log
  fetch('http://127.0.0.1:1024/ingest/738e3ff4-c1bc-4f87-8364-ca554946b59d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'storage.ts:910',message:'addBeat start',data:{beatName:beat.name},timestamp:Date.now(),runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  const beats = getBeats()
  const newBeat: Beat = {
    ...beat,
    id: `beat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  beats.push(newBeat)
  const writeStart = Date.now()
  writeJsonFile('beats.json', beats)
  // #region agent log
  fetch('http://127.0.0.1:1024/ingest/738e3ff4-c1bc-4f87-8364-ca554946b59d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'storage.ts:923',message:'addBeat complete',data:{beatId:newBeat.id,beatName:beat.name,writeTime:Date.now()-writeStart,totalTime:Date.now()-addBeatStart},timestamp:Date.now(),runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  return newBeat
}

export function updateBeat(id: string, updates: Partial<Beat>): boolean {
  const beats = getBeats()
  const index = beats.findIndex(b => b.id === id)
  if (index === -1) return false
  beats[index] = { ...beats[index], ...updates, updatedAt: new Date().toISOString() }
  writeJsonFile('beats.json', beats)
  return true
}

export function deleteBeat(id: string): boolean {
  const beats = getBeats()
  const filtered = beats.filter(b => b.id !== id)
  if (filtered.length === beats.length) return false
  writeJsonFile('beats.json', filtered)
  return true
}

// Beat file functions
export function getBeatFiles(beatId?: string): BeatFile[] {
  const files = readJsonFile<BeatFile>('beatFiles.json')
  return beatId ? files.filter(f => f.beatId === beatId) : files
}

export function addBeatFile(file: Omit<BeatFile, 'id' | 'uploadedAt'> & { fileUrl?: string; folderPath?: string; isFolder?: boolean }): BeatFile {
  const files = getBeatFiles()
  const newFile: BeatFile = {
    ...file,
    id: `beatfile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    uploadedAt: new Date().toISOString(),
  }
  files.push(newFile)
  writeJsonFile('beatFiles.json', files)
  return newFile
}

export function updateBeatFile(id: string, updates: Partial<BeatFile>): boolean {
  const files = getBeatFiles()
  const index = files.findIndex(f => f.id === id)
  if (index === -1) return false
  files[index] = { ...files[index], ...updates }
  writeJsonFile('beatFiles.json', files)
  return true
}

export function deleteBeatFile(id: string): boolean {
  const files = getBeatFiles()
  const filtered = files.filter(f => f.id !== id)
  if (filtered.length === files.length) return false
  writeJsonFile('beatFiles.json', filtered)
  return true
}

// Beat pack functions
export function getBeatPacks(): BeatPack[] {
  return readJsonFile<BeatPack>('beatPacks.json')
}

export function addBeatPack(pack: Omit<BeatPack, 'id' | 'createdAt'>): BeatPack {
  const packs = getBeatPacks()
  const newPack: BeatPack = {
    ...pack,
    id: `pack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
  }
  packs.push(newPack)
  writeJsonFile('beatPacks.json', packs)
  return newPack
}

// Producer functions
export function getProducers(): Producer[] {
  return readJsonFile<Producer>('producers.json')
}

export function updateProducer(id: string, updates: Partial<Producer>): boolean {
  const producers = getProducers()
  const index = producers.findIndex(p => p.id === id)
  if (index === -1) return false
  producers[index] = { ...producers[index], ...updates }
  writeJsonFile('producers.json', producers)
  return true
}

export function findOrCreateProducer(name: string): Producer {
  const producers = getProducers()
  let producer = producers.find(p => p.name.toLowerCase() === name.toLowerCase())
  if (!producer) {
    producer = {
      id: `producer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      createdAt: new Date().toISOString(),
    }
    producers.push(producer)
    writeJsonFile('producers.json', producers)
  }
  return producer
}

// Beat selection functions
export function getBeatSelections(artistId?: string, sessionId?: string): BeatSelection[] {
  let selections = readJsonFile<BeatSelection>('beatSelections.json')
  if (artistId) selections = selections.filter(s => s.artistId === artistId)
  if (sessionId) selections = selections.filter(s => s.sessionId === sessionId)
  return selections
}

export function addBeatSelection(selection: Omit<BeatSelection, 'id' | 'createdAt'>): BeatSelection {
  const selections = getBeatSelections()
  const newSelection: BeatSelection = {
    ...selection,
    id: `selection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
  }
  selections.push(newSelection)
  writeJsonFile('beatSelections.json', selections)
  return newSelection
}

// Song vault functions
export function getSongVaultFiles(songId?: string): SongVaultFile[] {
  const files = readJsonFile<SongVaultFile>('songVault.json')
  return songId ? files.filter(f => f.songId === songId) : files
}

export function addSongVaultFile(file: Omit<SongVaultFile, 'id' | 'uploadedAt'> & { link?: string }): SongVaultFile {
  const files = getSongVaultFiles()
  const newFile: SongVaultFile = {
    ...file,
    link: file.link || undefined,
    id: `vault_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    uploadedAt: new Date().toISOString(),
  }
  files.push(newFile)
  writeJsonFile('songVault.json', files)
  return newFile
}

export function updateSongVaultFile(id: string, updates: Partial<SongVaultFile>): boolean {
  const files = getSongVaultFiles()
  const index = files.findIndex(f => f.id === id)
  if (index === -1) return false
  files[index] = { ...files[index], ...updates }
  writeJsonFile('songVault.json', files)
  return true
}

export function deleteSongVaultFile(id: string): boolean {
  const files = getSongVaultFiles()
  const filtered = files.filter(f => f.id !== id)
  if (filtered.length === files.length) return false
  writeJsonFile('songVault.json', filtered)
  return true
}

export function updateVaultFilesByFolderPath(oldPath: string, newPath: string, songId?: string): number {
  const files = getSongVaultFiles()
  let updated = 0
  files.forEach(file => {
    if (file.folderPath === oldPath && (!songId || file.songId === songId)) {
      file.folderPath = newPath
      updated++
    }
  })
  if (updated > 0) writeJsonFile('songVault.json', files)
  return updated
}

export function deleteVaultFilesByFolderPath(folderPath: string, songId?: string): number {
  const files = getSongVaultFiles()
  const filtered = files.filter(f => !(f.folderPath === folderPath && (!songId || f.songId === songId)))
  const deleted = files.length - filtered.length
  if (deleted > 0) writeJsonFile('songVault.json', filtered)
  return deleted
}

// Catalog change requests (staff requests changes to owner)
export function getCatalogChangeRequests(requestedBy?: string, status?: 'pending' | 'approved' | 'denied'): CatalogChangeRequest[] {
  let items = readJsonFile<CatalogChangeRequest>('catalogChangeRequests.json')
  if (requestedBy) items = items.filter(r => r.requestedBy === requestedBy)
  if (status) items = items.filter(r => r.status === status)
  return items.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
}

export function addCatalogChangeRequest(req: Omit<CatalogChangeRequest, 'id' | 'requestedAt' | 'status'>): CatalogChangeRequest {
  const items = getCatalogChangeRequests()
  const newReq: CatalogChangeRequest = {
    ...req,
    id: `ccr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    requestedAt: new Date().toISOString(),
    status: 'pending',
  }
  items.unshift(newReq)
  writeJsonFile('catalogChangeRequests.json', items)
  return newReq
}

export function updateCatalogChangeRequest(id: string, updates: Partial<CatalogChangeRequest>): CatalogChangeRequest | null {
  const items = readJsonFile<CatalogChangeRequest>('catalogChangeRequests.json')
  const index = items.findIndex(r => r.id === id)
  if (index === -1) return null
  items[index] = { ...items[index], ...updates }
  writeJsonFile('catalogChangeRequests.json', items)
  return items[index]
}

// Personal calendar events
export function getPersonalCalendarEvents(userId: string, startDate?: string, endDate?: string): PersonalCalendarEvent[] {
  let items = readJsonFile<PersonalCalendarEvent>('personalCalendarEvents.json').filter(e => e.userId === userId)
  if (startDate) items = items.filter(e => e.date >= startDate)
  if (endDate) items = items.filter(e => e.date <= endDate)
  return items.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))
}

/** All personal events in date range (for ICS feed, no user filter) */
export function getAllPersonalCalendarEvents(startDate?: string, endDate?: string): PersonalCalendarEvent[] {
  let items = readJsonFile<PersonalCalendarEvent>('personalCalendarEvents.json')
  if (startDate) items = items.filter(e => e.date >= startDate)
  if (endDate) items = items.filter(e => e.date <= endDate)
  return items.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))
}

export function addPersonalCalendarEvent(event: Omit<PersonalCalendarEvent, 'id' | 'createdAt'>): PersonalCalendarEvent {
  const items = readJsonFile<PersonalCalendarEvent>('personalCalendarEvents.json')
  const newEvent: PersonalCalendarEvent = {
    ...event,
    id: `pce_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
  }
  items.push(newEvent)
  writeJsonFile('personalCalendarEvents.json', items)
  return newEvent
}

export function updatePersonalCalendarEvent(id: string, userId: string, updates: Partial<PersonalCalendarEvent>): PersonalCalendarEvent | null {
  const items = readJsonFile<PersonalCalendarEvent>('personalCalendarEvents.json')
  const index = items.findIndex(e => e.id === id && e.userId === userId)
  if (index === -1) return null
  items[index] = { ...items[index], ...updates }
  writeJsonFile('personalCalendarEvents.json', items)
  return items[index]
}

export function deletePersonalCalendarEvent(id: string, userId: string): boolean {
  const items = readJsonFile<PersonalCalendarEvent>('personalCalendarEvents.json')
  const filtered = items.filter(e => !(e.id === id && e.userId === userId))
  if (filtered.length === items.length) return false
  writeJsonFile('personalCalendarEvents.json', filtered)
  return true
}

// Label calendar events (unified scheduling)
export function getLabelCalendarEvents(startDate?: string, endDate?: string, songId?: string): LabelCalendarEvent[] {
  let items = readJsonFile<LabelCalendarEvent>('labelCalendarEvents.json')
  if (songId) items = items.filter(e => e.songId === songId)
  if (startDate) items = items.filter(e => e.date >= startDate)
  if (endDate) items = items.filter(e => e.date <= endDate)
  return items.sort((a, b) => a.date.localeCompare(b.date))
}

export function addLabelCalendarEvent(event: Omit<LabelCalendarEvent, 'id' | 'createdAt'>): LabelCalendarEvent {
  const items = readJsonFile<LabelCalendarEvent>('labelCalendarEvents.json')
  const newEvent: LabelCalendarEvent = {
    ...event,
    id: `lce_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
  }
  items.push(newEvent)
  writeJsonFile('labelCalendarEvents.json', items)
  return newEvent
}

export function updateLabelCalendarEvent(id: string, updates: Partial<LabelCalendarEvent>): LabelCalendarEvent | null {
  const items = readJsonFile<LabelCalendarEvent>('labelCalendarEvents.json')
  const index = items.findIndex(e => e.id === id)
  if (index === -1) return null
  items[index] = { ...items[index], ...updates }
  writeJsonFile('labelCalendarEvents.json', items)
  return items[index]
}

export function deleteLabelCalendarEvent(id: string): boolean {
  const items = readJsonFile<LabelCalendarEvent>('labelCalendarEvents.json')
  const filtered = items.filter(e => e.id !== id)
  if (filtered.length === items.length) return false
  writeJsonFile('labelCalendarEvents.json', filtered)
  return true
}

// Video vault functions
export function getVideoVaultItems(): VideoVaultItem[] {
  return readJsonFile<VideoVaultItem>('videoVault.json')
}

export function addVideoVaultItem(item: Omit<VideoVaultItem, 'id' | 'createdAt'>): VideoVaultItem {
  const items = getVideoVaultItems()
  const newItem: VideoVaultItem = {
    ...item,
    id: `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
  }
  items.push(newItem)
  writeJsonFile('videoVault.json', items)
  return newItem
}

// Chat functions
export function getChatHistory(userId?: string): ChatMessage[] {
  const messages = readJsonFile<ChatMessage>('chatHistory.json')
  return userId ? messages.filter(m => m.userId === userId) : messages
}

export function addChatMessage(userId: string | undefined, role: 'user' | 'assistant', message: string): ChatMessage {
  const messages = getChatHistory()
  const newMessage: ChatMessage = {
    id: `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    userName: undefined,
    message: role === 'user' ? message : '',
    response: role === 'assistant' ? message : '',
    timestamp: new Date().toISOString(),
  }
  messages.push(newMessage)
  writeJsonFile('chatHistory.json', messages)
  return newMessage
}

// Upload functions
export function getUploads(): Upload[] {
  return readJsonFile<Upload>('uploads.json')
}

export function saveUpload(upload: Omit<Upload, 'id'>): Upload {
  const uploads = getUploads()
  const newUpload: Upload = {
    ...upload,
    id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  }
  uploads.push(newUpload)
  writeJsonFile('uploads.json', uploads)
  return newUpload
}

export function deleteUpload(id: string): boolean {
  const uploads = getUploads()
  const filtered = uploads.filter(u => u.id !== id)
  if (filtered.length === uploads.length) return false
  writeJsonFile('uploads.json', filtered)
  return true
}

export function updateUpload(id: string, updates: Partial<Upload>): boolean {
  const uploads = getUploads()
  const index = uploads.findIndex(u => u.id === id)
  if (index === -1) return false
  uploads[index] = { ...uploads[index], ...updates }
  writeJsonFile('uploads.json', uploads)
  return true
}

// Artist data functions
export function saveArtistData(artistName: string, data: any[]): void {
  const filePath = path.join(DATA_DIR, `artist_${artistName.replace(/[^a-zA-Z0-9]/g, '_')}.json`)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

export function getArtistData(artistName: string): any[] {
  const filePath = path.join(DATA_DIR, `artist_${artistName.replace(/[^a-zA-Z0-9]/g, '_')}.json`)
  if (!fs.existsSync(filePath)) return []
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return []
  }
}

export function getAllArtists(): string[] {
  const artistSet = new Set<string>()
  
  // 1. Get artists from artist_*.json files
  try {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('artist_') && f.endsWith('.json'))
    files.forEach(f => {
      const artistName = f.replace(/^artist_/, '').replace(/\.json$/, '').replace(/_/g, ' ')
      if (artistName) artistSet.add(artistName)
    })
  } catch (error) {
    console.error('Error reading artist files:', error)
  }
  
  // 2. Get artists from catalog
  try {
    const catalog = getCatalog()
    catalog.forEach(item => {
      if (item.artist) {
        // Import parseArtistsFromString dynamically to avoid circular dependencies
        const { parseArtistsFromString } = require('./artistParser')
        const artists = parseArtistsFromString(item.artist)
        artists.forEach((artist: string) => {
          if (artist && artist.trim()) {
            artistSet.add(artist.trim())
          }
        })
      }
    })
  } catch (error) {
    console.error('Error reading catalog for artists:', error)
  }
  
  // 3. Get artists from uploads (groupedByArtist)
  try {
    const uploads = getUploads()
    uploads.forEach(upload => {
      if (upload.groupedByArtist) {
        Object.keys(upload.groupedByArtist).forEach(artistName => {
          if (artistName && artistName.trim()) {
            artistSet.add(artistName.trim())
          }
        })
      }
      // Also check artistsFound field
      if (upload.artistsFound && Array.isArray(upload.artistsFound)) {
        upload.artistsFound.forEach(artistName => {
          if (artistName && artistName.trim()) {
            artistSet.add(artistName.trim())
          }
        })
      }
    })
  } catch (error) {
    console.error('Error reading uploads for artists:', error)
  }
  
  // 4. Get artists from user accounts (artistName field)
  try {
    const users = getUsers()
    users.forEach(user => {
      if (user.artistName && user.artistName.trim()) {
        artistSet.add(user.artistName.trim())
      }
      // Also check aliases
      if (user.aliases && Array.isArray(user.aliases)) {
        user.aliases.forEach(alias => {
          if (alias && alias.trim()) {
            artistSet.add(alias.trim())
          }
        })
      }
    })
  } catch (error) {
    console.error('Error reading users for artists:', error)
  }
  
  return Array.from(artistSet).sort()
}

// Notification read states
// Support both old format (array of individual entries) and new format (grouped by user)
export function getNotificationReadStates(userId: string): Set<string> {
  const states = readJsonFile<any>('notificationReadStates.json')
  if (!states || states.length === 0) return new Set()
  
  // Check if it's the old format (array of individual entries with notificationId field)
  const firstItem = states[0]
  if (firstItem && 'notificationId' in firstItem) {
    // Old format: [{ userId, notificationId, type, readAt }, ...]
    const userReadStates = states
      .filter((s: any) => s.userId === userId)
      .map((s: any) => s.notificationId)
    return new Set(userReadStates)
  } else {
    // New format: [{ userId, notificationIds: [...] }, ...]
    const userState = states.find((s: any) => s.userId === userId)
    return new Set(userState?.notificationIds || [])
  }
}

export function markNotificationRead(userId: string, notificationId: string, type?: string): void {
  const states = readJsonFile<any>('notificationReadStates.json')
  if (!states || states.length === 0) {
    // Initialize with new format
    const newState = [{ userId, notificationIds: [notificationId] }]
    writeJsonFile('notificationReadStates.json', newState)
    return
  }
  
  // Check if it's the old format (array of individual entries with notificationId field)
  const firstItem = states[0]
  if (firstItem && 'notificationId' in firstItem) {
    // Old format: check if this notification is already marked
    const alreadyMarked = states.some((s: any) => 
      s.userId === userId && s.notificationId === notificationId
    )
    
    if (!alreadyMarked) {
      // Add new entry in old format
      states.push({
        userId,
        notificationId,
        type: type || 'unknown',
        readAt: new Date().toISOString()
      })
      writeJsonFile('notificationReadStates.json', states)
    }
  } else {
    // New format: group by userId
    let userState = states.find((s: any) => s.userId === userId)
    if (!userState) {
      userState = { userId, notificationIds: [] }
      states.push(userState)
    }
    if (!userState.notificationIds.includes(notificationId)) {
      userState.notificationIds.push(notificationId)
      writeJsonFile('notificationReadStates.json', states)
    }
  }
}

// Notification deleted states
export function getNotificationDeletedStates(userId: string): Set<string> {
  const states = readJsonFile<any>('notificationDeletedStates.json')
  if (!states || states.length === 0) return new Set()
  
  // Check if it's the old format (array of individual entries with notificationId field)
  const firstItem = states[0]
  if (firstItem && 'notificationId' in firstItem) {
    // Old format: [{ userId, notificationId, deletedAt }, ...]
    const userDeletedStates = states
      .filter((s: any) => s.userId === userId)
      .map((s: any) => s.notificationId)
    return new Set(userDeletedStates)
  } else {
    // New format: [{ userId, notificationIds: [...] }, ...]
    const userState = states.find((s: any) => s.userId === userId)
    return new Set(userState?.notificationIds || [])
  }
}

export function markNotificationDeleted(userId: string, notificationId: string): void {
  const states = readJsonFile<any>('notificationDeletedStates.json')
  if (!states || states.length === 0) {
    // Initialize with new format
    const newState = [{ userId, notificationIds: [notificationId] }]
    writeJsonFile('notificationDeletedStates.json', newState)
    return
  }
  
  // Check if it's the old format (array of individual entries with notificationId field)
  const firstItem = states[0]
  if (firstItem && 'notificationId' in firstItem) {
    // Old format: check if this notification is already deleted
    const alreadyDeleted = states.some((s: any) => 
      s.userId === userId && s.notificationId === notificationId
    )
    
    if (!alreadyDeleted) {
      // Add new entry in old format
      states.push({
        userId,
        notificationId,
        deletedAt: new Date().toISOString()
      })
      writeJsonFile('notificationDeletedStates.json', states)
    }
  } else {
    // New format: group by userId
    let userState = states.find((s: any) => s.userId === userId)
    if (!userState) {
      userState = { userId, notificationIds: [] }
      states.push(userState)
    }
    if (!userState.notificationIds.includes(notificationId)) {
      userState.notificationIds.push(notificationId)
      writeJsonFile('notificationDeletedStates.json', states)
    }
  }
}

// Guide functions
export function getGuides(): Guide[] {
  return readJsonFile<Guide>('guides.json')
}

export function addGuide(guide: Omit<Guide, 'id' | 'createdAt' | 'updatedAt'>): Guide {
  const guides = getGuides()
  const newGuide: Guide = {
    ...guide,
    id: `guide_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  guides.push(newGuide)
  writeJsonFile('guides.json', guides)
  return newGuide
}

export function updateGuide(id: string, updates: Partial<Guide>): boolean {
  const guides = getGuides()
  const index = guides.findIndex(g => g.id === id)
  if (index === -1) return false
  guides[index] = { ...guides[index], ...updates, updatedAt: new Date().toISOString() }
  writeJsonFile('guides.json', guides)
  return true
}

export function deleteGuide(id: string): boolean {
  const guides = getGuides()
  const filtered = guides.filter(g => g.id !== id)
  if (filtered.length === guides.length) return false
  writeJsonFile('guides.json', filtered)
  return true
}

export function getGuidesForUser(userId: string): Guide[] {
  const guides = getGuides()
  return guides.filter(g => g.isActive && g.assignedTo.includes(userId))
}

// Artist-to-User mapping functions
export interface ArtistUserMapping {
  id: string
  artistName: string
  userId: string
  createdAt: string
  updatedAt: string
}

export function getArtistUserMappings(): ArtistUserMapping[] {
  try {
    const mappings = readJsonFile<ArtistUserMapping>('artistUserMappings.json')
    // Ensure we return an array
    if (!Array.isArray(mappings)) {
      console.error('[getArtistUserMappings] File does not contain an array:', mappings)
      return []
    }
    return mappings
  } catch (error: any) {
    console.error('[getArtistUserMappings] Error reading mappings:', error)
    return []
  }
}

export function addArtistUserMapping(mapping: Omit<ArtistUserMapping, 'id' | 'createdAt' | 'updatedAt'>): ArtistUserMapping {
  try {
    const mappings = getArtistUserMappings()
    
    // Remove any existing mapping for this artist name
    const filtered = mappings.filter(m => m.artistName.toLowerCase() !== mapping.artistName.toLowerCase())
    
    const newMapping: ArtistUserMapping = {
      ...mapping,
      id: `mapping_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    
    filtered.push(newMapping)
    writeJsonFile('artistUserMappings.json', filtered)
    
    return newMapping
  } catch (error: any) {
    console.error('[addArtistUserMapping] Error:', error)
    console.error('[addArtistUserMapping] Error stack:', error.stack)
    throw error
  }
}

export function deleteArtistUserMapping(artistName: string): boolean {
  const mappings = getArtistUserMappings()
  const filtered = mappings.filter(m => m.artistName.toLowerCase() !== artistName.toLowerCase())
  if (filtered.length === mappings.length) return false
  writeJsonFile('artistUserMappings.json', filtered)
  return true
}

export function getUserIdForArtist(artistName: string): string | null {
  const mappings = getArtistUserMappings()
  const mapping = mappings.find(m => m.artistName.toLowerCase() === artistName.toLowerCase())
  return mapping?.userId || null
}

// Collaborative song account mappings (for songs with multiple artists)
export interface CollaborativeSongMapping {
  id: string
  songName: string
  artistString: string // e.g., "Lilpoetiq & Slykstah"
  primaryUserId: string // Which account this song should link to
  createdAt: string
  updatedAt: string
}

// Release Readiness interfaces
export interface ReleaseReadiness {
  id: string
  artistId: string
  state: 'cooling' | 'building' | 'ready' // Internal states (admin/AI only)
  decisionState?: 'UNDER_REVIEW' | 'APPROVED' | 'HOLD' | 'DENIED' // Artist-facing decision states
  lastUpdated: string
  // Release request data
  releaseRequest?: ReleaseRequest
  // Decision data
  decision?: ReleaseDecision
}

export interface ReleaseRequest {
  id: string
  artistId: string
  releaseType: 'single' | 'ep' | 'album' | 'visual'
  intendedTimeframe: 'asap' | 'this_month' | 'next_month'
  assetsConfirmed: {
    finalMixMaster: boolean
    coverArt: boolean
    distributionFiles: boolean
  }
  requestedAt: string
  status: 'pending' | 'under_review' | 'decided'
}

export interface ReleaseDecision {
  decision: 'APPROVED' | 'HOLD' | 'DENIED'
  decidedAt: string
  // APPROVED fields
  releaseWindow?: {
    open: boolean
    durationDays: number
    expiresAt: string
  }
  approvalReason?: string
  rules?: string[]
  // HOLD fields
  holdReasons?: {
    audienceReadiness?: string[]
    momentum?: string[]
    execution?: string[]
    dataGaps?: string[]
  }
  actionableTasks?: Array<{
    id: string
    task: string
    measurable: boolean
    completed: boolean
    completedAt?: string
  }>
  // DENIED fields
  denialReason?: string
  expectedOutcome?: string
  rebuildPlan?: string[]
  cooldownPeriodDays?: number
  cooldownUntil?: string
  // Evidence (metrics used in decision)
  evidence?: {
    heatScore?: number
    momentumSpeed?: number
    confidenceIndex?: number
    simulationOutcome?: string
    metrics?: any
  }
}

export interface ReadinessExplanation {
  id: string
  artistId: string
  explanationText: string
  actionSteps: string[]
  adminNotes?: string  // Admin-focused insights
  laneContext?: string  // Lane-specific one-liner
  generatedAt: string
}

export interface InstagramMetrics {
  id: string
  artistId: string
  metricDate: string
  views: number
  saves: number
  shares: number
  comments: number
  likes?: number
  completionRate: number
  retention?: number // Retention rate as percentage (0-100)
  skipRate?: number // Skip rate as percentage (0-100)
  interactions?: number // Total interactions count
  watchTime?: number // Watch time in seconds
  audience?: number // Audience count
  facebookVsInstagram?: {
    facebook: number // Facebook-specific metric (could be views, engagement, etc.)
    instagram: number // Instagram-specific metric
  }
  followers: number
  manuallyAdded?: boolean // Flag to indicate if this was manually added by staff/admin
  addedBy?: string // User ID of staff member or admin who added this
  videoTitle?: string // Title/description of the video/post
  videoLink?: string // Link to the Instagram post/video
}

export interface TikTokMetrics {
  id: string
  artistId: string
  metricDate: string
  views: number
  likes?: number
  comments?: number
  shares?: number
  followers: number
  engagementRate?: number // Engagement rate as percentage (0-100)
  watchTime?: number // Watch time in seconds
  retention?: number // Retention rate as percentage (0-100)
  manuallyAdded?: boolean // Flag to indicate if this was manually added by staff/admin
  addedBy?: string // User ID of staff member or admin who added this
  videoTitle?: string // Title/description of the TikTok video
  videoLink?: string // Link to the TikTok video
}

export interface TikTokSongViews {
  id: string
  songId: string // Catalog item ID
  songName: string // Song name for reference
  artistName: string // Artist name for reference
  views: number // TikTok views for this song
  metricDate: string // Date of the views
  videoUrl?: string // TikTok video URL if available
  manuallyAdded?: boolean // Flag to indicate if this was manually added
  addedBy?: string // User ID of staff member or admin who added this
  createdAt: string
}

export interface SpotifySnapshot {
  id: string
  artistId: string
  releaseId?: string
  weekStart: string
  streams: number
  listeners: number
  saveRate: number
  playlistAdds: number
  topCities: string[]
  confidence: number
  rawImageUrl?: string
  createdAt: string
  lowConfidenceFlag?: boolean  // Flag for low confidence OCR
  processingError?: string  // Store processing errors
}

export interface PostReleaseEvaluation {
  id: string
  releaseId: string
  artistId: string
  releaseDate: string
  evaluatedAt: string
  readinessAtRelease: {
    state: 'cooling' | 'building' | 'ready'
    momentum: 'rising' | 'steady' | 'falling'
    weightedScore: number
    explanation?: string
  }
  spotifyOutcomes: {
    week1Streams?: number
    week1Listeners?: number
    week1SaveRate?: number
    week1PlaylistAdds?: number
    week2Streams?: number
    week2Listeners?: number
    week4Streams?: number
    week4Listeners?: number
    peakStreams?: number
    peakListeners?: number
    totalStreams?: number
    totalListeners?: number
  }
  internalNotes: {
    performanceRating: 'exceeded' | 'met' | 'below' | 'significantly_below'
    keyFindings: string[]
    recommendations: string[]
    correlationNotes?: string
  }
  evaluatedBy?: string
  isArchived?: boolean
}

export interface StaffOverride {
  id: string
  artistId: string
  overriddenState: 'cooling' | 'building' | 'ready'
  originalState: 'cooling' | 'building' | 'ready'
  reason: string
  overriddenBy: string
  overriddenAt: string
  releaseDate?: string
  releaseId?: string
  outcome?: {
    streams?: number
    performance?: 'exceeded' | 'met' | 'below' | 'significantly_below'
    notes?: string
    evaluatedAt?: string
  }
}

export interface PostDropHealth {
  id: string
  releaseId: string
  artistId: string
  releaseDate: string
  health6h?: {
    status: 'held-attention' | 'initial-spike' | 'slow-burn' | 'underperformed'
    streams?: number
    engagement?: number
    notes?: string
  }
  health24h?: {
    status: 'held-attention' | 'initial-spike' | 'slow-burn' | 'underperformed'
    streams?: number
    engagement?: number
    notes?: string
  }
  health72h?: {
    status: 'held-attention' | 'initial-spike' | 'slow-burn' | 'underperformed'
    streams?: number
    engagement?: number
    notes?: string
  }
  overallClassification?: string
  lessonsLearned?: string[]
  createdAt: string
}

export interface ReleaseMemory {
  id: string
  artistId: string
  successfulStates: Array<{
    state: 'cooling' | 'building' | 'ready'
    count: number
    avgStreams: number
    successRate: number
  }>
  failedStates: Array<{
    state: 'cooling' | 'building' | 'ready'
    count: number
    avgStreams: number
    successRate: number
  }>
  laneRules: {
    canDropAtBuilding: boolean
    canDropAtCooling: boolean
    successRate: number
    totalReleases: number
  }
  personalRhythm: {
    optimalWindow?: string
    bestDropType?: string
    avgTimeToPeak?: number
    bestPerformingGoal?: string
  }
  insights: string[]
  lastUpdated: string
}

export function getCollaborativeSongMappings(): CollaborativeSongMapping[] {
  return readJsonFile<CollaborativeSongMapping>('collaborativeSongMappings.json')
}

export function addCollaborativeSongMapping(mapping: Omit<CollaborativeSongMapping, 'id' | 'createdAt' | 'updatedAt'>): CollaborativeSongMapping {
  const mappings = getCollaborativeSongMappings()
  
  // Remove any existing mapping for this song/artist combination
  const normalized = `${mapping.songName.toLowerCase()}_${mapping.artistString.toLowerCase()}`
  const filtered = mappings.filter(m => 
    `${m.songName.toLowerCase()}_${m.artistString.toLowerCase()}` !== normalized
  )
  
  const newMapping: CollaborativeSongMapping = {
    ...mapping,
    id: `collab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  
  filtered.push(newMapping)
  writeJsonFile('collaborativeSongMappings.json', filtered)
  return newMapping
}

export function deleteCollaborativeSongMapping(id: string): boolean {
  const mappings = getCollaborativeSongMappings()
  const filtered = mappings.filter(m => m.id !== id)
  if (filtered.length === mappings.length) return false
  writeJsonFile('collaborativeSongMappings.json', filtered)
  return true
}

export function getPrimaryUserIdForCollaborativeSong(songName: string, artistString: string): string | null {
  const mappings = getCollaborativeSongMappings()
  const normalized = `${songName.toLowerCase()}_${artistString.toLowerCase()}`
  const mapping = mappings.find(m => 
    `${m.songName.toLowerCase()}_${m.artistString.toLowerCase()}` === normalized
  )
  return mapping?.primaryUserId || null
}

// Release Readiness functions
export function getReleaseReadiness(artistId?: string): ReleaseReadiness[] {
  const data = readJsonFile<ReleaseReadiness>('releaseReadiness.json')
  return artistId ? data.filter(d => d.artistId === artistId) : data
}

export function getReleaseReadinessByArtistId(artistId: string): ReleaseReadiness | null {
  const data = getReleaseReadiness(artistId)
  return data.length > 0 ? data[0] : null
}

export function upsertReleaseReadiness(data: Omit<ReleaseReadiness, 'id' | 'lastUpdated'>): ReleaseReadiness {
  const allData = getReleaseReadiness()
  const existing = allData.find(d => d.artistId === data.artistId)
  
  if (existing) {
    existing.state = data.state
    if (data.decisionState !== undefined) existing.decisionState = data.decisionState
    if (data.releaseRequest !== undefined) existing.releaseRequest = data.releaseRequest
    if (data.decision !== undefined) existing.decision = data.decision
    existing.lastUpdated = new Date().toISOString()
    writeJsonFile('releaseReadiness.json', allData)
    return existing
  } else {
    const newData: ReleaseReadiness = {
      ...data,
      id: `rr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      lastUpdated: new Date().toISOString(),
    }
    allData.push(newData)
    writeJsonFile('releaseReadiness.json', allData)
    return newData
  }
}

export function addReleaseRequest(request: Omit<ReleaseRequest, 'id' | 'requestedAt' | 'status'>): ReleaseRequest {
  const allData = getReleaseReadiness()
  const existing = allData.find(d => d.artistId === request.artistId)
  
  const newRequest: ReleaseRequest = {
    ...request,
    id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    requestedAt: new Date().toISOString(),
    status: 'under_review',
  }
  
  if (existing) {
    existing.releaseRequest = newRequest
    existing.decisionState = 'UNDER_REVIEW'
    existing.lastUpdated = new Date().toISOString()
    writeJsonFile('releaseReadiness.json', allData)
  } else {
    const newReadiness: ReleaseReadiness = {
      id: `rr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      artistId: request.artistId,
      state: 'building', // Internal state
      decisionState: 'UNDER_REVIEW',
      releaseRequest: newRequest,
      lastUpdated: new Date().toISOString(),
    }
    allData.push(newReadiness)
    writeJsonFile('releaseReadiness.json', allData)
  }
  
  return newRequest
}

export function updateReleaseDecision(artistId: string, decision: ReleaseDecision): boolean {
  const allData = getReleaseReadiness()
  const existing = allData.find(d => d.artistId === artistId)
  
  if (!existing) return false
  
  existing.decision = decision
  existing.decisionState = decision.decision
  if (existing.releaseRequest) {
    existing.releaseRequest.status = 'decided'
  }
  existing.lastUpdated = new Date().toISOString()
  writeJsonFile('releaseReadiness.json', allData)
  return true
}

export function getReadinessExplanations(artistId?: string): ReadinessExplanation[] {
  const data = readJsonFile<ReadinessExplanation>('readinessExplanations.json')
  return artistId ? data.filter(d => d.artistId === artistId) : data
}

export function addReadinessExplanation(data: Omit<ReadinessExplanation, 'id' | 'generatedAt'>): ReadinessExplanation {
  const allData = getReadinessExplanations()
  const newData: ReadinessExplanation = {
    ...data,
    adminNotes: data.adminNotes || undefined,
    id: `re_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    generatedAt: new Date().toISOString(),
  }
  allData.push(newData)
  writeJsonFile('readinessExplanations.json', allData)
  return newData
}

export function getInstagramMetrics(artistId?: string): InstagramMetrics[] {
  const data = readJsonFile<InstagramMetrics>('instagramMetrics.json')
  return artistId ? data.filter(d => d.artistId === artistId) : data
}

/**
 * Add Instagram metrics, aggregating with existing metrics for the same date
 * When multiple screenshots are uploaded for the same date:
 * - Sums: views, saves, shares, comments, likes, interactions, watchTime, audience (total across all videos)
 * - Max: followers (uses most current count)
 * - Weighted average: completionRate (weighted by views)
 * - Simple average: retention, skipRate
 * This ensures goal-based scores and discovery metrics use aggregated totals
 */
export function addInstagramMetrics(data: Omit<InstagramMetrics, 'id'>): InstagramMetrics {
  const allData = getInstagramMetrics()
  
  // Check if there's already an entry for this artist and date
  const existingIndex = allData.findIndex(
    (m) => m.artistId === data.artistId && m.metricDate === data.metricDate
  )
  
  if (existingIndex >= 0) {
    // Aggregate with existing metrics - combine multiple screenshots for same date
    const existing = allData[existingIndex]
    
    // Sum counts (views, saves, shares, comments, likes, interactions, watchTime, audience)
    // These represent totals across all videos/posts for the date
    const totalViews = existing.views + (data.views || 0)
    const totalSaves = existing.saves + (data.saves || 0)
    const totalShares = existing.shares + (data.shares || 0)
    const totalComments = existing.comments + (data.comments || 0)
    const totalLikes = (existing.likes || 0) + (data.likes || 0)
    const totalInteractions = (existing.interactions || 0) + (data.interactions || 0)
    const totalWatchTime = (existing.watchTime || 0) + (data.watchTime || 0)
    const totalAudience = (existing.audience || 0) + (data.audience || 0)
    
    // Use max for followers (most current count)
    const maxFollowers = Math.max(existing.followers, data.followers || 0)
    
    // Calculate weighted averages for rates (weighted by views)
    const existingViews = existing.views || 0
    const newViews = data.views || 0
    const combinedViews = existingViews + newViews
    
    let avgCompletionRate = existing.completionRate || 0
    if (combinedViews > 0) {
      const existingWeight = existingViews / combinedViews
      const newWeight = newViews / combinedViews
      avgCompletionRate = (existing.completionRate || 0) * existingWeight + (data.completionRate || 0) * newWeight
    } else if (data.completionRate !== undefined) {
      avgCompletionRate = ((existing.completionRate || 0) + data.completionRate) / 2
    }
    
    // Simple average for retention and skipRate (if both exist)
    const avgRetention = existing.retention !== undefined && data.retention !== undefined
      ? (existing.retention + data.retention) / 2
      : existing.retention !== undefined ? existing.retention : data.retention
    
    const avgSkipRate = existing.skipRate !== undefined && data.skipRate !== undefined
      ? (existing.skipRate + data.skipRate) / 2
      : existing.skipRate !== undefined ? existing.skipRate : data.skipRate
    
    const aggregated: InstagramMetrics = {
      ...existing,
      views: totalViews,
      saves: totalSaves,
      shares: totalShares,
      comments: totalComments,
      likes: totalLikes > 0 ? totalLikes : undefined,
      interactions: totalInteractions > 0 ? totalInteractions : undefined,
      watchTime: totalWatchTime > 0 ? totalWatchTime : undefined,
      audience: totalAudience > 0 ? totalAudience : undefined,
      followers: maxFollowers,
      completionRate: avgCompletionRate,
      retention: avgRetention,
      skipRate: avgSkipRate,
      
      // Keep latest video info or combine (prefer new data)
      videoTitle: data.videoTitle || existing.videoTitle,
      videoLink: data.videoLink || existing.videoLink,
      
      // Keep manuallyAdded flag if either was manual
      manuallyAdded: existing.manuallyAdded || data.manuallyAdded,
      addedBy: data.addedBy || existing.addedBy,
    }
    
    // Update existing entry
    allData[existingIndex] = aggregated
    writeJsonFile('instagramMetrics.json', allData)
    return aggregated
  } else {
    // Create new entry
    const newData: InstagramMetrics = {
      ...data,
      id: `im_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    }
    allData.push(newData)
    writeJsonFile('instagramMetrics.json', allData)
    return newData
  }
}

export function deleteInstagramMetrics(id: string): boolean {
  const allData = getInstagramMetrics()
  const filtered = allData.filter(d => d.id !== id)
  if (filtered.length === allData.length) return false
  writeJsonFile('instagramMetrics.json', filtered)
  return true
}

export function getTikTokMetrics(artistId?: string): TikTokMetrics[] {
  const data = readJsonFile<TikTokMetrics>('tiktokMetrics.json')
  return artistId ? data.filter(d => d.artistId === artistId) : data
}

export function addTikTokMetrics(data: Omit<TikTokMetrics, 'id'>): TikTokMetrics {
  const allData = getTikTokMetrics()
  const newData: TikTokMetrics = {
    ...data,
    id: `tm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  }
  allData.push(newData)
  writeJsonFile('tiktokMetrics.json', allData)
  return newData
}

export function deleteTikTokMetrics(id: string): boolean {
  const allData = getTikTokMetrics()
  const filtered = allData.filter(d => d.id !== id)
  if (filtered.length === allData.length) return false
  writeJsonFile('tiktokMetrics.json', filtered)
  return true
}

export function getTikTokSongViews(songId?: string): TikTokSongViews[] {
  const data = readJsonFile<TikTokSongViews>('tiktokSongViews.json')
  return songId ? data.filter(d => d.songId === songId) : data
}

export function addTikTokSongViews(data: Omit<TikTokSongViews, 'id' | 'createdAt'>): TikTokSongViews {
  const allData = getTikTokSongViews()
  const newData: TikTokSongViews = {
    ...data,
    id: `tsv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
  }
  allData.push(newData)
  writeJsonFile('tiktokSongViews.json', allData)
  return newData
}

export function updateTikTokSongViews(id: string, updates: Partial<TikTokSongViews>): TikTokSongViews | null {
  const allData = getTikTokSongViews()
  const index = allData.findIndex(d => d.id === id)
  if (index === -1) return null
  
  allData[index] = { ...allData[index], ...updates }
  writeJsonFile('tiktokSongViews.json', allData)
  return allData[index]
}

export function deleteTikTokSongViews(id: string): boolean {
  const allData = getTikTokSongViews()
  const filtered = allData.filter(d => d.id !== id)
  if (filtered.length === allData.length) return false
  writeJsonFile('tiktokSongViews.json', filtered)
  return true
}

export function getSpotifySnapshots(artistId?: string, releaseId?: string): SpotifySnapshot[] {
  const data = readJsonFile<SpotifySnapshot>('spotifySnapshots.json')
  let filtered = artistId ? data.filter(d => d.artistId === artistId) : data
  if (releaseId) {
    filtered = filtered.filter(d => d.releaseId === releaseId)
  }
  return filtered
}

export function addSpotifySnapshot(data: Omit<SpotifySnapshot, 'id' | 'createdAt'>): SpotifySnapshot {
  const allData = getSpotifySnapshots()
  const newData: SpotifySnapshot = {
    ...data,
    id: `ss_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    lowConfidenceFlag: data.confidence < 0.7, // Flag if confidence is below 70%
  }
  allData.push(newData)
  writeJsonFile('spotifySnapshots.json', allData)
  return newData
}

export function deleteSpotifySnapshot(id: string): boolean {
  const allData = getSpotifySnapshots()
  const filtered = allData.filter(d => d.id !== id)
  if (filtered.length === allData.length) return false
  writeJsonFile('spotifySnapshots.json', filtered)
  return true
}

export function getPostReleaseEvaluations(releaseId?: string, artistId?: string): PostReleaseEvaluation[] {
  const data = readJsonFile<PostReleaseEvaluation>('postReleaseEvaluations.json')
  let filtered = data
  if (releaseId) {
    filtered = filtered.filter(d => d.releaseId === releaseId)
  }
  if (artistId) {
    filtered = filtered.filter(d => d.artistId === artistId)
  }
  return filtered
}

export function getStaffOverrides(artistId?: string): StaffOverride[] {
  const data = readJsonFile<StaffOverride>('staffOverrides.json')
  return artistId ? data.filter(d => d.artistId === artistId) : data
}

export function addStaffOverride(data: Omit<StaffOverride, 'id' | 'overriddenAt'>): StaffOverride {
  const allData = getStaffOverrides()
  const newData: StaffOverride = {
    ...data,
    id: `override_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    overriddenAt: new Date().toISOString(),
  }
  allData.push(newData)
  writeJsonFile('staffOverrides.json', allData)
  return newData
}

export function updateStaffOverrideOutcome(
  id: string,
  outcome: StaffOverride['outcome']
): StaffOverride | null {
  const allData = getStaffOverrides()
  const index = allData.findIndex(d => d.id === id)
  if (index === -1) return null
  
  allData[index].outcome = outcome
  writeJsonFile('staffOverrides.json', allData)
  return allData[index]
}

export function getPostDropHealth(releaseId?: string, artistId?: string): PostDropHealth[] {
  const data = readJsonFile<PostDropHealth>('postDropHealth.json')
  let filtered = data
  if (releaseId) {
    filtered = filtered.filter(d => d.releaseId === releaseId)
  }
  if (artistId) {
    filtered = filtered.filter(d => d.artistId === artistId)
  }
  return filtered
}

export function addPostDropHealth(data: Omit<PostDropHealth, 'id' | 'createdAt'>): PostDropHealth {
  const allData = getPostDropHealth()
  const newData: PostDropHealth = {
    ...data,
    id: `pdh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
  }
  allData.push(newData)
  writeJsonFile('postDropHealth.json', allData)
  return newData
}

export function updatePostDropHealth(
  id: string,
  updates: Partial<Omit<PostDropHealth, 'id' | 'releaseId' | 'artistId' | 'releaseDate' | 'createdAt'>>
): PostDropHealth | null {
  const allData = getPostDropHealth()
  const index = allData.findIndex(d => d.id === id)
  if (index === -1) return null
  
  allData[index] = { ...allData[index], ...updates }
  writeJsonFile('postDropHealth.json', allData)
  return allData[index]
}

export function getReleaseMemory(artistId: string): ReleaseMemory | null {
  const data = readJsonFile<ReleaseMemory>('releaseMemory.json')
  return data.find(d => d.artistId === artistId) || null
}

export function upsertReleaseMemory(data: Omit<ReleaseMemory, 'id' | 'lastUpdated'>): ReleaseMemory {
  const allData = readJsonFile<ReleaseMemory>('releaseMemory.json')
  const existing = allData.find(d => d.artistId === data.artistId)
  
  if (existing) {
    existing.successfulStates = data.successfulStates
    existing.failedStates = data.failedStates
    existing.laneRules = data.laneRules
    existing.personalRhythm = data.personalRhythm
    existing.insights = data.insights
    existing.lastUpdated = new Date().toISOString()
    writeJsonFile('releaseMemory.json', allData)
    return existing
  } else {
    const newData: ReleaseMemory = {
      ...data,
      id: `rm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      lastUpdated: new Date().toISOString(),
    }
    allData.push(newData)
    writeJsonFile('releaseMemory.json', allData)
    return newData
  }
}

export function addPostReleaseEvaluation(data: Omit<PostReleaseEvaluation, 'id' | 'evaluatedAt'>): PostReleaseEvaluation {
  const allData = getPostReleaseEvaluations()
  const newData: PostReleaseEvaluation = {
    ...data,
    id: `pre_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    evaluatedAt: new Date().toISOString(),
  }
  allData.push(newData)
  writeJsonFile('postReleaseEvaluations.json', allData)
  return newData
}

export function updatePostReleaseEvaluation(
  id: string,
  updates: Partial<Omit<PostReleaseEvaluation, 'id' | 'releaseId' | 'artistId' | 'releaseDate' | 'evaluatedAt'>>
): PostReleaseEvaluation | null {
  const allData = getPostReleaseEvaluations()
  const index = allData.findIndex(d => d.id === id)
  if (index === -1) return null
  
  allData[index] = { ...allData[index], ...updates }
  writeJsonFile('postReleaseEvaluations.json', allData)
  return allData[index]
}

// ==================== ARTIST GROWTH CENTER INTERFACES ====================

export interface ArtistGoal {
  id: string
  artistId: string
  type: 'followers' | 'engagement_rate' | 'views' | 'streams' | 'revenue' | 'collaborations' | 'custom'
  target: number
  current: number
  deadline: string
  description?: string
  createdAt: string
  completedAt?: string
  isCompleted: boolean
  progress: number // 0-100
}

export interface Milestone {
  id: string
  artistId: string
  type: 'followers' | 'engagement' | 'views' | 'streams' | 'revenue' | 'streak' | 'custom'
  value: number
  achievedAt: string
  title: string
  description?: string
  celebrated: boolean
}

export interface ContentPerformance {
  id: string
  artistId: string
  platform: 'instagram' | 'tiktok'
  contentType: 'reel' | 'post' | 'story' | 'carousel' | 'video'
  postedAt: string
  views: number
  likes: number
  comments: number
  shares: number
  saves: number
  engagementRate: number
  bestPostingHour?: number
  hashtags?: string[]
  caption?: string
  url?: string
}

export interface ContentCalendar {
  id: string
  artistId: string
  scheduledDate: string
  platform: 'instagram' | 'tiktok' | 'both'
  contentType: 'reel' | 'post' | 'story' | 'carousel' | 'video'
  title: string
  description?: string
  hashtags?: string[]
  status: 'draft' | 'scheduled' | 'posted' | 'cancelled'
  createdAt: string
  postedAt?: string
}

export interface AudienceInsight {
  id: string
  artistId: string
  insightType: 'demographics' | 'active_times' | 'growth_source' | 'quality_score' | 'interests'
  data: Record<string, any>
  generatedAt: string
  period: 'week' | 'month' | 'quarter' | 'year'
}

export interface ContentIdea {
  id: string
  artistId: string
  idea: string
  contentType: 'reel' | 'post' | 'story' | 'carousel' | 'video'
  reasoning: string
  suggestedHashtags?: string[]
  suggestedPostingTime?: string
  priority: 'high' | 'medium' | 'low'
  generatedAt: string
  used: boolean
  usedAt?: string
  performance?: {
    views?: number
    engagementRate?: number
  }
}

export interface Benchmark {
  id: string
  artistId: string
  metric: 'followers' | 'engagement_rate' | 'views' | 'growth_rate'
  artistValue: number
  industryAverage: number
  percentile: number // 0-100
  comparison: 'above' | 'below' | 'average'
  period: string
  generatedAt: string
}

export interface ActionItem {
  id: string
  artistId: string
  title: string
  description: string
  category: 'content' | 'engagement' | 'growth' | 'release' | 'collaboration' | 'optimization'
  priority: 'high' | 'medium' | 'low'
  dueDate?: string
  completed: boolean
  completedAt?: string
  createdAt: string
  impact?: 'high' | 'medium' | 'low'
  estimatedTime?: number // minutes
}

export interface HashtagPerformance {
  id: string
  artistId: string
  hashtag: string
  platform: 'instagram' | 'tiktok'
  usageCount: number
  avgEngagementRate: number
  bestPerformance?: {
    views: number
    engagementRate: number
    postedAt: string
  }
  lastUsed?: string
}

export interface CrossPlatformComparison {
  id: string
  artistId: string
  period: string
  instagram: {
    followers: number
    avgViews: number
    avgEngagementRate: number
    growthRate: number
  }
  tiktok: {
    followers: number
    avgViews: number
    avgEngagementRate: number
    growthRate: number
  }
  recommendation: string
  generatedAt: string
}

export interface EngagementResponse {
  id: string
  artistId: string
  platform: 'instagram' | 'tiktok'
  responseTime: number // minutes
  responseType: 'comment' | 'dm' | 'story_reply'
  engagementId: string
  respondedAt: string
}

export interface StoryPerformance {
  id: string
  artistId: string
  platform: 'instagram' | 'tiktok'
  postedAt: string
  views: number
  interactions: number
  exits: number
  completionRate: number
  contentType: 'photo' | 'video' | 'boomerang' | 'reel'
  url?: string
}

export interface CollaborationOpportunity {
  id: string
  artistId: string
  suggestedArtistId: string
  suggestedArtistName: string
  reason: string
  audienceOverlap: number // 0-100
  potentialReach: number
  collaborationType: 'duet' | 'remix' | 'feature' | 'cross_promo' | 'live'
  priority: 'high' | 'medium' | 'low'
  generatedAt: string
  status: 'pending' | 'contacted' | 'in_progress' | 'completed' | 'declined'
}

export interface RevenueProjection {
  id: string
  artistId: string
  period: 'month' | 'quarter' | 'year'
  projectedRevenue: number
  projectedStreams: number
  growthRate: number
  confidence: 'high' | 'medium' | 'low'
  basedOn: string[]
  generatedAt: string
  targetDate: string
}

export interface WeeklyGrowthReport {
  id: string
  artistId: string
  weekStart: string
  weekEnd: string
  summary: {
    followerGrowth: number
    engagementChange: number
    viewsChange: number
    topPerformingContent: string[]
    keyInsights: string[]
    recommendations: string[]
  }
  generatedAt: string
}

/** Admin/staff context for artist growth - ideas, strategy notes, AI conversation to help the artist */
export interface ArtistGrowthContext {
  artistId: string
  /** Staff-written brief: ideas, strategy, vision for this artist */
  contextBrief: string
  /** Recent AI conversation (staff talking to AI to refine understanding) - last 20 messages */
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>
  updatedAt: string
  updatedBy?: string
}

// ==================== STORAGE FUNCTIONS ====================

export function getArtistGrowthContext(artistId: string): ArtistGrowthContext | null {
  const allData = readJsonFile<ArtistGrowthContext>('artistGrowthContext.json')
  const found = allData.find(c => c.artistId === artistId)
  return found || null
}

export function upsertArtistGrowthContext(data: {
  artistId: string
  contextBrief?: string
  conversationHistory?: ArtistGrowthContext['conversationHistory']
  updatedBy?: string
}): ArtistGrowthContext {
  const allData = readJsonFile<ArtistGrowthContext>('artistGrowthContext.json')
  const index = allData.findIndex(c => c.artistId === data.artistId)
  const now = new Date().toISOString()
  const existing = index >= 0 ? allData[index] : null

  const updated: ArtistGrowthContext = {
    artistId: data.artistId,
    contextBrief: data.contextBrief ?? existing?.contextBrief ?? '',
    conversationHistory: data.conversationHistory ?? existing?.conversationHistory ?? [],
    updatedAt: now,
    updatedBy: data.updatedBy ?? existing?.updatedBy,
  }

  if (index >= 0) {
    allData[index] = updated
  } else {
    allData.push(updated)
  }
  writeJsonFile('artistGrowthContext.json', allData)
  return updated
}

export function appendGrowthContextConversation(
  artistId: string,
  role: 'user' | 'assistant',
  content: string,
  updatedBy?: string
): ArtistGrowthContext | null {
  const ctx = getArtistGrowthContext(artistId)
  const history = [...(ctx?.conversationHistory ?? []), { role, content, timestamp: new Date().toISOString() }]
  const trimmed = history.slice(-20)
  return upsertArtistGrowthContext({ artistId, conversationHistory: trimmed, updatedBy }) as ArtistGrowthContext
}

export function getArtistGoals(artistId: string): ArtistGoal[] {
  const allData = readJsonFile<ArtistGoal>('artistGoals.json')
  return allData.filter(g => g.artistId === artistId)
}

export function addArtistGoal(data: Omit<ArtistGoal, 'id' | 'createdAt' | 'isCompleted' | 'progress'>): ArtistGoal {
  const allData = readJsonFile<ArtistGoal>('artistGoals.json')
  const newGoal: ArtistGoal = {
    ...data,
    id: `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    isCompleted: false,
    progress: (data.current / data.target) * 100,
  }
  allData.push(newGoal)
  writeJsonFile('artistGoals.json', allData)
  return newGoal
}

export function updateArtistGoal(id: string, updates: Partial<ArtistGoal>): ArtistGoal | null {
  const allData = readJsonFile<ArtistGoal>('artistGoals.json')
  const index = allData.findIndex(g => g.id === id)
  if (index === -1) return null
  
  const updated = { ...allData[index], ...updates }
  if (updates.current !== undefined || updates.target !== undefined) {
    const current = updated.current ?? allData[index].current
    const target = updated.target ?? allData[index].target
    updated.progress = Math.min(100, (current / target) * 100)
    updated.isCompleted = updated.progress >= 100
    if (updated.isCompleted && !updated.completedAt) {
      updated.completedAt = new Date().toISOString()
    }
  }
  allData[index] = updated
  writeJsonFile('artistGoals.json', allData)
  return updated
}

export function getMilestones(artistId: string): Milestone[] {
  const allData = readJsonFile<Milestone>('milestones.json')
  return allData.filter(m => m.artistId === artistId).sort((a, b) => 
    new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime()
  )
}

export function addMilestone(data: Omit<Milestone, 'id' | 'achievedAt' | 'celebrated'>): Milestone {
  const allData = readJsonFile<Milestone>('milestones.json')
  const newMilestone: Milestone = {
    ...data,
    id: `milestone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    achievedAt: new Date().toISOString(),
    celebrated: false,
  }
  allData.push(newMilestone)
  writeJsonFile('milestones.json', allData)
  return newMilestone
}

export function getContentPerformance(artistId: string, limit?: number): ContentPerformance[] {
  const allData = readJsonFile<ContentPerformance>('contentPerformance.json')
  const filtered = allData.filter(c => c.artistId === artistId)
  return limit ? filtered.slice(0, limit) : filtered
}

export function addContentPerformance(data: Omit<ContentPerformance, 'id'>): ContentPerformance {
  const allData = readJsonFile<ContentPerformance>('contentPerformance.json')
  const newData: ContentPerformance = {
    ...data,
    id: `cp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  }
  allData.push(newData)
  writeJsonFile('contentPerformance.json', allData)
  return newData
}

export function getContentCalendar(artistId: string, startDate?: string, endDate?: string): ContentCalendar[] {
  const allData = readJsonFile<ContentCalendar>('contentCalendar.json')
  let filtered = allData.filter(c => c.artistId === artistId)
  
  if (startDate) {
    filtered = filtered.filter(c => new Date(c.scheduledDate) >= new Date(startDate))
  }
  if (endDate) {
    filtered = filtered.filter(c => new Date(c.scheduledDate) <= new Date(endDate))
  }
  
  return filtered.sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
}

export function addContentCalendar(data: Omit<ContentCalendar, 'id' | 'createdAt'>): ContentCalendar {
  const allData = readJsonFile<ContentCalendar>('contentCalendar.json')
  const newData: ContentCalendar = {
    ...data,
    id: `cal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
  }
  allData.push(newData)
  writeJsonFile('contentCalendar.json', allData)
  return newData
}

export function updateContentCalendar(id: string, updates: Partial<ContentCalendar>): ContentCalendar | null {
  const allData = readJsonFile<ContentCalendar>('contentCalendar.json')
  const index = allData.findIndex(c => c.id === id)
  if (index === -1) return null
  
  allData[index] = { ...allData[index], ...updates }
  writeJsonFile('contentCalendar.json', allData)
  return allData[index]
}

export function getAudienceInsights(artistId: string): AudienceInsight[] {
  const allData = readJsonFile<AudienceInsight>('audienceInsights.json')
  return allData.filter(a => a.artistId === artistId).sort((a, b) => 
    new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
  )
}

export function addAudienceInsight(data: Omit<AudienceInsight, 'id' | 'generatedAt'>): AudienceInsight {
  const allData = readJsonFile<AudienceInsight>('audienceInsights.json')
  const newData: AudienceInsight = {
    ...data,
    id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    generatedAt: new Date().toISOString(),
  }
  allData.push(newData)
  writeJsonFile('audienceInsights.json', allData)
  return newData
}

export function getContentIdeas(artistId: string, used?: boolean): ContentIdea[] {
  const allData = readJsonFile<ContentIdea>('contentIdeas.json')
  let filtered = allData.filter(c => c.artistId === artistId)
  if (used !== undefined) {
    filtered = filtered.filter(c => c.used === used)
  }
  return filtered.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
}

export function addContentIdea(data: Omit<ContentIdea, 'id' | 'generatedAt' | 'used'>): ContentIdea {
  const allData = readJsonFile<ContentIdea>('contentIdeas.json')
  const newData: ContentIdea = {
    ...data,
    id: `idea_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    generatedAt: new Date().toISOString(),
    used: false,
  }
  allData.push(newData)
  writeJsonFile('contentIdeas.json', allData)
  return newData
}

export function markContentIdeaUsed(id: string, performance?: ContentIdea['performance']): ContentIdea | null {
  const allData = readJsonFile<ContentIdea>('contentIdeas.json')
  const index = allData.findIndex(c => c.id === id)
  if (index === -1) return null
  
  allData[index] = {
    ...allData[index],
    used: true,
    usedAt: new Date().toISOString(),
    performance,
  }
  writeJsonFile('contentIdeas.json', allData)
  return allData[index]
}

export function getBenchmarks(artistId: string): Benchmark[] {
  const allData = readJsonFile<Benchmark>('benchmarks.json')
  return allData.filter(b => b.artistId === artistId).sort((a, b) => 
    new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
  )
}

export function addBenchmark(data: Omit<Benchmark, 'id' | 'generatedAt'>): Benchmark {
  const allData = readJsonFile<Benchmark>('benchmarks.json')
  const newData: Benchmark = {
    ...data,
    id: `bench_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    generatedAt: new Date().toISOString(),
  }
  allData.push(newData)
  writeJsonFile('benchmarks.json', allData)
  return newData
}

export function getActionItems(artistId: string, completed?: boolean): ActionItem[] {
  const allData = readJsonFile<ActionItem>('actionItems.json')
  let filtered = allData.filter(a => a.artistId === artistId)
  if (completed !== undefined) {
    filtered = filtered.filter(a => a.completed === completed)
  }
  return filtered.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    if (a.priority !== b.priority) {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })
}

export function addActionItem(data: Omit<ActionItem, 'id' | 'createdAt' | 'completed'>): ActionItem {
  const allData = readJsonFile<ActionItem>('actionItems.json')
  const newData: ActionItem = {
    ...data,
    id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    completed: false,
  }
  allData.push(newData)
  writeJsonFile('actionItems.json', allData)
  return newData
}

export function updateActionItem(id: string, updates: Partial<ActionItem>): ActionItem | null {
  const allData = readJsonFile<ActionItem>('actionItems.json')
  const index = allData.findIndex(a => a.id === id)
  if (index === -1) return null
  
  const updated = { ...allData[index], ...updates }
  if (updates.completed && !updated.completedAt) {
    updated.completedAt = new Date().toISOString()
  }
  allData[index] = updated
  writeJsonFile('actionItems.json', allData)
  return updated
}

export function getHashtagPerformance(artistId: string): HashtagPerformance[] {
  const allData = readJsonFile<HashtagPerformance>('hashtagPerformance.json')
  return allData.filter(h => h.artistId === artistId).sort((a, b) => 
    b.avgEngagementRate - a.avgEngagementRate
  )
}

export function addHashtagPerformance(data: Omit<HashtagPerformance, 'id'>): HashtagPerformance {
  const allData = readJsonFile<HashtagPerformance>('hashtagPerformance.json')
  const existing = allData.find(h => h.artistId === data.artistId && h.hashtag === data.hashtag && h.platform === data.platform)
  
  if (existing) {
    // Update existing
    existing.usageCount += data.usageCount
    existing.avgEngagementRate = (existing.avgEngagementRate + data.avgEngagementRate) / 2
    if (data.bestPerformance && (!existing.bestPerformance || data.bestPerformance.engagementRate > existing.bestPerformance.engagementRate)) {
      existing.bestPerformance = data.bestPerformance
    }
    existing.lastUsed = new Date().toISOString()
    writeJsonFile('hashtagPerformance.json', allData)
    return existing
  } else {
    const newData: HashtagPerformance = {
      ...data,
      id: `hashtag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    }
    allData.push(newData)
    writeJsonFile('hashtagPerformance.json', allData)
    return newData
  }
}

export function getCrossPlatformComparisons(artistId: string): CrossPlatformComparison[] {
  const allData = readJsonFile<CrossPlatformComparison>('crossPlatformComparisons.json')
  return allData.filter(c => c.artistId === artistId).sort((a, b) => 
    new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
  )
}

export function addCrossPlatformComparison(data: Omit<CrossPlatformComparison, 'id' | 'generatedAt'>): CrossPlatformComparison {
  const allData = readJsonFile<CrossPlatformComparison>('crossPlatformComparisons.json')
  const newData: CrossPlatformComparison = {
    ...data,
    id: `cpc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    generatedAt: new Date().toISOString(),
  }
  allData.push(newData)
  writeJsonFile('crossPlatformComparisons.json', allData)
  return newData
}

export function getEngagementResponses(artistId: string, limit?: number): EngagementResponse[] {
  const allData = readJsonFile<EngagementResponse>('engagementResponses.json')
  const filtered = allData.filter(e => e.artistId === artistId)
  return limit ? filtered.slice(0, limit) : filtered
}

export function addEngagementResponse(data: Omit<EngagementResponse, 'id'>): EngagementResponse {
  const allData = readJsonFile<EngagementResponse>('engagementResponses.json')
  const newData: EngagementResponse = {
    ...data,
    id: `er_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  }
  allData.push(newData)
  writeJsonFile('engagementResponses.json', allData)
  return newData
}

export function getStoryPerformance(artistId: string, limit?: number): StoryPerformance[] {
  const allData = readJsonFile<StoryPerformance>('storyPerformance.json')
  const filtered = allData.filter(s => s.artistId === artistId)
  return limit ? filtered.slice(0, limit) : filtered
}

export function addStoryPerformance(data: Omit<StoryPerformance, 'id'>): StoryPerformance {
  const allData = readJsonFile<StoryPerformance>('storyPerformance.json')
  const newData: StoryPerformance = {
    ...data,
    id: `story_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  }
  allData.push(newData)
  writeJsonFile('storyPerformance.json', allData)
  return newData
}

export function getCollaborationOpportunities(artistId: string): CollaborationOpportunity[] {
  const allData = readJsonFile<CollaborationOpportunity>('collaborationOpportunities.json')
  return allData.filter(c => c.artistId === artistId).sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })
}

export function addCollaborationOpportunity(data: Omit<CollaborationOpportunity, 'id' | 'generatedAt' | 'status'>): CollaborationOpportunity {
  const allData = readJsonFile<CollaborationOpportunity>('collaborationOpportunities.json')
  const newData: CollaborationOpportunity = {
    ...data,
    id: `collab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    generatedAt: new Date().toISOString(),
    status: 'pending',
  }
  allData.push(newData)
  writeJsonFile('collaborationOpportunities.json', allData)
  return newData
}

export function updateCollaborationOpportunity(id: string, updates: Partial<CollaborationOpportunity>): CollaborationOpportunity | null {
  const allData = readJsonFile<CollaborationOpportunity>('collaborationOpportunities.json')
  const index = allData.findIndex(c => c.id === id)
  if (index === -1) return null
  
  allData[index] = { ...allData[index], ...updates }
  writeJsonFile('collaborationOpportunities.json', allData)
  return allData[index]
}

export function getRevenueProjections(artistId: string): RevenueProjection[] {
  const allData = readJsonFile<RevenueProjection>('revenueProjections.json')
  return allData.filter(r => r.artistId === artistId).sort((a, b) => 
    new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
  )
}

export function addRevenueProjection(data: Omit<RevenueProjection, 'id' | 'generatedAt'>): RevenueProjection {
  const allData = readJsonFile<RevenueProjection>('revenueProjections.json')
  const newData: RevenueProjection = {
    ...data,
    id: `rev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    generatedAt: new Date().toISOString(),
  }
  allData.push(newData)
  writeJsonFile('revenueProjections.json', allData)
  return newData
}

export function getWeeklyGrowthReports(artistId: string, limit?: number): WeeklyGrowthReport[] {
  const allData = readJsonFile<WeeklyGrowthReport>('weeklyGrowthReports.json')
  const filtered = allData.filter(r => r.artistId === artistId).sort((a, b) => 
    new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime()
  )
  return limit ? filtered.slice(0, limit) : filtered
}

export function addWeeklyGrowthReport(data: Omit<WeeklyGrowthReport, 'id' | 'generatedAt'>): WeeklyGrowthReport {
  const allData = readJsonFile<WeeklyGrowthReport>('weeklyGrowthReports.json')
  const newData: WeeklyGrowthReport = {
    ...data,
    id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    generatedAt: new Date().toISOString(),
  }
  allData.push(newData)
  writeJsonFile('weeklyGrowthReports.json', allData)
  return newData
}
