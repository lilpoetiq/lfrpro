'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, UserRole } from '@/types'

interface AuthContextType {
  user: User | null
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  updateUserProfile: (updatedUser: Partial<User> & { id: string }) => void
  isLoading: boolean
  staffViewMode?: 'artist' | 'staff'
  setStaffViewMode: (mode: 'artist' | 'staff') => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Mock users database
const MOCK_USERS: User[] = [
  {
    id: '1',
    email: 'artist@lfr.com',
    name: 'Alex Johnson',
    role: 'artist',
  },
  {
    id: '2',
    email: 'manager@lfr.com',
    name: 'Sarah Williams',
    role: 'manager',
  },
  {
    id: '3',
    email: 'admin@lfr.com',
    name: 'Michael Chen',
    role: 'admin',
  },
]

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [staffViewMode, setStaffViewMode] = useState<'artist' | 'staff'>('artist')
  const router = useRouter()

  useEffect(() => {
    // Check for stored user session
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
    // Check for stored staff view mode
    const storedViewMode = localStorage.getItem('staffViewMode')
    if (storedViewMode === 'artist' || storedViewMode === 'staff') {
      setStaffViewMode(storedViewMode)
    }
    setIsLoading(false)
  }, [])

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (data.success && data.user) {
        setUser(data.user)
        localStorage.setItem('user', JSON.stringify(data.user))
        return true
      }
      return false
    } catch (error) {
      console.error('Login error:', error)
      return false
    }
  }

  const logout = async () => {
    // Log logout activity
    if (user) {
      try {
        await fetch('/api/activity-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'User logged out',
            user: user.name,
            userId: user.id,
            details: {
              username: user.username,
              role: user.role,
            },
            category: 'auth',
          }),
        })
      } catch (error) {
        console.error('Failed to log logout activity:', error)
      }
    }
    
    setUser(null)
    localStorage.removeItem('user')
    router.push('/login')
  }

  const handleSetStaffViewMode = (mode: 'artist' | 'staff') => {
    setStaffViewMode(mode)
    localStorage.setItem('staffViewMode', mode)
  }

  const updateUserProfile = (updatedUser: Partial<User> & { id: string }) => {
    if (!user || user.id !== updatedUser.id) return
    const merged = { ...user, ...updatedUser }
    setUser(merged)
    localStorage.setItem('user', JSON.stringify(merged))
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUserProfile, isLoading, staffViewMode, setStaffViewMode: handleSetStaffViewMode }}>
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

