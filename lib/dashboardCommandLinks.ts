/**
 * Nav destinations for the in-app command palette (⌘K). Kept in sync with SidebarClient default nav.
 */

export type CommandLink = { name: string; href: string; keywords?: string }

const artists: CommandLink[] = [
  { name: 'Dashboard', href: '/dashboard', keywords: 'home' },
  { name: 'My Calendar', href: '/dashboard/calendar', keywords: 'schedule' },
  { name: 'AI Chat', href: '/dashboard/ai-chat' },
  { name: 'Submit Release', href: '/dashboard/submit-release', keywords: 'upload release' },
  { name: 'Artist Growth Center', href: '/dashboard/release-readiness' },
  { name: 'Browse Beats', href: '/dashboard/beats/browse' },
  { name: 'Streaming Stats', href: '/dashboard/streaming' },
  { name: 'Releases', href: '/dashboard/releases' },
  { name: 'Revenue', href: '/dashboard/revenue' },
  { name: 'My Catalog', href: '/dashboard/catalog' },
  { name: 'My Contracts', href: '/dashboard/contracts' },
  { name: 'Guides & Handbooks', href: '/dashboard/guides' },
  { name: 'Updates', href: '/dashboard/updates' },
]

const staff: CommandLink[] = [
  { name: 'Dashboard', href: '/dashboard', keywords: 'home' },
  { name: 'My Calendar', href: '/dashboard/calendar' },
  { name: 'AI Chat', href: '/dashboard/ai-chat' },
  { name: 'All Artists', href: '/dashboard/artists' },
  { name: 'Catalog', href: '/dashboard/catalog' },
  { name: 'My Change Requests', href: '/dashboard/change-requests' },
  { name: 'Vault', href: '/dashboard/vault' },
  { name: 'Analytics', href: '/dashboard/analytics' },
  { name: 'Artist Growth Center', href: '/dashboard/release-readiness' },
  { name: 'Release Schedule', href: '/dashboard/release-schedule' },
  { name: 'Tasks', href: '/dashboard/tasks' },
  { name: 'Activity Log', href: '/dashboard/activity-log' },
  { name: 'Guides & Handbooks', href: '/dashboard/guides' },
  { name: 'Updates', href: '/dashboard/updates' },
]

const manager: CommandLink[] = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'My Calendar', href: '/dashboard/calendar' },
  { name: 'AI Chat', href: '/dashboard/ai-chat' },
  { name: 'My Artists', href: '/dashboard/manager-artists' },
  { name: 'All Artists', href: '/dashboard/artists' },
  { name: 'Catalog', href: '/dashboard/catalog' },
  { name: 'Tasks', href: '/dashboard/tasks' },
  { name: 'Communication', href: '/dashboard/communication' },
  { name: 'Contracts', href: '/dashboard/contracts' },
  { name: 'Change Requests', href: '/dashboard/change-requests' },
  { name: 'Guides & Handbooks', href: '/dashboard/guides' },
  { name: 'Updates', href: '/dashboard/updates' },
]

const admin: CommandLink[] = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'My Calendar', href: '/dashboard/calendar' },
  { name: 'AI Chat', href: '/dashboard/ai-chat' },
  { name: 'All Artists', href: '/dashboard/artists' },
  { name: 'Catalog', href: '/dashboard/catalog' },
  { name: 'Analytics', href: '/dashboard/analytics' },
  { name: 'Artist Growth Center', href: '/dashboard/release-readiness' },
  { name: 'Vault', href: '/dashboard/vault' },
  { name: 'Contracts', href: '/dashboard/contracts' },
  { name: 'Change Requests', href: '/dashboard/change-requests' },
  { name: 'Upload Data', href: '/dashboard/upload' },
  { name: 'AI Insights', href: '/dashboard/insights' },
  { name: 'Release Schedule', href: '/dashboard/release-schedule' },
  { name: 'Users', href: '/dashboard/users' },
  { name: 'Feature Requests', href: '/dashboard/feature-requests' },
  { name: 'Tasks', href: '/dashboard/tasks' },
  { name: 'Activity Log', href: '/dashboard/activity-log' },
  { name: 'Guides & Handbooks', href: '/dashboard/guides' },
  { name: 'Updates', href: '/dashboard/updates' },
  { name: 'Beats', href: '/dashboard/beats' },
  { name: 'Notifications', href: '/dashboard/notifications' },
  { name: 'Submit Release', href: '/dashboard/submit-release' },
  { name: 'Streaming', href: '/dashboard/streaming' },
  { name: 'Releases', href: '/dashboard/releases' },
  { name: 'Revenue', href: '/dashboard/revenue' },
  { name: 'Error logs', href: '/dashboard/error-logs', keywords: 'errors' },
]

const producer: CommandLink[] = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'My Calendar', href: '/dashboard/calendar' },
  { name: 'Catalog', href: '/dashboard/catalog' },
]

export function getDashboardCommandLinks(input: {
  role?: string
  isStaff: boolean
  staffViewMode: 'staff' | 'artist' | string
}): CommandLink[] {
  const { role, isStaff, staffViewMode } = input
  if (role === 'artist' && isStaff && staffViewMode === 'staff') {
    return staff
  }
  if (role === 'artist') {
    return artists
  }
  if (role === 'manager') {
    return manager
  }
  if (role === 'producer') {
    return producer
  }
  return admin
}

export function filterCommandLinks(links: CommandLink[], q: string): CommandLink[] {
  const s = q.trim().toLowerCase()
  if (!s) return links
  return links.filter((item) => {
    const name = item.name.toLowerCase()
    const href = item.href.toLowerCase()
    const kw = (item.keywords || '').toLowerCase()
    return name.includes(s) || href.includes(s) || kw.includes(s)
  })
}
