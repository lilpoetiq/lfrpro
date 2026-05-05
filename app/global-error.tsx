'use client'

import { Phone, FileText, AlertTriangle } from 'lucide-react'
import { SUPPORT_PHONE, CATALOG_BACKUP_URL } from '@/lib/errorRecovery'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en" className="dark" style={{ backgroundColor: '#000000' }}>
      <body className="bg-black text-white" style={{ backgroundColor: '#000000', color: '#ffffff', margin: 0, padding: 0 }}>
        <div className="min-h-screen flex items-center justify-center bg-black p-4">
          <div className="text-center max-w-lg mx-auto p-8 space-y-6">
            <h2 className="text-2xl font-bold text-white">Something went wrong</h2>
            <p className="text-slate-400">{error.message || 'An unexpected error occurred'}</p>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-left">
              <p className="text-amber-400 font-semibold flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4" />
                Important
              </p>
              <p className="text-slate-300 text-sm">Do not touch or modify what&apos;s broken. Contact support.</p>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-4">
              <p className="text-slate-400 text-sm mb-2">Contact support:</p>
              <a href={`tel:${SUPPORT_PHONE}`} className="inline-flex items-center gap-2 text-lg font-semibold text-red-400 hover:text-red-300">
                <Phone className="w-5 h-5" />
                {SUPPORT_PHONE}
              </a>
            </div>

            <p className="text-slate-500 text-sm">If the site is down, use the catalog backup:</p>
            <a
              href={CATALOG_BACKUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-sm"
            >
              <FileText className="w-4 h-4" />
              Label Catalog Backup (Google Doc)
            </a>

            <div className="flex flex-wrap gap-3 justify-center pt-4">
              <button
                onClick={reset}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-6 rounded-lg transition"
              >
                Try again
              </button>
              <a
                href="/dashboard"
                className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-6 rounded-lg transition inline-block"
              >
                Go to Dashboard
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}

