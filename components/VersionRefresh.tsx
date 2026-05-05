'use client'

import { useEffect } from 'react'

const STORAGE_KEY = 'lfr_app_version'

/**
 * Fetches current version from server (avoids cached client code).
 * When version changes, force a hard reload to clear cached old bundles.
 * Fixes "old versions popping up" when delete/save wasn't persisting.
 */
export default function VersionRefresh() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false
    fetch('/api/version', { cache: 'no-store' })
      .then((r) => r.json())
      .then(({ version }) => {
        if (cancelled) return
        try {
          const stored = localStorage.getItem(STORAGE_KEY)
          if (!stored) {
            localStorage.setItem(STORAGE_KEY, version)
            return
          }
          if (stored !== version) {
            localStorage.setItem(STORAGE_KEY, version)
            window.location.reload()
          }
        } catch {
          // Ignore localStorage errors
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])
  return null
}
