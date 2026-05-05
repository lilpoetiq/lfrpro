'use client'

import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { AudioPlayerProvider } from '@/contexts/AudioPlayerContext'
import RemoveWebpackIndicator from '@/components/RemoveWebpackIndicator'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AudioPlayerProvider>
          <RemoveWebpackIndicator />
          {children}
        </AudioPlayerProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}

