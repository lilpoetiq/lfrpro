export type UserRole = 'artist' | 'manager' | 'admin' | 'producer'

export interface User {
  id: string
  username?: string
  email: string
  name: string
  role: UserRole
  artistName?: string // Stage/artist name (e.g., "OD Sleep")
  realName?: string // Real name (e.g., "Loyce")
  aliases?: string[] // Alternative names/aliases
  phoneNumber?: string // Phone number for AI/iMessage integration
  linkedArtistIds?: string[] // For managers: IDs of artists they manage
  staffPermissions?: string[] // For staff-users (who may still be artists): what staff actions they can perform
  staffManagedArtistIds?: string[] // For staff-users: which artist user IDs they are allowed to manage
  lastActive?: string // ISO timestamp of last activity
}

export interface StreamingStats {
  spotify: {
    streams: number
    listeners: number
    growth: number
  }
  appleMusic: {
    streams: number
    listeners: number
    growth: number
  }
}

export interface SocialMetrics {
  instagram: {
    followers: number
    engagement: number
    growth: number
  }
  twitter: {
    followers: number
    engagement: number
    growth: number
  }
  tiktok: {
    followers: number
    engagement: number
    growth: number
  }
}

export interface Release {
  id: string
  title: string
  artist: string
  releaseDate: string
  status: 'upcoming' | 'released'
  type: 'single' | 'album' | 'ep'
}

export interface Revenue {
  total: number
  streaming: number
  merchandise: number
  live: number
  other: number
  period: string
}

export interface Artist {
  id: string
  name: string
  email: string
  managerId?: string
  streamingStats: StreamingStats
  socialMetrics: SocialMetrics
  revenue: Revenue
  releases: Release[]
}

export interface Task {
  id: string
  title: string
  description: string
  dueDate: string
  completed: boolean
  releaseId: string
}

export interface Message {
  id: string
  from: string
  to: string
  subject: string
  message: string
  timestamp: string
  read: boolean
}

