'use client'

import { useAuth } from '@/contexts/AuthContext'
import ArtistDashboard from '@/components/dashboards/ArtistDashboard'
import ManagerDashboard from '@/components/dashboards/ManagerDashboard'
import AdminDashboard from '@/components/dashboards/AdminDashboard'
import ProducerDashboard from '@/components/dashboards/ProducerDashboard'

export default function DashboardPage() {
  const { user, isLoading, staffViewMode } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="text-center">
          <p className="text-slate-400">No user session</p>
        </div>
      </div>
    )
  }

  const isStaff =
    user.role === 'artist' &&
    Array.isArray(user?.staffPermissions) &&
    user.staffPermissions.length > 0

  if (isStaff) {
    if (staffViewMode === 'staff') {
      return <AdminDashboard />
    }
    return <ArtistDashboard />
  }

  if (user.role === 'artist') {
    return <ArtistDashboard />
  }
  if (user.role === 'manager') {
    return <ManagerDashboard />
  }
  if (user.role === 'admin') {
    return <AdminDashboard />
  }
  if (user.role === 'producer') {
    return <ProducerDashboard />
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-black">
      <div className="text-center">
        <p className="text-slate-400">Unknown user role</p>
      </div>
    </div>
  )
}
