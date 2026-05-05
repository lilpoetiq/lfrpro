'use client'

import dynamic from 'next/dynamic'

// Dynamically import SidebarClient to avoid SSR issues with usePathname
const SidebarClient = dynamic(() => import('./SidebarClient'), {
  ssr: false,
  loading: () => (
    <div className="fixed left-0 top-0 h-screen w-[200px] bg-zinc-950/95 backdrop-blur-md border-r border-white/[0.06] flex items-center justify-center">
      <div className="animate-spin rounded-full h-7 w-7 border-2 border-zinc-600 border-t-zinc-300"></div>
    </div>
  ),
})

export default function Sidebar() {
  return <SidebarClient />
}
