'use client'

import React, { createContext, useContext, useEffect } from 'react'

interface ThemeContextType {
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Force dark mode always - remove any light mode preferences
    document.documentElement.classList.add('dark')
    localStorage.setItem('theme', 'dark')
    // Remove light mode class if it exists
    document.documentElement.classList.remove('light')
  }, [])

  return (
    <ThemeContext.Provider value={{ isDark: true }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

