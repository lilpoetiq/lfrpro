/**
 * AI Notification Helper
 * Sends change notifications to the AI server so it can text admins/CEO
 */

const AI_SERVER_URL = (process.env as any).AI_SERVER_URL || 'http://localhost:3001';

export interface RecipientInfo {
  userId: string
  name: string
  phoneNumber?: string
  email?: string
  role: string
  artistName?: string
}

export interface ChangeNotification {
  event: string
  data: any
  notifyAdmins?: boolean
  notifyCEO?: boolean
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  timestamp?: string
  recipients?: RecipientInfo[] // Optional: explicitly specify recipients
  // If recipients not provided, AI server should fetch based on notifyAdmins/notifyCEO flags
}

/**
 * Notify AI server of a change (non-blocking)
 */
export async function notifyAIChange(notification: ChangeNotification): Promise<void> {
  // Send async without blocking
  setImmediate(async () => {
    try {
      // Add timestamp if not provided
      const notificationWithTimestamp = {
        ...notification,
        timestamp: notification.timestamp || new Date().toISOString(),
      }

      // Create timeout controller for older Node.js versions
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout (increased for reliability)
      
      try {
        const response = await fetch(`${AI_SERVER_URL}/api/webhook/change`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(notificationWithTimestamp),
          signal: controller.signal,
        });

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error')
          console.error(`[AI Notification] Failed to notify AI server: ${response.status} - ${errorText} - ${AI_SERVER_URL}`);
        } else {
          console.log(`[AI Notification] Successfully notified AI of: ${notification.event} (priority: ${notification.priority || 'medium'})`);
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        throw fetchError
      }
    } catch (error: any) {
      // Silently fail - don't block operations, but log for debugging
      if (error.name === 'AbortError' || error.message?.includes('timeout') || error.message?.includes('aborted')) {
        console.log(`[AI Notification] Timeout connecting to AI server at ${AI_SERVER_URL}`);
      } else if (error.message?.includes('ECONNREFUSED') || error.message?.includes('fetch failed')) {
        console.log(`[AI Notification] AI server unavailable at ${AI_SERVER_URL} - server may not be running`);
      } else {
        console.log(`[AI Notification] Error: ${error.message || error} - Server: ${AI_SERVER_URL}`);
      }
    }
  });
}

/**
 * Notify AI when a song is submitted
 */
export async function notifySongSubmitted(data: {
  songName: string
  artistName: string
  userId: string
  userName: string
  releaseDate?: string
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
  songsCount?: number // For albums/EPs
}): Promise<void> {
  await notifyAIChange({
    event: 'song_submitted',
    data: {
      ...data,
      // Format release date for better readability
      releaseDateFormatted: data.releaseDate ? new Date(data.releaseDate).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }) : undefined,
      // Calculate days until release
      daysUntilRelease: data.releaseDate ? Math.ceil(
        (new Date(data.releaseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ) : undefined,
    },
    notifyAdmins: true,
    notifyCEO: false,
    priority: 'high', // Release requests are high priority
  });
}

/**
 * Notify AI when a release is approved
 */
export async function notifyReleaseApproved(data: {
  songName: string
  artistName: string
  releaseDate?: string
  approvedBy: string
  songId?: string
  userId?: string
  releaseType?: 'single' | 'ep' | 'album'
}): Promise<void> {
  await notifyAIChange({
    event: 'release_approved',
    data: {
      ...data,
      releaseDateFormatted: data.releaseDate ? new Date(data.releaseDate).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }) : undefined,
      daysUntilRelease: data.releaseDate ? Math.ceil(
        (new Date(data.releaseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ) : undefined,
    },
    notifyAdmins: true,
    notifyCEO: false,
    priority: 'high',
  });
}

/**
 * Notify AI when a release is denied
 */
export async function notifyReleaseDenied(data: {
  songName: string
  artistName: string
  reason?: string
  deniedBy: string
  songId?: string
  userId?: string
  releaseDate?: string
  releaseType?: 'single' | 'ep' | 'album'
}): Promise<void> {
  await notifyAIChange({
    event: 'release_denied',
    data: {
      ...data,
      releaseDateFormatted: data.releaseDate ? new Date(data.releaseDate).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }) : undefined,
    },
    notifyAdmins: true,
    notifyCEO: false,
    priority: 'high',
  });
}

/**
 * Notify AI when streams are updated significantly
 */
export async function notifyStreamsUpdated(data: {
  songName: string
  artistName: string
  totalStreams: number
  oldStreams?: number
}): Promise<void> {
  // Only notify if significant change (e.g., >10% increase)
  const significantChange = data.oldStreams && 
    ((data.totalStreams - data.oldStreams) / data.oldStreams) > 0.1;
  
  if (significantChange || !data.oldStreams) {
    await notifyAIChange({
      event: 'streams_updated',
      data,
      notifyAdmins: false, // Don't spam admins for every stream update
      notifyCEO: false,
      priority: 'low',
    });
  }
}

/**
 * Notify AI when a deadline is approaching
 */
export async function notifyDeadlineApproaching(data: {
  item: string
  daysUntil: number
  type: 'release' | 'task' | 'contract' | 'other'
}): Promise<void> {
  const priority = data.daysUntil <= 1 ? 'urgent' : data.daysUntil <= 3 ? 'high' : 'medium';
  
  await notifyAIChange({
    event: 'deadline_approaching',
    data,
    notifyAdmins: true,
    notifyCEO: priority === 'urgent',
    priority,
  });
}

/**
 * Notify AI when a deadline is missed
 */
export async function notifyDeadlineMissed(data: {
  item: string
  daysOverdue: number
  type: 'release' | 'task' | 'contract' | 'other'
}): Promise<void> {
  await notifyAIChange({
    event: 'deadline_missed',
    data,
    notifyAdmins: true,
    notifyCEO: true,
    priority: 'urgent',
  });
}

/**
 * Notify AI when a phone number is added
 */
export async function notifyPhoneNumberAdded(data: {
  userName: string
  phoneNumber: string
  role: string
}): Promise<void> {
  await notifyAIChange({
    event: 'phone_number_added',
    data,
    notifyAdmins: true,
    notifyCEO: false,
    priority: 'low',
  });
}

/**
 * Notify AI about upcoming releases with incomplete checklists
 */
export async function notifyChecklistStatus(data: {
  releases: Array<{
    songName: string
    artistName: string
    releaseDate: string
    daysUntil: number
    completionPercentage: number
    untouched: boolean
  }>
}): Promise<void> {
  const urgentReleases = data.releases.filter(r => r.daysUntil <= 3)
  const soonReleases = data.releases.filter(r => r.daysUntil > 3 && r.daysUntil <= 7)
  
  const priority = urgentReleases.length > 0 ? 'urgent' : soonReleases.length > 0 ? 'high' : 'medium'
  
  await notifyAIChange({
    event: 'checklist_status',
    data,
    notifyAdmins: true,
    notifyCEO: urgentReleases.length > 0,
    priority,
  });
}

/**
 * Notify AI when catalog is updated
 */
export async function notifyCatalogUpdated(data: {
  songName: string
  artistName: string
  changes: string
}): Promise<void> {
  await notifyAIChange({
    event: 'catalog_updated',
    data,
    notifyAdmins: false, // Don't spam admins for every catalog update
    notifyCEO: false,
    priority: 'low',
  });
}/**
 * Notify AI when a song release is delayed
 */
export async function notifySongDelayed(data: {
  songName: string
  artistName: string
  delayReason?: string
  releaseDate?: string
  artistUserIds?: string[]
}): Promise<void> {
  await notifyAIChange({
    event: 'song_delayed',
    data,
    notifyAdmins: true,
    notifyCEO: false,
    priority: 'high',
  });
}

/**
 * Notify AI when a song delay is removed
 */
export async function notifySongDelayRemoved(data: {
  songName: string
  artistName: string
  releaseDate?: string
  artistUserIds?: string[]
}): Promise<void> {
  await notifyAIChange({
    event: 'song_delay_removed',
    data,
    notifyAdmins: false,
    notifyCEO: false,
    priority: 'medium',
  });
}/**
 * Notify AI when a song is updated (for artist notifications)
 */
export async function notifySongUpdated(data: {
  songName: string
  artistName: string
  changes: string[]
  releaseDate?: string
  artistUserIds?: string[]
}): Promise<void> {
  await notifyAIChange({
    event: 'song_updated',
    data,
    notifyAdmins: false,
    notifyCEO: false,
    priority: 'medium',
  });
}

/**
 * Notify AI when a checklist item is completed (for artist notifications)
 */
export async function notifyChecklistItemCompleted(data: {
  songName: string
  artistName: string
  task: string
  section: string
  completedBy?: string
  releaseDate?: string
  artistUserIds?: string[]
  songId?: string
}): Promise<void> {
  // Determine priority based on task importance
  const importantTasks = [
    'upload to distributor',
    'sent out to empire',
    'empire',
    'orchard',
    'release date',
    'cover art',
    'master',
    'distributor'
  ]
  
  const isImportant = importantTasks.some(keyword => 
    data.task.toLowerCase().includes(keyword)
  )
  
  await notifyAIChange({
    event: 'checklist_item_completed',
    data: {
      ...data,
      releaseDateFormatted: data.releaseDate ? new Date(data.releaseDate).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }) : undefined,
      daysUntilRelease: data.releaseDate ? Math.ceil(
        (new Date(data.releaseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ) : undefined,
    },
    notifyAdmins: isImportant, // Notify admins for important tasks
    notifyCEO: false,
    priority: isImportant ? 'high' : 'medium',
  });
}

/**
 * Notify AI when an artist has a question or needs support
 */
export async function notifyArtistQuestion(data: {
  question: string
  artistName: string
  artistId: string
  userName: string
  songName?: string
  songId?: string
  context?: string // Additional context (e.g., "Release Request Form", "Catalog Page", etc.)
  category?: 'release' | 'catalog' | 'checklist' | 'technical' | 'general'
  urgency?: 'low' | 'medium' | 'high' | 'urgent'
  contactMethod?: 'email' | 'sms' | 'both'
}): Promise<void> {
  const priority = data.urgency || 'high' // Questions are usually high priority
  
  await notifyAIChange({
    event: 'artist_question',
    data: {
      ...data,
      // Format question for better readability
      questionFormatted: data.question.trim(),
      timestamp: new Date().toISOString(),
    },
    notifyAdmins: true,
    notifyCEO: data.urgency === 'urgent', // Only notify CEO for urgent questions
    priority,
  });
}