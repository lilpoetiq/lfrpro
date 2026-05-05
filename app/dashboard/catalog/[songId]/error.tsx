'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SongError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error('Song page error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center max-w-md mx-auto p-8">
        <h2 className="text-2xl font-bold text-white mb-4">Error Loading Song</h2>
        <p className="text-slate-400 mb-6">{error.message || 'An error occurred while loading the song'}</p>
        <div className="flex space-x-4 justify-center">
          <button
            onClick={reset}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-6 rounded-lg transition"
          >
            Try again
          </button>
          <button
            onClick={() => router.push('/dashboard/catalog')}
            className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-6 rounded-lg transition"
          >
            Back to Catalog
          </button>
        </div>
      </div>
    </div>
  )
}



