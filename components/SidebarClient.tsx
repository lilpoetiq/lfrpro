'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard,
  Music,
  Users,
  Settings,
  BarChart3,
  Calendar,
  MessageSquare,
  Upload,
  Brain,
  Menu,
  X,
  Activity,
  FileText,
  Bot,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Minimize2,
  Maximize2,
  BookOpen,
  Target,
  Lightbulb,
} from 'lucide-react'
import ProfileModal from './ProfileModal'
import clsx from 'clsx'

interface NavItem {
  name: string
  href: string
  icon: any
  mobileOnly?: boolean
  badge?: string
  comingSoon?: boolean
}

type SidebarSize = 'hidden' | 'small' | 'medium' | 'large'

export default function SidebarClient() {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [pathname, setPathname] = useState('/dashboard')
  const [isEditingOrder, setIsEditingOrder] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [sidebarSize, setSidebarSize] = useState<SidebarSize>('medium')
  const [showSidebarButton, setShowSidebarButton] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const { user, staffViewMode, setStaffViewMode } = useAuth()

  const isStaff =
    user?.role === 'artist' &&
    Array.isArray(user?.staffPermissions) &&
    user.staffPermissions.length > 0

  const isOwner = user?.role === 'admin' && user?.name?.toLowerCase().includes('eric')
  const roleLabel = isOwner ? 'Owner' : isStaff ? 'Staff' : user?.role === 'artist' ? 'Artist' : (user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User')

  // Get sidebar width based on size
  const getSidebarWidth = (size: SidebarSize): string => {
    switch (size) {
      case 'hidden':
        return '0px'
      case 'small':
        return '64px' // Just wide enough for icons
      case 'medium':
        return '200px' // Compact but fits text
      case 'large':
        return '240px' // Slightly more space
      default:
        return '200px'
    }
  }

  // Get sidebar width classes
  const getSidebarWidthClasses = (size: SidebarSize): string => {
    switch (size) {
      case 'hidden':
        return 'w-0'
      case 'small':
        return 'w-16' // Just wide enough for icons (64px)
      case 'medium':
        return 'w-[200px]' // Compact but fits text
      case 'large':
        return 'w-[240px]' // Slightly more space
      default:
        return 'w-[200px]'
    }
  }

  // Update CSS variable when sidebar size changes or window resizes
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const updateSidebarWidth = () => {
      // On mobile (lg breakpoint = 1024px), sidebar is hidden by default
      const isMobile = window.innerWidth < 1024
      const width = isMobile ? '0px' : getSidebarWidth(sidebarSize)
      document.documentElement.style.setProperty('--sidebar-width', width)
    }
    
    // Initial load
    const savedSize = localStorage.getItem('sidebar_size') as SidebarSize | null
    const initialSize = (savedSize && ['hidden', 'small', 'medium', 'large'].includes(savedSize)) 
      ? savedSize 
      : 'medium'
    setSidebarSize(initialSize)
    
    // Set initial width
    updateSidebarWidth()
    
    // Update on resize
    window.addEventListener('resize', updateSidebarWidth)
    return () => window.removeEventListener('resize', updateSidebarWidth)
  }, [])
  
  // Update CSS variable when sidebarSize changes
  useEffect(() => {
    if (typeof window === 'undefined') return
    const isMobile = window.innerWidth < 1024
    const width = isMobile ? '0px' : getSidebarWidth(sidebarSize)
    document.documentElement.style.setProperty('--sidebar-width', width)
  }, [sidebarSize])

  // Save sidebar size preference
  const handleSizeChange = (newSize: SidebarSize) => {
    setSidebarSize(newSize)
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebar_size', newSize)
      // Update CSS variable for main content margin
      // On mobile, always set to 0px
      const isMobile = window.innerWidth < 1024
      const width = isMobile ? '0px' : getSidebarWidth(newSize)
      document.documentElement.style.setProperty('--sidebar-width', width)
    }
  }

  useEffect(() => {
    setMounted(true)
    
    // Get initial pathname from window.location
    if (typeof window !== 'undefined') {
      setPathname(window.location.pathname)
    }
    
    // Update pathname on navigation
    const updatePathname = () => {
      if (typeof window !== 'undefined') {
        setPathname(window.location.pathname)
      }
    }
    
    // Listen to popstate events (back/forward navigation)
    window.addEventListener('popstate', updatePathname)
    
    // Listen to pushstate/replacestate by intercepting history methods
    const originalPushState = window.history.pushState
    const originalReplaceState = window.history.replaceState
    
    window.history.pushState = function(...args) {
      originalPushState.apply(window.history, args)
      setTimeout(updatePathname, 0)
    }
    
    window.history.replaceState = function(...args) {
      originalReplaceState.apply(window.history, args)
      setTimeout(updatePathname, 0)
    }
    
    // Also check periodically for pathname changes (for Next.js client-side navigation)
    const intervalId = setInterval(() => {
      if (typeof window !== 'undefined' && window.location.pathname !== pathname) {
        setPathname(window.location.pathname)
      }
    }, 100)
    
    return () => {
      window.removeEventListener('popstate', updatePathname)
      window.history.pushState = originalPushState
      window.history.replaceState = originalReplaceState
      clearInterval(intervalId)
    }
  }, [pathname])

  // Normalize pathname for active state
  const activePathname = pathname

  const defaultArtistNav: NavItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'My Calendar', href: '/dashboard/calendar', icon: Calendar },
    { name: 'AI Chat', href: '/dashboard/ai-chat', icon: Bot },
    { name: 'Submit Release', href: '/dashboard/submit-release', icon: Upload },
    { name: 'Artist Growth Center', href: '/dashboard/release-readiness', icon: Target },
    { name: 'Browse Beats', href: '/dashboard/beats/browse', icon: Music },
    { name: 'Streaming Stats', href: '/dashboard/streaming', icon: BarChart3 },
    { name: 'Releases', href: '/dashboard/releases', icon: Music },
    { name: 'Revenue', href: '/dashboard/revenue', icon: BarChart3 },
    { name: 'My Catalog', href: '/dashboard/catalog', icon: Music },
    { name: 'My Contracts', href: '/dashboard/contracts', icon: FileText },
    { name: 'Guides & Handbooks', href: '/dashboard/guides', icon: BookOpen },
    { name: 'Updates', href: '/dashboard/updates', icon: FileText },
  ]

  const defaultStaffNav: NavItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'My Calendar', href: '/dashboard/calendar', icon: Calendar },
    { name: 'AI Chat', href: '/dashboard/ai-chat', icon: Bot },
    { name: 'All Artists', href: '/dashboard/artists', icon: Users },
    { name: 'Catalog', href: '/dashboard/catalog', icon: Music },
    { name: 'My Change Requests', href: '/dashboard/change-requests', icon: FileText },
    { name: 'Vault', href: '/dashboard/vault', icon: Music },
    { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    { name: 'Artist Growth Center', href: '/dashboard/release-readiness', icon: Target },
    { name: 'Release Schedule', href: '/dashboard/release-schedule', icon: Calendar },
    { name: 'Tasks', href: '/dashboard/tasks', icon: Calendar },
    { name: 'Activity Log', href: '/dashboard/activity-log', icon: Activity },
    { name: 'Guides & Handbooks', href: '/dashboard/guides', icon: BookOpen },
    { name: 'Updates', href: '/dashboard/updates', icon: FileText },
  ]

  const defaultManagerNav: NavItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'My Calendar', href: '/dashboard/calendar', icon: Calendar },
    { name: 'AI Chat', href: '/dashboard/ai-chat', icon: Bot },
    { name: 'My Artists', href: '/dashboard/manager-artists', icon: Users },
    { name: 'All Artists', href: '/dashboard/artists', icon: Users },
    { name: 'Catalog', href: '/dashboard/catalog', icon: Music },
    { name: 'Tasks', href: '/dashboard/tasks', icon: Calendar },
    { name: 'Communication', href: '/dashboard/communication', icon: MessageSquare },
    { name: 'Contracts', href: '/dashboard/contracts', icon: FileText },
    { name: 'Change Requests', href: '/dashboard/change-requests', icon: FileText },
    { name: 'Guides & Handbooks', href: '/dashboard/guides', icon: BookOpen },
    { name: 'Updates', href: '/dashboard/updates', icon: FileText },
  ]

  const defaultAdminNav: NavItem[] = [
    { name: 'Home', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Calendar', href: '/dashboard/calendar', icon: Calendar },
    { name: 'Ask AI', href: '/dashboard/ai-chat', icon: Bot },
    { name: 'Artists', href: '/dashboard/artists', icon: Users },
    { name: 'Catalog', href: '/dashboard/catalog', icon: Music },
    { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    { name: 'Growth', href: '/dashboard/release-readiness', icon: Target },
    { name: 'Vault', href: '/dashboard/vault', icon: Music },
    { name: 'Contracts', href: '/dashboard/contracts', icon: FileText },
    { name: 'Change requests', href: '/dashboard/change-requests', icon: FileText },
    { name: 'CSV import', href: '/dashboard/upload', icon: Upload },
    { name: 'Insights', href: '/dashboard/insights', icon: Brain },
    { name: 'Releases', href: '/dashboard/release-schedule', icon: Calendar },
    { name: 'Users', href: '/dashboard/users', icon: Users },
    { name: 'Ideas', href: '/dashboard/feature-requests', icon: Lightbulb },
    { name: 'Tasks', href: '/dashboard/tasks', icon: Calendar },
    { name: 'Activity', href: '/dashboard/activity-log', icon: Activity },
    { name: 'Guides', href: '/dashboard/guides', icon: BookOpen },
    { name: 'Updates', href: '/dashboard/updates', icon: FileText },
  ]

  const defaultProducerNav: NavItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'My Calendar', href: '/dashboard/calendar', icon: Calendar },
    { name: 'Catalog', href: '/dashboard/catalog', icon: Music },
  ]


  // Load saved order from localStorage
  const getSavedOrder = (role: string): number[] | null => {
    if (typeof window === 'undefined') return null
    const modeKey = role === 'artist' && isStaff ? `_${staffViewMode}` : ''
    const saved = localStorage.getItem(`sidebar_order_${role}${modeKey}`)
    return saved ? JSON.parse(saved) : null
  }

  // Save order to localStorage
  const saveOrder = (role: string, order: number[]) => {
    if (typeof window === 'undefined') return
    const modeKey = role === 'artist' && isStaff ? `_${staffViewMode}` : ''
    localStorage.setItem(`sidebar_order_${role}${modeKey}`, JSON.stringify(order))
  }

  // Get default nav based on role
  const getDefaultNav = (): NavItem[] => {
    let nav: NavItem[] = []
    if (user?.role === 'artist') {
      if (isStaff && staffViewMode === 'staff') nav = defaultStaffNav
      else nav = defaultArtistNav
    } else if (user?.role === 'manager') {
      nav = defaultManagerNav
    } else if (user?.role === 'producer') {
      nav = defaultProducerNav
    } else {
      nav = defaultAdminNav
    }
    
    return nav
  }

  // Apply saved order to nav items
  const applyOrder = (navItems: NavItem[], order: number[]): NavItem[] => {
    const ordered: NavItem[] = []
    order.forEach((index) => {
      if (navItems[index]) {
        ordered.push(navItems[index])
      }
    })
    // Add any items that weren't in the saved order (for new items)
    navItems.forEach((item, index) => {
      if (!order.includes(index)) {
        ordered.push(item)
      }
    })
    return ordered
  }

  // Initialize nav items with saved order
  const [navItems, setNavItems] = useState<NavItem[]>(() => {
    const defaultNav = getDefaultNav()
    if (user?.role) {
      const savedOrder = getSavedOrder(user.role)
      if (savedOrder) {
        return applyOrder(defaultNav, savedOrder)
      }
    }
    return defaultNav
  })

  // Update nav items when user changes
  useEffect(() => {
    if (!user?.role) return
    const defaultNav = getDefaultNav()
    const savedOrder = getSavedOrder(user.role)
    if (savedOrder) {
      setNavItems(applyOrder(defaultNav, savedOrder))
    } else {
      setNavItems(defaultNav)
    }
  }, [user?.role, staffViewMode, isStaff])

  // Handle drag start
  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  // Handle drag over
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newItems = [...navItems]
    const draggedItem = newItems[draggedIndex]
    newItems.splice(draggedIndex, 1)
    newItems.splice(index, 0, draggedItem)
    setNavItems(newItems)
    setDraggedIndex(index)
  }

  // Handle drag end
  const handleDragEnd = () => {
    if (user?.role && draggedIndex !== null) {
      const order = navItems.map((item, index) => {
        const defaultNav = getDefaultNav()
        const originalIndex = defaultNav.findIndex(
          (defaultItem) => defaultItem.href === item.href && defaultItem.name === item.name
        )
        return originalIndex >= 0 ? originalIndex : index
      })
      saveOrder(user.role, order)
    }
    setDraggedIndex(null)
  }

  // Move item up
  const moveItemUp = (index: number) => {
    if (index === 0) return
    const newItems = [...navItems]
    ;[newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]]
    setNavItems(newItems)
    if (user?.role) {
      const order = newItems.map((item) => {
        const defaultNav = getDefaultNav()
        const originalIndex = defaultNav.findIndex(
          (defaultItem) => defaultItem.href === item.href && defaultItem.name === item.name
        )
        return originalIndex >= 0 ? originalIndex : 0
      })
      saveOrder(user.role, order)
    }
  }

  // Move item down
  const moveItemDown = (index: number) => {
    if (index === navItems.length - 1) return
    const newItems = [...navItems]
    ;[newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]]
    setNavItems(newItems)
    if (user?.role) {
      const order = newItems.map((item) => {
        const defaultNav = getDefaultNav()
        const originalIndex = defaultNav.findIndex(
          (defaultItem) => defaultItem.href === item.href && defaultItem.name === item.name
        )
        return originalIndex >= 0 ? originalIndex : 0
      })
      saveOrder(user.role, order)
    }
  }

  // Reset to default order
  const resetOrder = () => {
    const defaultNav = getDefaultNav()
    setNavItems(defaultNav)
    if (user?.role) {
      localStorage.removeItem(`sidebar_order_${user.role}`)
    }
  }

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="fixed left-0 top-0 h-screen w-64 bg-black border-r border-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <>
      {/* Left edge hover zone - shows sidebar button when hidden */}
      {sidebarSize === 'hidden' && (
        <>
          {/* Invisible hover zone on the left edge */}
          <div
            className="hidden lg:block fixed left-0 top-0 w-8 h-screen z-40"
            onMouseEnter={() => setShowSidebarButton(true)}
            onMouseLeave={() => setShowSidebarButton(false)}
          />
          
          {/* Show sidebar button - appears on hover */}
          <div
            className={clsx(
              'hidden lg:flex fixed left-4 top-4 z-50 transition-all duration-200',
              showSidebarButton ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'
            )}
            onMouseEnter={() => setShowSidebarButton(true)}
            onMouseLeave={() => setShowSidebarButton(false)}
          >
            <button
              onClick={() => {
                handleSizeChange('medium')
                setShowSidebarButton(false)
              }}
              className="px-2.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-lg flex items-center space-x-1.5 transition-all text-sm"
              title="Show sidebar"
            >
              <Menu className="w-4 h-4" />
              <span className="text-xs font-medium">Menu</span>
            </button>
          </div>
        </>
      )}

      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-black border border-slate-900 rounded-lg text-white shadow-lg"
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={clsx(
          'fixed left-0 top-0 h-screen bg-zinc-950/90 backdrop-blur-md border-r border-white/[0.06] flex flex-col z-50 transition-all duration-300 shadow-[4px_0_40px_-12px_rgba(0,0,0,0.8)]',
          getSidebarWidthClasses(sidebarSize),
          sidebarSize === 'hidden' ? 'lg:hidden border-r-0' : '',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        style={{ width: sidebarSize === 'hidden' ? '0' : undefined }}
      >
        {sidebarSize !== 'hidden' && (
          <>
            <div className={clsx('p-5 border-b border-white/[0.06]', sidebarSize === 'small' && 'p-3')}>
              <div className="flex items-start justify-between gap-2">
                {sidebarSize === 'small' ? (
                  <Link
                    href="/dashboard"
                    className="font-label mx-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-red-950/50 bg-gradient-to-b from-red-950/40 to-black text-[0.72rem] leading-none text-white shadow-[0_0_24px_-4px_rgba(127,29,29,0.55)] ring-1 ring-white/10 transition hover:border-red-800/60 hover:ring-white/15"
                    title="Legendary Fyre Records"
                  >
                    LFR
                  </Link>
                ) : (
                  <Link
                    href="/dashboard"
                    className="group min-w-0 flex-1 rounded-lg py-0.5 pr-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600/40"
                  >
                    <div className="min-w-0 space-y-1.5">
                      <div
                        className="font-label text-[0.8125rem] uppercase leading-[1.12] tracking-wide text-white sm:text-[0.875rem]"
                        style={{
                          textShadow:
                            '0 0 14px rgba(185,28,28,0.28), 0 1px 0 rgba(0,0,0,0.9)',
                        }}
                      >
                        <span className="block">Legendary</span>
                        <span className="block text-red-100">Fyre</span>
                      </div>
                      <p className="font-sans text-[0.58rem] font-medium uppercase tracking-[0.28em] text-slate-400">
                        Records
                      </p>
                    </div>
                  </Link>
                )}
                {sidebarSize !== 'small' && (
                  <button
                    type="button"
                    onClick={() => setIsEditingOrder(!isEditingOrder)}
                    className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] rounded-md transition flex-shrink-0"
                    title={isEditingOrder ? 'Done editing' : 'Reorder sidebar items'}
                  >
                    {isEditingOrder ? <Check className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
                  </button>
                )}
              </div>
              {isEditingOrder && (
                <div className="mt-3 pt-3 border-t border-slate-800">
                  <button
                    onClick={resetOrder}
                    className="w-full text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg transition"
                  >
                    Reset to Default Order
                  </button>
                </div>
              )}
            </div>

            <nav className={clsx('flex-1 overflow-y-auto', sidebarSize === 'small' ? 'p-2 space-y-1' : 'p-3 space-y-1.5')}>
              {navItems.map((item, index): React.ReactNode => {
          const Icon = item.icon
          const isActive = activePathname === item.href
          const isMobileOnly = item.mobileOnly
          
          // Hide mobile-only items on desktop (lg and above)
          if (isMobileOnly) {
            return (
              <div
                key={item.name}
                draggable={isEditingOrder}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => isEditingOrder && handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={clsx(
                  'lg:hidden flex items-center space-x-2 rounded-lg transition',
                  isEditingOrder && 'cursor-move'
                )}
              >
                {isEditingOrder && (
                  <GripVertical className="w-4 h-4 text-slate-500 flex-shrink-0" />
                )}
              <Link
                href={item.href}
                onClick={(e) => {
                  if (item.comingSoon) {
                    e.preventDefault()
                  } else {
                    setIsOpen(false)
                  }
                }}
                className={clsx(
                  'flex-1 flex items-center space-x-3 px-4 py-3 rounded-xl transition-all',
                  isActive
                    ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md ring-1 ring-white/10'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-white',
                  item.comingSoon && 'opacity-60 cursor-not-allowed'
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarSize !== 'small' && (
                  <span className="font-medium flex items-center space-x-2">
                    <span>{item.name}</span>
                    {item.badge && (
                      <span className="px-1.5 py-0.5 text-xs font-semibold bg-red-600 text-white rounded">
                        {item.badge}
                      </span>
                    )}
                  </span>
                )}
              </Link>
              </div>
            )
          }
          
          return (
            <div
              key={item.name}
              draggable={isEditingOrder}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => isEditingOrder && handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={clsx(
                'flex items-center space-x-2 rounded-lg transition',
                isEditingOrder && 'cursor-move',
                draggedIndex === index && 'opacity-50'
              )}
            >
              {isEditingOrder && (
                <>
                  <GripVertical className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <div className="flex flex-col space-y-1">
                    <button
                      onClick={() => moveItemUp(index)}
                      disabled={index === 0}
                      className="p-1 text-slate-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => moveItemDown(index)}
                      disabled={index === navItems.length - 1}
                      className="p-1 text-slate-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                </>
              )}
              <Link
                href={item.href}
                onClick={(e) => {
                  if (item.comingSoon) {
                    e.preventDefault()
                  } else {
                    setIsOpen(false)
                  }
                }}
                className={clsx(
                  'flex-1 flex items-center rounded-xl transition-all duration-300 relative hover:-translate-y-px',
                  sidebarSize === 'small' ? 'justify-center px-2 py-2.5' : 'space-x-2.5 px-3 py-2.5',
                  isActive
                    ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md shadow-red-900/40 ring-1 ring-white/15'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-white',
                  item.comingSoon && 'opacity-60 cursor-not-allowed'
                )}
                title={sidebarSize === 'small' ? item.name : undefined}
              >
                <Icon className={clsx('flex-shrink-0', sidebarSize === 'small' ? 'w-5 h-5' : 'w-4 h-4')} />
                {sidebarSize !== 'small' && (
                  <span className="font-medium text-sm truncate flex items-center space-x-2">
                    <span>{item.name}</span>
                    {item.badge && (
                      <span className="px-1.5 py-0.5 text-xs font-semibold bg-red-600 text-white rounded flex-shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </span>
                )}
              </Link>
            </div>
          )
        })}
            </nav>

            <div className={clsx('p-4 border-t border-slate-900 space-y-2', sidebarSize === 'small' && 'p-2')}>
        {/* Sidebar Resize Controls */}
        {sidebarSize === 'small' ? (
          // When small, only show button to expand
          <div className="flex items-center justify-center mb-2 pb-2 border-b border-slate-800">
            <button
              onClick={() => handleSizeChange('medium')}
              className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition flex-shrink-0"
              title="Expand sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          // When medium/large, show all resize options
          <div className="flex items-center justify-between gap-1 mb-2 pb-2 border-b border-slate-800">
            <button
              onClick={() => handleSizeChange('hidden')}
              className={clsx(
                'p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition flex-shrink-0',
                // sidebarSize cannot be 'hidden' here because this block only renders when sidebar is visible
                false
              )}
              title="Hide sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleSizeChange('small')}
              className={clsx(
                'p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition flex-shrink-0',
                // sidebarSize cannot be 'small' here because this branch renders only when sidebarSize !== 'small'
                false
              )}
              title="Small"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleSizeChange('medium')}
              className={clsx(
                'p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition flex-shrink-0',
                sidebarSize === 'medium' && 'bg-slate-800 text-white'
              )}
              title="Medium"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleSizeChange('large')}
              className={clsx(
                'p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition flex-shrink-0',
                sidebarSize === 'large' && 'bg-slate-800 text-white'
              )}
              title="Large"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {sidebarSize !== 'small' ? (
          <button
            onClick={() => setShowProfileModal(true)}
            className="w-full px-3 py-2 text-left hover:bg-slate-800/50 rounded-lg transition group"
          >
            <p className="font-medium text-white text-sm truncate group-hover:text-blue-400 transition">
              {user?.name || 'User'}
            </p>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              {roleLabel}
            </p>
          </button>
        ) : (
          <button
            onClick={() => setShowProfileModal(true)}
            className="w-full flex items-center justify-center p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-900 rounded transition"
            title="Account & Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        )}

        {isStaff && sidebarSize !== 'small' && (
          <div className="px-3 pb-2">
            <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-2 py-2">
              <span className="text-[11px] text-slate-500">Mode</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setStaffViewMode('artist')}
                  className={clsx(
                    'text-[11px] px-2 py-1 rounded-md border transition',
                    staffViewMode === 'artist'
                      ? 'bg-slate-800 text-white border-slate-700'
                      : 'bg-transparent text-slate-500 border-slate-900 hover:text-white hover:border-slate-700'
                  )}
                >
                  Artist
                </button>
                <button
                  onClick={() => setStaffViewMode('staff')}
                  className={clsx(
                    'text-[11px] px-2 py-1 rounded-md border transition',
                    staffViewMode === 'staff'
                      ? 'bg-slate-800 text-white border-slate-700'
                      : 'bg-transparent text-slate-500 border-slate-900 hover:text-white hover:border-slate-700'
                  )}
                >
                  Staff
                </button>
              </div>
            </div>
          </div>
        )}
            </div>
          </>
        )}
      </div>

      <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
    </>
  )
}

