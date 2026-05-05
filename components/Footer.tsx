'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { APP_NAME, APP_VERSION } from '@/lib/version'
import { useDashboardCommand } from '@/components/DashboardCommandMenu'
import { usePathname } from 'next/navigation'

export default function Footer() {
  const currentYear = new Date().getFullYear()
  const { user } = useAuth()
  const pathname = usePathname()
  const { openCommandMenu } = useDashboardCommand()
  const isDashboard = pathname?.startsWith('/dashboard')
  const isStaffOrOwner = user?.role === 'admin' || user?.role === 'manager' || (user?.role === 'artist' && Array.isArray(user?.staffPermissions) && user.staffPermissions.length > 0)

  return (
    <footer className="relative shrink-0 border-t border-slate-800 bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
          <p className="text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>© {currentYear} Legendary Fyre Records. All rights reserved.</span>
            {isDashboard && user && (
              <button
                type="button"
                onClick={openCommandMenu}
                title="Open quick nav (⌘K or Ctrl+K)"
                className="text-slate-400 hover:text-slate-300 underline decoration-slate-600 underline-offset-2"
              >
                Jump to page
              </button>
            )}
          </p>
          <div className="flex gap-4">
            <Link
              href="/terms-of-service"
              className="text-slate-500 hover:text-slate-400 transition"
            >
              Terms of Service
            </Link>
            <Link
              href="/privacy-policy"
              className="text-slate-500 hover:text-slate-400 transition"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
      {isStaffOrOwner && (
        <div className="fixed bottom-4 right-4 z-40">
          <Link
            href="/dashboard/updates"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/90 border border-slate-700 text-slate-400 hover:text-slate-300 hover:border-slate-600 text-[10px] font-mono transition"
            title="View changelog"
          >
            {APP_NAME} {APP_VERSION}
          </Link>
        </div>
      )}
    </footer>
  )
}
