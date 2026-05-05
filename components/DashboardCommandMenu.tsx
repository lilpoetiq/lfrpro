'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Search, CornerDownLeft, ArrowUp, ArrowDown } from 'lucide-react'
import { getDashboardCommandLinks, filterCommandLinks, type CommandLink } from '@/lib/dashboardCommandLinks'

type CmdCtx = { openCommandMenu: () => void; closeCommandMenu: () => void; toggleCommandMenu: () => void }
const Ctx = createContext<CmdCtx | null>(null)

export function useDashboardCommand(): CmdCtx {
  const v = useContext(Ctx)
  if (!v) {
    return {
      openCommandMenu: () => {},
      closeCommandMenu: () => {},
      toggleCommandMenu: () => {},
    }
  }
  return v
}

export function DashboardCommandProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const value = useMemo<CmdCtx>(
    () => ({
      openCommandMenu: () => setOpen(true),
      closeCommandMenu: () => setOpen(false),
      toggleCommandMenu: () => setOpen((o) => !o),
    }),
    []
  )
  return (
    <Ctx.Provider value={value}>
      {children}
      <GlobalCommandMenuHotkey open={open} />
      {open && <CommandMenu onClose={() => setOpen(false)} />}
    </Ctx.Provider>
  )
}

/**
 * Listens for ⌘K / Ctrl+K globally while mounted (layout wraps dashboard).
 */
function CommandMenu({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const { user, staffViewMode } = useAuth()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const isStaff =
    user?.role === 'artist' &&
    Array.isArray(user?.staffPermissions) &&
    user.staffPermissions.length > 0

  const allLinks = useMemo(
    () =>
      getDashboardCommandLinks({
        role: user?.role,
        isStaff: !!isStaff,
        staffViewMode: staffViewMode || 'artist',
      }),
    [user?.role, isStaff, staffViewMode]
  )

  const filtered = useMemo(() => {
    const list = filterCommandLinks(allLinks, q)
    const seen = new Set<string>()
    return list.filter((item) => {
      if (seen.has(item.href)) return false
      seen.add(item.href)
      return true
    })
  }, [allLinks, q])

  const go = useCallback(
    (item: CommandLink) => {
      router.push(item.href)
      onClose()
    },
    [router, onClose]
  )

  useEffect(() => {
    setSel(0)
  }, [q, filtered.length])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSel((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSel((i) => Math.max(0, i - 1))
      }
      if (e.key === 'Enter' && filtered[sel]) {
        e.preventDefault()
        go(filtered[sel])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filtered, sel, go])

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${sel}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  const mod = typeof window !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.platform) ? '⌘' : 'Ctrl+'

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-3 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Go to page"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-3 border-b border-slate-800">
          <Search className="w-5 h-5 text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            type="search"
            autoComplete="off"
            autoCorrect="off"
            placeholder="Search pages… (e.g. calendar, catalog, vault)"
            className="flex-1 bg-transparent text-white placeholder:text-slate-500 focus:outline-none text-base"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') e.preventDefault()
            }}
          />
        </div>
        <ul ref={listRef} className="max-h-[min(50vh,360px)] overflow-y-auto py-1">
          {filtered.length === 0 && (
            <li className="px-4 py-6 text-slate-500 text-sm text-center">No pages match that search.</li>
          )}
          {filtered.map((item, i) => (
            <li key={`${item.href}-${item.name}`}>
              <button
                type="button"
                data-idx={i}
                onClick={() => go(item)}
                onMouseEnter={() => setSel(i)}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between gap-2 transition
                  ${i === sel ? 'bg-red-600/20 text-white' : 'text-slate-200 hover:bg-slate-800/80'}`}
              >
                <span>{item.name}</span>
                <span className="text-slate-500 text-xs font-mono truncate max-w-[45%]">{item.href.replace('/dashboard', '') || '/'}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="px-3 py-2 border-t border-slate-800 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <ArrowUp className="w-3 h-3" />
            <ArrowDown className="w-3 h-3" />
            move
          </span>
          <span className="inline-flex items-center gap-1">
            <CornerDownLeft className="w-3 h-3" />
            open
          </span>
          <span>Esc close</span>
          <span className="ml-auto text-slate-600">{mod}K to toggle</span>
        </div>
      </div>
    </div>
  )
}

/** Global ⌘K / Ctrl+K — must render inside {@link DashboardCommandProvider}. */
function GlobalCommandMenuHotkey({ open }: { open: boolean }) {
  const { toggleCommandMenu, closeCommandMenu } = useDashboardCommand()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        toggleCommandMenu()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [toggleCommandMenu])

  // Escape closes (when only palette uses capture for Cmd+K; Escape handled in CommandMenu)
  useEffect(() => {
    if (!open) return
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeCommandMenu()
      }
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [open, closeCommandMenu])

  return null
}
