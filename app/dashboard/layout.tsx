'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import Sidebar from '@/components/Sidebar'
import VersionRefresh from '@/components/VersionRefresh'
import NotificationManager from '@/components/NotificationManager'
import NotificationPermissionPopup from '@/components/NotificationPermissionPopup'
import NotificationDropdown from '@/components/NotificationDropdown'
import SupportChatPopup from '@/components/SupportChatPopup'
import MiniAudioPlayer from '@/components/MiniAudioPlayer'
import Footer from '@/components/Footer'
import { DashboardCommandProvider } from '@/components/DashboardCommandMenu'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute>
      <DashboardCommandProvider>
        <VersionRefresh />
        <Sidebar />
        {/* Sidebar is a sibling (fixed). Shell is not min-h-screen/flex-1 so main doesn’t stretch into an empty band. */}
        <div className="dashboard-canvas w-full overflow-x-hidden">
          <main
            className="relative z-[2] w-full max-w-full p-3 pt-20 sm:pt-16 sm:p-4 md:pl-7 md:pr-5 md:pt-5 lg:pl-10 lg:pr-8 lg:pt-6 pb-12 sm:pb-16 transition-all duration-300"
            style={{
              marginLeft: 'var(--sidebar-width, 0px)',
              width: 'calc(100% - var(--sidebar-width, 0px))',
              maxWidth: '100%',
            }}
          >
            {children}
          </main>
          <Footer />
          {/* Notification bell for mobile - fixed position */}
          <div className="fixed right-4 top-4 z-50 lg:hidden">
            <NotificationDropdown onNotificationClick={() => {}} />
          </div>
          <NotificationManager />
          <NotificationPermissionPopup />
          <SupportChatPopup />
          <MiniAudioPlayer />
        </div>
      </DashboardCommandProvider>
    </ProtectedRoute>
  )
}

