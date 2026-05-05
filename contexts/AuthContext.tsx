'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { User } from '@/types'

/** Single local identity while real auth is redesigned. */
const GUEST_USER: User = {
  id: 'guest-local',
  username: 'guest',
  email: 'guest@local',
  name: 'Guest',
  role: 'admin',
}

interface AuthContextType {
  user: User | null
  logout: () => void
  updateUserProfile: (updatedUser: Partial<User> & { id: string }) => void
  isLoading: boolean
  staffViewMode?: 'artist' | 'staff'
  setStaffViewMode: (mode: 'artist' | 'staff') => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(GUEST_USER)
  const [isLoading, setIsLoading] = useState(true)
  const [staffViewMode, setStaffViewMode] = useState<'artist' | 'staff'>('artist')

  useEffect(() => {
    try {
      const storedViewMode = localStorage.getItem('staffViewMode')
      if (storedViewMode === 'artist' || storedViewMode === 'staff') {
        setStaffViewMode(storedViewMode)
      }
    } catch {
      localStorage.removeItem('staffViewMode')
    }
    try {
      localStorage.removeItem('user')
    } catch {
      /* ignore */
    }
    setIsLoading(false)
  }, [])

  const logout = () => {}

  const handleSetStaffViewMode = (mode: 'artist' | 'staff') => {
    setStaffViewMode(mode)
    try {
      localStorage.setItem('staffViewMode', mode)
    } catch {
      /* ignore */
    }
  }

  const updateUserProfile = (updatedUser: Partial<User> & { id: string }) => {
    if (!user || user.id !== updatedUser.id) return
    const merged = { ...user, ...updatedUser }
    setUser(merged)
    try {
      localStorage.setItem('user', JSON.stringify(merged))
    } catch {
      /* ignore */
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        logout,
        updateUserProfile,
        isLoading,
        staffViewMode,
        setStaffViewMode: handleSetStaffViewMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
